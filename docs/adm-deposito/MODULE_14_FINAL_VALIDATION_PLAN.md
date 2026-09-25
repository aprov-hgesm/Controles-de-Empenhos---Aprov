# MÓDULO 14 — Campanha Final de Validação e Fechamento

Data do planejamento: 2026-09-25.

## 1. Estado de entrada

Branch oficial:
`feat/adm-deposito-phase-11-5-visual-ux`

Baseline auditada antes do planejamento:
`2d8160db956296779bcf86c7040829776d4e20ef`

A comparação entre a branch e a baseline resultou em estado idêntico:
- 0 commits à frente;
- 0 commits atrás;
- nenhuma mudança posterior a reconciliar.

Estado modular:
- Módulos 1–13: concluídos;
- Módulo 14: **PLANEJADO / NÃO INICIADO**;
- piloto permanece founder-only;
- expansão externa permanece não autorizada;
- merge/deploy não são consequência automática desta campanha.

Este documento detalha operacionalmente a campanha final prevista por D-057. Não cria nova arquitetura nem altera as autoridades de dados existentes.

## 2. Objetivo

Executar, de forma consolidada, a validação acumulada durante os Módulos 1–13 e demonstrar simultaneamente que:

1. o ADM Depósito funciona de ponta a ponta;
2. o Core EMPROVEX continua independente do ADM;
3. Firestore Rules e isolamento multi-tenant estão corretos em execução real;
4. ledger e saldos mantêm suas invariantes;
5. as novas jornadas de usuário funcionam no navegador;
6. TypeScript e build permanecem compatíveis com o conjunto consolidado;
7. nenhuma correção final introduz nova fonte de verdade, relaxamento indevido de Rules ou dependência inversa;
8. o GitHub CI é usado como certificação final depois da regressão local.

## 3. Princípios de execução

A campanha obedece D-057 e `docs/DEVELOPMENT_CI_WORKFLOW.md`.

Regras:
- estação local do fundador, via PowerShell, é o ambiente preferencial da campanha pesada;
- Core Protection é gate zero e qualquer regressão real é bloqueante;
- começar por testes rápidos/baratos antes de build e Browser E2E;
- não executar a suíte inteira novamente após cada correção;
- corrigir falhas de forma consolidada;
- após cada correção, reexecutar primeiro somente testes afetados;
- executar uma regressão completa final quando os grupos afetados estiverem verdes;
- GitHub Application CI deve certificar o resultado final, não ser a principal ferramenta de diagnóstico;
- Cloud Shell fica reservado a necessidade remota real, publicação/configuração ou diagnóstico que não possa ser resolvido localmente;
- nenhum erro legítimo pode ser ignorado apenas para obter CI verde.

## 4. Auditoria preparatória realizada em 2026-09-25

### 4.1 Cobertura já disponível

O repositório já possui testes/guards para:
- fundação/isolamento;
- material canônico;
- ledger e saldo;
- walking skeleton;
- NF → estoque;
- SISCOFIS;
- localizações e transferências;
- estoque, lotes, validade e FEFO;
- barcode e saída;
- croqui/layout;
- inventário;
- logística;
- Core Protection;
- isolamento EMPROVEX/ADM;
- multi-tenant/security;
- hardening do Módulo 13.

O Application CI já executa os principais testes de domínio do ADM e guards das fases anteriores, além do guard do Módulo 13.

### 4.2 Lacuna de Browser E2E a tratar

O script atual `scripts/e2e-browser-emulator.mjs` não contém, na baseline auditada, jornadas específicas identificáveis do ADM Depósito, como:
- `adm-deposito`;
- `warehouse`;
- Cadastro de Itens;
- Controle de Itens;
- Inventário;
- SISCOFIS.

Consequência para o Módulo 14:
- não considerar o Browser E2E genérico atual como cobertura suficiente do ADM;
- preparar uma jornada E2E específica/dirigida do módulo antes da certificação final.

Isso é uma lacuna de cobertura, não evidência de defeito funcional.

### 4.3 Guard 11.5 no CI

