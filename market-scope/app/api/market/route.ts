import {cached,market} from '@/lib/feeds';
import {STOCKS,RANGES} from '@/lib/stocks';
export async function GET(request:Request){const q=new URL(request.url).searchParams,symbol=q.get('symbol')||'RELIANCE.NS',range=q.get('range')||'3M';
  if(!STOCKS.some(s=>s.symbol===symbol)||!RANGES.includes(range as typeof RANGES[number]))return Response.json({error:'Unsupported stock or time range.'},{status:400});
  const data=await cached(`market:${symbol}:${range}`,120000,()=>market(symbol,range));return Response.json(data,{headers:{'Cache-Control':'private, max-age=60'}});
}
