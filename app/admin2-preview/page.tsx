import { notFound } from 'next/navigation';

import { AdminCommandPreview } from '../../components/admin2/shell/AdminCommandPreview';

/**
 * Laboratório de design sem Firebase/Auth/dados de clientes.
 * Disponível somente em next dev; em builds de produção retorna 404.
 */
export default function Admin2PreviewPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return <AdminCommandPreview />;
}
