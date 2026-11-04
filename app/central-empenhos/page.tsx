// Rota canonica operacional. Reutiliza o mesmo shell, autenticacao e billing gate de /login.
// Sem duplicar estado, assinaturas, sessoes ou permissao por workspace.
// Evita HTML/RSC pre-renderizado reusado entre revisoes do Cloud Run.
// O shell, Auth, billing e consultas continuam implementados no cliente.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export { default } from '../login/page';
