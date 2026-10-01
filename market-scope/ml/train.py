"""Reproducible financial sentiment baseline; no generated training examples.
Run: python ml/train.py. Downloads source data, groups duplicates, trains and exports.
"""
from pathlib import Path
import collections, hashlib, io, json, re, zipfile
from datetime import datetime, timezone
import numpy as np
import pandas as pd
import requests
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.neighbors import NearestNeighbors

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'ml' / 'data'
DATA.mkdir(exist_ok=True)
OUT = ROOT / 'lib' / 'generated'
OUT.mkdir(parents=True, exist_ok=True)
sources = []

def download(repo, filename):
    revision = {'zeroshot/twitter-financial-news-sentiment':'ccbe24de388e287beb92dd393a335c376b350ac3',
                'takala/financial_phrasebank':'8d3fe0c36d5feec6b3cc5e455b0fcb4820fb9964'}[repo]
    url = f'https://huggingface.co/datasets/{repo}/resolve/{revision}/{filename}'
    path = DATA / filename.split('/')[-1]
    if not path.exists():
        response = requests.get(url, timeout=120)
        response.raise_for_status()
        path.write_bytes(response.content)
    sources.append({'repository': repo, 'file': filename, 'revision': revision,
                    'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'url': url})
    return path

def clean(text):
    text = re.sub(r'https?://\S+', ' ', str(text).lower())
    return ' '.join(re.findall(r'[a-z0-9]+', text))

rows = []
for file in ['sent_train.csv', 'sent_valid.csv']:
    frame = pd.read_csv(download('zeroshot/twitter-financial-news-sentiment', file))
    for row in frame.to_dict('records'):
        rows.append({'text': row['text'], 'label': {0:'negative',1:'positive',2:'neutral'}[int(row['label'])], 'source':'Twitter Financial News'})
archive = zipfile.ZipFile(download('takala/financial_phrasebank', 'data/FinancialPhraseBank-v1.0.zip'))
name = next(n for n in archive.namelist() if n.endswith('Sentences_50Agree.txt'))
for line in archive.read(name).decode('latin-1').splitlines():
    text, label = line.rsplit('@', 1)
    rows.append({'text':text, 'label':label, 'source':'Financial PhraseBank'})

raw_count = len(rows)
raw_source_counts = dict(collections.Counter(r['source'] for r in rows))
frame = pd.DataFrame(rows)
frame['normalized'] = frame.text.map(clean)
conflicts = frame.groupby('normalized').label.nunique()
conflicts = set(conflicts[conflicts > 1].index)
frame = frame[~frame.normalized.isin(conflicts)].drop_duplicates('normalized')
frame = frame[frame.normalized.str.len() > 5].reset_index(drop=True)
print(f'Raw: {raw_count}; unique unambiguous: {len(frame)}', flush=True)

# Group very similar stories before splitting; this vectorizer never enters the model.
group_text = frame.normalized.str.replace(r'\b\d+\b', 'number', regex=True)
dedup = TfidfVectorizer(ngram_range=(1,2), min_df=2, max_features=20000).fit_transform(group_text)
nn = NearestNeighbors(metric='cosine', algorithm='brute', n_jobs=2).fit(dedup)
parents = list(range(len(frame)))
def root(i):
    while parents[i] != i:
        parents[i] = parents[parents[i]]
        i = parents[i]
    return i
for start in range(0, len(frame), 400):
    neighbors = nn.radius_neighbors(dedup[start:start+400], radius=0.12, return_distance=False)
    for offset, indices in enumerate(neighbors):
        for j in indices:
            parents[root(int(j))] = root(start+offset)
groups = np.array([root(i) for i in range(len(frame))])
folds = np.zeros(len(frame), dtype=int)
for fold, (_, indices) in enumerate(StratifiedGroupKFold(10, shuffle=True, random_state=42).split(frame.text, frame.label, groups)):
    folds[indices] = fold
train, val, test = folds >= 2, folds == 1, folds == 0
assert not (set(groups[train]) & set(groups[test]))
assert not (set(groups[train]) & set(groups[val]))
assert not (set(groups[val]) & set(groups[test]))

vectorizer = TfidfVectorizer(preprocessor=clean, token_pattern=r'(?u)\b[a-z0-9]+\b',
                           ngram_range=(1,2), min_df=2, max_features=30000, sublinear_tf=True)
Xtrain = vectorizer.fit_transform(frame.text[train])
Xval = vectorizer.transform(frame.text[val])
best = None
trials = []
for c in [1.0, 4.0, 10.0]:
    model = LogisticRegression(C=c, class_weight='balanced', max_iter=1000, random_state=42)
    model.fit(Xtrain, frame.label[train])
    score = f1_score(frame.label[val], model.predict(Xval), average='macro')
    trials.append({'C':c, 'validation_macro_f1':float(score)})
    print(trials[-1], flush=True)
    if best is None or score > best[0]: best = (score, model)
model = best[1]
Xtest = vectorizer.transform(frame.text[test])
pred = model.predict(Xtest)
labels = model.classes_.tolist()
report = {
    'model':'TF-IDF unigrams + bigrams / balanced logistic regression',
    'trained_at':datetime.now(timezone.utc).isoformat(),
    'raw_count':raw_count, 'raw_source_counts':raw_source_counts,
    'unique_count':len(frame), 'removed_count':raw_count-len(frame),
    'conflicting_texts_removed':len(conflicts), 'duplicate_groups':len(set(groups)),
    'split_counts':{'train':int(train.sum()),'validation':int(val.sum()),'test':int(test.sum())},
    'class_counts':frame.label.value_counts().to_dict(),
    'feature_count':len(vectorizer.vocabulary_), 'seed':42, 'selected_C':model.C,
    'validation_trials':trials,
    'accuracy':float(accuracy_score(frame.label[test],pred)),
    'macro_f1':float(f1_score(frame.label[test],pred,average='macro')),
    'majority_accuracy':float((frame.label[test] == frame.label[train].mode()[0]).mean()),
    'classification_report':classification_report(frame.label[test],pred,output_dict=True),
    'labels':labels, 'confusion_matrix':confusion_matrix(frame.label[test],pred,labels=labels).tolist(),
    'source_results':{}, 'sources':sources,
    'limitations':[
        'English financial text only; no independent Indian-news benchmark has been labelled yet.',
        'Random grouped holdout, not a temporal backtest or an estimate of investment returns.',
        'The published Twitter splits are pooled and re-split with PhraseBank; scores are not directly comparable to its official benchmark.',
        'Near-duplicate grouping uses cosine similarity >= 0.88; semantic duplicates may remain.',
        'Probabilities are uncalibrated model estimates, not probabilities of profit or truth.',
        'Financial relevance is a conservative keyword gate, not a separately evaluated classifier.',
        'PhraseBank uses the >50% agreement subset; some labels are ambiguous.'
    ]
}
for source in frame.source.unique():
    mask = frame.source[test].to_numpy() == source
    report['source_results'][source] = {'count':int(mask.sum()),'macro_f1':float(f1_score(frame.label[test].to_numpy()[mask],pred[mask],average='macro'))}
payload = {'classes':labels, 'vocabulary':vectorizer.vocabulary_, 'idf':vectorizer.idf_.round(10).tolist(),
           'coefficients':model.coef_.round(10).tolist(), 'intercepts':model.intercept_.round(10).tolist()}
payload['vocabulary'] = {k:int(v) for k,v in payload['vocabulary'].items()}
(OUT/'sentiment-model.json').write_text(json.dumps(payload,separators=(',',':')),encoding='utf-8')
(OUT/'evaluation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
frame['split'] = np.where(train,'train',np.where(val,'validation','test'))
frame['group'] = groups
frame.to_csv(DATA/'split-manifest.csv',index=False)
fixtures = ['Company reports a sharp decline in quarterly profit','Bank profits rise as loan growth accelerates','Company announces annual general meeting on Monday','The cricket team wins the final','Profit increased but missed analyst expectations','Reliance shares plunge after earnings miss','Company is not profitable','Oil prices rise']
fixtures += frame.text[test].head(40).tolist()
(ROOT/'ml'/'parity-fixtures.json').write_text(json.dumps([{'text':t,'probabilities':p.tolist()} for t,p in zip(fixtures,model.predict_proba(vectorizer.transform(fixtures)))],indent=2),encoding='utf-8')
print(json.dumps({k:report[k] for k in ['split_counts','accuracy','macro_f1','source_results']},indent=2),flush=True)
