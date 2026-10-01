import { classify } from '@/lib/sentiment';
export async function POST(request:Request){
  if(Number(request.headers.get('content-length')||0)>10000)return Response.json({error:'Headline is too long.'},{status:413});
  try {
    const body=await request.text();
    if(body.length>10000)return Response.json({error:'Headline is too long.'},{status:413});
    const {text}=JSON.parse(body);
    if(typeof text!=='string'||text.trim().length<5||text.length>2000)return Response.json({error:'Enter a headline between 5 and 2,000 characters.'},{status:400});
    return Response.json(classify(text.trim()),{headers:{'Cache-Control':'no-store'}});
  } catch {return Response.json({error:'Please send a valid headline.'},{status:400});}
}
