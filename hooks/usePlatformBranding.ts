'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { db, OperationType, handleFirestoreError } from '../lib/firebase';

/**
 * Branding institucional somente leitura.
 *
 * A fonte de verdade é settings/global.logo. O runtime não oferece qualquer
 * caminho de upload, substituição ou remoção da marca.
 */
export function usePlatformBranding() {
  const [customLogo, setCustomLogo] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'global'),
      (docSnap) => {
        if (!docSnap.exists()) {
          setCustomLogo(null);
          return;
        }

        const logo = docSnap.data().logo;
        setCustomLogo(typeof logo === 'string' && logo.trim() ? logo : null);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings/global');
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const setFavicon = (dataUrl: string) => {
      try {
        const head = document.head || document.getElementsByTagName('head')[0];
        if (!head) return;

        document.querySelectorAll("link[rel*='icon']").forEach((link) => link.remove());

        const iconLink = document.createElement('link');
        iconLink.rel = 'icon';
        iconLink.type = 'image/png';
        iconLink.href = dataUrl;
        head.appendChild(iconLink);

        const shortcutLink = document.createElement('link');
        shortcutLink.rel = 'shortcut icon';
        shortcutLink.type = 'image/png';
        shortcutLink.href = dataUrl;
        head.appendChild(shortcutLink);

        const appleLink = document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        appleLink.href = dataUrl;
        head.appendChild(appleLink);
      } catch (error) {
        console.warn('Erro ao aplicar favicon institucional:', error);
      }
    };

    if (customLogo) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            setFavicon(customLogo);
            return;
          }

          ctx.clearRect(0, 0, 64, 64);
          const ratio = Math.min(64 / img.width, 64 / img.height);
          const width = img.width * ratio;
          const height = img.height * ratio;
          const x = (64 - width) / 2;
          const y = (64 - height) / 2;

          ctx.drawImage(img, x, y, width, height);
          setFavicon(canvas.toDataURL('image/png'));
        } catch {
          setFavicon(customLogo);
        }
      };
      img.onerror = () => setFavicon(customLogo);
      img.src = customLogo;
      return;
    }

    const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#00288e"/><text x="50%" y="54%" dominant-baseline="central" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="20" letter-spacing="1">EMP</text></svg>`;
    setFavicon(`data:image/svg+xml;utf8,${encodeURIComponent(defaultSvg)}`);
  }, [customLogo]);

  return { customLogo };
}
