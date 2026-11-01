import { redirect } from 'next/navigation';

// Alias de acesso direto: preserva o shell, a sessão, o billing gate
// e as permissões existentes em /central-empenhos. Nenhum login paralelo.
export default function EleonorPage() {
  redirect('/central-empenhos?tab=eleonor');
}
