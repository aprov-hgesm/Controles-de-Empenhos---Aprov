// A raiz publica continua reescrita para /institucional em next.config.ts.
// Se a rota operacional historica / for resolvida, reutiliza exatamente
// a mesma UI, cobranca, permissao e estado de /login. Nenhum segundo gate.
export { default } from './login/page';
