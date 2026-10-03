# SAAS R1 — HARDEN-A1 — jsPDF Security

Base congelada: `9a294bc543ec7150b9144ed96e767a161864d72f`

## Objetivo

Eliminar o blocker CRITICAL da linha jsPDF 2.5.x sem misturar a correção Firebase/Firestore/gRPC e preservando os contratos de PDF do EMPROVEX.

## Versões

Antes:
- jsPDF: 2.5.2 resolvido (`^2.5.1` declarado)
- jsPDF-AutoTable: 3.8.4 resolvido (`^3.8.2` declarado)
- DOMPurify: 2.5.9 optional/transitivo

Depois:
- jsPDF: 4.2.1
- jsPDF-AutoTable: 5.0.8
- DOMPurify: 3.4.15 optional/transitivo

## Consumidores auditados

- `lib/pdfToolkit.ts`
- `features/cronogramas/hooks/useCronogramaActions.ts`
- `features/relatorios/hooks/useDocumentActions.ts`
- `features/warehouse/pdf/WarehouseAllocationSheet.ts`
- `features/warehouse/pdf/WarehouseOutboundDocuments.ts`
- `features/warehouse/pdf/warehouseLabelsPdf.ts`

## Breaking changes e adaptação

O AutoTable 5 não deve depender de autoaplicação implícita do plugin fora do browser. O toolkit foi ajustado para retornar os exports nomeados `jsPDF` e `autoTable`, mantendo `import()` dinâmico e a chamada já existente `autoTable(doc, options)`.

A mudança de jsPDF preserva os métodos usados pelo EMPROVEX: construtor, `text`, `save`, `output`, `autoPrint` e APIs de paginação. Nenhum refactor funcional foi feito.

## Regressão automatizada

`npm run test:harden-a1-pdf` cobre:
- geração real de PDF com assinatura `%PDF-`;
- `output('arraybuffer')`;
- `output('blob')`;
- AutoTable 5 com paginação real;
- preservação dos boundaries lazy em toolkit, Cronogramas, Relatórios, Alocação e Saída;
- teste já existente de etiquetas, incluindo geração de Blob PDF A4.

## Matriz funcional

| Superfície | Evidência automatizada | Visual/manual |
| --- | --- | --- |
| Cronogramas | TypeScript/build + boundary lazy + API AutoTable smoke | PENDENTE DE VALIDAÇÃO MANUAL |
| Relatórios/Termo | TypeScript/build + boundary lazy + API AutoTable smoke | PENDENTE DE VALIDAÇÃO MANUAL |
| Alocação | TypeScript/build + import dinâmico + jsPDF smoke | PENDENTE DE VALIDAÇÃO MANUAL |
| Saída | TypeScript/build + import dinâmico + jsPDF smoke | PENDENTE DE VALIDAÇÃO MANUAL |
| Etiquetas | teste existente gera Blob PDF A4 não vazio | PENDENTE DE VALIDAÇÃO MANUAL |

## Performance R3

O carregamento lazy do toolkit foi preservado. Alocação e Saída continuam usando `await import('jspdf')`. A alteração não introduz import estático novo nas superfícies que já eram lazy.

## Impacto MOBILE-R1

DELTA COMPATÍVEL: `package.json` e `package-lock.json` são compartilhados, mas a mudança é limitada à pilha PDF. Nenhum contrato Mobile, scanner, Auth, Firestore, workspace/UG ou lifecycle foi alterado. O HEAD composto deve repetir build/CI após integração.

## Fora de escopo

- Firebase/Firestore/gRPC não alterado.
- Nenhum `npm audit fix --force`.
- Nenhum `next.config.ts` / CT-01.
- Nenhum deploy, Rules, restore, piloto, RC ou produção.

## Validação

O PR da frente deve registrar separadamente:
- `npm ci`;
- `npm audit`;
- TypeScript;
- Production Build;
- Application CI;
- Core Protection;
- Recovery/Legal quando aplicável;
- Diff Hygiene;
- `npm run test:harden-a1-pdf`.

A validação visual dos layouts permanece explicitamente manual; CI verde não deve ser convertido em PASS visual por inferência.
