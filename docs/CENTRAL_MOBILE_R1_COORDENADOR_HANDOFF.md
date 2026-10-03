# EMPROVEX — Central Móvel R1 — Handoff do Coordenador

Última atualização: **2026-10-02**
Programa: **MOBILE-R1**
Integrador: `feat/central-mobile-r1`

## 1. Missão

Governar a Central Móvel R1 pelo método oficial de execução paralela, sem duplicar domínio de estoque e sem competir com workers.

## 2. Leitura obrigatória

1. `docs/EMPROVEX_MEMORIAL_OFICIAL.md`;
2. `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md`;
3. `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`;
4. `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`;
5. este arquivo;
6. `docs/TESTING_POLICY.md`;
7. `docs/DEVELOPMENT_CI_WORKFLOW.md`;
8. documentação `docs/adm-deposito/*`.

## 3. Baseline congelado

Branch integradora criada de:
`saas-r1-i-integration@78d3e9afeeb4176a8d6423cdd8e65d32435ba0a9`

Freeze documental usado como base idêntica de MOBILE-A e MOBILE-B:
`feat/central-mobile-r1@53e28b81874ee1b7ce0bd484cc7a97537aa99473`

O baseline tinha:
- Application CI #908 verde;
- Core #195 verde;
- Recovery #595 verde;
- Legal #20 verde.

## 4. Dependência SaaS

A MOBILE-R1 não é proprietária de SAAS-I.

Razão do baseline:
- SAAS-I altera shell e Central;
- iniciar mobile sobre integradora SaaS anterior criaria conflito conhecido.

Obrigatório:
- antes de MOBILE-I, comparar/reconciliar com estado SaaS consolidado;
- workers móveis não editam billing/legal/lifecycle para “acompanhar” SaaS.

## 5. Decisões congeladas

- web mobile, não app nativo;
- mesmo login;
- mesma autorização;
- mesma base operacional;
- online-first;
- scanner único;
- location barcode separado de product barcode;
- etiqueta resolve posição estável;
- barcode não autoriza;
- C/D/E dependem da Integração 1;
- F/G/H dependem da Integração 2;
- MOBILE-I/J são do Coordenador.

## 6. Primeira onda

**LIBERADA após o freeze MOBILE-0.**

Branches já criadas na mesma base `53e28b818...`:
- MOBILE-A — `mobile-r1-a-platform-scanner`;
- MOBILE-B — `mobile-r1-b-location-labels`.

Não criar workers C–H antecipadamente se isso induzir desenvolvimento antes dos contratos compartilhados estarem integrados.

## 7. Papel de A

Fundação móvel/scanner.

Não mexer em ledger/intake/outbound/inventory.

## 8. Papel de B

Etiquetas/resolver.

Não mexer em scanner/ledger/movimentos.

## 9. Próximo gate

Receber e aprovar os handoffs independentes de MOBILE-A e MOBILE-B. Depois executar a Integração 1:
scanner → tipo → resolver → posição.

Sem estoque.

## 10. Estado de produção

