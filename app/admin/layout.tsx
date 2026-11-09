import type { ReactNode } from 'react';

// A área administrativa contém Auth e dados privados por sessão. Não reutilizar
// HTML/RSC pré-renderizado de outra revisão Cloud Run (incidente #473).
// A guarda de acesso permanece exclusivamente na página cliente e no backend.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
