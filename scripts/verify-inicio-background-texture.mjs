#!/usr/bin/env node

import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const view = read('features/inicio/components/InicioView.tsx');
const css = read('features/inicio/components/InicioView.module.css');
const docs = read('docs/block-19-home-experience.md');

assert(view.includes('className={styles.texture}'), 'A Home precisa manter a camada dedicada de textura.');
assert(css.includes('.texture {'), 'A folha de estilo precisa definir a textura do Início.');
assert(css.includes('radial-gradient(circle at 1px 1px'), 'A textura precisa manter microgrão pontilhado leve.');
assert(css.includes('repeating-linear-gradient('), 'A textura precisa manter a trama técnica estática.');
assert(css.includes('repeating-radial-gradient('), 'A textura precisa manter os anéis topográficos discretos.');
assert(css.includes("z-index: 1;"), 'A textura deve ficar abaixo da constelação e acima da atmosfera.');
assert(css.includes('pointer-events: none;'), 'A textura jamais pode bloquear interação.');
assert(css.includes(".scene[data-performance='balanced'] .texture"), 'Perfil balanced precisa reduzir a textura.');
assert(css.includes(".scene[data-performance='static'] .texture"), 'Perfil static precisa reduzir a textura.');

const textureBlock = css.slice(css.indexOf('.texture {'), css.indexOf('.grid {'));
assert(!textureBlock.includes('animation:'), 'A textura de fundo não deve introduzir animação contínua.');
assert(!textureBlock.includes('url('), 'A textura deve permanecer CSS-only, sem imagem externa/embutida.');
assert(!textureBlock.includes('filter: blur'), 'A textura não deve adicionar blur GPU caro.');

assert(docs.includes('textura técnica do fundo'), 'A documentação da Home precisa registrar a textura adicional.');
assert(docs.includes('nenhuma animação contínua nova'), 'A documentação precisa preservar o contrato de performance.');

console.log('Inicio background texture guard: OK');
