import { requireCreditMember, CreditAccessError } from '@/lib/server/creditControlAuth';
import { listFinance } from '@/lib/server/creditControlStore';
import { documentError } from '@/lib/server/creditControlDocuments';
import { creditPdf, creditPdfResponse, displayDate, money, type CreditReportLine } from '@/lib/controle-credito/reports/creditPdf';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {
    const member=await requireCreditMember(request);
    const q=new URL(request.url).searchParams;
    const type=q.get('type')||'saldo';
    const yearText=q.get('year')||new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric'});
    if(!['saldo','nc','ne'].includes(type)||!/^20\d{2}$/.test(yearText))throw new CreditAccessError(422,'Filtro de relatório inválido.');
    const year=Number(yearText);
    const lines:CreditReportLine[]=[];
    const view=await listFinance(member,{year,limit:100},true);
    lines.push({label:'Crédito recebido / destinado',value:money(view.totals.creditCents)},
      {label:'Empenhado',value:money(view.totals.committedCents)},
      {label:'Disponível',value:money(view.totals.availableCents)});
    if(type!=='ne')for(const c of view.credits){
      lines.push({label:'NC '+c.number,value:'Emissão '+displayDate(c.issueDate)+' | Prazo '+displayDate(c.deadline)+' | '+money(c.totalCents)});
    }
    if(type!=='nc')for(const n of view.commitments){
      if(member.role==='centro'&&n.centerId!==member.centerId)throw new CreditAccessError(503,'Projeção financeira inconsistente.');
      lines.push({label:'NE '+n.number,value:displayDate(n.issueDate)+' | Centro '+n.centerId+' | '+money(n.netCents)});
    }
    return creditPdfResponse(creditPdf(member,'Relatório de '+(type==='nc'?'notas de crédito':type==='ne'?'notas de empenho':'saldo e empenhos'),lines,year),'credito-'+type+'-'+year+'.pdf');
  }catch(e){return documentError(e);}
}
