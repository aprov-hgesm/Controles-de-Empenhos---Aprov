#!/usr/bin/env node

import fs from 'node:fs';

const css = fs.readFileSync('features/inicio/components/InicioOrbitSystem.module.css', 'utf8');
const docs = fs.readFileSync('docs/block-19-home-experience.md', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(css.includes('--orbit-duration: 136s;'), 'Órbita externa precisa permanecer lenta.');
assert(css.includes('--orbit-duration: 112s;'), 'Órbita média precisa permanecer lenta.');
assert(css.includes('--orbit-duration: 88s;'), 'Órbita interna precisa permanecer lenta.');
assert(css.includes('animation: planetOrbit var(--orbit-duration) linear infinite;'), 'Órbita precisa permanecer linear e contínua.');
assert(css.includes('animation: planetCounterOrbit var(--orbit-duration) linear infinite;'), 'Contrarrotação precisa acompanhar a órbita.');
assert(!css.includes('.orbitSlot:hover,\n.orbitSlot:focus-within {\n  animation-play-state: paused;'), 'Hover/focus não deve pausar a órbita.');
assert(css.includes("[data-performance='balanced'] .orbitSlot"), 'Perfil balanced precisa preservar a órbita principal.');
assert(css.includes("[data-performance='static'] .orbitSlot"), 'Perfil static precisa continuar desativando movimento.');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'Movimento reduzido precisa continuar respeitado.');
assert(docs.includes('órbita planetária lenta e contínua'), 'Documentação precisa registrar o refinamento orbital.');

console.log('Inicio slow planet orbit guard: OK');
