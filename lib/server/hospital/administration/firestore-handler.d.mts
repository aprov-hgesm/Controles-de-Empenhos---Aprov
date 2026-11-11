export function createHospitalFirestoreAdministrationHandler(args:{store:any;verifyToken?:any;userExists?:(uid:string)=>Promise<boolean>}): (args:any)=>Promise<{status:number;body:any}>;
