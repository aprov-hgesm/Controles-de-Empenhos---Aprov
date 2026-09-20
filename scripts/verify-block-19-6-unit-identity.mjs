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

const view = read('features/inicio/components/InicioView.tsx');
const identity = read('features/inicio/components/InicioIdentityPanel.tsx');
const identityCss = read('features/inicio/components/InicioIdentityPanel.module.css');
const docs = read('docs/block-19-home-experience.md');

requireText(view, "import { InicioIdentityPanel }", 'Início não importa a saudação compacta.');
requireText(view, '<InicioIdentityPanel userDisplayName={userDisplayName} />', 'Início não renderiza a saudação compacta.');
requireText(identity, 'resolveDayPhase', 'Saudação contextual por período não foi preservada.');
requireText(identity, 'new Date().getHours()', 'Saudação não usa horário local do navegador.');
requireText(identity, "split(/\\s+/)[0]", 'Saudação não limita o nome ao primeiro nome.');
requireText(identity, 'data-testid="inicio-identity"', 'Saudação perdeu âncora E2E.');
requireText(identityCss, 'font-size: clamp(23px, 3vw, 34px)', 'Saudação não utiliza escala compacta.');
requireText(identityCss, '@media (max-width: 420px)', 'Saudação não possui compactação narrow-phone.');
requireText(docs, 'Bloco 19.6', 'Documentação não registra o bloco de identidade.');

forbidText(identity, 'Organização', 'Home voltou a exibir cartão de organização.');
forbidText(identity, 'Ambiente', 'Home voltou a exibir cartão de ambiente.');
forbidText(identity, 'EMPROVEX ONLINE', 'Home voltou a exibir status online redundante.');
forbidText(identity, 'NÓ FUNDADOR', 'Home voltou a exibir marcador fundador.');
forbidText(identity, 'Fingerprint', 'Home voltou a exibir assinatura técnica da unidade.');
forbidText(identity, 'workspaceName', 'Saudação voltou a depender do workspace.');
forbidText(identity, 'organizationName', 'Saudação voltou a depender da organização.');
forbidText(identity, 'workspaceUg', 'Saudação voltou a exibir UG.');
forbidText(identity, 'firebase', 'Saudação acoplou Firebase diretamente.');
forbidText(identity, 'onSnapshot', 'Saudação abriu listener Firestore.');
forbidText(identity, 'localStorage', 'Saudação criou persistência local indevida.');

if (findings.length) {
  console.error('BLOCK 19.6 COMPACT IDENTITY: FAIL');
  findings.forEach((finding) => console.error('  [BLOCK] ' + finding));
  process.exitCode = 2;
} else {
  console.log('BLOCK 19.6 COMPACT IDENTITY: READY');
  console.log('Saudação por período: PRESERVADA');
  console.log('Nome: COMPACTO');
  console.log('Organização/ambiente/status: REMOVIDOS');
  console.log('Realtime adicional: ZERO');
}
