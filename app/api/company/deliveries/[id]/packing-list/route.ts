import {requireCompanyContext} from '../../../../../../lib/server/companyAuthz';
import {getDelivery} from '../../../../../../lib/company/delivery/service';
import {generateCompanyPdf,validatePdfSource} from '../../../../../../lib/company/documents/exportPdf';
import {CompanyDocumentError} from '../../../../../../lib/company/documents/model';
import {companyDocumentErrorResponse,privateDocumentHeaders} from '../../../../../../lib/company/documents/http';
export const runtime='nodejs';export const dynamic='force-dynamic';
/** W9-specific driver ownership check before generating the shared W5 PDF. */
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const ctx=await requireCompanyContext(request,{action:'deliveries:read'});
  const {id}=await params;
  const record=await getDelivery(ctx,id);
  if(!record.pdfSnapshot)throw new CompanyDocumentError('PDF_SNAPSHOT_NOT_READY',422);
  const source=validatePdfSource(record.pdfSnapshot,ctx.companyId);
  const bytes=generateCompanyPdf('packing-list',source);
  return new Response(new Uint8Array(bytes).buffer as ArrayBuffer,{
   status:200,headers:{...privateDocumentHeaders,'Content-Type':'application/pdf',
    'Content-Disposition':'attachment; filename="romaneio-'+encodeURIComponent(id)+'.pdf"'}});
 }catch(e){return companyDocumentErrorResponse(e);}
}
