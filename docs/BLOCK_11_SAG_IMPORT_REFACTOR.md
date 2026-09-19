# EMPROVEX — Bloco 11 — refatoração conservadora do SagImportView

## Objetivo

O Bloco 11 reduz a complexidade estrutural de `SagImportView.tsx` sem alterar regras de negócio,
contratos SAG, persistência, identidade UG + NS, confirmação humana ou experiência funcional.

Baseline antes da refatoração:

```text
SagImportView.tsx
1.525 linhas
~75 KB
```

Após a decomposição, o arquivo principal permanece como **orquestrador** e fica abaixo de 900 linhas.

## Princípio

A refatoração segue uma regra estrita:

> estado e decisões ficam no orquestrador; componentes extraídos apenas apresentam dados e encaminham callbacks.

Nenhum componente extraído importa Firestore, executa transação, interpreta JSON, reconcilia NS ou grava dados.

## Componentes extraídos

### SagImportProgress

Responsável apenas pela navegação visual das quatro etapas.

### SagSupplierStep

Responsável por:

- busca visual de fornecedor;
- cards por CNPJ;
- estado visual de seleção;
- recolhimento/expansão do seletor.

A seleção continua sendo controlada pelo callback do `SagImportView`.

### SagPromptStep

Responsável pela apresentação de:

- favorecido selecionado;
- link para o SAG;
- UG da Organização Militar;
- estado de incompatibilidade de UG;
- botão de copiar o prompt.

O prompt continua sendo construído no orquestrador por `buildSagNsExtractionPrompt`.

### SagApplicationPreviewSection

Responsável pela apresentação da prévia final:

- ALTERAR;
- SEM ALTERAÇÃO;
- IGNORAR;
- BLOQUEAR;
- filtros;
- cards mobile;
- tabela desktop;
- ação para abrir revisão de persistência.

O plano continua sendo calculado no orquestrador por `buildSagNsApplicationPreview`.

### SagApplyConfirmationDialog

Responsável apenas pela confirmação humana final.

A função que executa a persistência continua em `SagImportView`, utilizando:

```text
onApplySagNsImport(
  effectivePayload,
  selectedSupplier.cnpj,
  confirmationFingerprint
)
```

## Responsabilidades que permanecem no SagImportView

O orquestrador continua sendo o único responsável por:

- estado da importação;
- seleção lógica do favorecido;
- construção do prompt;
- parsing do JSON;
- validação do CNPJ;
- imposição da UG do workspace;
- reconciliação;
- preview model;
- fingerprint;
- abertura/fechamento da confirmação;
- chamada de persistência;
- tratamento do resultado transacional.

## Segurança

Os componentes extraídos não podem importar:

```text
firebase/firestore
```

Também não podem executar `setDoc`, `updateDoc`, `addDoc`, `runTransaction` ou chamar
`onApplySagNsImport` diretamente.

A escrita continua mediada pelas camadas já validadas dos Blocos 7–10.

## Guards legados

Os guards existentes do SAG foram adaptados para ler a superfície composta, e não apenas um arquivo:

- SAG import assistant;
- SAG application preview;
- SAG UX;
- NS UG identity.

As exigências desses guards não foram relaxadas.

## E2E

O Browser E2E passa a verificar também a composição refatorada:

```text
login
→ Relatórios
→ Importar NS — SAG
→ progresso visível
→ selecionar fornecedor
→ SAG/prompt visível
→ UG 160416 visível
```

As suites determinísticas existentes continuam verificando contrato, reconciliação, preview,
idempotência, hardening, NS integrity, UG e persistência.

## Critério de aceite

O Bloco 11 está pronto quando:

1. `SagImportView.tsx` fica abaixo de 900 linhas;
2. componentes extraídos são estritamente apresentacionais;
3. estado e persistência permanecem no orquestrador;
4. guards SAG existentes permanecem verdes;
5. guard estrutural do Bloco 11 passa;
6. Browser E2E confirma a composição visual;
7. TypeScript e build de produção permanecem verdes;
8. não existe alteração intencional de comportamento.