O script `verify:adm-deposito-phase-11-5` existe no `package.json`, porém não foi identificado entre os passos atuais do Application CI.

A campanha deve:
- executá-lo localmente obrigatoriamente;
- avaliar sua inclusão na certificação remota final, desde que o guard continue representando invariantes vigentes e não esteja obsoleto.

## 5. Ordem oficial da campanha

### 14.0 — Congelamento da baseline

Antes de executar testes:
- confirmar branch;
- confirmar HEAD;
- confirmar working tree limpo na estação local;
- comparar branch remota com a baseline documentada;
- registrar qualquer commit novo legítimo antes de prosseguir.

Gate:
- nenhuma alteração não auditada entra silenciosamente na campanha.

### 14.1 — Auditoria estática final

Validar por inspeção:
- Core Protection;
- fronteira `EMPROVEX → leitura/projeção → ADM Depósito`;
- founder-only;
- workspace/UG;
- ausência de dependência inversa;
- Rules;
- queries bounded;
- listeners;
- ledger append-only;
- saldos derivados;
- delete físico de históricos;
- ausência de cache/materialização de relatório;
- telemetria best-effort.

Esta etapa pode ser realizada sem PowerShell.

### 14.2 — Gates rápidos

Executar primeiro:
- `verify:emprovex-core-protection`;
- `verify:emprovex-warehouse-isolation`;
- `verify:adm-deposito-phase-0`;
- guards ADM 1–11;
- `verify:adm-deposito-phase-11-5`;
- `verify:adm-deposito-phase-13`;
- guards relacionados a multitenancy/readiness quando aplicáveis.

Objetivo:
- detectar regressão estrutural antes de testes caros.

### 14.3 — Testes de domínio ADM

Executar a bateria existente:
- `test:adm-deposito-material`;
- `test:adm-deposito-ledger`;
- `test:adm-deposito-walking-skeleton`;
- `test:adm-deposito-nf-stock`;
- `test:adm-deposito-siscofis`;
- `test:adm-deposito-locations`;
- `test:adm-deposito-stock-operational`;
- `test:adm-deposito-barcode-outbound`;
- `test:adm-deposito-depot-layout`;
- `test:adm-deposito-inventory`;
- `test:adm-deposito-logistics`.

Gate:
- contratos canônicos e regras de domínio verdes antes de Browser E2E.

### 14.4 — TypeScript global

Executar:
- `npm run typecheck`.

Tratar os diagnósticos conforme política vigente do projeto:
- regressão nova relacionada ao ADM: corrigir;
- erro legado fora do escopo: classificar e comparar com orçamento/baseline do CI;
- não mascarar regressão nova como dívida histórica.

### 14.5 — Firestore Emulator + segurança multi-tenant

Executar a suíte real de Auth/Firestore Emulator, incluindo:
- `verify:multitenant-security`;
- `test:security:multitenant`;
- readiness de produção quando aplicável.

Cobertura obrigatória:
- fundador lê/escreve somente onde autorizado;
- setor externo continua sem acesso ao ADM;
- isolamento entre workspaces/UGs;
- material canônico sem delete físico;
- ledger append-only;
- saldo não altera sem movimento;
- movimento e saldo permanecem coerentes;
- transferências não alteram quantidade total;
- lote/barcode/layout/inventário respeitam founder-only e imutabilidades;
- contagem de inventário isolada não escreve saldo diretamente;
- Rules do Core não dependem de warehouse.

### 14.6 — Walking skeleton integrado

Validar a cadeia operacional:

`material → entrada → movimento → saldo → localização → lote → barcode → saída → novo saldo → histórico`

Também confirmar:
- transferência interna altera distribuição física sem alterar saldo total;
- inventário produz ajuste auditável somente após confirmação;
- NF/Empenho/Cronograma permanecem fontes canônicas somente de leitura para o ADM.

### 14.7 — Build de produção

Executar:
- `npm run build`.

O build vem depois dos gates estruturais e de domínio para reduzir custo de diagnóstico.

Gate:
- build verde ou falha classificada/corrigida antes do E2E final.

