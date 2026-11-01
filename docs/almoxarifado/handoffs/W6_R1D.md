# EMPROVEX Almoxarifado — Handoff W6 R1-D

**Estado:** EM PR — sem homologação final, merge ou publicação.
**Base exata:** PR #441, `feat/emprovex-almox-r1-w5-integration`, SHA `d89781d5347d04173af98bcc50c71d99bfb8f663`.
**Branch de execução:** `feat/emprovex-almox-r1d-w6-financial`.
**Destino:** W9. Este handoff não altera o memorial compartilhado.

## Inspeções e decisões

- PR #436 de fundação e PR #441 de integração seguem abertas; W5 contém os contratos e integração W1–W5.
- A `main` inspecionada estava em `4f803e5795109fc02a24cb2bb7eee12353ba1efe` e diverge da W5 (17 commits à frente na comparação, com histórico W5 próprio). Não foi feito rebase ou merge.
- Expansão Empresas pausada; PR #447 não é dependência e nenhum arquivo empresarial foi modificado.
- O armazenamento financeiro vigente é `workspaces/{workspaceId}/empenhos|invoices|cronogramas`, via `lib/firebaseSync.ts`, `operationalPaths.ts`, `empenhoConcurrencyService`, `nsIntegrityService`. A UG NÃO é identificador de isolamento.
- Os módulos financeiros existentes são mantidos; nenhuma nova coleção ou endpoint financeiro foi criado. W6 não modifica Warehouse, Firestore Rules, billing, Admin, login ou portal.

## Entregas disponíveis para integração do W9

1. `features/almoxarifado/financeiro/sectorFinancialPolicy.ts`: classificação setorial sem QR/CALI/PASA, projeção determinística de saldos de empenho, recebimentos parciais, documentos NF únicos, remessas e verificador de escopo por workspace autenticado/UID.
2. `features/almoxarifado/financeiro/AlmoxFinancialSurfaces.tsx`: `AlmoxEmpenhosSurface`, `AlmoxNotasFiscaisSurface` e `AlmoxCronogramasSurface` recebem contexto de workspace validado, usuário Firebase e os contextos dos componentes financeiros existentes. A montagem verifica o workspace operacional corrente antes de renderizar.
3. Empenhos: `EmpenhosView` e `useEmpenhoActions` aceitam a modalidade setorial opcional; para Almoxarifado o padrão é FUNADOM, classes exclusivamente alimentares não são ofertadas e TR/comissão não são operados. O legado mantém a regra QR.
4. Notas Fiscais: `NotasFiscaisView` e `useNotasFiscaisActions` aceitam modalidade opcional; abas e ações CREM/TREM/comissão são bloqueadas no Almoxarifado. Permanecem as ações reais de NF, saldo do empenho, anexo, espelho, consulta e encaminhamento à Tesouraria, todas pelo mesmo fluxo/coleções do Aprovisionamento.
5. Cronogramas: `CronogramasView` aceita modalidade opcional e `useCronogramaActions` já recebe `workspaceContext`; usam notas, rubrica e textos do setor não alimentar. A superfície verifica o somatório planejado por item, inclusive remessas parciais, antes de delegar ao mesmo `saveCronograma`.
6. `scripts/emprovex-almox-w6-financial.test.mjs`: cenários sintéticos de workspace, UID, origem, classe, saldo, NF duplicada e remessas. Workflow `emprovex-almox-w6-r1d.yml` executa `npm ci`, `npm run typecheck`, testes e `npm run build` sem deploy.

## Contrato de montagem obrigatório (W9)

- Montar as três superfícies somente após resolução de `platformAccess` autenticada e `workspaceContext` da modalidade `almoxarifado`, com `Firebase User` da sessão real.
- Reutilizar o estado e **as mesmas ações** dos hooks `useEmpenhoActions`, `useNotasFiscaisActions`, `useCronogramaActions`, fornecendo os `context` já esperados pelas views. Passar `sectorType: 'almoxarifado'` explicitamente aos hooks de Empenhos e NF; no Cronograma passar `workspaceContext` autorizado.
- Inicializar formulário manual de empenho com `classification: 'FUNADOM'`. Não deixar o estado de registro iniciar em `QR` por herança. Seleção de classe deve ser humana para qualquer documento de classe incompatível.
- Não usar rotas ou e-mails como prova de tenant. Nunca compartilhar coleções entre UGs/workspaces. A checagem de montagem é defesa adicional; Firebase Rules e operações transacionais continuam mandatórias.
- A enumeração histórica `localizacaoAtual: 'APROVISIONAMENTO'` é reutilizada como estado interno de origem de NF, mas exibida como Almoxarifado no novo portal; qualquer alteração desse enum é mudança de contrato fora do W6 e exige integração controlada no W9.
- Não habilitar ações de CREM/TREM/comissão QR, não interpretar geração de NF como entrada no estoque e não efetuar movimentação Warehouse ao salvar empenho, NF ou cronograma.
- Não ativar a importação real do Pedido SISCOFIS enquanto o layout PDF oficial não for homologado. A ferramenta sintética W5 permanece delimitada.

## Estado funcional e condições

| Capacidade | Estado W6 |
| --- | --- |
| Cadastro de empenho, classificação, CNPJ, itens, valores e PDFs | Ações existentes adaptadas, aguardam montagem do W9 e certificação CI |
| NFs associadas, parciais, edição, histórico, espelho e documento | Ações existentes reaproveitadas, aguardam montagem e certificação CI |
| Saldo de empenho e NF sem dupla baixa | Projeção determinística com testes sintéticos |
| Cronogramas por empenho, remessas, PDF, e-mail confirmado | Ações existentes e validação de remessas, aguardam montagem e certificação CI |
| Filtro CREM/TREM/comissão QR | Condicionado por setor; preservado para Aprovisionamento |
| Baixa automática ou ledger Warehouse | Fora de escopo; nenhuma chamada W6 |
| Teste com dados reais, Firebase Emulator e permissão efetiva Firestore | NÃO EXECUTADO neste handoff; necessário na homologação W9 |
| Portal `/almoxarifado` com navegação financeira | PERTENCE AO W9 e não foi alterado |

Os testes sintéticos não substituem a homologação de segurança do Firebase com dois workspaces, a conferência da renderização com dados reais nem o fluxo de usuário do portal. Não declarar essas operações como PASS sem evidência correspondente.
