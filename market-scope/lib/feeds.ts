import { STOCKS, type MarketData, type Fundamentals, type NewsData, type NewsItem, type Metric } from './stocks';
import { classify, normalize } from './sentiment';
const cache = new Map<string,{expires:number;value:unknown}>();
export async function cached<T>(key:string,ttl:number,load:()=>Promise<T>):Promise<T>{
  const existing=cache.get(key);if(existing&&existing.expires>Date.now())return existing.value as T;
  const value=await load();
  const hasIssues=typeof value==='object'&&value!==null&&'issues' in value&&Array.isArray(value.issues)&&value.issues.length>0;
  if(cache.size>100)cache.clear();cache.set(key,{expires:Date.now()+(hasIssues?15000:ttl),value});return value;
}
async function remote(url:string){
  let failure:unknown;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json, application/rss+xml, */*'},signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error(`Provider returned ${response.status}`);
      return response;
    }catch(error){failure=error;}
  }
  throw failure;
}
function num(v:unknown):number|null{return typeof v==='number'&&Number.isFinite(v)?v:null;}
type ChartResponse = {chart?:{result?:{meta?:Record<string,unknown>;timestamp?:number[];indicators?:{quote?:{close?:number[];volume?:number[]}[]}}[]}};
type SeriesResponse = {timeseries?:{result?:({meta?:{type?:string[]}} & Record<string,unknown>)[]}};
type Point = {asOfDate:string; reportedValue:{raw:number};currencyCode?:string};
const fields=['trailingDilutedEPS','trailingNetIncome','trailingTotalRevenue','quarterlyTotalRevenue','quarterlyNetIncome','quarterlyDilutedEPS','quarterlyStockholdersEquity','quarterlyTotalDebt','quarterlyOrdinarySharesNumber'];
export async function fundamentals(symbol:string,price:number|null):Promise<Fundamentals>{
  const now=Math.floor(Date.now()/1000);
  const url=`https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${symbol}?type=${fields.join(',')}&period1=${now-86400*800}&period2=${now}`;
  const data=await (await remote(url)).json() as SeriesResponse;
  const series:Record<string,Point[]>={};
  for(const item of data.timeseries?.result||[]){const key=item.meta?.type?.[0];if(key)series[key]=((item[key]||[]) as Point[]).filter((p:Point)=>num(p.reportedValue?.raw)!==null&&p.asOfDate<=new Date().toISOString().slice(0,10)).sort((a:Point,b:Point)=>a.asOfDate.localeCompare(b.asOfDate));}
  const latest=(key:string):Metric=>{const p=series[key]?.at(-1);return {value:num(p?.reportedValue.raw),asOf:p?.asOfDate||null};};
  const eps=latest('trailingDilutedEPS'),revenue=latest('trailingTotalRevenue'),netIncome=latest('trailingNetIncome'),shares=latest('quarterlyOrdinarySharesNumber');
  const equity=latest('quarterlyStockholdersEquity'),debt=latest('quarterlyTotalDebt');
  const growth=(key:string):Metric=>{const values=series[key]||[],last=values.at(-1);if(!last)return {value:null,asOf:null};const previous=values.find(p=>p.asOfDate===`${Number(last.asOfDate.slice(0,4))-1}${last.asOfDate.slice(4)}`);const old=previous?.reportedValue.raw;return {value:old!==undefined&&old>0?(last.reportedValue.raw/old-1)*100:null,asOf:last.asOfDate};};
  const dates=[...new Set((series.quarterlyTotalRevenue||[]).map(p=>p.asOfDate))].slice(-5);
  const earnings=dates.map(date=>({date,revenue:num(series.quarterlyTotalRevenue?.find(p=>p.asOfDate===date)?.reportedValue.raw),netIncome:num(series.quarterlyNetIncome?.find(p=>p.asOfDate===date)?.reportedValue.raw),eps:num(series.quarterlyDilutedEPS?.find(p=>p.asOfDate===date)?.reportedValue.raw)}));
  // Ratio comparisons require aligned reporting periods. ROE uses average equity over a year.
  const equityDate=equity.asOf;
  const equityStart=equityDate?series.quarterlyStockholdersEquity?.find(p=>p.asOfDate===`${Number(equityDate!.slice(0,4))-1}${equityDate!.slice(4)}`):undefined;
  const avgEquity=equity.value!==null&&equityStart?(equity.value+equityStart.reportedValue.raw)/2:null;
  return {eps,revenue,netIncome,earnings,sharesOutstanding:shares,
    pe:{value:price!==null&&eps.value!==null&&eps.value>0?price/eps.value:null,asOf:eps.asOf},
    marketCap:{value:price!==null&&shares.value!==null?price*shares.value:null,asOf:shares.asOf},
    debtEquity:{value:debt.asOf===equity.asOf&&debt.value!==null&&equity.value!==null&&equity.value>0?debt.value/equity.value:null,asOf:debt.asOf},
    roe:{value:netIncome.asOf===equity.asOf&&netIncome.value!==null&&avgEquity!==null&&avgEquity>0?netIncome.value/avgEquity*100:null,asOf:equity.asOf},
    revenueGrowth:growth('quarterlyTotalRevenue'),profitGrowth:growth('quarterlyNetIncome')};
}
export async function market(symbol:string,range:string):Promise<MarketData>{
  const result:MarketData={symbol,fetchedAt:new Date().toISOString(),priceAt:null,price:null,change:null,currency:'INR',high52:null,low52:null,volume:null,history:[],fundamentals:null,issues:[],source:'Yahoo Finance · unofficial public endpoints; quotes may be delayed'};
  const chartTask=remote(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${({ '1M':'1mo','3M':'3mo','6M':'6mo','1Y':'1y' } as Record<string,string>)[range]}&interval=1d`).then(r=>r.json() as Promise<ChartResponse>);
  const fundamentalsTask=fundamentals(symbol,null);
  const [chart,fin]=await Promise.allSettled([chartTask,fundamentalsTask]);
  if(chart.status==='fulfilled'){
    const data=chart.value.chart?.result?.[0];
    if(data){const meta=data.meta||{},quote=data.indicators?.quote?.[0]||{};
      result.price=num(meta.regularMarketPrice);result.priceAt=meta.regularMarketTime?new Date(Number(meta.regularMarketTime)*1000).toISOString():null;
      result.currency=String(meta.currency||'INR'); result.high52=num(meta.fiftyTwoWeekHigh);result.low52=num(meta.fiftyTwoWeekLow);result.volume=num(meta.regularMarketVolume);
      result.history=(data.timestamp||[]).map((t:number,i:number)=>({date:new Date(t*1000).toISOString().slice(0,10),close:num(quote.close?.[i]),volume:num(quote.volume?.[i])||0})).filter((p): p is {date:string;close:number;volume:number}=>p.close!==null);
      const prior=result.history.at(-2)?.close;
      result.change=prior&&result.price!==null?(result.price/prior-1)*100:null;
    }else result.issues.push('Price provider returned no data for this stock.');
  }else result.issues.push('Price feed unavailable. Try refreshing shortly.');
  if(fin.status==='fulfilled'){
    result.fundamentals=fin.value;
    const eps=fin.value.eps.value;
    result.fundamentals.pe.value=result.price!==null&&eps!==null&&eps>0?result.price/eps:null;
    const shares=fin.value.sharesOutstanding.value;
    result.fundamentals.marketCap.value=result.price!==null&&shares!==null?result.price*shares:null;
  }else result.issues.push('Earnings and financial ratios are currently unavailable.');
  return result;
}
function decode(xml:string):string{return xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):'';}).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&').replace(/<[^>]*>/g,'').trim();}
function tag(xml:string,name:string){return decode(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'))?.[1]||'');}
export function parseNews(xml:string,stock:typeof STOCKS[number],now=Date.now()):NewsItem[]{
  const items:NewsItem[]=[];const signatures:Set<string>[]=[];
  for(const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)){
    const chunk=match[1],source=tag(chunk,'source'),rawTitle=tag(chunk,'title');
    const title=source&&rawTitle.endsWith(` - ${source}`)?rawTitle.slice(0,-source.length-3):rawTitle;
    const normalized=normalize(title),url=tag(chunk,'link'),published=Date.parse(tag(chunk,'pubDate'));
    if(!title||!/^https:\/\//.test(url)||!Number.isFinite(published)||published>now+300000||now-published>7*86400000)continue;
    if(stock.symbol==='RELIANCE.NS'&&/\breliance\s+(infrastructure|power|capital|communications|home finance)\b/i.test(title)&&!(/\breliance industries\b|\bril\b/i.test(title)))continue;
    if(!stock.aliases.some(alias=>new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(title)))continue;
    const words=new Set(normalized.split(' ').filter(t=>t.length>2));
    if(signatures.some(s=>{const intersection=[...words].filter(w=>s.has(w)).length;return intersection/(s.size+words.size-intersection||1)>0.75;}))continue;
    signatures.push(words);items.push({title,url,source:source||'Unknown publisher',publishedAt:new Date(published).toISOString(),sentiment:classify(title)});
  }
  return items.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,20);
}
export async function news(symbol:string):Promise<NewsData>{
  const stock=STOCKS.find(s=>s.symbol===symbol)!;
  const url=`https://news.google.com/rss/search?q=${encodeURIComponent(`(${stock.query}) when:7d`)}&hl=en-IN&gl=IN&ceid=IN:en`;
  try {const xml=await (await remote(url)).text();const items=parseNews(xml,stock);return {items,fetchedAt:new Date().toISOString(),source:'Google News RSS · publisher headlines',issues:items.length?[]:['No matching company headlines in the last seven days.']};}
  catch (error) {console.warn('News provider failure:', error instanceof Error ? error.message : 'Unknown error');return {items:[],fetchedAt:new Date().toISOString(),source:'Google News RSS',issues:['News feed unavailable. Try refreshing shortly.']};}
}
