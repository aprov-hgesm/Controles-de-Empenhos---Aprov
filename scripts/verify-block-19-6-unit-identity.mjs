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

const page = read('app/page.tsx');
const view = read('features/inicio/components/InicioView.tsx');
const identity = read('features/inicio/components/InicioIdentityPanel.tsx');
const identityCss = read('features/inicio/components/InicioIdentityPanel.module.css');
const workspace = read('lib/workspaceContext.ts');
const docs = read('docs/block-19-home-experience.md');

requireText(view, "import { InicioIdentityPanel }", 'Início não importa o painel de identidade contextual.');
requireText(view, '<InicioIdentityPanel', 'Início não renderiza identidade da unidade.');
requireText(page, "workspaceName={workspaceContext.status === 'sector'", 'Home não recebe nome do workspace validado.');
requireText(page, "organizationName={workspaceContext.status === 'sector'", 'Home não recebe organização institucional.');
requireText(page, "sectionName={workspaceContext.status === 'sector'", 'Home não recebe setor institucional.');
requireText(page, "workspaceUg={workspaceContext.status === 'sector'", 'Home não recebe UG validada.');
requireText(page, "workspaceContext.resolutionSource === 'legacy-hgesm-bootstrap'", 'Workspace fundador não é identificado de forma explícita.');
requireText(identity, 'hashUnitSignature', 'Identidade não possui assinatura determinística da unidade.');
requireText(identity, 'workspaceUg || workspaceName || organizationName', 'Assinatura não usa identidade estável da unidade.');
requireText(identity, 'resolveDayPhase', 'Saudação contextual por período não foi implementada.');
requireText(identity, 'new Date().getHours()', 'Saudação não usa horário local do navegador.');
requireText(identity, 'Workspace fundador', 'Identidade não diferencia workspace fundador.');
requireText(identity, 'Workspace setorial', 'Identidade não diferencia workspace externo.');
requireText(identity, 'NÓ FUNDADOR', 'Nó fundador não possui sinal visual dedicado.');
requireText(identity, 'EMPROVEX ONLINE', 'Estado operacional não está presente na identidade.');
requireText(identityCss, '.identityGrid', 'Identidade institucional não possui estrutura visual.');
requireText(identityCss, '.signature', 'Assinatura visual da unidade não possui estilo.');
requireText(identityCss, '@media (prefers-reduced-motion: reduce)', 'Identidade não respeita reduced motion.');
requireText(workspace, 'institutionalProfile: WorkspaceInstitutionalProfile', 'Contrato de workspace não preserva perfil institucional.');
requireText(docs, 'Bloco 19.6', 'Documentação não registra identidade/UG.');
forbidText(identity, 'email', 'Painel de identidade expõe e-mail operacional.');
forbidText(identity, 'firebase', 'Painel de identidade acoplou Firebase diretamente.');
forbidText(identity, 'onSnapshot', 'Painel de identidade abriu listener Firestore.');
forbidText(identity, 'localStorage', 'Painel de identidade criou persistência local indevida.');

if (findings.length) {
  console.error('BLOCK 19.6 UNIT IDENTITY: FAIL');
  findings.forEach((finding) => console.error('  [BLOCK] ' + finding));
  process.exitCode = 2;
} else {
  console.log('BLOCK 19.6 UNIT IDENTITY: READY');
  console.log('UG + organização: CONTEXTUALIZADAS');
  console.log('Workspace fundador/setorial: DIFERENCIADO');
  console.log('Assinatura da unidade: DETERMINÍSTICA');
  console.log('Dados sensíveis adicionais: ZERO');
  console.log('Realtime adicional: ZERO');
}
