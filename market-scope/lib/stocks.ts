import catalog from './generated/nse-equities.json';
export const FEATURED_STOCKS = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries', sector: 'Energy & retail', query: '"Reliance Industries"', aliases: ['reliance', 'ril'] },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services', sector: 'Information technology', query: '"TCS" OR "Tata Consultancy Services"', aliases: ['tcs', 'tata consultancy'] },
  { symbol: 'INFY.NS', name: 'Infosys', sector: 'Information technology', query: '"Infosys"', aliases: ['infosys'] },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', sector: 'Banking', query: '"HDFC Bank"', aliases: ['hdfc bank', 'hdfcbank'] },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', sector: 'Banking', query: '"ICICI Bank"', aliases: ['icici bank', 'icicibank'] },
  { symbol: 'SBIN.NS', name: 'State Bank of India', sector: 'Banking', query: '"State Bank of India" OR "SBI" stock', aliases: ['state bank', 'sbi'] },
  { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', sector: 'Telecommunications', query: '"Bharti Airtel"', aliases: ['airtel'] },
  { symbol: 'ITC.NS', name: 'ITC', sector: 'Consumer goods', query: '"ITC" shares', aliases: ['itc'] },
  { symbol: 'LT.NS', name: 'Larsen & Toubro', sector: 'Engineering', query: '"Larsen & Toubro" OR "L&T" stock', aliases: ['larsen', 'l&t'] },
  { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever', sector: 'Consumer goods', query: '"Hindustan Unilever"', aliases: ['hindustan unilever', 'hul'] },
  { symbol: 'SUNPHARMA.NS', name: 'Sun Pharmaceutical', sector: 'Healthcare', query: '"Sun Pharma"', aliases: ['sun pharma'] },
  { symbol: 'MARUTI.NS', name: 'Maruti Suzuki', sector: 'Automotive', query: '"Maruti Suzuki"', aliases: ['maruti'] },
];
export type Stock = { symbol:string; name:string; sector:string; query:string; aliases:string[]; isin?:string };
const featuredSymbols = new Set(FEATURED_STOCKS.map(stock => stock.symbol));
function listedStock(stock: typeof catalog.stocks[number]): Stock {
  const cleanName = stock.name.replace(/\s+(?:LIMITED|LTD\.?|LTD\.|PVT\.?\s+LTD\.?)$/i, '').trim();
  const ticker = stock.symbol.slice(0,-3);
  const alias = cleanName.toLowerCase();
  return {
    ...stock,
    name: cleanName.replace(/\b[A-Z]{4,}\b/g, word => word[0] + word.slice(1).toLowerCase()),
    sector: 'NSE equity',
    query: `"${cleanName}" stock`,
    aliases: [alias, ...(ticker.length >= 4 && /^[A-Z0-9]+$/.test(ticker) ? [ticker.toLowerCase()] : [])],
  };
}
export const STOCKS: Stock[] = [
  ...FEATURED_STOCKS,
  ...catalog.stocks.filter(stock => !featuredSymbols.has(stock.symbol)).map(listedStock),
];
export const STOCK_CATALOG = { count: STOCKS.length, fetchedAt: catalog.fetchedAt, source: catalog.source };
export const RANGES = ['1M', '3M', '6M', '1Y'] as const;
export type Sentiment = { label: string; confidence: number; probabilities: Record<string,number>; relevant: boolean; lowConfidence: boolean; coverage: number; evidence: {term:string; contribution:number}[]; note: string; model?: string };
export type NewsItem = { title: string; url: string; source: string; publishedAt: string; sentiment: Sentiment };
export type Metric = { value: number | null; asOf: string | null };
export type Fundamentals = { sharesOutstanding: Metric; pe: Metric; eps: Metric; revenue: Metric; netIncome: Metric; marketCap: Metric; debtEquity: Metric; roe: Metric; revenueGrowth: Metric; profitGrowth: Metric; earnings: {date:string; revenue:number|null; netIncome:number|null; eps:number|null}[] };
export type MarketData = { symbol: string; fetchedAt: string; priceAt: string | null; price: number|null; change: number|null; currency: string; high52: number|null; low52: number|null; volume: number|null; history: {date:string; close:number; volume:number}[]; fundamentals:Fundamentals|null; issues:string[]; source:string };
export type NewsData = { items:NewsItem[]; fetchedAt:string; issues:string[]; source:string };
