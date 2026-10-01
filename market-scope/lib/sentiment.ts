import raw from './generated/sentiment-model.json';
import type { Sentiment } from './stocks';
type Model = {classes:string[]; vocabulary:Record<string,number>; idf:number[]; coefficients:number[][]; intercepts:number[]};
const model = raw as Model;
export function normalize(text:string) { return (text.toLowerCase().replace(/https?:\/\/\S+/g,' ').match(/[a-z0-9]+/g)||[]).join(' '); }
const financial = /\b(stock|stocks|share|shares|market|markets|profit|profits|profitable|loss|losses|earnings|revenue|revenues|sales|bank|banks|banking|loan|loans|debt|dividend|dividends|equity|investor|investors|investment|investments|financial|finance|fiscal|quarter|quarterly|company|companies|business|businesses|economy|economic|inflation|interest|rates|rupee|rupees|dollar|dollars|billion|million|crore|crores|lakh|valuation|merger|acquisition|ipo|buyback|credit|bond|bonds|tariff|tariffs|exports|imports|oil|gold|crude|bitcoin|crypto|nifty|sensex|nse|bse|rbi|sebi|reliance|infosys|tcs|hdfc|icici|sbi|airtel|itc|unilever|maruti|tesla|apple|microsoft|amazon|google|nvidia|meta|eps|ebitda|retail|demand|costs|margin|margins|production|output|guidance|layoffs|recession|orders|contract|contracts|funding|capital|operating|turnover|cash|assets|liabilities|stake|stakes|analyst|analysts)\b/i;
export function classify(text:string):Sentiment {
  const tokens = normalize(text).split(' ').filter(Boolean);
  const terms = [...tokens,...tokens.slice(0,-1).map((t,i)=>`${t} ${tokens[i+1]}`)];
  const counts = new Map<number,number>();
  for(const term of terms){const i=model.vocabulary[term]; if(i!==undefined)counts.set(i,(counts.get(i)||0)+1);}
  const features = [...counts].map(([i,n])=>[i,(1+Math.log(n))*model.idf[i]]);
  const norm = Math.sqrt(features.reduce((sum,[,v])=>sum+v*v,0))||1;
  const scores = model.intercepts.map((b,c)=>features.reduce((s,[i,v])=>s+model.coefficients[c][i]*v/norm,b));
  const max=Math.max(...scores), exp=scores.map(s=>Math.exp(s-max)), total=exp.reduce((a,b)=>a+b,0);
  const probabilities=Object.fromEntries(model.classes.map((label,i)=>[label,exp[i]/total]));
  const winner=scores.indexOf(max), label=model.classes[winner], confidence=probabilities[label];
  const relevant=financial.test(text);
  const coverage=tokens.length ? tokens.filter(t=>model.vocabulary[t]!==undefined).length/tokens.length : 0;
  const runner=[...scores.keys()].filter(i=>i!==winner).sort((a,b)=>scores[b]-scores[a])[0];
  const values=new Map(features.map(([i,v])=>[i,v/norm]));
  const evidence=[...new Set(terms)].filter(t=>values.has(model.vocabulary[t])).map(term=>({term,contribution:(model.coefficients[winner][model.vocabulary[term]]-model.coefficients[runner][model.vocabulary[term]])*values.get(model.vocabulary[term])!})).filter(e=>e.contribution>0).sort((a,b)=>b.contribution-a.contribution).slice(0,6);
  return {label:relevant?label:'not financial',confidence,probabilities,relevant,lowConfidence:confidence<0.60||coverage<0.4,coverage,evidence,model:'TF-IDF baseline',
    note:relevant?'English financial-text prediction. Model probabilities are uncalibrated; this does not verify truth or predict returns.':'No clear financial context detected by the keyword relevance filter. Add financial context if this is relevant news.'};
}
