'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ComponentProps, type MouseEvent } from 'react';

// A troca normal de páginas permanece no App Router, sem novas leituras de
// autenticação/Firestore. Só fazemos navegação de documento se a transição
// ficar presa; atualizar manualmente a página já recupera esse cenário.
const ROUTE_RECOVERY_TIMEOUT_MS = 8000;

interface PendingNavigation {
  fromPath: string;
  toPath: string;
  timer: ReturnType<typeof setTimeout>;
}

// Compartilhado entre os links para que uma segunda escolha cancele o fallback
// da anterior (importante ao alternar rapidamente entre abas).
let pendingNavigation: PendingNavigation | null = null;

function normalizedPath(href: string): string {
  const path = href.split(/[?#]/, 1)[0] || '/';
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

function cancelPendingNavigation() {
  if (!pendingNavigation) return;
  clearTimeout(pendingNavigation.timer);
  pendingNavigation = null;
}

type RecoveredLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
};

export function WarehouseRecoveredLink({
  href,
  onClick,
  ...props
}: RecoveredLinkProps) {
  const pathname = usePathname();

  useEffect(() => {
    // O App Router concluiu uma transição. Não há motivo para recarregar
    // uma página já navegada com sucesso.
    if (
      pendingNavigation
      && normalizedPath(pathname) !== pendingNavigation.fromPath
    ) {
      cancelPendingNavigation();
    }
  }, [pathname]);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    // Respeita cliques modificados, novos separadores e handlers que impedem
    // a navegação, sem alterar o comportamento do Next Link.
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || (props.target && props.target !== '_self')
      || !href.startsWith('/')
      || href.startsWith('//')
    ) {
      return;
    }

    const fromPath = normalizedPath(pathname);
    const toPath = normalizedPath(href);
    cancelPendingNavigation();

    if (fromPath === toPath) return;

    const navigation: PendingNavigation = {
      fromPath,
      toPath,
      timer: setTimeout(() => {
        if (pendingNavigation !== navigation) return;
        pendingNavigation = null;
        // Recurso de recuperação, jamais a via normal. Preserva o destino
        // escolhido, que antes exigia um recarregamento manual.
        window.location.assign(href);
      }, ROUTE_RECOVERY_TIMEOUT_MS),
    };
    pendingNavigation = navigation;
  };

  return <Link href={href} onClick={handleClick} {...props} />;
}
