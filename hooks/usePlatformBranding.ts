'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';

import { db } from '../lib/firebase';

/**
 * Branding institucional somente leitura.
 *
 * Prioriza configuração estática de build e, quando ausente, faz no máximo uma
 * leitura Firestore por sessão do navegador. Não existe listener realtime nem
 * caminho de upload, substituição ou remoção da marca no runtime.
 */
export function usePlatformBranding() {
  const [customLogo, setCustomLogo] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Logo oficial com fundo transparente. A configuração legada
    // NEXT_PUBLIC_EMPROVEX_LOGO_URL não deve restaurar a arte anterior.
    const staticLogo = '/branding/emprovex-dark-transparent.png?v=20261102-r4';
    const cacheKey = 'emprovex:branding-logo:v1';

    if (staticLogo) {
      setCustomLogo(staticLogo);
      return () => {
        active = false;
      };
    }

    try {
      const cached = window.sessionStorage.getItem(cacheKey);
      if (cached) {
        setCustomLogo(cached === '__none__' ? null : cached);
        return () => {
          active = false;
        };
      }
    } catch {
      // Cache é apenas otimização; a identidade visual nunca depende dele.
    }

    void getDoc(doc(db, 'settings', 'global'))
      .then((docSnap) => {
        if (!active) return;
        const logo = docSnap.exists() ? docSnap.data().logo : null;
        const resolved = typeof logo === 'string' && logo.trim() ? logo.trim() : null;
        setCustomLogo(resolved);
        try {
          window.sessionStorage.setItem(cacheKey, resolved || '__none__');
        } catch {
          // Sem persistência local, a UI continua funcionando normalmente.
        }
      })
      .catch((error) => {
        // Branding nunca pode bloquear login/operação. O fallback visual EMPROVEX
        // permanece disponível mesmo se a leitura institucional falhar.
        console.warn('Não foi possível carregar o branding institucional.', error);
        if (active) setCustomLogo(null);
      });

    return () => {
      active = false;
    };
  }, []);

  // Favicon e ícones Apple/PWA pertencem ao metadata/manifest e ao gerador
  // dedicado; nunca sobrescrever via Canvas com a imagem do cabeçalho.

  return { customLogo };
}
