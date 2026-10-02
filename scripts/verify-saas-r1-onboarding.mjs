#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const operationalData = read('hooks/useOperationalData.ts');
const login = read('components/auth/EmprovexLogin.tsx');
const page = read('app/page.tsx');
const header = read('components/layout/AppHeader.tsx');
const credentials = read('components/auth/SectorCredentialModal.tsx');
const checklist = read('components/auth/SectorFirstAccessChecklist.tsx');
const provisioningModal = read('components/admin/CreateSectorModal.tsx');
const provisioning = read('lib/sectorProvisioning.ts');
const access = read('lib/platformAccess.ts');

requireText(operationalData, 'sendPasswordResetEmail', 'Recuperação self-service não usa Firebase Auth.');
requireText(operationalData, 'PASSWORD_RESET_CONFIRMATION', 'Recuperação não possui resposta neutra contra enumeração de contas.');
requireText(operationalData, "normalizedEmail === HGESM_SECTOR_EMAIL", 'Fluxo de senha não protege a conta fundadora Google-only.');
requireText(operationalData, 'reauthenticateWithCredential', 'Troca de senha não reautentica o usuário externo.');
requireText(operationalData, 'updatePassword(currentUser, newPassword)', 'Troca de senha não usa Firebase Auth.');
requireText(operationalData, "tokenResult.signInProvider !== 'password'", 'Troca de senha não valida provider password.');
requireText(operationalData, 'describeSectorAuthorizationFailure', 'Códigos internos de identidade não são traduzidos para UX humana.');
requireText(operationalData, 'O e-mail desta credencial ainda não está verificado.', 'Primeiro acesso não trata e-mail não verificado.');
requireText(operationalData, 'SESSION_CAPACITY_EXCEEDED_MESSAGE', 'Limite de sessões deixou de usar a mensagem operacional consolidada.');
forbidText(operationalData, 'Falha de autorização do workspace [', 'Código técnico de workspace voltou a ser exposto ao usuário.');
forbidText(operationalData, 'console.log(currentPassword', 'Senha atual não pode ser registrada em log.');
forbidText(operationalData, 'console.log(newPassword', 'Nova senha não pode ser registrada em log.');

requireText(login, 'Esqueci minha senha', 'Tela de login não oferece recuperação de senha.');
requireText(login, 'sector-password-recovery-submit', 'Recuperação de senha não possui superfície testável.');
requireText(login, 'a resposta não confirma se existe uma conta cadastrada', 'UX não explica a resposta neutra de recuperação.');
requireText(page, 'onRequestPasswordReset={requestSectorPasswordReset}', 'Login não está ligado ao reset self-service.');
requireText(page, 'SectorCredentialModal', 'Aplicação não expõe troca de senha ao usuário externo.');
requireText(page, 'SectorFirstAccessChecklist', 'Aplicação não expõe checklist curto de primeiro acesso.');
requireText(header, 'Minha conta', 'Header não oferece caminho persistente para credenciais do usuário externo.');

requireText(credentials, 'Senha atual', 'Troca de senha não solicita reautenticação de forma clara.');
requireText(credentials, 'O EMPROVEX não grava sua senha no Firestore', 'UX não esclarece o tratamento da senha.');
requireText(checklist, 'localStorage', 'Checklist deveria persistir somente no navegador.');
forbidText(checklist, 'firebase/firestore', 'Checklist não pode criar persistência Firestore.');
requireText(checklist, 'Google Drive é opcional', 'Checklist não preserva Drive como opcional.');
requireText(checklist, 'Começar a usar', 'Checklist não possui encerramento curto.');

requireText(provisioningModal, 'Entregue a credencial inicial ao operador por um canal seguro', 'Provisionamento não orienta entrega segura da credencial inicial.');
requireText(provisioningModal, 'A conexão com o Google Drive é opcional', 'Provisionamento ainda trata Drive como etapa obrigatória.');
forbidText(provisioning, 'password:', 'Senha não pode ser persistida nos registros do workspace/platformAccount.');
requireText(access, 'signInProvider !== SECTOR_AUTH_PROVIDER', 'Setor externo deixou de exigir provider password.');
requireText(access, 'signInProvider !== FOUNDER_AUTH_PROVIDER', 'Fundador deixou de exigir provider Google.');

if (findings.length) {
  console.error('SAAS-C — onboarding e credenciais\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nSAAS-C ONBOARDING: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('SAAS-C — onboarding e credenciais\n');
  console.log('Onboarding: assistido, sem signup público');
  console.log('Recuperação de senha: Firebase Auth self-service com resposta neutra');
  console.log('Troca de senha: reautenticação + Firebase Auth');
  console.log('Fundador: Google-only preservado');
  console.log('Primeiro acesso: checklist curto, local e não bloqueante');
  console.log('Google Drive: opcional');
  console.log('Códigos técnicos: mantidos fora da UX');
  console.log('\nSAAS-C ONBOARDING: READY');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}

function forbidText(source, forbidden, message) {
  if (source.includes(forbidden)) findings.push(message);
}
