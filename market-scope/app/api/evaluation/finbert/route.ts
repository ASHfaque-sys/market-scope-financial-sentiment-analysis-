import report from '@/lib/generated/finbert-evaluation.json';

export function GET(){return Response.json(report);}
