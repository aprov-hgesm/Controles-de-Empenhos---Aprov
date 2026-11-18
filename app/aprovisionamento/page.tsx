// Reutiliza integralmente o shell, a autenticação, o billing gate e as sessões
// do Aprovisionamento. O legado /central-empenhos redireciona para esta rota.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export { default } from '../login/page';
