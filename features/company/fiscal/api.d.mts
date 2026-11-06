export interface FiscalBrowserApi {
 profiles(signal?:AbortSignal):Promise<Record<string,unknown>>;
 connection(signal?:AbortSignal):Promise<Record<string,unknown>>;
 nfe(signal?:AbortSignal):Promise<Record<string,unknown>>;
 submit(body:unknown,idempotencyKey:string,signal?:AbortSignal):Promise<Record<string,unknown>>;
}
export function createFiscalBrowserApi(args:{getIdToken:()=>Promise<string>;fetchImpl?:typeof fetch}):FiscalBrowserApi;