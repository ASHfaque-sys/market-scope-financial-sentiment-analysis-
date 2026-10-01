import type { MarketData, NewsData } from './stocks';
export function stockSignal(market:MarketData|null,news:NewsData|null,now=Date.now()){
  const reasons:string[]=[]; const f=market?.fundamentals;
  const recent=news?.items.filter(n=>n.sentiment.relevant&&!n.sentiment.lowConfidence&&now-Date.parse(n.publishedAt)<3*86400000)||[];
  const sources=new Set(recent.map(n=>n.source));
  const stalePrice=!market?.priceAt||now-Date.parse(market.priceAt)>4*86400000;
  const staleFundamentals=!f?.profitGrowth.asOf||now-Date.parse(f.profitGrowth.asOf)>200*86400000;
  if(stalePrice)reasons.push('A recent price is required.');
  if(!f||f.profitGrowth.value===null||f.revenueGrowth.value===null||staleFundamentals)reasons.push('Recent year-on-year earnings and revenue growth are required.');
  if(recent.length<3||sources.size<2)reasons.push('At least three usable recent headlines from two publishers are required.');
  if(!market||market.history.length<20)reasons.push('At least 20 trading sessions are required.');
  if(reasons.length)return {label:'Insufficient data',tone:'neutral',reasons,score:null,newsCount:recent.length};
  let weighted=0,total=0;
  for(const n of recent){const weight=Math.exp(-(now-Date.parse(n.publishedAt))/(2*86400000));weighted+=(n.sentiment.probabilities.positive-n.sentiment.probabilities.negative)*weight;total+=weight;}
  const sentiment=weighted/total;
  const closes=market!.history.slice(-20).map(p=>p.close),ma=closes.reduce((a,b)=>a+b,0)/closes.length;
  const trend=market!.price!>ma?1:-1;
  const earnings=(f!.profitGrowth.value!>0?1:-1)+(f!.revenueGrowth.value!>0?1:-1);
  const score=(sentiment>0.15?1:sentiment< -0.15?-1:0)+trend+earnings;
  reasons.push(`Recent news is ${sentiment>0.15?'positive':sentiment< -0.15?'negative':'mixed or neutral'} (${recent.length} usable headlines).`);
  reasons.push(`Price is ${trend>0?'above':'below'} its 20-session average.`);
  reasons.push(`Quarterly profit ${f!.profitGrowth.value!>=0?'grew':'fell'} ${Math.abs(f!.profitGrowth.value!).toFixed(1)}% year on year; revenue ${f!.revenueGrowth.value!>=0?'grew':'fell'} ${Math.abs(f!.revenueGrowth.value!).toFixed(1)}%.`);
  return {label:score>=3?'Buy':score<=-3?'Sell':'Hold',tone:score>=3?'positive':score<=-3?'negative':'neutral',reasons,score,newsCount:recent.length};
}
