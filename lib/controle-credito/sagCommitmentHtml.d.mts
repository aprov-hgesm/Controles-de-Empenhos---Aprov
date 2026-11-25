import type {ParsedEmpenhoPdfResult} from '../server/empenhoPdfParser';
export function parseSagCommitmentHtml(html:string,expectedUg:string):ParsedEmpenhoPdfResult & {number:string;issueDate:string;netCents:number;requiresReview:true};
