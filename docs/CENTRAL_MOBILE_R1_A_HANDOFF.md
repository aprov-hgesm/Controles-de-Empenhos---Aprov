# MOBILE-A — HANDOFF

## Identidade

- **Branch:** `mobile-r1-a-platform-scanner`
- **HEAD de código certificado:** `86aa9962f82f1d37ff4d19d4c33c859bf0d777cb`
- **Base congelada:** `53e28b81874ee1b7ce0bd484cc7a97537aa99473`
- **PR:** #221 — draft, mergeable, não mergeado
- **Status:** **APTO PARA REVISÃO**

## Objetivo executado

Foi criada a fundação compartilhada da Central Móvel R1, limitada ao escopo MOBILE-A:

- rota própria `/central-mobile`;
- shell móvel leve e separado do shell desktop;
- reaproveitamento do gate canônico de Firebase Auth, workspace/UG, autorização da Central, sessão/lease e aceite legal;
- contrato de scanner com tipos `PRODUCT`, `LOCATION`, `UNKNOWN`;
- estados `EXPECT_PRODUCT`, `EXPECT_LOCATION`, `EXPECT_SOURCE_LOCATION`, `EXPECT_DESTINATION_LOCATION`;
- pipeline de captura com normalização, identificação injetável e evento validado;
- câmera solicitada somente após ação explícita;
- preferência por câmera traseira;
- estados explícitos `idle/loading/ready/success/error`;
- tratamento de permissão negada e câmera indisponível;
- teardown explícito do stream ao encerrar/desmontar;
- cooldown de 900 ms para double scan idêntico;
- entrada manual usando o mesmo pipeline;
- feedback visual com som/vibração opcionais e não bloqueantes;
- decoder ZXing carregado somente por `import('./scannerDecoder')`;
- nenhuma imagem ou vídeo armazenado;
- nenhuma escrita em estoque, saldo, ledger ou domínio operacional.

A resolução completa de barcode de posição continua fora desta frente e pertence à MOBILE-B.

## Arquivos alterados

Arquivos existentes alterados:

- `features/warehouse/components/WarehouseProtectedSurface.tsx`
- `package.json`
- `package-lock.json`

Arquivos novos:

- `app/central-mobile/layout.tsx`
- `app/central-mobile/page.tsx`
- `features/warehouse/mobile/WarehouseMobileProtectedLayout.tsx`
- `features/warehouse/mobile/WarehouseMobileShell.tsx`
- `features/warehouse/mobile/WarehouseMobileHome.tsx`
- `features/warehouse/mobile/WarehouseMobileScanner.tsx`
- `features/warehouse/mobile/scannerDecoder.ts`
- `lib/warehouse/mobileScanner.ts`
- `scripts/warehouse-mobile-scanner.test.mjs`
- `scripts/verify-mobile-r1-platform-scanner.mjs`

## Arquivos apenas consultados

Entre os arquivos consultados durante a implementação e auditoria:

- `docs/EMPROVEX_MEMORIAL_OFICIAL.md`
- `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md`
- `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`
- `docs/TESTING_POLICY.md`
- `docs/DEVELOPMENT_CI_WORKFLOW.md`
- `docs/adm-deposito/README.md`
- `docs/adm-deposito/STATUS.md`
- `docs/adm-deposito/DECISIONS.md`
- `app/adm-deposito/layout.tsx`
- `features/warehouse/components/WarehouseModuleShell.tsx`
- `features/warehouse/components/WarehouseModuleContext.tsx`
- `features/warehouse/components/WarehouseRouteContent.tsx`
- `features/warehouse/components/WarehouseSidebar.tsx`
- `features/warehouse/navigation.ts`
- `lib/warehouse/barcode.ts`
- `scripts/warehouse-barcode-outbound.test.mjs`
- `scripts/verify-performance-r3-central-shell.mjs`
- `tsconfig.json`

## Contratos reutilizados

Preservados/reutilizados sem criar segunda fonte de verdade:

- Firebase Auth;
- workspace/UG;
- autorização da Central via `/api/adm-deposito/status`;
- sessão/lease via `startWorkspaceSessionControl`;
- gate legal via `LegalAcceptanceGate`;
- contexto da Central via `WarehouseWorkspaceProvider`;
- contrato canônico `warehouse_barcode_v1` permanece inalterado;
- contratos de material, ledger, saldo, localização, lote, intake, outbound e inventário permanecem inalterados.

## Contratos novos

- `WarehouseMobileScanKind = PRODUCT | LOCATION | UNKNOWN`;
- `WarehouseMobileScannerExpectation = EXPECT_PRODUCT | EXPECT_LOCATION | EXPECT_SOURCE_LOCATION | EXPECT_DESTINATION_LOCATION`;
- `WarehouseMobileScanSource = CAMERA | MANUAL`;
- `WarehouseMobileScanEvent`;
- `WarehouseMobileCooldownGuard`;
- `WarehouseMobileScanner` com `identifyScan`, `onScanCandidate` e `onValidatedScan`.

## Mudanças funcionais intencionais

