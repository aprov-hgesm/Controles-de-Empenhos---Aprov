export interface MapOrderState {status?:string|null;submittedAt?:string|null;receivedAt?:string|null;}
export interface OrderMealState {status:string;}
export interface OrderStep {id:string;label:string;}
export const ORDER_STEPS:ReadonlyArray<OrderStep>;
export function getOrderProgress(map:MapOrderState|null|undefined,meals?:readonly OrderMealState[]):{
 stage:number;headline:string;description:string;count:number;delivered:number;problems:number;
 partial:boolean;received:boolean;submitted:boolean;completed:boolean;
};
