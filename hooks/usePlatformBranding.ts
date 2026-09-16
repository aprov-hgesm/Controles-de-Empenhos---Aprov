'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { savePlatformLogo } from '../lib/firebaseSync';

type NotificationType = 'success' | 'error' | 'info';

interface UsePlatformBrandingOptions {
  userEmail?: string | null;
  onNotify: (message: string, type?: NotificationType) => void;
}

export function usePlatformBranding({ userEmail, onNotify }: UsePlatformBrandingOptions) {
  // Custom Platform Logo State & Upload Handlers
  const [customLogo, setCustomLogo] = useState<string | null>(null);

  // Global Platform Settings (Logotipo & Favicon) Listener - Unconditionally loads and syncs with Firestore
  useEffect(() => {
    try {
      const saved = localStorage.getItem('emprovex_custom_logo') || localStorage.getItem('emprovium_custom_logo');
      if (saved) setCustomLogo(saved);
    } catch (e) {
      console.warn('Erro ao carregar logotipo do armazenamento local:', e);
    }

    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'global'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.logo !== undefined) {
            setCustomLogo(data.logo || null);
            try {
              if (data.logo) {
                localStorage.setItem('emprovex_custom_logo', data.logo);
              } else {
                localStorage.removeItem('emprovex_custom_logo');
                localStorage.removeItem('emprovium_custom_logo');
              }
            } catch (e) {}
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings/global');
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Update browser tab favicon dynamically and reliably across all browsers
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const setFavicon = (dataUrl: string) => {
      try {
        const head = document.head || document.getElementsByTagName('head')[0];
        if (!head) return;

        // Remove all previous icon tags to force browser tab to refresh the icon
        const existingLinks = document.querySelectorAll("link[rel*='icon']");
        existingLinks.forEach(link => link.remove());

        // Create new standard favicon
        const iconLink = document.createElement('link');
        iconLink.rel = 'icon';
        iconLink.type = 'image/png';
        iconLink.href = dataUrl;
        head.appendChild(iconLink);

        // Create shortcut icon
        const shortcutLink = document.createElement('link');
        shortcutLink.rel = 'shortcut icon';
        shortcutLink.type = 'image/png';
        shortcutLink.href = dataUrl;
        head.appendChild(shortcutLink);

        // Create apple touch icon
        const appleLink = document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        appleLink.href = dataUrl;
        head.appendChild(appleLink);
      } catch (err) {
        console.warn('Erro ao aplicar favicon no documento:', err);
      }
    };

    if (customLogo) {
      // Convert custom image into a clean square 64x64 PNG for crisp browser tab rendering
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, 64, 64);

            // Calculate fit inside 64x64
            const maxDim = 64;
            const ratio = Math.min(maxDim / img.width, maxDim / img.height);
            const w = img.width * ratio;
            const h = img.height * ratio;
            const x = (maxDim - w) / 2;
            const y = (maxDim - h) / 2;

            ctx.drawImage(img, x, y, w, h);
            const faviconDataUrl = canvas.toDataURL('image/png');
            setFavicon(faviconDataUrl);
          } else {
            setFavicon(customLogo);
          }
        } catch (e) {
          setFavicon(customLogo);
        }
      };
      img.onerror = () => {
        setFavicon(customLogo);
      };
      img.src = customLogo;
    } else {
      // Default SVG favicon with EMP branding
      const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#00288e"/><text x="50%" y="54%" dominant-baseline="central" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="20" letter-spacing="1">EMP</text></svg>`;
      const defaultDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(defaultSvg)}`;
      setFavicon(defaultDataUrl);
    }
  }, [customLogo]);

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        onNotify('Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP).', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        onNotify('A imagem deve ter no máximo 5MB.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const rawData = ev.target?.result as string;
        if (!rawData) return;

        // Resize / optimize image using canvas to ensure efficient Firestore storage
        const img = new Image();
        img.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 480;
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const optimizedDataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
              
              setCustomLogo(optimizedDataUrl);
              try {
                localStorage.setItem('emprovex_custom_logo', optimizedDataUrl);
              } catch (err) {
                console.warn('Erro no armazenamento local:', err);
              }

              // Salva no banco de dados Firestore
              await savePlatformLogo(optimizedDataUrl, userEmail || 'aprov1hgesm@gmail.com');
              onNotify('Logotipo salvo com sucesso no banco de dados!', 'success');
            }
          } catch (err) {
            console.error('Erro ao processar e salvar imagem:', err);
            onNotify('Erro ao salvar logotipo no banco de dados.', 'error');
          }
        };
        img.src = rawData;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = async (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCustomLogo(null);
    try {
      localStorage.removeItem('emprovex_custom_logo');
      localStorage.removeItem('emprovium_custom_logo');
    } catch (e) {}
    try {
      await savePlatformLogo(null, userEmail || 'aprov1hgesm@gmail.com');
      onNotify('Logotipo padrão restaurado e sincronizado no banco de dados.', 'info');
    } catch (err) {
      console.error('Erro ao remover logotipo no banco:', err);
      onNotify('Logotipo padrão restaurado localmente.', 'info');
    }
  };


  return {
    customLogo,
    handleLogoUpload,
    handleRemoveLogo,
  };
}
