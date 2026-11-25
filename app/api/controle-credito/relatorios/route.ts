import { requireCreditMember, CreditAccessError } from '@/lib/server/creditControlAuth';
import { listFinance } from '@/lib/server/creditControlStore';
import { documentError } from '@/lib/server/creditControlDocuments';
import { creditPdf, creditPdfResponse } from '@/lib/controle-credito/reports/creditPdf';
import { REPORT_TITLES,buildCreditReport } from '@/lib/controle-credito/reports/reportLines';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function readDate(v:string|null){if(!v)return undefined;if(!/^20\d{2}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw new CreditAccessError(422,'Informe uma data válida.');return v;}
export async function GET(request:Request) {
  try {
    const member=await requireCreditMember(request),q=new URL(request.url).searchParams;
    const type=q.get('type')||'saldo',yearText=q.get('year')||new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(new Date());
    if(!Object.prototype.hasOwnProperty.call(REPORT_TITLES,type)||!/^20\d{2}$/.test(yearText))throw new CreditAccessError(422,'Filtro de relatório inválido.');
    const nc=['nc-detalhe','ne-centro','ne'].includes(type)?q.get('nc')?.trim().toUpperCase()||undefined:undefined;
    const center=['ne-centro','ne'].includes(type)?q.get('center')||undefined:undefined;
    const from=['ne-centro','ne'].includes(type)?readDate(q.get('from')):undefined,to=['ne-centro','ne'].includes(type)?readDate(q.get('to')):undefined;
    if(nc&&!/^[A-Z0-9_]{1,160}$/.test(nc)||center&&!/^[A-Za-z0-9_-]{1,64}$/.test(center)||from&&to&&from>to)throw new CreditAccessError(422,'Confira o número da NC, centro e período informados.');
    if(member.role==='centro'&&center&&center!==member.centerId)throw new CreditAccessError(403,'Seu perfil só pode consultar o próprio centro de custos.');
    const year=Number(yearText),view=await listFinance(member,{year,limit:100},true);
    if(member.role==='centro'&&view.commitments.some(n=>n.centerId!==member.centerId))throw new CreditAccessError(503,'Projeção financeira inconsistente.');
    const lines=buildCreditReport(view,{type,nc,center,from,to});
    return creditPdfResponse(creditPdf(member,REPORT_TITLES[type],lines,year),'credito-'+type+'-'+year+'.pdf');
  }catch(e){return documentError(e);}
}
