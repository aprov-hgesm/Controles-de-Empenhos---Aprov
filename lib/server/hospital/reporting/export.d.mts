export declare const HOSPITAL_REPORT_COLUMNS:Readonly<Record<string,readonly string[]>>;
export declare function serializeHospitalCSV(report:{view:string;filters:Record<string,unknown>;rows:Record<string,unknown>[];generatedAt:string;partial:boolean}):string;
export declare function exportHospitalReport(report:{view:string;filters:Record<string,unknown>;rows:Record<string,unknown>[];generatedAt:string;partial:boolean},format:string):Promise<{filename:string;mime:string;bytes:Uint8Array}>;
