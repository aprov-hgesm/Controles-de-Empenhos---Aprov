/** Apresentação apenas: toda autorização real acontece nas APIs W0. */
const menus=Object.freeze({
  UNIT:[
    {id:'inicio',label:'Início'},
    {id:'pacientes',label:'Pacientes'},
    {id:'dietas',label:'Dietas prescritas'},
    {id:'mapas',label:'Meus Mapas'},
    {id:'acompanhamento',label:'Acompanhamento'},
  ],
  KITCHEN:[
    {id:'painel',label:'Painel da Cozinha'},
    {id:'producao',label:'Produção'},
    {id:'distribuicao',label:'Distribuição'},
    {id:'ocorrencias',label:'Ocorrências'},
    {id:'relatorios',label:'Relatórios'},
  ],
  NUTRITION:[{id:'nutricao',label:'Auditoria nutricional'}],
  HOSPITAL_ADMIN:[{id:'administracao',label:'Administração hospitalar'}],
});
const order=['UNIT','KITCHEN','NUTRITION','HOSPITAL_ADMIN'];
export function menuForRoles(roles){
  if(!Array.isArray(roles))return [];
  const out=[];
  for(const role of order)if(roles.includes(role)){
    for(const item of menus[role])if(!out.some(x=>x.id===item.id))out.push({...item,role});
  }
  return out;
}
export function canOpenPage(roles,page){return menuForRoles(roles).some(x=>x.id===page);}
export function firstPage(roles){return menuForRoles(roles)[0]?.id??null;}
