/** Apresentação apenas: toda autorização real acontece nas APIs W0. */
const menus=Object.freeze({
  UNIT:[
    {id:'mapas',label:'Solicitar dietas'},
    {id:'acompanhamento',label:'Acompanhar pedidos'},
    {id:'pacientes',label:'Pacientes e leitos'},
    {id:'dietas',label:'Prescrições e dietas'},
  ],
  KITCHEN:[
    {id:'painel',label:'Pedidos recebidos'},
    {id:'producao',label:'Produção'},
    {id:'distribuicao',label:'Distribuição'},
    {id:'ocorrencias',label:'Ocorrências'},
    {id:'relatorios',label:'Relatórios'},
  ],
  NUTRITION:[{id:'nutricao',label:'Auditoria nutricional'}],
  HOSPITAL_ADMIN:[{id:'administracao',label:'Administração'},{id:'catalogo',label:'Catálogo de dietas'}],
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
