#!/usr/bin/env node

// Compatibilidade com as duas geracoes da Home. A orbit antiga foi
// substituida por logo discreto e modo Essencial: os guards devem proteger
// a UI ativa, nao exigir um componente removido intencionalmente.
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

if (fs.existsSync('features/inicio/components/InicioOrbitSystem.module.css')) {
  const css = read('features/inicio/components/InicioOrbitSystem.module.css');
  assert(css.includes('--orbit-duration: 136s;'), 'Orbita externa precisa permanecer lenta.');
  assert(css.includes('--orbit-duration: 112s;'), 'Orbita media precisa permanecer lenta.');
  assert(css.includes('--orbit-duration: 88s;'), 'Orbita interna precisa permanecer lenta.');
  assert(css.includes('animation: planetOrbit var(--orbit-duration) linear infinite;'), 'Orbita precisa permanecer continua.');
  assert(css.includes('animation: planetCounterOrbit var(--orbit-duration) linear infinite;'), 'Contrarrotacao precisa acompanhar a orbita.');
  assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'Movimento reduzido deve ser respeitado.');
  console.log('Inicio legacy planet orbit guard: OK');
} else {
  const view = read('features/inicio/components/InicioView.tsx');
  const css = read('features/inicio/components/InicioView.module.css');
  const core = read('features/inicio/components/InicioCore.tsx');
  assert(view.includes('data-lean-home="true"'), 'Início simplificado não está ativo.');
  assert(view.includes('<InicioCore'), 'O nucleo da Home deve estar presente.');
  assert(!view.includes('InicioOrbitSystem'), 'Não reintroduzir componente orbital pesado.');
  assert(core.includes('data-testid="inicio-logo-core"'), 'Nucleo/logo nao localizado.');
  assert(css.includes("[data-performance='balanced']"), 'Modo balanceado precisa ser preservado.');
  assert(css.includes("[data-performance='static']"), 'Modo estatico precisa ser preservado.');
  assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'Movimento reduzido precisa ser respeitado.');
  console.log('Inicio lean home guard: OK (orbita legada removida)');
}
