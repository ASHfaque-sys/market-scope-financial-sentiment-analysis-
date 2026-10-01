"""Evaluate the actual local quantized FinBERT ONNX model on the Twitter holdout.

Run ml/train.py first to create the grouped test split manifest.
"""
import json
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
import onnxruntime as ort
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from tokenizers import Tokenizer

ROOT = Path(__file__).resolve().parents[1]
model_dir = ROOT / 'public' / 'models' / 'finbert'
frame = pd.read_csv(ROOT / 'ml' / 'data' / 'split-manifest.csv')
frame = frame[(frame.split == 'test') & (frame.source == 'Twitter Financial News')]
tokenizer = Tokenizer.from_file(str(model_dir / 'tokenizer.json'))
tokenizer.enable_truncation(max_length=128)
options = ort.SessionOptions()
options.intra_op_num_threads = 4
session = ort.InferenceSession(str(model_dir / 'onnx' / 'model_quantized.onnx'), sess_options=options, providers=['CPUExecutionProvider'])
names = [item.name for item in session.get_inputs()]
labels = ['positive', 'negative', 'neutral']

def classify(texts):
    result = []
    for start in range(0, len(texts), 8):
        batch = tokenizer.encode_batch(texts[start:start+8])
        width = max(len(item.ids) for item in batch)
        inputs = {
            'input_ids': np.asarray([item.ids + [0]*(width-len(item.ids)) for item in batch], dtype=np.int64),
            'attention_mask': np.asarray([item.attention_mask + [0]*(width-len(item.ids)) for item in batch], dtype=np.int64),
            'token_type_ids': np.asarray([item.type_ids + [0]*(width-len(item.ids)) for item in batch], dtype=np.int64),
        }
        logits = session.run(None, {key:value for key,value in inputs.items() if key in names})[0]
        result.extend(labels[int(i)] for i in logits.argmax(axis=1))
        if start % 160 == 0: print(f'{start}/{len(texts)}', flush=True)
    return result

predictions = classify(frame.text.astype(str).tolist())
gold = frame.label.astype(str).tolist()
example = 'HDFC Bank ADRs Spike 4% As ICICI Group Veteran Anup Bagchi Gets CEO Charge'
encoded = tokenizer.encode(example)
inputs = {key: np.asarray([getattr(encoded, {'input_ids':'ids','attention_mask':'attention_mask','token_type_ids':'type_ids'}[key])], dtype=np.int64) for key in names}
logits = session.run(None, inputs)[0][0]
probs = np.exp(logits-logits.max()); probs /= probs.sum()
assert labels[int(probs.argmax())] == 'positive', 'HDFC ADR headline regression: expected positive sentiment'
report = {
    'model': 'Xenova/finbert, quantized ONNX conversion of ProsusAI/finbert',
    'model_revision': '8f269abebfdd9009d7d9b5e96af7e5c6bfe50b20',
    'evaluated_at': datetime.now(timezone.utc).isoformat(),
    'dataset': 'Grouped holdout from zeroshot/twitter-financial-news-sentiment',
    'count': len(gold),
    'accuracy': float(accuracy_score(gold, predictions)),
    'macro_f1': float(f1_score(gold, predictions, average='macro')),
    'classification_report': classification_report(gold,predictions,output_dict=True),
    'labels': ['negative','neutral','positive'],
    'confusion_matrix': confusion_matrix(gold,predictions,labels=['negative','neutral','positive']).tolist(),
    'example': {'text': example, 'probabilities':dict(zip(labels, map(float, probs))), 'label': labels[int(probs.argmax())]},
    'limitations': [
        'FinBERT was fine-tuned on Financial PhraseBank, so PhraseBank is excluded from this comparison.',
        'This Twitter holdout was not used to select or train FinBERT in this project, but pretraining or model-development overlap cannot be fully ruled out.',
        'No independently labelled Indian-financial-news set is available yet.',
        'Stock-specific impact, factual truth and market returns are not measured.'
    ]
}
path = ROOT / 'lib' / 'generated' / 'finbert-evaluation.json'
path.write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({key: report[key] for key in ['count','accuracy','macro_f1','example']}, indent=2),flush=True)
