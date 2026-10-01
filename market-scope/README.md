# MarketScope — Indian Financial Sentiment Analysis

A college research project combining an NSE stock dashboard, automatically fetched company news, and a trained English financial-headline classifier.

## Run locally

Requirements: Node.js 22.13+ and npm. Python 3.11+ is needed only to retrain the baseline model; the exported models run with the application.

```sh
npm install
npm run dev
```

Open the local URL printed by the server. On Windows, if the npm launcher is broken, run `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" install` and `node scripts/run-framework.mjs dev`.

## Technology stack

- **Frontend:** React 19 and TypeScript
- **Application framework:** Vinext with a Next.js-compatible structure
- **User interface:** Base UI, shadcn-style components and Tailwind CSS
- **Charts and icons:** Recharts and Lucide React
- **Backend:** TypeScript API routes for market data, news, sentiment and evaluation
- **Headline model:** FinBERT from Hugging Face, packaged as a quantized ONNX model and run locally in the browser with Transformers.js and WebAssembly
- **Fallback model:** TF-IDF word and phrase features with balanced Logistic Regression
- **Training and evaluation:** Python, pandas, NumPy, scikit-learn and ONNX Runtime
- **Data providers:** Yahoo Finance public endpoints, Google News RSS and the official NSE equity CSV
- **Runtime and hosting target:** Node.js locally; Cloudflare Workers/Sites-compatible production build

The project does not require a database. Market data and news are fetched when requested, while the model files and stock catalog are stored in the project.

## Features

- Search the refreshed NSE equity catalog (2,319 EQ listings in the checked-in snapshot); daily closing-price charts across 1, 3, 6 and 12 months.
- EPS, estimated market cap, trailing P/E, 52-week range, quarterly earnings, revenue/profit growth, debt/equity and ROE where the provider supplies suitable records.
- Company-filtered Google News RSS headlines, with duplicate filtering, timestamps, source links and sentiment predictions. Refresh while open every five minutes.
- Free-text headline checker: local quantized FinBERT positive, neutral or negative classification; class probabilities and uncertainty notice. The original TF-IDF logistic-regression model remains available as an explicit fallback.
- Model evaluation dashboard: dataset attribution, split counts, class metrics, confusion matrices, limitations and separate downloadable baseline/FinBERT JSON reports.
- Experimental Buy/Hold/Sell rule based on recent news, earnings growth and 20-session price trend, with explicit abstention on insufficient data.

## Dataset and measured results

