'use client';

import {
  createContext,
  useContext,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from 'react';

// Mesma troca local de abas usada na página principal do EMPROVEX.
// A URL é atualizada pela History API, sem provocar um fetch de rota RSC.
type NavigateWarehouseTab = (href: string) => void;

const WarehouseTabNavigationContext = createContext<NavigateWarehouseTab | null>(null);

export function WarehouseTabNavigationProvider({
  navigate,
  children,
}: {
  navigate: NavigateWarehouseTab;
  children: ReactNode;
}) {
  return (
    <WarehouseTabNavigationContext.Provider value={navigate}>
      {children}
    </WarehouseTabNavigationContext.Provider>
  );
}

export function useWarehouseTabNavigation(): NavigateWarehouseTab {
  const navigate = useContext(WarehouseTabNavigationContext);
  if (!navigate) throw new Error('WAREHOUSE_TAB_NAVIGATION_UNAVAILABLE');
  return navigate;
}

type WarehouseTabLinkProps = Omit<ComponentProps<'a'>, 'href'> & { href: string };

export function WarehouseTabLink({
  href,
  onClick,
  ...props
}: WarehouseTabLinkProps) {
  const navigate = useWarehouseTabNavigation();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || (props.target && props.target !== '_self')
    ) return;

    // Mantém a possibilidade de copiar o endereço/abrir em outra aba.
    // Apenas o clique simples passa pelo mesmo setState das abas principais.
    event.preventDefault();
    navigate(href);
  };

  return <a href={href} onClick={handleClick} {...props} />;
}
