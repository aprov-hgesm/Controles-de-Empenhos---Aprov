#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) findings.push(message);
};
const forbidText = (source, forbidden, message) => {
  if (source.includes(forbidden)) findings.push(message);
};

const constellation = read('features/inicio/components/InicioConstellation.tsx');
const constellationCss = read('features/inicio/components/InicioConstellation.module.css');
const atmosphere = read('features/inicio/components/InicioAtmosphere.tsx');
const atmosphereCss = read('features/inicio/components/InicioAtmosphere.module.css');
const docs = read('docs/block-19-home-experience.md');

requireText(
  constellation,
  'className={styles.operationalStarGlyph}',
  'Empenhos não usam glifo operacional próprio.'
);
requireText(
  constellation,
  'M12 0C12.8 7.2 16.8 11.2 24 12',
  'Glifo de quatro pontas curvas ausente.'
);
requireText(
  constellation,
  'const hitSize = Math.max(STAR_DESKTOP_HITBOX_MIN_PX, node.size + 12)',
  'Área desktop de interação das estrelas não foi ampliada.'
);
requireText(
  constellation,
  "'--star-visual-size' as string",
  'Tamanho visual não está desacoplado da hitbox.'
);
requireText(
  constellationCss,
  '.operationalStarGlyph',
  'CSS do glifo operacional ausente.'
);
requireText(
  constellationCss,
  'min-width: 20px',
  'Hitbox desktop mínima não está protegida.'
);
requireText(
  constellationCss,
  'min-width: 26px',
  'Hitbox touch mínima não está protegida.'
);
requireText(
  constellationCss,
  'clip-path: polygon(',
  'Legenda não diferencia estrelas operacionais.'
);
requireText(constellation, 'keepStarsMutuallySelectable', 'Constelação não evita sobreposição entre hitboxes.');
requireText(constellation, 'STAR_SELECTABLE_CLEARANCE_PX', 'Constelação não preserva folga mínima entre estrelas clicáveis.');
requireText(constellation, 'data-tooltip-x={tooltipX}', 'Tooltip não possui posicionamento horizontal adaptativo.');
requireText(constellation, 'data-tooltip-y={tooltipY}', 'Tooltip não possui posicionamento vertical adaptativo.');
requireText(constellationCss, 'z-index: 35', 'Constelação não fica acima das camadas decorativas internas.');
requireText(constellationCss, ".star[data-tooltip-x='start'] .tooltip", 'Tooltip não protege a borda esquerda da cena.');
requireText(constellationCss, ".star[data-tooltip-x='end'] .tooltip", 'Tooltip não protege a borda direita da cena.');
requireText(constellationCss, ".star[data-tooltip-y='below'] .tooltip", 'Tooltip não protege a borda superior da cena.');
requireText(
  constellation,
  'keepStarsMutuallySelectable',
  'Constelação não evita sobreposição entre hitboxes.'
);
requireText(
  constellation,
  'STAR_SELECTABLE_CLEARANCE_PX',
  'Constelação não preserva folga mínima entre estrelas clicáveis.'
);
requireText(
  constellation,
  'data-tooltip-x={tooltipX}',
  'Tooltip não possui posicionamento horizontal adaptativo.'
);
requireText(
  constellation,
  'data-tooltip-y={tooltipY}',
  'Tooltip não possui posicionamento vertical adaptativo.'
);
requireText(
  constellationCss,
  'z-index: 35',
  'Constelação não fica acima das camadas decorativas internas.'
);
requireText(
  constellationCss,
  ".star[data-tooltip-x='start'] .tooltip",
  'Tooltip não protege a borda esquerda da cena.'
);
requireText(
  constellationCss,
  ".star[data-tooltip-x='end'] .tooltip",
  'Tooltip não protege a borda direita da cena.'
);
requireText(
  constellationCss,
  ".star[data-tooltip-y='below'] .tooltip",
  'Tooltip não protege a borda superior da cena.'
);

requireText(
  atmosphere,
  'const shootingStars = Array.from({ length: 7 }',
  'Camada de estrelas cadentes não possui densidade controlada.'
);
requireText(
  atmosphere,
  'className={styles.shootingStar}',
  'Estrelas cadentes não são renderizadas.'
);
requireText(
  atmosphereCss,
  '.shootingStar {',
  'CSS de estrelas cadentes ausente.'
);
requireText(
  atmosphereCss,
  '@keyframes shootingStarFlight',
  'Movimento rápido das estrelas cadentes ausente.'
);
requireText(
  atmosphereCss,
  '.deepStar {',
  'Partículas profundas circulares foram removidas.'
);
requireText(
  atmosphereCss,
  'border-radius: 999px',
  'Partículas decorativas deixaram de ser circulares.'
);
requireText(
  atmosphereCss,
  '.shootingStar:nth-child(n+4)',
  'Mobile/balanced não reduz estrelas cadentes.'
);
requireText(
  atmosphereCss,
  "[data-performance='static'] .shootingStar",
  'Perfil static não remove estrelas cadentes.'
);
requireText(
  atmosphereCss,
  '@media (prefers-reduced-motion: reduce)',
  'Reduced motion não está protegido.'
);
requireText(
  docs,
  'Bloco 21 — estrelas operacionais e meteoros atmosféricos',
  'Documentação do Bloco 21 ausente.'
);

forbidText(constellation, 'onSnapshot', 'Constelação abriu listener Firestore.');
forbidText(atmosphere, 'onSnapshot', 'Atmosfera abriu listener Firestore.');
forbidText(constellation, '<canvas', 'Constelação introduziu Canvas.');
forbidText(atmosphere, '<canvas', 'Atmosfera introduziu Canvas.');
forbidText(constellation, 'three.js', 'Constelação introduziu Three.js.');
forbidText(atmosphere, 'three.js', 'Atmosfera introduziu Three.js.');

if (findings.length) {
  console.error('BLOCK 21 OPERATIONAL STARS + SHOOTING STARS: FAIL');
  findings.forEach((finding) => console.error('  [BLOCK] ' + finding));
  process.exitCode = 2;
} else {
  console.log('BLOCK 21 OPERATIONAL STARS + SHOOTING STARS: READY');
  console.log('Empenhos em estrela de quatro pontas: ATIVO');
  console.log('Hitbox ampliada: ATIVA');
  console.log('Partículas decorativas circulares: PRESERVADAS');
  console.log('Estrelas cadentes rápidas: ATIVAS');
  console.log('Balanced/static/reduced motion: PROTEGIDOS');
  console.log('Firestore adicional: ZERO');
}
