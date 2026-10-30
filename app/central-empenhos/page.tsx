// Rota canonica operacional. Reutiliza o mesmo shell, autenticacao e billing gate de /login.
// Sem duplicar estado, assinaturas, sessoes ou permissao por workspace.
export { default } from '../login/page';
