/** Shared, display-only labels for the canonical per-meal consistency. */
const consistencyLabels=Object.freeze({
 LIVRE:'livre',BRANDA:'branda',PASTOSA:'pastosa',
 LIQUIDA_RESTRITA:'líquida restrita',LIQUIDA_COMPLETA:'líquida completa',
 LIQUIDA_SEM_RESIDUOS:'líquida sem resíduos',OUTRA:'outra consistência'
});
export function consistencyLabel(code){
 return consistencyLabels[code]??null;
}
export function mealDisplayLabel(meal,catalogLabel='Dieta'){
 if(meal?.recipientType==='COMPANION')return 'Refeição do acompanhante';
 const consistency=consistencyLabel(meal?.consistency);
 return consistency?'Dieta '+consistency:catalogLabel;
}