## 6. Browser E2E específico do ADM

A campanha deve complementar o E2E atual com uma jornada curta, representativa e confiável.

Cobertura mínima proposta:
1. autenticar fundador;
2. acessar ADM Depósito;
3. confirmar renderização da Início;
4. abrir Cadastro de Itens;
5. verificar fila/estado de tratamento de material;
6. abrir Controle de Itens → Estoque;
7. consultar material e histórico;
8. percorrer Saída de Material com barcode/pesquisa e quantidade;
9. abrir Inventário e validar jornada sem escrita direta em saldo;
10. abrir Meus Depósitos/Croquis;
11. manipular e salvar versão do croqui;
12. voltar à Início e localizar material no croqui;
13. abrir Dashboard/Alertas/Relatórios sem erro;
14. abrir jornada SISCOFIS/preview;
15. confirmar persistência esperada após reload;
16. confirmar que usuário externo não acessa o ADM.

Princípio:
- E2E comprova interação/navegador;
- testes de domínio continuam responsáveis pela maior profundidade das invariantes;
- evitar dezenas de casos redundantes quando a mesma regra já é coberta em nível de domínio/Rules.

## 7. Regressão EMPROVEX

Além de provar o ADM, a campanha deve provar que o Core continua operável sem ele.

Fluxos prioritários:
- login/autenticação;
- Empenhos;
- Nota Fiscal;
- Comissão;
- Liquidação/Tesouraria;
- Cronograma;
- relatórios/SAG;
- usuários/sessões conforme cobertura existente.

Critério central:
- falha, indisponibilidade ou negação do namespace warehouse não pode impedir operação canônica do EMPROVEX.

## 8. Classificação de falhas

Toda falha encontrada deve ser classificada antes da correção:

- **A — regressão real:** código/Rule/contrato atual incorreto;
- **B — teste ou guard desatualizado:** expectativa antiga incompatível com decisão vigente;
- **C — ambiente local:** Node, npm, Java, Emulator, Playwright, Chromium, PATH ou permissão local;
- **D — infraestrutura externa:** GitHub/Vercel/serviço indisponível ou limitação externa;
- **E — dívida anterior não relacionada ao ADM:** diagnóstico legítimo, mas não introduzido pela campanha.

Regras:
- A deve ser corrigida;
- B deve ser atualizado somente após confirmar a decisão oficial vigente;
- C/D não justificam alterar domínio correto;
- E deve ser documentada e comparada com a baseline; não usar E para esconder regressão nova.

## 9. Estratégia de reexecução

Não repetir a campanha inteira a cada correção.

Sequência:
1. campanha inicial;
2. consolidar falhas;
3. corrigir em lote coerente;
4. reexecutar testes diretamente afetados;
5. quando esses grupos estiverem verdes, executar regressão final completa;
6. só então abrir/atualizar PR de fechamento e usar CI remoto como certificação.

## 10. Organização sugerida no PowerShell

A execução local deve preferir blocos consolidados:

### Rodada A — Estrutural + domínio
- Core Protection;
- isolamento;
- guards ADM;
- testes de domínio.

### Rodada B — TypeScript + segurança/Emulator
- typecheck;
- multitenancy;
- Firestore/Auth Emulator;
- readiness.

### Rodada C — Build + Browser E2E
- build;
- E2E genérico relevante;
- E2E específico do ADM.

### Rodada D — Regressão final
- grupos afetados pelas correções;
- campanha consolidada final.

Os comandos exatos devem ser montados no início da execução com base no estado real da estação local. Evitar um comando monolítico excessivamente grande no Windows.

## 11. GitHub CI e certificação final

Somente depois da estação local estar verde:
1. revisar diff final;
2. abrir PR;
3. confirmar workflow leve EMPROVEX Core Protection;
4. executar Application CI;
5. analisar qualquer divergência entre ambiente local e CI;
6. corrigir falhas legítimas;
7. obter checks verdes.

Application CI deve ser a certificação final da campanha.

## 12. Merge, deploy e expansão externa

