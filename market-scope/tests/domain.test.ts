import assert from 'node:assert/strict';
import {parseNews} from '../lib/feeds';
import {STOCKS,type MarketData,type NewsData,type Fundamentals} from '../lib/stocks';
import {stockSignal} from '../lib/signal';
import {classify} from '../lib/sentiment';

const now=Date.parse('2026-10-01T10:00:00Z');
const item=(title:string,pub='Thu, 01 Oct 2026 08:00:00 GMT',source='Publisher',url='https://example.com/article')=>`<item><title>${title} - ${source}</title><link>${url}</link><pubDate>${pub}</pubDate><source>${source}</source></item>`;
const xml='<rss>'+[
 item('Reliance profits rise 20%'),item('Reliance profits rise 20%','Thu, 01 Oct 2026 09:00:00 GMT','Copy'),
 item('Unrelated company wins a contract'),item('Reliance old news','Mon, 01 Sep 2025 08:00:00 GMT'),
 item('Reliance future news','Fri, 02 Oct 2026 08:00:00 GMT'),item('Reliance bad date','bad'),
 item('Reliance unsafe link',undefined,undefined,'javascript:alert(1)'),
 item('Reliance &amp; partners announce a deal')].join('')+'</rss>';
const parsed=parseNews(xml,STOCKS[0],now);
assert.equal(parsed.length,2);assert(parsed.some(n=>n.title.includes('& partners')));
assert(parsed.every(n=>n.url.startsWith('https://')));
assert.equal(parseNews('<rss>'+item('Reliance Infrastructure faces insolvency')+'</rss>',STOCKS[0],now).length,0);
assert.equal(stockSignal(null,null,now).label,'Insufficient data');
const metric=(value:number)=>({value,asOf:'2026-06-30'});
const f:Fundamentals={pe:metric(20),eps:metric(10),revenue:metric(100),netIncome:metric(20),marketCap:metric(1000),sharesOutstanding:metric(100),debtEquity:metric(.5),roe:metric(12),revenueGrowth:metric(20),profitGrowth:metric(15),earnings:[]};
const market:MarketData={symbol:'RELIANCE.NS',fetchedAt:new Date(now).toISOString(),priceAt:new Date(now-3600000).toISOString(),price:120,change:1,currency:'INR',high52:150,low52:80,volume:1000,history:Array.from({length:25},(_,i)=>({date:`2026-09-${String(i+1).padStart(2,'0')}`,close:100+i/2,volume:1000})),fundamentals:f,issues:[],source:'test fixture'};
const positive=classify('Bank profits rise as loan growth accelerates');
const news:NewsData={items:Array.from({length:3},(_,i)=>({title:`Fixture ${i}`,source:`Publisher ${i%2}`,url:`https://example.com/${i}`,publishedAt:new Date(now-3600000).toISOString(),sentiment:{...positive,label:'positive',relevant:true,lowConfidence:false,confidence:.9,probabilities:{positive:.9,neutral:.05,negative:.05}}})),fetchedAt:new Date(now).toISOString(),issues:[],source:'test fixture'};
assert.equal(stockSignal(market,news,now).label,'Buy');
assert.equal(stockSignal({...market,priceAt:'2025-01-01'},news,now).label,'Insufficient data');
assert.equal(stockSignal({...market,fundamentals:{...f,profitGrowth:{value:null,asOf:null}}},news,now).label,'Insufficient data');
assert.equal(stockSignal(market,{...news,items:news.items.map(n=>({...n,source:'Only one publisher'}))},now).label,'Insufficient data');
assert.equal(stockSignal(market,{...news,items:news.items.map(n=>({...n,sentiment:{...n.sentiment,lowConfidence:true}}))},now).label,'Insufficient data');
assert.equal(classify('The cricket team wins the final').label,'not financial');
console.log('PASS: news date/relevance/duplicate/link filters; signal prerequisites; nonfinancial gate.');
