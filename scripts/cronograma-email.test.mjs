#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const gmail = read('lib/googleWorkspaceMail.ts');
const supplier = read('lib/supplierEmailResolver.ts');
const hook = read('features/cronogramas/hooks/useCronogramaActions.ts');
const view = read('features/cronogramas/components/CronogramasView.tsx');
const dialog = read('features/cronogramas/components/CronogramaEmailDialog.tsx');
const types = read('lib/types.ts');
const drive = read('lib/googleDriveWorkspace.ts');

test('Gmail usa escopo mínimo de envio e conta configurada no Drive', () => {
  assert.match(gmail, /https:\/\/www\.googleapis\.com\/auth\/gmail\.send/);
  assert.doesNotMatch(gmail, /https:\/\/mail\.google\.com\//);
  assert.match(gmail, /gmail\/v1\/users\/me\/messages\/send/);
  assert.match(gmail, /expectedSenderEmail/);
  assert.match(gmail, /authorizedEmail !== expectedEmail/);
  assert.match(gmail, /A Conta Google selecionada para o Gmail não corresponde/);
  assert.match(drive, /export function getGoogleOAuthClientId/);
});

test('token do Gmail permanece efêmero e autorização é separada do Firebase', () => {
  assert.match(gmail, /let activeGmailRuntime: GmailRuntime \| null = null/);
  assert.match(gmail, /authorizeWorkspaceGmail/);
  assert.doesNotMatch(gmail, /localStorage|sessionStorage|refresh_token|setDoc\(/);
  assert.doesNotMatch(gmail, /reauthenticateWithPopup|GoogleAuthProvider/);
});

test('destinatário prioriza cadastro local e usa pré-cadastro global por CNPJ como fallback', () => {
  const localReturn = supplier.indexOf("source: 'local'");
  const globalLookup = supplier.indexOf(
    'const directory = await getGlobalSupplierDirectory(userId)',
    localReturn
  );

  assert.ok(localReturn > 0);
  assert.ok(
    globalLookup > localReturn,
    'A leitura global deve ocorrer somente depois do retorno possível do e-mail local.'
  );
  assert.match(supplier, /normalizeSupplierCnpj\(empenho\.supplierCnpj\)/);
  assert.match(supplier, /if \(localEmail\) \{/);
  assert.match(supplier, /if \(!cnpj\) return null;/);
  assert.match(supplier, /source: 'global'/);
});

test('cronograma gera PDF em memória, confirma envio e registra auditoria', () => {
  assert.match(hook, /action: 'download' \| 'print' \| 'blob'/);
  assert.match(hook, /doc\.output\('blob'\)/);
  assert.match(hook, /resolveSupplierEmailForEmpenho/);
  assert.match(hook, /loadWorkspaceDriveSettings/);
  assert.match(hook, /authorizeWorkspaceGmail/);
  assert.match(hook, /sendWorkspaceGmailMessage/);
  assert.match(hook, /ultimoEnvioEmail/);
  assert.match(hook, /messageId: sent\.messageId/);
  assert.match(hook, /await saveCronograma\(user\.uid, cronogramaBeforeSend\)/);
  assert.match(hook, /await saveCronograma\(user\.uid, cronogramaAfterSend\)/);
});

test('interface oferece envio e mostra último envio', () => {
  assert.match(view, /Enviar por e-mail/);
  assert.match(view, /handleSendCronogramaEmail/);
  assert.match(view, /isSendingCronogramaEmail/);
  assert.match(view, /Último envio/);
  assert.match(types, /export interface CronogramaEmailEnvio/);
  assert.match(types, /fonteEmailFornecedor: 'local' \| 'global' \| 'manual'/);
});

test('envio usa modal do EMPROVEX com destinatário editável, confirmação e cancelamento', () => {
  assert.doesNotMatch(hook, /window\.confirm\(/);
  assert.match(hook, /setCronogramaEmailConfirmation\(/);
  assert.match(hook, /confirmCronogramaEmail/);
  assert.match(hook, /cancelCronogramaEmail/);
  assert.match(view, /<CronogramaEmailDialog/);
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /type="email"/);
  assert.match(dialog, /Confirmar e enviar/);
  assert.match(dialog, /Cancelar/);
});

test('opção de atualizar Fornecedores é voluntária e somente após envio confirmado', () => {
  assert.match(dialog, /changedRecipient &&/);
  assert.match(dialog, /checked={saveSupplierEmail}/);
  assert.match(dialog, /Salvar este e-mail no cadastro do fornecedor/);
  assert.match(hook, /setSaveEmailInSupplierRecord\(false\)/);
  assert.match(hook, /changedEmail && saveEmailInSupplierRecord/);
  assert.match(hook, /shouldSaveContact && !draft\.podeSalvarContato/);
  assert.match(hook, /contactSaved \? 'local' : 'manual'/);
  assert.ok(
    hook.indexOf('await saveSupplierEmailForEmpenho(') > hook.indexOf('const sent = await sendWorkspaceGmailMessage('),
    'Cadastro somente pode ser atualizado após envio confirmado pelo Gmail.'
  );
  assert.match(supplier, /if \(!cnpj \|\| !isValidSupplierCnpj\(cnpj\)\)/);
  assert.match(supplier, /\{ \.\.\.existing, email, updatedAt: now, updatedBy: userId \}/);
  assert.match(supplier, /await saveSupplierContact\(userId, updated\)/);
});

test('falha ao atualizar contato não exige um segundo envio de e-mail', () => {
  assert.match(hook, /contactSaveFailed = true/);
  assert.match(hook, /Confira a pasta Enviados antes de tentar novamente/);
  assert.match(hook, /destinatario: recipient/);
});

test('Gmail monta um MIME multipart com os dois anexos PDF independentes', () => {
  assert.match(gmail, /additionalAttachments\?: Array/);
  assert.match(gmail, /\.\.\.\(input\.additionalAttachments \|\| \[\]\)/);
  assert.match(gmail, /for \(const item of attachments\)/);
  assert.match(gmail, /Content-Disposition: attachment; filename=/);
  assert.match(gmail, /bytesToBase64\(attachmentBytes\)/);
  assert.match(gmail, /MAX_GMAIL_PDF_TOTAL_BYTES/);
  assert.match(gmail, /String\.fromCharCode\(\.\.\.prefix\) !== '%PDF-'/);
});

test('cronograma envia o PDF da NE atual a partir do Drive junto ao PDF gerado', () => {
  assert.match(hook, /fetchEmpenhoPdfBlob/);
  assert.match(hook, /emp\.notaEmpenhoPdf\.storage\?\.status !== 'active'/);
  assert.match(hook, /notaEmpenhoPdf = await fetchEmpenhoPdfBlob\(user, emp\.id, emp\.notaEmpenhoPdf\)/);
  assert.match(hook, /additionalAttachments: \[/);
  assert.match(hook, /\{ blob: notaEmpenhoPdf, name: draft\.notaEmpenhoFilename \}/);
  assert.ok(
    hook.indexOf('await fetchEmpenhoPdfBlob(') < hook.indexOf('const sent = await sendWorkspaceGmailMessage('),
    'O PDF da NE deve estar disponível antes de chamar o Gmail.'
  );
  assert.match(hook, /Nenhum e-mail foi enviado/);
  assert.match(hook, /Cronograma de Entrega e a Nota de Empenho/);
  assert.match(dialog, /Anexos obrigatórios \(2 PDFs\)/);
  assert.match(dialog, /draft\.notaEmpenhoFilename/);
});

test('MIME real gera dois anexos independentes e não envia MIME inválido', async () => {
  const exported = gmail.replace(
    'async function buildRawMimeMessage(',
    'export async function buildRawMimeMessage('
  );
  assert.notEqual(exported, gmail, 'O construtor MIME esperado não foi localizado.');
  const transpiled = ts.transpileModule(exported, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiled = { exports: {} };
  runInNewContext(transpiled, {
    module: compiled,
    exports: compiled.exports,
    TextEncoder,
    Uint8Array,
    Blob,
    btoa,
    crypto: webcrypto,
    require(specifier) {
      if (specifier === './googleDriveWorkspace') return { getGoogleOAuthClientId: () => 'test' };
      if (specifier === './platformIdentity') return { normalizePlatformEmail: (value) => value };
      throw new Error('Importação não autorizada no teste MIME: ' + specifier);
    },
  });
  const build = compiled.exports.buildRawMimeMessage;
  assert.equal(typeof build, 'function');

  const sample = (name, content) => ({
    blob: new Blob(['%PDF-1.4\n', content], { type: 'application/pdf' }),
    name,
  });
  const cronograma = sample('Cronograma_NE_123.pdf', 'CRONOGRAMA_TESTE');
  const nota = sample('Nota_Empenho_NE_123.pdf', 'EMPENHO_TESTE');
  const input = {
    workspaceId: 'teste',
    expectedSenderEmail: 'setor@example.org',
    to: 'fornecedor@example.org',
    subject: 'Cronograma de Entrega - NE 123',
    bodyText: 'Encaminhamos o cronograma e a nota de empenho.',
    attachment: cronograma.blob,
    attachmentName: cronograma.name,
    additionalAttachments: [nota],
  };
  const raw = await build(input, 'setor@example.org');
  const mime = Buffer.from(raw, 'base64url').toString('utf8');

  assert.equal((mime.match(/Content-Disposition: attachment; filename=/g) || []).length, 2);
  assert.match(mime, /filename="Cronograma_NE_123.pdf"/);
  assert.match(mime, /filename="Nota_Empenho_NE_123.pdf"/);
  assert.match(mime, /Content-Type: multipart\/mixed/);
  const encodedBodies = Array.from(
    mime.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([^\r\n]+)/g),
    (match) => Buffer.from(match[1], 'base64').toString('utf8')
  );
  assert.equal(encodedBodies.length, 3); // corpo do e-mail + dois PDFs
  assert.match(encodedBodies[1], /CRONOGRAMA_TESTE/);
  assert.match(encodedBodies[2], /EMPENHO_TESTE/);

  await assert.rejects(
    () => build({ ...input, additionalAttachments: [{ name: 'NE.pdf', blob: new Blob(['inválido']) }] }, 'setor@example.org'),
    /não é um PDF válido/
  );
  await assert.rejects(
    () => build({ ...input, additionalAttachments: [{ name: 'NE.pdf', blob: { size: 18 * 1024 * 1024 } }] }, 'setor@example.org'),
    /17 MB/
  );
});
