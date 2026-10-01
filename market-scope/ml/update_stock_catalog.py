"""Refresh the app's NSE equity directory from the official exchange CSV."""
import csv, hashlib, io, json, pathlib, urllib.request
from datetime import datetime, timezone

url = 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv'
request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'text/csv'})
with urllib.request.urlopen(request, timeout=40) as response:
    raw = response.read()
rows = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
stocks = []
seen = set()
for row in rows:
    symbol = row.get('SYMBOL', '').strip()
    name = row.get('NAME OF COMPANY', '').strip()
    series = row.get(' SERIES', row.get('SERIES', '')).strip()
    if series != 'EQ' or not symbol or not name or symbol in seen:
        continue
    seen.add(symbol)
    stocks.append({'symbol': f'{symbol}.NS', 'name': name, 'isin': row.get('ISIN NUMBER', '').strip()})
stocks.sort(key=lambda stock: stock['name'])
if len(stocks) < 2000:
    raise RuntimeError(f'Only {len(stocks)} EQ shares found; refusing an incomplete catalog')
output = pathlib.Path(__file__).resolve().parents[1] / 'lib' / 'generated' / 'nse-equities.json'
output.write_text(json.dumps({
    'source': url,
    'fetchedAt': datetime.now(timezone.utc).isoformat(),
    'sha256': hashlib.sha256(raw).hexdigest(),
    'count': len(stocks),
    'stocks': stocks,
}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'Saved {len(stocks)} NSE EQ stocks to {output}')