| Dataset | Raw records | Labels | Licence |
|---|---:|---|---|
| [Twitter Financial News, zeroshot](https://huggingface.co/datasets/zeroshot/twitter-financial-news-sentiment) | 11,931 | Bearish → negative; bullish → positive; neutral | MIT |
| [Financial PhraseBank, Malo et al.](https://huggingface.co/datasets/takala/financial_phrasebank) | 4,846 | negative / neutral / positive | CC BY-NC-SA 3.0 |

Only the PhraseBank >50% agreement subset is loaded; overlapping agreement subsets are not concatenated. Actual downloaded row counts are used because dataset-card prose has inconsistent counts. There are 16,777 raw records, 16,538 usable unique unambiguous records, and 239 removed records. The Twitter train/validation files are pooled and re-split; these results are not the official Twitter benchmark.

Group near-duplicates using cosine similarity ≥0.88 on an auxiliary TF-IDF representation. Use stratified grouped folds (seed 42) for 13,230 training, 1,654 validation and 1,654 test examples. No group crosses partitions. Fit the predictive vocabulary and IDF only on training data; select C from 1, 4, 10 using validation macro-F1. Selected C=4. The model is a class-balanced logistic regression on word unigram/bigram TF-IDF.

Measured baseline holdout accuracy: **79.02%**. Macro-F1: **72.62%**. On the same independent Twitter holdout, local quantized FinBERT scores **73.67% accuracy** and **65.28% macro-F1**. These are model-comparison measurements, not India-specific generalisation claims. Full metrics, class distributions, source-specific scores, exact source revisions and SHA-256 hashes are in `lib/generated/evaluation.json` and `lib/generated/finbert-evaluation.json`.

No synthetic training rows are added. FinBERT is used for live classification because it understands financial context, while the measured TF-IDF baseline remains useful for comparison and fallback. There is not yet a separately labelled Indian-news test set. Build that benchmark before claiming Indian-market generalisation. Probabilities are uncalibrated; they are not truth scores or return forecasts. Relevance uses a keyword gate rather than a trained/evaluated general-topic classifier, so unrelated uses of company names and implicit finance headlines can be misclassified.

## Reproduce training and verification

```sh
python -m venv .venv
# Activate the environment, then:
pip install -r ml/requirements.txt
python ml/train.py
python ml/verify_app.py http://127.0.0.1:5173
```

Training downloads source files into ignored `ml/data/`, exports the fitted coefficients and vocabulary into `lib/generated/sentiment-model.json`, saves the split manifest locally, and writes parity fixtures. The web server runs inference with the exported model for each submitted headline.

## Data sources and calculations

Prices and reported fundamentals: Yahoo Finance public chart and fundamentals-timeseries endpoints. These unofficial endpoints require no key for this prototype but may be delayed, rate-limited, changed or unavailable. Google News RSS supplies live-fetched headlines and links; articles are not reproduced. If a provider fails, the app shows unavailable data instead of filling in values. Providers may enforce usage restrictions; a production service should use appropriately licensed feeds.

- P/E = latest price / positive trailing diluted EPS; negative or absent EPS yields unavailable.
- Market cap is an estimate using latest price × latest reported ordinary shares, not an exchange-certified live capitalization.
- YoY growth compares matching quarter-end dates and requires a positive prior-year base.
- Debt/equity requires aligned reporting periods and positive equity.
- ROE requires trailing net income and average start/end annual equity with aligned dates; otherwise unavailable.
- Chart prices are unadjusted daily closes. Corporate actions can distort simple chart-return and trend calculations.
- Publisher headlines are filtered for company aliases and recency, then near-duplicate token overlap is removed. This is not factual verification or perfect entity disambiguation.

## Experimental stock signal

`lib/signal.ts` implements a visible, inspectable rule. Recent confidence-qualified headlines contribute a recency-weighted directional score. Price versus the 20-session average, revenue growth and profit growth supply the other three components. Score ≥3 gives Buy, ≤−3 Sell, otherwise Hold. This rule is **not backtested, not calibrated and not personalised investment advice**. P/E and sector-relative valuation are displayed, but are not used in this initial signal. Missing or stale essentials produce Insufficient data. Changing the chart range can affect the available trend sample.

## Architecture

- React + TypeScript + Vinext + Recharts; server routes compatible with Cloudflare Workers / Sites.
- `app/api/sentiment`: validated headline input, local trained-model inference.
- `app/api/market`: allowlisted stock/range lookup, price and earnings retrieval.
- `app/api/news`: company news and sentiment; five-minute process-local cache.
- `app/api/evaluation`: measured training and model-comparison reports.
- No account keys or personal information are required.

## Research limitations and next steps

1. Independently label 300–500 Indian headlines with two reviewers and adjudicate disagreements.
2. Compare against a transformer using a test set absent from its training data.
3. Calibrate probabilities on a separate calibration partition.
4. Backtest signals with point-in-time financial releases, adjusted prices, fees and a benchmark. Sentiment accuracy is not trading profitability.

## Attribution

Financial PhraseBank: Pekka Malo, Ankur Sinha, Pekka Korhonen, Jyrki Wallenius and Pyry Takala, *Good debt or bad debt: Detecting semantic orientations in economic texts*, JASIST (2014). Dataset licence: https://creativecommons.org/licenses/by-nc-sa/3.0/ . Source data is not bundled in the published app. Respect the noncommercial/share-alike terms for applicable data and derivatives. Twitter Financial News: zeroshot, MIT, linked above. This project is intended for noncommercial college research.
