"""Integration checks against the running local app; no model retraining."""
import concurrent.futures, json, sys
from pathlib import Path
import requests
BASE = sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:5173'
fixtures = json.loads((Path(__file__).parent/'parity-fixtures.json').read_text(encoding='utf-8'))
def check(fixture):
    r=requests.post(BASE+'/api/sentiment',json={'text':fixture['text']},timeout=60)
    r.raise_for_status(); actual=r.json()
    for label,want in zip(['negative','neutral','positive'],fixture['probabilities']):
        assert abs(actual['probabilities'][label]-want)<1e-7, (label,want,actual)
    assert abs(sum(actual['probabilities'].values())-1)<1e-9
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(check,fixtures))
print(f'PASS: Python/JavaScript prediction parity on {len(fixtures)} examples')
for text in ['', 'a', 'x'*2001, None, 42]:
    assert requests.post(BASE+'/api/sentiment',json={'text':text},timeout=30).status_code==400
assert requests.post(BASE+'/api/sentiment',data='{bad',timeout=30).status_code==400
assert requests.post(BASE+'/api/sentiment',data='a'*11000,timeout=30).status_code==413
assert requests.get(BASE+'/api/market?symbol=BAD',timeout=30).status_code==400
assert requests.get(BASE+'/api/market?range=BAD',timeout=30).status_code==400
assert requests.get(BASE+'/api/news?symbol=BAD',timeout=30).status_code==400
nonfinancial=requests.post(BASE+'/api/sentiment',json={'text':'The cricket team wins the final'},timeout=30).json()
assert nonfinancial['label']=='not financial' and not nonfinancial['relevant']
print('PASS: invalid inputs, oversized requests, unsupported symbols and nonfinancial text')
for symbol in ['RELIANCE.NS','INFY.NS']:
    market=requests.get(BASE+f'/api/market?symbol={symbol}&range=3M',timeout=60).json()
    assert market['symbol']==symbol
    assert market['price'] is not None, market['issues']
    assert len(market['history'])>20, len(market['history'])
    assert market['fundamentals']['eps']['value'] is not None
    assert market['fundamentals']['marketCap']['value'] is not None
    news=requests.get(BASE+f'/api/news?symbol={symbol}',timeout=60).json()
    assert news['items'],news['issues']
    print(f"PASS: {symbol} live price, {len(market['history'])} sessions, earnings and {len(news['items'])} headlines")
print('All integration checks passed.')
