import report from '@/lib/generated/evaluation.json';
export function GET(){return Response.json(report);}