Módulo 14 tecnicamente concluído não autoriza automaticamente:
- merge;
- deploy;
- abertura do ADM para setores externos;
- piloto externo;
- comercialização do módulo.

Essas ações dependem de decisão explícita do fundador após leitura do relatório final.

O piloto continua founder-only durante toda a campanha.

## 13. Critério de conclusão técnica

Para declarar o Módulo 14 tecnicamente encerrado, buscar:

- Core Protection verde;
- isolamento EMPROVEX/ADM verde;
- guards ADM verdes;
- testes de domínio verdes;
- TypeScript sem regressão nova;
- build verde;
- Emulator/multitenancy verde;
- walking skeleton verde;
- Browser E2E específico do ADM verde;
- regressão EMPROVEX verde;
- regressão ADM verde;
- Application CI verde;
- documentação final atualizada.

Qualquer exceção deve ser explicitamente classificada e documentada; não deve ser silenciosamente ignorada.

## 14. Estado deste documento

Este arquivo é **planejamento oficial**, não registro de execução.

Na data de criação:
- Módulo 14 não foi iniciado;
- nenhuma suíte pesada foi executada por este planejamento;
- nenhum arquivo funcional, Rule, teste ou workflow foi alterado;
- nenhum PR, merge ou deploy foi realizado.

A próxima etapa prática é executar a campanha quando a estação PowerShell do fundador estiver disponível.

## 15. Registro de execução — 14.0 e 14.1 — 2026-09-25

A baseline de planejamento `2d8160db956296779bcf86c7040829776d4e20ef` foi superada por commits documentais legítimos antes da execução.

Na entrada real da campanha:
- branch: `feat/adm-deposito-phase-11-5-visual-ux`;
- HEAD real: `88dff395649f7700f2c9c080ba9d7de0acf13ae9`;
- comparação contra a referência conhecida: 0 ahead / 0 behind;
- `88dff395649f7700f2c9c080ba9d7de0acf13ae9` passa a ser a **baseline oficial de entrada do Módulo 14**.

Execução:
- 14.0: **CONCLUÍDO**;
- 14.1: **CONCLUÍDO**;
- 14.2+: **NÃO INICIADOS**.

Relatório:
`docs/adm-deposito/MODULE_14_STATIC_AUDIT.md`.

Resultado estático:
- Core Protection preservada;
- founder-only em client/server/Rules;
- warehouse sem abertura pública operacional identificada;
- nenhum secret privado versionado identificado;
- achados médios/baixos registrados para hardening futuro;
- nenhuma vulnerabilidade crítica/bloqueante confirmada.

Gate: **B — permitido avançar para 14.2 quando PowerShell estiver disponível**.

Nenhum teste dinâmico, CI, PR, merge ou deploy foi executado neste registro.

## 16. Registro de execução consolidado — 14.2 até regressão local final — 2026-09-25

A campanha dinâmica do Módulo 14 foi executada na estação local Windows/PowerShell do fundador, preservando a política D-057.

### 14.2 — Gates rápidos
Resultado: **CONCLUÍDO / APROVADO**.

Foram validados:
- Core Protection;
- isolamento EMPROVEX / ADM Depósito;
- guards ADM das fases anteriores;
- guard 11.5;
- guard do Módulo 13;
- readiness/multitenancy aplicáveis.

Falhas encontradas nesta etapa foram classificadas como **B — guards desatualizados**, reconciliadas somente após confirmação dos contratos oficiais vigentes. Não houve regressão funcional de domínio nem relaxamento de Rules.

### 14.3 — Testes de domínio ADM
Resultado: **CONCLUÍDO / APROVADO**.

Campanha completa: **91/91 testes aprovados** após correções estritamente de teste/fixture classificadas como B.

Na regressão local final posterior, a bateria consolidada principal de domínio foi novamente executada e fechou **85/85**, sem falhas.

### 14.4 — TypeScript
Resultado: **CONCLUÍDO / APROVADO**.

- `npm run typecheck`;
- `tsc --noEmit`;
- **0 erros**.

