# Indian Financial Sentiment Analysis

This is a college project for exploring Indian stocks, company news and financial headline sentiment. The application is in [market-scope](market-scope/README.md).

## Run the project

From this folder in PowerShell:

```powershell
.\start.ps1
```

Open the local address printed in the terminal, usually http://127.0.0.1:5173/. Keep the terminal open while using the application.

## What the application includes

- Search across the NSE equity catalog.
- Stock price charts, earnings, EPS, P/E, market cap and other available ratios.
- Recent company headlines from Google News RSS.
- Positive, neutral or negative classification using local FinBERT.
- A Buy, Hold or Sell research signal based on news, earnings and price trend.
- A model evaluation page comparing FinBERT with the TF-IDF baseline.

## Main technologies

React, TypeScript, Vinext, Tailwind CSS, Recharts, Node.js, Python, scikit-learn, Hugging Face Transformers.js, ONNX Runtime and WebAssembly.

Market data comes from Yahoo Finance public endpoints, news comes from Google News RSS, and the stock list comes from the official NSE equity file. Provider data may be delayed or unavailable.


## The project is live on 
https://market-scope-pink.vercel.app/
