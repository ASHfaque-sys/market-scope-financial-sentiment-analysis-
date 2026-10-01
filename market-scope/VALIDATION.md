# Validation of the first version

- Production build: successful (Vinext client, SSR and Worker output).
- TypeScript: `tsc --noEmit` passes.
- Model deployment parity: all 48 examples agree with Python probabilities within 1e-7.
- API validation: empty, short, malformed, non-string and oversized inputs rejected; unsupported symbols/ranges rejected.
- Live integration: RELIANCE.NS and INFY.NS each returned price, 67 daily sessions, earnings, estimated market capitalization and 20 headlines during testing on 1 October 2026.
- Domain tests: missing/stale signal inputs abstain; one-publisher/low-confidence news abstains; news date, company relevance, duplicate and unsafe-link filters pass.
- Browser: headline prediction and keyboard tab navigation verified; the HDFC ADR/Anup Bagchi headline returns positive with FinBERT, and the stock search selects an entry from the expanded NSE catalog.
- FinBERT holdout: 1,185 independent Twitter Financial News examples; 73.67% accuracy and 65.28% macro-F1. The baseline scores 73.69% macro-F1 on the same source-specific holdout.
- WebMCP: headline tool registration, valid input with visible state update, and invalid-input rejection verified.
- Responsive layout: inspected in the narrow in-app browser viewport; chart, earnings and headline results stack vertically.

Re-run API verification against a running app using `python ml/verify_app.py`. Live-source assertions can fail when external providers are unavailable; no fake values are substituted. Build emits a non-fatal large-client-chunk warning.

Sentiment test accuracy is 79.02%, macro-F1 72.62%, versus majority-class accuracy 63.06%. These are grouped random holdout results, not chronological or India-specific evaluation. The stock decision rule has not been backtested.

The local application, model files, source code and build output are preserved in this project. A hosted deployment is outside the current local validation scope.
