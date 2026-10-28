import { NextRequest, NextResponse } from 'next/server';
import { verifyWarehouseRequest, WarehouseAccessError } from '../../../../lib/server/warehouseAccess';
import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';
import { WarehouseStoreError } from '../../../../lib/server/warehouseFirestoreTransaction';
import { preflightWarehouseBulkStock } from '../../../../lib/server/warehouseBulkStockPreflight';
import { StockImportError, STOCK_MAX_FILE_BYTES, generateBulkStockTemplate, parseBulkStockWorkbook } from '../../../../lib/server/warehouseBulkStockWorkbook';

export const runtime='nodejs';
export const dynamic='force-dynamic';
function reply(error:string,status:number){
  return NextResponse.json({ok:false,error},{status,headers:{'cache-control':'no-store'}});
}
/** The template does not include workspace data. Authentication still required. */
export async function GET(request:NextRequest){
  try{
    await verifyWarehouseRequest(request.headers.get('authorization'));
    const file=generateBulkStockTemplate();
    return new NextResponse(new Uint8Array(file),{
      status:200,headers:{
        'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition':'attachment; filename="EMPROVEX_Carga_Inicial_Estoque.xlsx"',
        'cache-control':'no-store',
      },
    });
  }catch(error){
    if(error instanceof WarehouseAccessError||error instanceof FounderAuthError)
      return reply('STOCK_IMPORT_UNAUTHORIZED',error.status);
    return reply('STOCK_IMPORT_UNAVAILABLE',503);
  }
}
/** Parses and resolves a workbook using server IAM; NEVER writes stock or SISCOFIS. */
export async function POST(request:NextRequest){
  try{
    const access=await verifyWarehouseRequest(request.headers.get('authorization'));
    const declared=Number(request.headers.get('content-length')||0);
    if(!Number.isFinite(declared)||declared>STOCK_MAX_FILE_BYTES+65536)
      return reply('STOCK_IMPORT_TOO_LARGE',413);
    const form=await request.formData();
    const file=form.get('file');
    if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.xlsx'))
      return reply('STOCK_IMPORT_REQUIRE_XLSX',400);
    if(file.size>STOCK_MAX_FILE_BYTES)return reply('STOCK_IMPORT_TOO_LARGE',413);
    const rows=parseBulkStockWorkbook(Buffer.from(await file.arrayBuffer()));
    const depotId=form.get('depotId');
    if(typeof depotId!=='string')return reply('STOCK_IMPORT_DESTINATION_REQUIRED',400);
    const resolved=await preflightWarehouseBulkStock(access,depotId,rows);
    return NextResponse.json({ok:true,rows:resolved},{headers:{'cache-control':'no-store'}});
  }catch(error){
    if(error instanceof WarehouseAccessError||error instanceof FounderAuthError)
      return reply('STOCK_IMPORT_UNAUTHORIZED',error.status);
    if(error instanceof StockImportError)return reply(error.code,error.status);
    if(error instanceof WarehouseStoreError)return reply(error.code,error.status);
    console.error('[warehouse/bulk-stock] parse failed',error instanceof Error?error.name:'unknown');
    return reply('STOCK_IMPORT_UNAVAILABLE',503);
  }
}