### 14.5 — Firestore Emulator + segurança multi-tenant
Resultado: **CONCLUÍDO / APROVADO**.

- Auth/Firestore Emulator inicializados corretamente;
- **244/244 cenários multi-tenant aprovados**;
- `MULTI-TENANT SECURITY: READY`;
- `homeSnapshot`: **1/1 aprovado**;
- saída final: **code 0**.

Os `PERMISSION_DENIED` observados no log correspondem aos cenários DENY esperados e aprovados.

### 14.6 — Walking skeleton integrado
Resultado: **CONCLUÍDO / APROVADO**.

Regressão integrada da cadeia operacional: **70/70 testes aprovados**.

A cadeia material → entrada → movimento → saldo → localização → lote → barcode → saída → novo saldo → histórico permaneceu coerente.

### 14.7 — Build de produção
Resultado: **CONCLUÍDO / APROVADO**.

- Next.js 15.5.24;
- build de produção concluído;
- geração estática: **24/24**;
- sem falha bloqueante.

### Browser E2E específico do ADM
Resultado: **CONCLUÍDO / APROVADO**.

A cobertura do Browser E2E foi atualizada para refletir a IA 11.5 e recebeu hooks técnicos estáveis sem alterar regra de negócio.

Resultado final:
- **21/21 testes aprovados**;
- **0 falhas**;
- processo finalizado com **code 0**.

### Regressão local final consolidada
Resultado: **CONCLUÍDA / APROVADA**.

Na rodada final, após sincronização documental:
- Core Protection: OK;
- isolamento EMPROVEX / ADM: PASS;
- guard 11.5: PASS;
- Módulo 13: READY;
- domínio principal: **85/85**;
- TypeScript: **0 erros**;
- segurança multi-tenant: **244/244**;
- homeSnapshot: **1/1**;
- build: PASS;
- Browser E2E: **21/21**.

Nenhuma regressão A permaneceu aberta.

### Próximo gate
A estação local está verde. Restam para o encerramento técnico do Módulo 14:
1. revisão do diff final;
2. PR de fechamento;
3. workflow leve EMPROVEX Core Protection;
4. **Application CI** como certificação remota final;
5. documentação de encerramento após os checks remotos.

Merge, deploy e expansão externa continuam dependendo de decisão explícita do fundador.

## 17. Ajuste final da certificação remota — 2026-09-25

Durante a revisão pré-PR foi confirmada a lacuna prevista em 4.3: o guard `verify:adm-deposito-phase-11-5` ainda não fazia parte do Application CI.

Ação:
- incluído o passo **ADM Depósito Phase 11.5 visual guard** no workflow `.github/workflows/application-ci.yml`;
- comando: `npm run verify:adm-deposito-phase-11-5`;
- o guard já havia sido aprovado localmente na regressão final;
- nenhuma regra de negócio, Firestore Rule ou contrato de domínio foi alterado por esse ajuste.

Commit do workflow:
`eb6844b1931ebd115990891ec77bf5c04752bacf`.

Com isso, a cobertura remota final passa a incluir explicitamente a consolidação visual 11.5.


## 18. Fechamento técnico final — 2026-09-25

Após a reabertura e conclusão da Fase 9 v2, a campanha foi retomada.

Certificação remota:
- PR #187: aberta;
- Application CI #765 — job `validate-application`: **SUCCESS**;
- Core Protection: **SUCCESS**;
- Recovery guardrails: **SUCCESS**;
- Browser E2E: **FAILURE isolada na jornada do Croqui**, por timeout;
- release gates dependentes do Browser E2E falharam por consequência.

Classificação da pendência de navegador:
- não foi encontrada evidência de regressão A de domínio;
- a falha permanece como pendência visual/operacional da Fase 9 v2;
- conforme D-074 e decisão do fundador, será validada na `main` com operação acompanhada;
- não deve ser registrada como PASS.

Conclusão:
- Módulo 14: **ENCERRADO TECNICAMENTE COM RELEASE GATE VISUAL PENDENTE NA MAIN**;
- merge/deploy não autorizados por este fechamento;
- founder-only preservado.