- Nova superfície protegida `/central-mobile`.
- Em viewport desktop, a rota móvel exibe aviso para usar celular e link para a Central completa; não foi adicionada à navegação desktop.
- O scanner inicia a câmera somente após o botão **Ativar câmera**.
- O decoder é carregado somente nesse momento.
- Sem resolver injetado, a leitura é classificada como `UNKNOWN` e não é tratada como operação válida.
- Um erro de identificação não encerra nem mascara uma câmera ainda ativa.
- Entrada manual segue o mesmo contrato de normalização/identificação.
- Nenhum scan produz movimento ou alteração de saldo.

## Testes e gates

- Application CI #910 — **SUCCESS**.
- `npm ci` — **PASS** dentro do Application CI.
- TypeScript error budget inicial — **PASS**.
- `npm run verify:emprovex-core-protection` — **PASS** dentro do Application CI.
- regressão completa da Central e demais guards do Application CI — **PASS**.
- `npm run build` — **PASS**; Next.js 15.5.24, compilação otimizada em 20,9 s.
- `npm run typecheck` final — **PASS**.
- `git diff --check origin/feat/central-mobile-r1...HEAD` — **PASS**.
- Core Protection #197 — **SUCCESS**.
- Recovery #596 — **SUCCESS**.
- Release gates 16, 17, 18, 19, 20 e 21 — **SUCCESS**.
- Vercel preview associado ao HEAD de código — **SUCCESS**.
- validação isolada do contrato `mobileScanner.ts` com TypeScript + 6 grupos de asserts — **PASS**.
- auditoria estrutural do HEAD para lazy boundary, teardown, contratos e ausência do decoder no shell desktop — **29/29 checks PASS**.

Os scripts permanentes foram adicionados:

- `npm run test:mobile-r1-scanner`;
- `npm run verify:mobile-r1-platform-scanner`.

Eles não foram adicionados ao workflow compartilhado nesta frente para evitar ampliar propriedade de CI; a lógica correspondente foi validada isolada/estruturalmente e o build/typecheck reais passaram.

## Gates não executados

- **Browser E2E on demand:** não executado. A suíte existente não possui cenário da nova rota/scanner e esta frente não alterou o workflow compartilhado.
- **Câmera física em aparelho real:** não executada. Não há alegação de certificação física de câmera nesta entrega.
- **Teste tátil/sonoro em aparelho real:** não executado; ambos são feedback opcional e não bloqueante.

A validação física em celular real permanece necessária na certificação final da Central Móvel.

## Métricas

No Production Build do Application CI #910:

- `/central-mobile`: **4,72 kB** de Size; **109 kB** First Load JS.
- `/adm-deposito`: **2,33 kB** de Size; **106 kB** First Load JS.
- Shared First Load JS: **104 kB**.
- Geração estática: **29/29 páginas**.
- Compilação otimizada: **20,9 s**.
- Diff de código contra a base congelada antes deste documento: **13 arquivos**, **+1104 / -8**.
- O decoder ZXing não é importado por `WarehouseModuleShell`, `WarehouseSectionContent` ou `app/adm-deposito/layout.tsx`.
- O decoder fica atrás de import dinâmico acionado pelo operador, portanto não integra o caminho inicial da Central desktop.

## Riscos

- Compatibilidade real de câmera e ergonomia ainda precisam ser validadas em aparelhos Android/iOS reais.
- `getUserMedia` depende de contexto seguro (HTTPS) e permissão do usuário.
- Som/vibração podem ser bloqueados ou indisponíveis por navegador/dispositivo; o fluxo não depende desses feedbacks.
- As versões ZXing escolhidas são compatíveis com o Node 20 usado pelo CI, mas devem continuar sob revisão de manutenção nas futuras releases.
- O classificador padrão é deliberadamente `UNKNOWN`; nenhuma resolução de posição foi antecipada.

## Dependências

- **MOBILE-B:** conectar resolução completa de barcode de posição e identificação `LOCATION`.
- Frentes MOBILE-C–H podem reutilizar `WarehouseMobileScanner` e seus estados sem alterar o contrato de captura.
- Coordenador deve revisar e integrar o PR #221 na `feat/central-mobile-r1` quando considerar a frente aceita.

## Conflitos esperados

- `features/warehouse/components/WarehouseProtectedSurface.tsx`: refatoração pequena para expor boundary shell-agnostic; risco de conflito somente se outra frente alterar o mesmo gate.
- `package.json` e `package-lock.json`: possível conflito mecânico caso outra frente adicione dependências em paralelo.
- No estado auditado, PR #221 está **mergeable** contra a integradora.

## Documentação atualizada

- este arquivo: `docs/CENTRAL_MOBILE_R1_A_HANDOFF.md`.

O memorial oficial e o status de integração não foram alterados pela trabalhadora; a consolidação canônica permanece responsabilidade do Coordenador.

## Não realizado

- merge em `feat/central-mobile-r1`;
- merge em `main`;
- deploy/promoção de produção;
- publicação de Rules;
- alteração de contrato canônico;
- alteração de ledger, fonte de saldo ou modelo de posição;
- implementação de barcode de posições;
- ALLOCATE;
- TRANSFER;
- OUTBOUND;
- inventário;
- conferência;
- offline sync;
- app nativo;
- escopo de outra frente.
