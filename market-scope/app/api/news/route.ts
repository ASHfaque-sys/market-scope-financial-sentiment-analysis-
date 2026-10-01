import {cached,news} from '@/lib/feeds';
import {STOCKS} from '@/lib/stocks';
export async function GET(request:Request){const symbol=new URL(request.url).searchParams.get('symbol')||'RELIANCE.NS';
  if(!STOCKS.some(s=>s.symbol===symbol))return Response.json({error:'Unsupported stock.'},{status:400});
  return Response.json(await cached(`news:${symbol}`,300000,()=>news(symbol)),{headers:{'Cache-Control':'private, max-age=60'}});
}