Produção permanece:
`main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

Nenhum release MOBILE autorizado.

## 11. Regra de comunicação

Ao receber worker:
- não aceitar “deu certo” sem evidência;
- verificar HEAD;
- verificar diff;
- verificar gates;
- verificar contratos;
- atualizar status.

## 12. Critério de troca

Antes de encerrar uma conversa Coordenadora:
- atualizar Status;
- atualizar Handoff;
- registrar novos HEADs;
- registrar bloqueios;
- registrar próxima ação exata.


## 13. Revisão MOBILE-A — devolução controlada

Em 2026-10-02 o Coordenador revisou o PR #221 / HEAD `6abc35c60e5b0674f0e034b6da1476936345e41f`.

Estado:
**DEVOLVIDA PARA CORREÇÃO MÍNIMA; NÃO INTEGRAR AINDA.**

Dois bloqueios:
- Permissions-Policy global `camera=()` impede a própria câmera da Central Móvel;
- lifecycle de `mountedRef` não é resiliente ao Strict Mode habilitado no projeto.

A trabalhadora recebeu autorização estreita para corrigir:
- header de câmera em `next.config.ts`;
- lifecycle do scanner;
- testes/guards correspondentes.

MOBILE-B segue independente.

Ao receber novo handoff A:
1. confirmar que o diff adicional ficou restrito;
2. confirmar header efetivo de `/central-mobile`;
3. confirmar Strict Mode resiliente;
4. revalidar gates;
5. somente então reclassificar/integrar.


## 14. Integração MOBILE-B — concluída

Em 2026-10-02 o Coordenador aprovou e integrou a MOBILE-B.

Evidências:
- worker HEAD `948978e9e326ff6468643d44540a2a5337dff425`;
- PR #220;
- squash `5edb19812b1121fdf867dc63c787bb2439ae68d5`;
- CI/Core/Recovery/Legal: verdes.

Contratos agora presentes na integradora:
- namespace físico `EPX1`;
- Code 128 nas etiquetas;
- resolver autoritativo de depósito/local/subposição;
- LOCAL/SUBPOSITION → `WarehouseStockPosition`;
- DEPOT não fabrica posição;
- nenhuma persistência paralela.

Pendência deliberada:
- leitura física real dos presets COMPACT/MEDIUM/LARGE com câmera móvel, a ser tratada na Integração 1.

Estado da primeira onda:
- MOBILE-B: **INTEGRADA**;
- MOBILE-A: **DEVOLVIDA PARA CORREÇÃO MÍNIMA**;
- Integração 1: **BLOQUEADA aguardando MOBILE-A**.


## 15. MOBILE-A integrada e Integração 1 certificada

MOBILE-A:
- HEAD final `44c4f013859230b5d490d2049c6b8dbf2cd3baa2`;
- PR #221;
- squash `19fc6be4a1deb5de44ec6999ef42d1cf6ced576c`;
- classificação: **APROVADA COM PENDÊNCIA RUNTIME**;
- CI/Core/Recovery/Legal verdes no HEAD final.

Integração 1:
- PR técnico #224;
- HEAD certificado `4b397d61bf4c8505ddf5b3c8fa14e3e8c2e91461`;
- squash `7c987676e0c089285e8bcd2bf5d34a6f54c717fa`;
- Application CI #920 SUCCESS;
- Core Protection #207 SUCCESS;
- quatro checks MOBILE-R1 SUCCESS;
- build/typecheck/diff hygiene SUCCESS;
- nenhum movimento de estoque.

Contrato congelado após Integração 1:
- scanner compartilhado da MOBILE-A;
- namespace físico EPX1 da MOBILE-B;
- EPX1 válido → LOCATION;
- barcode comercial não é posição;
- resolver autoritativo;
- LOCAL/SUBPOSITION → WarehouseStockPosition;
- DEPOT falha fechado;
- ausência de UG → fail-closed;
- nenhuma escrita de saldo/ledger.

Pendências físicas continuam:
- header HTTP efetivo;
- câmera real;
- impressão/leitura Code 128.

## 16. Próxima onda

**MOBILE-C + MOBILE-D + MOBILE-E estão liberadas em paralelo.**

Freeze comum vigente da Onda 2 após reconciliação SaaS:
`feat/central-mobile-r1@6852963c7aa9a1c83133239f0b929715fd316530`

Branches já criadas nessa mesma base:
- `mobile-r1-c-intake-allocation`;
- `mobile-r1-d-transfer`;
- `mobile-r1-e-physical-query`.

O Coordenador deve:
1. congelar nova base comum;
2. criar as três branches;
3. emitir prompts;
4. manter F/G/H bloqueadas;
5. preferir integração E → C → D, pois E é read-only;
6. executar Integração 2 antes de liberar F/G/H.


## 17. Gate SaaS R1 ↔ MOBILE-R1 antes da Onda 2

Nova orientação recuperada do Memorial SaaS:
- os dois programas evoluem em paralelo;
- nova onda Mobile exige reconciliação semântica quando existir upstream SaaS relevante;
- worker transversal deve declarar `Impacto SAAS-R1`;
- nenhuma integradora deve ser mergeada/rebaseada cegamente na outra.

Reconciliação executada:
- Auth/identidade: equivalentes;
- workspace/UG: equivalentes;
- sessão/lease: equivalentes;
- LegalAcceptanceGate: equivalente;
- warehouseAccess/feature flag: equivalente;
- Rules principal/Central: equivalentes;
- app layout: equivalente;
- Mobile mantém extensão própria `WarehouseAccessBoundary`;
- SaaS mantém tooling operacional/recovery próprio;
- Mobile mantém scanner/CI guards próprios.

Resultado:
**PASS — nenhum conflito concreto capaz de bloquear MOBILE-C/D/E.**

A SAAS-P está em execução com quatro workers paralelos. Antes de qualquer integração Mobile que toque domínio compartilhado, reconsultar o estado vivo do SaaS.

Como C/D/E ainda não haviam iniciado e estavam idênticas ao freeze anterior, o Coordenador reemitiu as três branches por fast-forward no novo freeze comum `6852963c7aa9a1c83133239f0b929715fd316530`, sem perda de trabalho.


## 18. Revisão MOBILE-C — aprovada, integração aguardando MOBILE-E

Worker:
- branch `mobile-r1-c-intake-allocation`;
- base `6852963c7aa9a1c83133239f0b929715fd316530`;
- HEAD `6828273ee4c957fa92e42922363d2e1dcf296d89`;
- PR #229.

Classificação:
**APROVADA / AGUARDANDO ORDEM DE INTEGRAÇÃO DA ONDA 2**.

Evidências:
- Application CI #928 SUCCESS;
- Core Protection #215 SUCCESS;
- Recovery #611 SUCCESS;
- Legal #35 SUCCESS;
- build/typecheck/diff hygiene/gates 16–21 SUCCESS;
- ALLOCATE oficial preservado;
- idempotência e concorrência preservadas;
- barcode desconhecido criado somente de forma atômica no ALLOCATE;
- nenhuma escrita client-side de saldo/ledger/barcode;
- impacto SaaS funcional: nenhum.

Performance:
- home móvel baseline Integração 1 ~249 kB;
- MOBILE-C ~253 kB;
- incremento aproximado ~4 kB;
- rota de alocação ~274 kB First Load.

Decisão:
- não devolver à worker;
- não rebasear;
- congelar o HEAD aprovado;
- aguardar MOBILE-E;
- integrar pela ordem preferencial E → C → D.


## 19. Integração MOBILE-E — concluída

MOBILE-E:
- worker HEAD `fff6fa3ca7588cec4ecf0c3c76d141dda357c626`;
- PR #230;
- squash `e768ee5f554dc3016951bd7cebc54c69feba3bd3`;
- classificação: **APROVADA E INTEGRADA**.

Evidências:
- Application CI #930 SUCCESS;
- Core Protection #217 SUCCESS;
- Recovery #612 SUCCESS;
- Legal #36 SUCCESS;
- read-only bounded/on-demand;
- 0 listeners;
- nenhum write path;
- sem impacto SaaS funcional.

Próxima integração da ordem preferencial:
**MOBILE-C**, já aprovada no HEAD `6828273ee4c957fa92e42922363d2e1dcf296d89`.


## 20. Integração semântica MOBILE-C — concluída após MOBILE-E

A MOBILE-C havia sido aprovada no HEAD `6828273ee4c957fa92e42922363d2e1dcf296d89` / PR #229.

Após o merge da MOBILE-E, o PR worker apresentou conflito mecânico apenas em package/CI compartilhados.

O Coordenador:
1. criou `mobile-r1-integration-2-c` a partir da integradora já com E;
2. aplicou o código funcional aprovado da C sem alterar a worker;
3. preservou scripts/gates da E;
4. adicionou scripts/gates da C;
5. abriu PR técnico #232;
6. certificou E+C juntas;
7. integrou por squash `1c523fe2dccbd7248fd3f845d9169261da7edc65`;
8. encerrou PR #229 sem merge direto.

Gates combinados:
- Application CI #931 SUCCESS;
- Core #218 SUCCESS;
- Recovery #613 SUCCESS;
- Legal #37 SUCCESS;
- E tests/guard SUCCESS;
- C tests/guard SUCCESS;
- build/typecheck/diff hygiene SUCCESS;
- release gates 16–21 SUCCESS.

Próxima frente da ordem E → C → D:
**MOBILE-D**.

Integração 2 somente pode ser declarada encerrada após MOBILE-D revisada, integrada e certificada junto ao estado corrente.


## 21. Revisão MOBILE-D — devolvida para correção mínima

Worker HEAD revisado:
`4d3d75be98786d4470b593759580f50683a8f31b` / PR #231.

Gates worker:
- Application CI #929 SUCCESS;
- Core #216 SUCCESS;
- Phase 6/7 e scanner/Integration 1 verdes.

A implementação não foi integrada porque a leitura de lotes usada para decidir transferência parcial não é fail-closed: o repository legado retorna lista vazia em erro.

Correções delimitadas:
- leitura crítica de lotes deve propagar falha e detectar saturação;
- >24 lotes relocáveis deve bloquear antes do TRANSFER;
- EPX1 reservado/malformado deve permanecer UNKNOWN, não PRODUCT.

Nenhuma mudança no TRANSFER canônico ou Rules está autorizada.

Após novo handoff:
1. revisar somente o delta corretivo;
2. integrar semanticamente D sobre E+C;
3. executar certificação combinada;
4. se verde, encerrar Integração 2;
5. só então avaliar liberação de F/G/H.


## 22. MOBILE-D integrada e Integração 2 certificada

MOBILE-D:
- worker HEAD corrigido `4549b280b483d935373604a8c2b2a54a140684f0`;
- PR #231;
- integrada semanticamente pelo PR #234;
- squash `fc87bf8f9e67bc4abea6332a09059cfcfd6260fe`.

Correções aceitas:
- lotes fail-closed;
- saturação MAX+1;
- limite 24 pré-validado;
- EPX1 malformado UNKNOWN;
- TRANSFER canônico preservado.

Integração 2 final:
- PR #235;
- HEAD `12df2f1ab6524e80322866ad8a5af59eeb51d49d`;
- squash `d8148f01b877adad1e7880fc0b7fc6d4b3d60249`;
- Application CI #934 SUCCESS;
- Core #221 SUCCESS;
- Recovery #614 SUCCESS;
- Legal #38 SUCCESS;
- jornada C→E→D→E SUCCESS;
- build/typecheck/diff hygiene SUCCESS;
- gates 16–21 SUCCESS.

Contrato congelado após Integração 2:
- ALLOCATE oficial;
- consulta física read-only;
- TRANSFER oficial;
- classificador PRODUCT/LOCATION/UNKNOWN único entre C/D;
- lote crítico fail-closed;
- saldo agregado preservado;
- nenhuma escrita direta de saldo/ledger.

## 23. Gate SaaS R1 ↔ MOBILE-R1 antes da Onda 3

SaaS observado:
`feat/saas-r1-commercializacao@4848643be85b30532f7f093c4ddb0e729facfad3`.

Resultado da comparação:
**PASS — sem conflito transversal concreto**.

Auth, workspace/UG, sessão, Legal Gate, warehouseAccess/feature flag, Rules e app layout permanecem equivalentes.

Divergências esperadas:
- Mobile: WarehouseAccessBoundary + scanner/gates móveis;
- SaaS: recovery/hardening/tooling próprio;
- package/CI: diferenças aditivas por programa.

Consequência:
- F/G/H podem ser liberadas em uma nova base comum;
- workers continuam obrigados a declarar Impacto SAAS-R1;
- MOBILE-I/J seguem bloqueadas.


## 24. Freeze e ativação da Onda 3

Freeze comum:
`c971d5356c343a0819bf96ec016de73dd96a435d`.

Branches:
- F: `mobile-r1-f-inventory`;
- G: `mobile-r1-g-outbound`;
- H: `mobile-r1-h-position-check`.

As três branches foram criadas exatamente na mesma base, após:
- Integração 2 certificada;
- reconciliação SaaS↔Mobile PASS.

Próxima ação:
1. emitir prompts F/G/H;
2. receber handoffs independentes;
3. não permitir integração cruzada entre workers;
4. integrar semanticamente somente após revisão;
5. executar Integração 3;
6. liberar MOBILE-I somente se Integração 3 ficar verde.


## 25. Adaptação ao EMPROVEX Program Control

Governança vigente:
`Fundador → Coordenador Geral → Coordenador MOBILE-R1 → workers Mobile`.

O Coordenador MOBILE-R1 permanece autoridade operacional do programa e passa a escalar ao Geral:
- contratos compartilhados;
- conflitos SaaS/Desktop;
- release/produção;
- Memorial global;
- `next.config.ts` / Permissions-Policy;
- Rules, Auth, sessão, workspace/UG, legal/lifecycle quando transversais.

### Checkpoint para o Coordenador Geral

Integradora:
`feat/central-mobile-r1@64de6a414d00e0b151a5e07a1f2add7606936165`.

Último estado operacional certificado:
- Integração 2 squash `d8148f01b877adad1e7880fc0b7fc6d4b3d60249`;
- Application CI #934 SUCCESS;
- Core #221 SUCCESS;
- Recovery #614 SUCCESS;
- Legal #38 SUCCESS.

C/D/E:
- concluídas;
- integradas;
- nenhum handoff pendente.

F/G/H:
- branches já preparadas no freeze `c971d5356c343a0819bf96ec016de73dd96a435d`;
- ainda não iniciadas;
- não mover/recriar.

Delta transversal aberto:
- `next.config.ts` / Permissions-Policy:
  - Mobile `camera=(self)`;
  - SaaS `camera=()`;
- requer decisão/reconciliação do Coordenador Geral/HARDEN-D;
- não é para merge/rebase cego.

HARDEN-D:
- branch `saas-harden-d-mobile-reconciliation`;
- base `f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`;
- ainda identical à base;
- Mobile recomenda liberação **agora**, antes de ativar F/G/H.

Política documental a partir deste ponto:
- atualizar Mobile Plan/Execution/Status/Handoff normalmente;
- não alterar por padrão o estado global do Memorial;
- fornecer deltas certificados ao Coordenador Geral;
- nenhuma reorganização Memorial V2 pelo Coordenador Mobile.

Semáforo recomendado:
- MOBILE-R1: AMARELO;
- C/D/E: VERDE / CONCLUÍDAS;
- F/G/H: não iniciadas / aguardar decisão de barreira global.

Produção:
- `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`;
- não alterada.


## 26. Program Control libera Onda 3

Decisão global recebida:
- HARDEN-D PASS técnico;
- aceita pelo Coordenador SaaS;
- aceita pelo Program Control;
- MOBILE-R1 reclassificada para VERDE;
- F/G/H liberadas em paralelo.

Freeze mantido:
`c971d5356c343a0819bf96ec016de73dd96a435d`.

Branches ativadas sem movimento:
- `mobile-r1-f-inventory`;
- `mobile-r1-g-outbound`;
- `mobile-r1-h-position-check`.

CT-01:
- `next.config.ts`/Permissions-Policy;
- futuro RC deve usar `camera=(self), microphone=(), geolocation=()`;
- não corrigir na Onda 3;
- não abrir worker Mobile para CT-01.

Coordenação:
- receber handoffs F/G/H;
- revisar cada worker individualmente;
- ordem de integração definida por semântica/conflitos, não cronologia;
- nenhuma nova frente antes de Integração 3;
- ao final, emitir checkpoint pós-Integração 3 ao Program Control.


## 27. Revisão MOBILE-F — aprovada e congelada

MOBILE-F:
- branch `mobile-r1-f-inventory`;
- HEAD `42954adab43694816262720581abad2bc0761d4c`;
- PR #239;
- base Onda 3 `c971d5356c343a0819bf96ec016de73dd96a435d`;
- classificação: **APROVADA / CONGELADA**.

Auditoria confirmou:
- save count sem saldo/ledger;
- REVIEW + confirmação humana antes de ajuste;
- INVENTORY_ADJUSTMENT exclusivamente canônico;
- STALE e RECONCILIATION_REQUIRED preservados;
- nenhuma alteração de inventoryRepository;
- nenhum CT-01/Rules/Auth/sessão/legal;
- 0 listener novo;
- sem novo delta transversal.

Gates:
- App CI #935 SUCCESS;
- Core #222 SUCCESS;
- Recovery #615 SUCCESS;
- Legal #39 SUCCESS;
- build/typecheck/diff hygiene SUCCESS.

A branch deve permanecer congelada no HEAD aprovado.
Não integrar antes de receber e revisar G/H.


## 28. Revisão MOBILE-H — aprovada e congelada

MOBILE-H:
- branch `mobile-r1-h-position-check`;
- HEAD `f30f4dcbb1d03d15230fa4414a7d1b95e231253e`;
- PR #241;
- base Onda 3 `c971d5356c343a0819bf96ec016de73dd96a435d`;
- classificação: **APROVADA / CONGELADA**.

Auditoria confirmou:
- read-only real;
- MOBILE-E reutilizada como consulta física;
- alternativas bounded 60+1 e fail-closed;
- concorrência não vira falso INCORRETO;
- posições alternativas revalidadas pelo resolver;
- navegação para MOBILE-D sem mutação;
- 0 writes / 0 listeners;
- nenhum CT-01/Rules/Auth/sessão/legal;
- sem novo delta transversal.

Gates:
- App CI #937 SUCCESS;
- Core #224 SUCCESS;
- Recovery #616 SUCCESS;
- Legal #40 SUCCESS;
- build/typecheck/diff hygiene SUCCESS.

Sobreposição já conhecida com F:
- WarehouseMobileHome.tsx;
- package.json;
- application-ci.yml.

Resolver semanticamente apenas na Integração 3.
Não integrar H antes de receber e revisar G.


## 29. Revisão MOBILE-G — aprovada e congelada

MOBILE-G:
- HEAD `0b513edf7324e40d7b0a505edfdaf84270301ccf`;
- PR #242;
- classificação: **APROVADA / CONGELADA**.

Auditoria:
- OUTBOUND canônico único write;
- FEFO oficial;
- reader 60+1 / 120+1 fail-closed;
- posição/barcode/lote revalidados;
- idempotência/replay preservados;
- 0 listeners;
- nenhum CT-01/Rules/Auth/sessão/legal.

Legal #41:
- único vermelho foi Diff Hygiene sem merge-base por shallow fetch e avanço da integradora;
- classificado como stale guard de CI;
- reexecutar na Integração 3.

Com F/G/H agora aprovadas, iniciar comparação de sobreposição e composição semântica da Integração 3.


## 30. Integração 3 certificada

F/G/H foram revisadas individualmente e integradas semanticamente.

PR técnico:
#243 — MOBILE-R1 — Integração 3: F + G + H.

HEAD certificado:
`e40c80d73cf9c444ec0573503a63af18f141bd11`.

Squash:
`f11b7bf29f8b3fe9525ff80880f4e0f87cd1c67e`.

Ordem semântica:
H → F → G.

Workers encerradas sem merge direto:
- F PR #239;
- H PR #241;
- G PR #242.

Gates:
- App CI #940 SUCCESS;
- Core #227 SUCCESS;
- Recovery #618 SUCCESS;
- Legal #42 SUCCESS;
- F/G/H + Integration 3 tests/guards SUCCESS;
- build/typecheck/diff hygiene SUCCESS.

Métricas:
- Central Mobile 257 kB;
- inventário 271 kB;
- saída 265 kB;
- conferir 260 kB;
- transferir 261 kB;
- alocar 275 kB;
- Shared 104 kB.

## 31. Checkpoint obrigatório ao Program Control

Novo delta funcional SaaS↔Mobile:
**NENHUM**.

Contratos críticos idênticos:
Auth/Legal/workspace/UG/sessão/feature flag/Rules/layout/inventoryRepository/outboundRepository.

Deltas conhecidos:
- CT-01: preexistente, propriedade do RC;
- WarehouseProtectedSurface: preexistente/aceito HARDEN-D;
- package + Application CI: **novo delta de tooling aditivo da Onda 3**.

Classificação:
**NOVA RECONCILIAÇÃO / DECISÃO DO PROGRAM CONTROL OBRIGATÓRIA ANTES DA MOBILE-I**.

Não ativar MOBILE-I/J até retorno do Coordenador Geral.
Produção permanece não alterada.


## 32. Program Control libera MOBILE-I

Decisão recebida:
- Integração 3 PASS / aceita;
- F/G/H integradas e certificadas;
- package/CI tooling aceito como compatível;
- MOBILE-R1 VERDE;
- MOBILE-I formalmente liberada;
- MOBILE-J continua bloqueada.

Branch criada:
`mobile-r1-i-integration`.

Base:
`816c1c07cf251ce3705098a3a65b9d84e2fc8614`.

A branch nasceu exatamente do HEAD autorizado e não deve ser rebaseada após a ativação.

MOBILE-I deve:
- validar A–H como produto único;
- revisar navegação/UX combinada;
- testar regressões cruzadas;
- medir build/performance;
- preservar source of truth;
- revisar package/CI consolidado;
- consultar SaaS vivo antes do fechamento;
- registrar HARDEN-A1/jsPDF e HARDEN-B;
- preservar CT-01.

MOBILE-I não deve:
- inventar feature;
- alterar domínio;
- alterar contratos SaaS;
- resolver CT-01;
- publicar produção.

Ao concluir:
- emitir checkpoint pós-MOBILE-I ao Program Control;
- não liberar MOBILE-J autonomamente.


## 33. MOBILE-I integrada / checkpoint ao Program Control

MOBILE-I:
- worker `mobile-r1-i-integration`;
- base `816c1c07cf251ce3705098a3a65b9d84e2fc8614`;
- HEAD auditado `ea5ad10054e2aea608e270a970fde723cde41d93`;
- PR #245;
- squash `3a5689e0e613adfb7dbf48ef8d44085ec6c951b3`;
- classificação: **APROVADA / INTEGRADA**.

Auditoria confirmou:
- única correção funcional: card de consulta física na Home;
- MOBILE-E já existia e recebeu apenas navegação interna;
- guard final A–H aditivo;
- nenhum novo domínio/schema/API/source of truth;
- CT-01 não alterada;
- contratos críticos SaaS↔Mobile continuam compatíveis;
- package/CI apenas tooling aditivo.

Gates:
- App CI #945 SUCCESS;
- Core #232 SUCCESS;
- Recovery #623 SUCCESS;
- Legal #47 SUCCESS;
- build/typecheck/diff hygiene SUCCESS;
- segurança multi-tenant/external workspace SUCCESS;
- Integration 1/2/3 + F/G/H + MOBILE-I guard SUCCESS.

SaaS:
- HEAD `750d4c69cd3f233938631bcdd22db7e397ddc50e`;
- HARDEN-A1 Security PASS / visual pendente;
- HARDEN-B parcial / recovery real pendente;
- nenhum novo delta funcional Mobile.

Próxima ação:
- enviar checkpoint pós-MOBILE-I ao Program Control;
- não liberar MOBILE-J autonomamente;
- preservar pendências físicas e CT-01.
