# EMPROVEX — Memorial Oficial

Última sincronização global: **2026-10-03 — consolidação canônica pré-RC**

Produção vigente: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

Integradora SaaS R1: `feat/saas-r1-commercializacao` — snapshot técnico pós-HARDEN-A2: `d7709d22f8e7ec9654ffaaa17a59ae06b34426bd` (commits posteriores podem ser apenas documentais)

Integradora Mobile R1: `feat/central-mobile-r1@7b7717b6eebabf911310d2b8ac56ed13c9cb9238` — avanço documental, sem novo delta runtime

Estado global: **Performance R3 em produção; desenvolvimento funcional SaaS R1 e Mobile R1 encerrado; HARDEN-A1/A2/C/D em PASS; HARDEN-B parcial por dependência temporal; MOBILE-J em certificação final; composição do RC único SaaS+Mobile liberada, ainda não congelada; Preview HTTPS ainda não publicado; produção não alterada pelas frentes atuais.**

---

## 0. Finalidade e regra de leitura

Este é o **documento de entrada canônico do EMPROVEX**.

O objetivo do Memorial é permitir que um novo Coordenador, worker ou sessão de continuidade responda rapidamente:

1. o que está efetivamente em produção;
2. quais programas estão ativos;
3. quais contratos estão congelados;
4. quais riscos e bloqueios permanecem;
5. qual é o próximo gate global;
6. onde encontrar a evidência detalhada.

O Memorial **não apaga histórico** e não substitui os documentos especializados. Ele organiza o conhecimento em camadas.

### Camadas documentais

**Camada 1 — Estado global e contratos vigentes**

Este arquivo: `docs/EMPROVEX_MEMORIAL_OFICIAL.md`.

**Camada 2 — Estado operacional de cada programa**

- `docs/SAAS_R1_INTEGRATION_STATUS.md`
- `docs/SAAS_R1_COORDENADOR_HANDOFF.md`
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`
- `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`
- planos mestres e documentos especializados de cada programa.

**Camada 3 — Histórico detalhado integral**

`docs/EMPROVEX_MEMORIAL_HISTORICO_ATE_2026-10-03.md`

Esse arquivo contém **a versão anterior completa do Memorial, preservada integralmente**, incluindo registros de PRs, commits, métricas, fases, incidentes, decisões e checkpoints históricos.

### Regra de precedência canônica

Quando houver divergência aparente entre trechos, aplicar esta precedência:

1. **Snapshot Global + Contratos Permanentes deste Memorial** — estado vigente;
2. **documentos especializados de Integration Status / Coordenador / runbooks** — evidência operacional detalhada;
3. **Cronologia e checkpoints históricos** — explicam como o estado foi alcançado, mas não revogam decisão posterior;
4. **Memorial Histórico Integral / Git history** — arquivo de rastreabilidade, não estado vivo.

Um checkpoint histórico que diga “bloqueado”, “parcial” ou “aguardando” deixa de governar o sistema quando uma seção posterior e vigente registrar explicitamente PASS/encerramento.

Números operacionais devem refletir o **runtime atual**. Se uma especificação antiga divergir do código integrado, o Memorial deve registrar o contrato efetivamente implementado e apontar a divergência como histórica.

### Regra estrutural a partir desta reorganização

Novos estados não devem ser simplesmente anexados ao fim do Memorial.

Sempre atualizar primeiro:

1. **Snapshot Global**;
2. **Programa afetado**;
3. **Riscos/Gates**;
4. **Cronologia**, quando houver marco histórico;
5. documento especializado correspondente.

Quando um estado deixar de ser vigente, ele deve sair do quadro vivo e permanecer na cronologia/documentação histórica.

### Concorrência documental

Como SaaS e Mobile podem atualizar documentação em paralelo, qualquer edição do Memorial deve:

- reler o HEAD vivo imediatamente antes da gravação;
- preservar alterações concorrentes;
- mover novos checkpoints para a seção temática correta;
- nunca sobrescrever uma atualização de outro Coordenador apenas para restaurar uma versão anterior.


---

# PARTE I — ESTADO VIVO

## 1. Snapshot Global

| Domínio | Estado vigente | Contrato/observação |
| --- | --- | --- |
| Produção | **Performance R3** | `main@e90f92acae1514ee5cbc6ce95fed354bc1454330` |
| SaaS R1 | **FUNCIONALMENTE CONCLUÍDO / PRONTO PARA RC** | A1/A2/C/D PASS; B parcial/temporal |
| Mobile R1 | **FUNCIONALMENTE CONCLUÍDO** | A–I integradas; MOBILE-J em certificação final |
| MOBILE-J | **PARCIAL TECNICAMENTE SAUDÁVEL / CERTIFICAÇÃO EM EXECUÇÃO** | aguarda RC em Preview HTTPS para testes físicos reais |
| RC conjunto | **COMPOSIÇÃO LIBERADA / NÃO CONGELADO** | próximo trabalho transversal |
| CT-01 | **PENDENTE NO RC** | `camera=(self), microphone=(), geolocation=()` |
| Rules candidatas | **SaaS↔Mobile reconciliadas** | diferem das Rules hoje presentes em `main`; exigem rollout/rollback preparado |
| HARDEN-B | **PARCIAL / ESPERA CONTROLADA** | PITR/delete protection/schedule/retention ativos; backup READY/verify/restore pendentes |
| Billing R1 | **IMPLEMENTADO EM MODO OBSERVE** | R$ 70; trial; cobrança externa; confirmação manual; sem suspensão automática |
| Piloto real | **NÃO INICIADO** | vem depois do RC tecnicamente fechado/publicação controlada |
| Abertura comercial ampla | **NÃO AUTORIZADA** | exige piloto, correções, SAAS-J e GO explícito do Fundador |

### Snapshots técnicos relevantes

- SaaS pós-HARDEN-A2: `d7709d22f8e7ec9654ffaaa17a59ae06b34426bd`;
- Mobile integradora documental: `7b7717b6eebabf911310d2b8ac56ed13c9cb9238`;
- MOBILE-J: `mobile-r1-j-final-certification@90d646372aae3e92318a78b90d71f72c5eb6b00e`;
- HARDEN-B: `saas-harden-b-recovery-restore@910cca1ea9f14e4ef080ee649624042f63206d51`.

A produção só muda por autorização explícita e posterior do Fundador.

## 2. Próxima barreira global

A próxima fase não é nova feature. É **Release Engineering / Certificação**.

Sequência canônica:

```text
SaaS final + Mobile final
→ SESSION-CAP-01 — remover teto fixo de 2 sessões
→ regressão de sessão/Rules/telemetria
→ RULES-AUDIT-01 — baseline + compatibilidade + ALLOW/DENY + rollback
→ branch única de composição do RC
→ reconciliação semântica dos contratos compartilhados
→ CT-01
→ Rules/package/lockfile/Application CI consolidados
→ gates no SHA exato
→ RC CANDIDATE
→ RC FROZEN
→ Preview HTTPS
→ testes SaaS + MOBILE-J físicos
→ correções rastreáveis, se houver
→ nova reconciliação/freeze quando necessário
→ GO/NO-GO explícito
→ eventual produção controlada
→ piloto real
→ correções pós-piloto
→ SAAS-J
→ autorização explícita
→ abertura comercial ampla
```

### Condições para declarar RC CANDIDATE

Obrigatório:

- SESSION-CAP-01 concluída e reconciliada, salvo decisão explícita do Fundador de adiar a mudança para release posterior;
- RULES-AUDIT-01 concluída em **PASS** sobre o ruleset final pós-SESSION-CAP-01;
- nenhuma Rule produtiva nova pode ser publicada sem esse PASS;
- nenhum novo conflito SaaS↔Mobile;
- CT-01 materializada;
- Rules candidata principal e warehouse registradas;
- rollback de Rules preparado;
- package/lockfile/CI reconciliados;
- build/TypeScript/diff hygiene verdes;
- Core/Legal/Recovery e segurança multi-tenant verdes;
- contratos de Auth/workspace/UG/sessão/lifecycle/Legal/billing/Central coerentes;
- source of truth logística única.

### Condições para RC FROZEN

Registrar no mínimo:

- `RC_BRANCH`;
- `RC_SHA`;
- `SAAS_SOURCE_SHA`;
- `MOBILE_SOURCE_SHA`;
- resultado HARDEN-A2;
- hashes das Rules de produção e do RC;
- hash de `next.config.ts`;
- hash de `package-lock.json`;
- resultados dos gates.

Após o freeze, só entram correções de blocker, regressão, segurança ou defeito real da certificação. Não entram melhorias oportunistas.

# PARTE II — GOVERNANÇA GLOBAL

## 3. Hierarquia oficial

### Fase funcional — modelo histórico

Durante o desenvolvimento paralelo:

```text
Fundador
→ Coordenador Geral / Program Control
   → Coordenador SaaS R1
   → Coordenador Mobile R1
      → workers especializados
```

### Fase atual — composição do RC

Por decisão do Fundador, o **Coordenador Geral também assume a Coordenação operacional do RC**.

Modelo vigente:

```text
FUNDADOR
   ↓
PROGRAM CONTROL + COORDENAÇÃO DO RC
   ├── Coordenador SaaS — consulta/evidência sob demanda
   ├── Coordenador Mobile — consulta/evidência sob demanda
   ├── HARDEN-B — frente especializada temporal
   └── MOBILE-J — frente especializada de certificação física
```

Os Coordenadores SaaS e Mobile não foram apagados: permanecem como fontes especializadas de contexto e evidência. Porém **não existe nova wave funcional autorizada** em nenhum dos dois programas.

### Separação de autoridade mesmo no mesmo chat

O mesmo chat pode executar dois papéis, mas as decisões continuam separadas por evidência:

- **Coordenação RC**: compõe candidato, reconcilia, executa gates, prepara Preview e consolida evidências;
- **Program Control**: aceita/rejeita checkpoints, declara RC CANDIDATE/FROZEN, classifica risco e prepara GO/NO-GO;
- **Fundador**: autoriza ações produtivas protegidas e lançamento.

O Coordenador Geral não transforma “continue”, “próximo passo”, CI verde ou PASS técnico em autorização de produção.

## 4. Classificação oficial de problemas

- **LOCAL** → worker.
- **PROGRAM** → Coordenador do programa.
- **TRANSVERSAL** → Coordenador Geral.
- **RELEASE/PRODUÇÃO** → Coordenador Geral + Fundador quando aplicável.

## 5. Semáforo global

- **VERDE** — pode prosseguir.
- **AMARELO** — risco/delta conhecido; pode avançar até a próxima barreira.
- **VERMELHO** — bloquear somente a menor unidade necessária.

O objetivo é evitar que um risco localizado paralise programas independentes.

## 6. WIP e desenvolvimento paralelo

O EMPROVEX adota como método oficial:

> **frentes independentes em paralelo + integração semântica + barreiras explícitas de sincronização.**

A capacidade de revisão determina o WIP, não a quantidade possível de chats.

SaaS e Mobile podem evoluir simultaneamente enquanto seus contratos comuns permanecerem compatíveis.

Não fazer sincronização por merge/rebase cego entre integradoras.

---

# PARTE III — PRODUTO E ARQUITETURA

## 7. Stack vigente

- Next.js 15 / App Router;
- Firebase Auth;
- Firestore;
- Cloud Monitoring;
- Vercel;
- Vercel Blob;
- integrações Google usadas pelos fluxos institucionais.

## 8. Núcleo funcional do EMPROVEX

Capacidades consolidadas incluem:

- Empenhos;
- Itens;
- Notas Fiscais;
- Comissão;
- Tesouraria/Liquidação;
- Cronogramas/Entregas;
- Central de Avisos;
- Relatórios/SAG;
- Administração;
- usuários e sessões;
- telemetria/consumo;
- Central de Depósitos;
- Central Móvel R1 em desenvolvimento.

Performance R3 é a baseline de produção atual.

## 9. Contratos de identidade, sessão e multi-tenant

### 9.1 Identidade autenticada

Fonte: Firebase Auth.

Contrato atual:

- fundador: login **Google-only**;
- usuários externos/setores: login **e-mail/senha only**;
- e-mail verificado é obrigatório;
- sessão com provider inesperado falha fechada;
- Mobile e Desktop usam a mesma identidade; não existe Auth Mobile paralelo.

### 9.2 Relação conta ↔ workspace ↔ UG

Na R1:

- 1 cliente operacional externo = 1 workspace;
- 1 workspace = 1 UG;
- 1 workspace externo possui 1 conta operacional primária;
- conta, workspace e sessão precisam concordar em e-mail/UID/workspace/UG;
- inconsistência de UID, e-mail, UG, status ou provider resulta em **fail-closed**;
- o usuário não recebe subscriptions operacionais antes da validação do contexto.

### 9.3 UID e primeiro vínculo

Contas novas já podem chegar pré-vinculadas ao UID Firebase pelo provisionamento.

Para registros legados sem UID, o bootstrap histórico de primeiro acesso pode vincular o UID após validar:

- e-mail;
- provider;
- conta ativa;
- workspace ativo;
- UG coerente.

Após o vínculo, e-mail idêntico não basta: o UID precisa continuar sendo exatamente o mesmo.

### 9.4 Sessões simultâneas — contrato de runtime atual

O runtime atualmente integrado define:

- usuário externo: **máximo padrão de 2 sessões simultâneas por workspace**;
- founder: **isento do limite de capacidade**;
- slots canônicos: `slot-1` e `slot-2`;
- lease nominal: **30 minutos**;
- heartbeat/renovação nominal: **15 minutos**;
- decisão temporal baseada em relógio confiável do servidor, não no relógio local do Windows;
- revogação administrativa cria tombstone e remove slots conhecidos;
- perda de lease/revogação/mudança de acesso invalida a sessão local.

**Estes números 30/15 são o contrato implementado atual e substituem referências históricas anteriores com valores diferentes.**

### 9.4.1 Mudança autorizada — remoção do teto fixo de duas sessões

Decisão do Fundador em 2026-10-03:

**o limite fixo de 2 sessões simultâneas para usuários externos deve ser removido.**

Motivação operacional:

- a Central Móvel R1 transforma o celular em ferramenta operacional do depósito;
- uma única equipe pode precisar de vários operadores simultâneos;
- alocação, conferência, inventário, transferência e saída podem ocorrer em paralelo;
- limitar o workspace a apenas duas sessões cria gargalo artificial justamente no cenário Mobile;
- Desktop e múltiplos celulares precisam poder coexistir durante a operação.

### Estado atual versus estado alvo

**Estado atual do runtime:**

- limite externo: 2 sessões;
- documentos fixos: `sessionSlots/slot-1` e `sessionSlots/slot-2`;
- lease: 30 minutos;
- heartbeat: 15 minutos;
- revogação administrativa: ativa;
- painel de sessões: ativo;
- telemetria: ativa.

**Estado alvo autorizado:**

- **sem teto fixo de duas sessões por workspace/UG**;
- permitir múltiplas sessões externas simultâneas compatíveis com o uso operacional real;
- manter controle individual de identidade de cada sessão;
- manter lease, heartbeat, revogação, auditoria e telemetria;
- manter possibilidade de encerramento remoto de uma sessão específica;
- manter lifecycle fail-closed;
- manter proteção cross-workspace;
- não transformar “sem limite fixo” em “sem controle de sessão”.

### Princípio arquitetural

A mudança deve remover o **limite de capacidade**, não remover a **camada de segurança de sessão**.

Continuam obrigatórios:

- `sessionId`;
- `browserInstanceId`;
- UID;
- e-mail;
- workspaceId;
- UG;
- lease temporal;
- heartbeat;
- tombstone de revogação;
- invalidação por mudança de acesso;
- painel administrativo de sessões;
- auditoria `session.terminate`;
- telemetria de sessões/consumo.

### Implicação técnica conhecida

A implementação atual usa apenas:

- `slot-1`;
- `slot-2`.

Portanto **não basta alterar `DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT`**.

A frente deverá substituir a reserva física fixa por uma coleção de sessões dinâmicas ou mecanismo equivalente, preservando identidade e revogação.

Direção preferida:

```text
workspaces/{workspaceId}/sessionSlots/{sessionIdOuIdDinamico}
```

ou contrato equivalente que:

- aceite N sessões simultâneas;
- permita identificar cada sessão;
- permita revogar uma sessão específica;
- permita listar sessões no painel;
- permita expiração por lease;
- impeça overwrite de sessão alheia;
- preserve isolamento por workspace.

O nome final do documento/coleção pode ser mantido por compatibilidade se isso simplificar a migração, mas o ID não deve continuar restrito a `slot-1`/`slot-2`.

### Momento ideal de execução

Esta alteração deve ser executada:

**ANTES DO RC CANDIDATE / ANTES DO RC FROZEN.**

Motivo:

- a certificação física Mobile deve representar o comportamento real que será lançado;
- testar o RC com limite 2 e removê-lo depois invalidaria parte da certificação;
- a mudança toca Auth/sessão/Rules/telemetria e precisa estar estabilizada antes do Preview final.

Sequência recomendada:

```text
estado atual consolidado
→ frente transversal SESSION-CAP-01
→ regressão de Auth/sessão/Rules/telemetria
→ integração SaaS + Mobile
→ composição do RC
→ freeze
→ Preview HTTPS
→ testes físicos com múltiplos operadores
```

Se a composição do RC já tiver começado quando a frente for ativada, a alteração deve entrar **antes do freeze**, com repetição dos gates afetados.

Não aplicar após `RC FROZEN` como melhoria oportunista; nesse caso, somente reabrir o freeze por decisão explícita do Program Control/Fundador.

### Escopo mínimo da futura frente SESSION-CAP-01

Arquivos/contratos provavelmente afetados:

- `lib/platformCapacity.ts`;
- `lib/platformSessionLease.ts`;
- `lib/platformSessionControl.ts`;
- `lib/platformAdminSessions.ts`;
- `hooks/useOperationalData.ts`;
- `hooks/usePlatformAdminSessions.ts`;
- painel administrativo de sessões;
- provisionamento/exclusão de setor;
- lifecycle/suspensão;
- `firestore.rules`;
- testes multi-tenant;
- E2E de sessão;
- guards Block 16.0/16.1/16.2;
- guards Block 17.1/17.2;
- telemetria/consumo;
- documentação de capacidade.

### Regras de segurança da alteração

A remoção do teto não pode:

- permitir sessão de outro workspace;
- aceitar UG divergente;
- permitir uma sessão renovar lease de outra;
- permitir recriar sessão revogada;
- permitir que cliente altere identidade do lease;
- remover revogação administrativa;
- remover expiração temporal;
- remover painel de sessões;
- remover auditoria;
- quebrar suspensão/reativação;
- criar acesso anônimo ou bypass de Auth.

### Performance e custo

Mais sessões simultâneas podem aumentar:

- listeners;
- reads;
- writes de heartbeat;
- conexões;
- consumo Firestore;
- telemetria.

Por isso a frente deve medir:

- custo por sessão;
- writes de heartbeat;
- listeners por aba;
- pico de sessões por workspace;
- impacto no Cloud Monitoring;
- comportamento com vários celulares simultâneos.

A ausência de teto fixo não elimina observabilidade de capacidade. O EMPROVEX deve continuar podendo alertar sobre uso anormal ou excessivo.

### Critérios mínimos de aceitação

A futura frente só pode ser considerada PASS se provar:

1. terceiro, quarto e demais logins externos não são bloqueados apenas por capacidade fixa;
2. cada navegador/celular possui identidade de sessão coerente;
3. múltiplas abas da mesma sessão continuam sem duplicação indevida de lease;
4. revogação de uma sessão não derruba sessões diferentes sem intenção;
5. suspensão do workspace invalida todas as sessões operacionais;
6. reativação não ressuscita tombstones antigos;
7. Rules permanecem fail-closed;
8. cross-workspace continua DENY;
9. painel admin lista/encerra sessões corretamente;
10. telemetria registra aumento de sessões;
11. Android + Desktop + múltiplos celulares podem coexistir;
12. Application CI/Core/Rules/multi-tenant/build/typecheck/diff hygiene passam;
13. MOBILE-J repete os testes afetados no RC.

### Classificação

Esta é uma **mudança funcional explicitamente autorizada pelo Fundador**, apesar do freeze geral de novas features.

Ela é tratada como exceção controlada porque remove uma limitação operacional que conflita diretamente com o uso Mobile do depósito.

Até a implementação e certificação terminarem:

**o runtime continua limitado a 2 sessões externas.**

### 9.5 Lifecycle observado em tempo real

Sessões externas monitoram:

- `workspaces/{workspaceId}`;
- `platformAccounts/{email}`;
- revogação da sessão.

Se workspace/conta deixa de estar `active`, identidade deixa de coincidir ou Rules negam acesso, a sessão é invalidada.

### 9.6 Autoridade da Central

A Central de Depósitos adiciona `warehouseAccess` como autorização específica do banco `emprovex-warehouse`.

Suspensão/reativação coordenada deve preservar coerência entre:

- workspace;
- platformAccount;
- warehouseAccess;
- sessões.

### 9.7 Regra multi-tenant

Nunca criar caminhos alternativos que permitam:

- ler outro workspace;
- trocar workspaceId/UG por input do cliente;
- usar barcode como autorização;
- contornar `warehouseAccess`;
- confiar apenas em estado visual/client-side.

Auth, workspace/UG, Legal Gate, lifecycle, sessão e Rules são contratos compartilhados por SaaS, Desktop e Mobile.

# PARTE IV — CENTRAL DE DEPÓSITOS

## 10. Nome e compatibilidade

Nome vigente de produto: **Central de Depósitos**.

O caminho técnico histórico `adm-deposito` e documentos antigos permanecem por compatibilidade.

## 11. Fontes da verdade logísticas

Não criar fontes paralelas para:

- material;
- posição;
- saldo;
- lote;
- barcode;
- ledger;
- transferência;
- autorização de depósito.

Contratos centrais reutilizados pelo Desktop e pela Mobile:

- materiais canônicos;
- depósitos/localizações/subposições;
- `WarehouseStockPosition`;
- lotes/validade;
- FEFO;
- barcode;
- ledger;
- saldos materializados;
- intake;
- transferência;
- outbound.

## 12. Operações canônicas

### Entrada / ALLOCATE

A alocação móvel e desktop deve reutilizar operações oficiais, com:

- idempotência;
- revalidação concorrente;
- associação de barcode;
- lote/validade;
- ausência de escrita client-side paralela de saldo/ledger.

### TRANSFER

Transferência oficial:

- altera distribuição física;
- preserva o total agregado;
- usa operação `TRANSFER`;
- `quantityDelta = 0`;
- não simula transferência por OUTBOUND + nova entrada;
- não escreve diretamente `locationBalance`.

### OUTBOUND

Saída de material deve preservar:

- carrinho/draft;
- idempotência;
- lotes;
- FEFO;
- saldo não negativo;
- ledger oficial.

### Identidade física

Namespace Mobile: **EPX1**.

EPX1 deriva da identidade técnica e sempre é resolvido novamente contra entidades canônicas.

EPX1 não é fonte paralela de posição.

---

# PARTE V — PERFORMANCE R3

## 13. Estado

**PUBLICADA E ENCERRADA.**

Produção:

`main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

A Performance R3 permanece como baseline técnica da produção enquanto SaaS R1/Mobile R1 não forem publicados.

## 14. Resultados consolidados relevantes

Resultados finais registrados durante a rodada:

- Home: First Load caiu aproximadamente de 460 kB para 335 kB;
- principais rotas da Central: aproximadamente 579 kB para 106 kB;
- shared global: aproximadamente 104 kB;
- lazy loading ampliado;
- consultas históricas movidas para demanda;
- invoices quentes separadas semanticamente do histórico;
- cache curto em memória com TTL e isolamento por workspace;
- shell persistente da Central;
- budgets e métricas versionados;
- validação de UX obrigatória.

Detalhes completos de PERF-A...J e PERF-X permanecem no histórico integral e nos documentos `PERFORMANCE_R3_*`.

## 15. Regra permanente herdada da R3

> Ganho técnico que piora significativamente a experiência do operador não é aceito como otimização.

Performance não pode justificar:

- perda de formulário;
- clique aparentemente sem resposta;
- ausência de feedback;
- quebra de foco/teclado/scanner;
- navegação menos previsível;
- informação visual enganosa;
- necessidade nova de refresh manual.

---

# PARTE VI — SAAS R1

## 16. Objetivo

Transformar o EMPROVEX operacional em serviço comercial controlado, sem reconstruir o núcleo do produto.

Princípios:

- vender inicialmente de forma assistida;
- preservar usuários existentes;
- não automatizar finanças antes de haver necessidade real;
- manter billing separado da autorização operacional;
- preservar multi-tenant, segurança, legal, recovery e auditoria;
- só abrir comercialmente após RC, piloto, correções e certificação final.

## 17. Contrato comercial, pagamento, onboarding, legal e lifecycle

### 17.1 Plano comercial congelado

R1 possui um único plano:

**Plano Completo EMPROVEX — R$ 70,00/mês por workspace**

Inclui acesso funcional completo às funcionalidades disponibilizadas para aquele tenant.

Não existem na R1:

- tiers Bronze/Prata/Pro;
- módulos pagos separadamente;
- feature flags comerciais por preço;
- checkout embutido;
- assinatura criada por API;
- webhook de pagamento;
- suspensão automática;
- signup público de organização.

### 17.2 Trial, vencimento e tolerância

Contrato:

- trial padrão: **30 dias**;
- início: provisionamento/concessão administrativa;
- extensão: somente administrativa e auditada;
- vencimento: **5º dia útil**;
- tolerância: **10 dias corridos**;
- feriados adicionais podem ser configurados;
- fim do trial não apaga dados;
- fim do trial não suspende automaticamente;
- competências históricas preservam o valor já materializado.

### 17.3 Fonte de verdade de billing

Coleções/contratos principais:

- configuração: `platformBillingConfig/main`;
- conta comercial: `billingAccounts/{workspaceId}`;
- competências: `billingCycles/{workspaceId}__{referenceMonth}`.

Estados de `BillingAccount`:

- `trial` — teste em andamento;
- `active` — comercialmente regular;
- `pending` — atenção/regularização;
- `suspended` — estado comercial explícito;
- `canceled` — encerramento comercial;
- `exempt` — founder ou VIP/isento.

Estados de competência:

- `open`;
- `pending`;
- `paid`;
- `waived`.

Não criar estados comerciais concorrentes.

### 17.4 Modo de cobrança vigente

Configuração canônica R1:

- `billingMode = observe`;
- `requirePayment = false`;
- `automaticSuspension = false`;
- método administrativo: `pix_manual`.

Consequência essencial:

**billing acompanha e audita a situação comercial, mas billing sozinho não autoriza nem bloqueia o uso operacional.**

Marcar `billingAccounts.status = suspended` não substitui a ação de lifecycle que realmente desabilita workspace/conta/Central.

### 17.5 Pagamento e regularização

O EMPROVEX **não processa cartão/Pix internamente**.

Fluxo canônico:

```text
cliente precisa regularizar
→ abre /regularizacao
→ usa Link de Pagamento HTTPS e/ou copia Pix
→ pagamento ocorre fora do EMPROVEX
→ Fundador/admin confere o recebimento no provedor/banco
→ confirma a competência no painel
→ competência = paid (ou waived quando aplicável)
→ billing account = active
→ evento auditado
```

Configurações administrativas disponíveis:

- `paymentLinkUrl` — URL pública HTTPS;
- `pixKey`;
- `pixKeyType` — CPF/CNPJ/e-mail/telefone/chave aleatória;
- `pixRecipientName`;
- `supportContact`;
- `holidayDates`;
- trial/tolerância dentro dos limites aceitos.

A mensalidade R1 é fixada em R$ 70 pelo domínio; o painel não deve aceitar outro preço como configuração casual.

### 17.6 Provedor de pagamento

O desenho comercial inicial documenta Mercado Pago/Pix como referência operacional.

A implementação, porém, armazena apenas **uma URL pública HTTPS de pagamento**, sem credencial do provedor. Portanto o RC não fica tecnicamente acoplado a um único gateway.

Se outro provedor for adotado:

- deve oferecer URL HTTPS pública apropriada;
- nenhum token/secret deve ir para o cliente;
- Termos/Privacidade devem ser revistos se a mudança alterar materialmente terceiros envolvidos;
- a fonte de verdade da competência continua no EMPROVEX, não no gateway.

API/webhook permanece fora da R1.

### 17.7 Dados financeiros que o EMPROVEX não armazena

Não armazenar:

- número de cartão;
- CVV;
- credencial do gateway;
- Access Token de pagamento no cliente;
- token de cartão;
- comprovante financeiro por padrão.

Podem existir apenas metadados administrativos mínimos e auditáveis, como nota/referência textual da confirmação.

### 17.8 Página pública de regularização

Rota:

`/regularizacao`

Deve apresentar:

- Plano Completo;
- mensalidade;
- vencimento/tolerância;
- Link de Pagamento quando configurado;
- Pix quando configurado;
- contato de suporte.

A página declara que o pagamento ocorre fora do EMPROVEX e não solicita cartão/CVV.

Regularização, Termos, Privacidade e recuperação de credenciais não devem ficar inutilizáveis justamente quando o usuário está suspenso ou precisa recuperar acesso.

### 17.9 Confirmação/reabertura da competência

A confirmação manual é auditada.

- `paid` ou `waived` → competência confirmada; billing account comercial passa para `active`;
- reabertura/não confirmação → billing account passa para `pending`.

**Importante:** se o workspace tiver sido operacionalmente desabilitado pelo lifecycle, confirmar pagamento não equivale automaticamente a reativá-lo. A reativação de acesso é uma ação administrativa separada e explícita.

### 17.10 Suspensão operacional e reativação

A suspensão real da R1 é manual e founder-only.

Para suspender:

1. validar ator/admin;
2. validar coerência workspace/e-mail/UG/conta;
3. desabilitar `warehouseAccess`;
4. alterar `workspaces.status` e `platformAccounts.status` para `disabled`;
5. revogar sessões conhecidas e remover slots;
6. registrar auditoria;
7. compensar/rollback parcial se um banco falhar.

Reativação:

1. retorna workspace/conta principal para `active`;
2. retorna `warehouseAccess` para `active`;
3. se a segunda etapa falhar, o código tenta compensar para impedir estado incoerente;
4. falha parcial não é escondida: pode resultar em `RECOVERY_REQUIRED`.

Suspensão/reativação **não altera dados operacionais**.

### 17.11 Cancelamento e exclusão

`canceled` é estado comercial, não comando de delete.

Cancelamento não:

- apaga workspace;
- apaga documentos;
- apaga histórico;
- apaga estoque/ledger;
- reaproveita UG/e-mail automaticamente.

Retenção, exportação e exclusão são processos separados e sujeitos à política legal/administrativa aplicável.

### 17.12 Onboarding assistido

Não existe auto-cadastro de organização.

Fluxo canônico:

1. Fundador/admin confirma dados mínimos;
2. cria workspace/UG pelo painel;
3. informa e-mail operacional primário;
4. concede trial quando aplicável;
5. provisionamento cria Auth/diretório/billing;
6. credencial inicial é enviada por canal seguro;
7. primeiro acesso valida e-mail/provider/UID/workspace/UG;
8. usuário aceita pacote legal vigente;
9. checklist curto de primeiro acesso é exibido;
10. Google Drive é opcional;
11. usuário começa a operar.

Conta externa: password-only. Founder: Google-only.

### 17.13 Recuperação e troca de senha

R1 inclui:

- “Esqueci minha senha” usando fluxo nativo do Firebase;
- resposta neutra para reduzir enumeração de contas;
- troca da própria senha com reautenticação;
- mensagens humanas para credencial inválida, conta suspensa, workspace inconsistente e limite de sessão.

### 17.14 Legal Gate versionado

Pacote legal atual:

- `legalBundleVersion = saas-r1-2026-10-01`;
- `termsVersion = terms-2026-10-01-r1`;
- `privacyVersion = privacy-2026-10-01-r1`.

Aceite canônico:

`workspaces/{workspaceId}/legalAcceptances/{uid}__{legalBundleVersion}`

Registro contém:

- workspaceId;
- UG;
- UID;
- e-mail;
- versão do bundle;
- versão dos Termos;
- versão da Privacidade;
- timestamp autoritativo.

O runtime verifica especificamente a versão vigente. Novo aceite só é exigido quando o pacote legal configurado muda.

Falha na verificação é **fail-closed**: nenhum aceite é presumido.

Termos e Privacidade permanecem consultáveis no próprio gate.

Aceite contratual não significa que todo tratamento de dados pessoais dependa de “consentimento LGPD”.

### 17.15 Arquitetura de dados SaaS

Não criar terceiro Firestore apenas para billing/legal/onboarding.

Arquitetura R1:

1. banco principal — identidade, workspace, billing, legal, auditoria e núcleo operacional;
2. `emprovex-warehouse` — Central de Depósitos;
3. nenhum terceiro banco SaaS.

Rules são específicas por banco e continuam parte do contrato de release.

## 18. VIP e isenção comercial

### 18.1 Founder

Founder permanece:

- `exempt`;
- preço efetivo R$ 0;
- sem trial;
- sem inadimplência;
- isento do limite padrão de sessões externas.

### 18.2 VIP manual

VIP externo reutiliza a semântica `exempt`.

Contrato:

- mesmo Plano Completo;
- R$ 0 enquanto a isenção estiver ativa;
- nenhuma redução funcional;
- sem cobrança/atraso/suspensão por inadimplência;
- concessão/remoção manual, explícita e auditada;
- histórico preservado.

Não criar status `vip` concorrente.

### 18.3 VIP legado

Coorte histórica materializada:

- `aprovisionamento-2-b-fv`;
- `aprovisionamento-3-gac-ap`;
- `aprovisionamento-teste`.

O código atual protege a isenção `legacy_vip` contra remoção pela operação genérica de isenção.

VIP não cria exceção de segurança, sessão, Legal Gate ou isolamento multi-tenant. Isenção é comercial, não autorização privilegiada.

## 19. Ordem oficial da reta final SaaS

Estado funcional SaaS: **ENCERRADO PARA NOVAS FEATURES**.

Sequência vigente:

```text
HARDEN-A1/A2/C/D PASS
+ HARDEN-B em acompanhamento temporal
→ composição do RC único SaaS+Mobile
→ CT-01 + Rules/package/CI
→ gates combinados
→ RC FROZEN
→ Preview HTTPS
→ certificação real SaaS+Mobile
→ eventual produção controlada autorizada
→ piloto real
→ correções finais
→ SAAS-J
→ GO explícito
→ abertura comercial ampla
```

Nenhuma nova wave funcional SaaS está autorizada sem regressão concreta ou nova decisão de produto.

## 20. HARDEN — estado vivo

| Frente | Estado vigente | Decisão |
| --- | --- | --- |
| HARDEN-A1 — jsPDF | **PASS / ENCERRADA** | jsPDF 4.2.1 + AutoTable 5.0.8; CRITICAL removido; 7/7 regressão PDF; acabamento visual fino = backlog não bloqueante |
| HARDEN-A2 — Firebase/Firestore/gRPC | **PASS — RISCO RESIDUAL ACEITO TECNICAMENTE** | sem alteração de dependência/runtime/Rules; vetores analisados não alcançáveis pelos usos atuais |
| HARDEN-B — Recovery | **PARCIAL / ESPERA CONTROLADA** | controles ativos; backup READY/verify/restore pendentes |
| HARDEN-C — Health/Rules/Release | **PASS / ENCERRADA** | health/release/rollback preparados |
| HARDEN-D — SaaS↔Mobile | **PASS / ENCERRADA** | sem conflito funcional material; CT-01 isolada para o RC |

### A1 — regra pós-fechamento

A inspeção visual fina de PDF não bloqueia RC/piloto/lançamento.

Só reabre gate se surgir defeito funcional real, como:

- PDF vazio;
- geração quebrada;
- conteúdo ausente;
- ilegibilidade operacional;
- paginação funcionalmente destruída.

Margem, espaçamento, alinhamento e refinamento estético ficam em backlog.

### A2 — risco residual

A cadeia Firebase → Firestore → `@grpc/grpc-js` permanece instalada.

Decisão aceita:

- não forçar override fora do range do Firestore;
- não fazer downgrade/major só para reduzir scanner;
- uso browser não carrega o transporte Node gRPC;
- uso Node atual é cliente Firestore, sem servidor gRPC próprio nem primitivas de servidor analisadas;
- não abrir nova frente Firebase/gRPC sem nova evidência técnica ou correção upstream suportada.

Snapshot técnico da A2:

- Firebase declarado: `^10.12.2`;
- Firebase resolvido: `10.14.1`;
- `@firebase/firestore`: `4.7.3`;
- `@grpc/grpc-js`: `1.9.16`;
- pin Firestore: `~1.9.0`.

A aceitação de risco não declara a biblioteca intrinsecamente segura; declara o risco específico como não alcançável pelo uso atual e sem correção suportada melhor no momento.

## 21. HARDEN-B — recovery

Estado:

**PARCIAL — dependência temporal legítima**

Proteções confirmadas nos dois bancos:

- PITR: ativo;
- delete protection: ativa;
- schedule diário de backup: ativo;
- retenção: **14 semanas**;
- tooling `recovery:status` e `recovery:verify` disponível.

Pendências:

1. primeiro backup nativo `READY` no banco principal;
2. primeiro backup nativo `READY` no `emprovex-warehouse`;
3. capturar resource/location/snapshot/expiration;
4. executar `recovery:verify`;
5. preparar restore plan isolado;
6. restore real em banco novo/isolado;
7. validar dados, IAM, Rules, TTL e isolamento.

Não repetir `recovery:apply` enquanto controles permanecerem ativos.

Restore real continua ação protegida e requer autorização explícita quando chegar o momento.

### Relação HARDEN-B ↔ RC

- composição do RC: **não bloqueada**;
- Preview HTTPS sem writes críticos: **não bloqueado por B parcial**;
- produção controlada com writes reais: preferir fortemente `backup READY` nos dois bancos + `recovery:verify`;
- se houver promoção antes disso, o Fundador deve aceitar explicitamente o risco residual;
- abertura comercial final exige prova de recuperação adequada, incluindo restore isolado real conforme plano SaaS.

## 22. Health, Rules, observabilidade e release

### 22.1 Health

Contrato:

- `/api/health` público;
- não expõe dados sensíveis;
- não depende de leitura operacional do Firestore para responder saúde básica.

### 22.2 Observabilidade

Fontes oficiais R1:

- Vercel — deploy/runtime;
- GitHub Actions — certificação/gates;
- Cloud Monitoring — métricas/uptime;
- telemetria Firebase/Firestore já existente;
- logs de sessão/Central quando aplicável.

No ambiente publicado, validar:

- domínio/SSL;
- `/api/health`;
- erros runtime/HTTP;
- erros Firestore/permissão;
- erros de sessão;
- erros da Central;
- crashes do scanner;
- consumo inesperado;
- uptime check/alerta/canal quando materializados.

Uptime/alerta externo não deve ser declarado PASS sem evidência real do ambiente publicado.

### 22.3 Rules candidatas

SaaS e Mobile possuem Rules candidatas reconciliadas entre si.

Blobs auditados:

- candidata `firestore.rules`: `57a1394c921b2ab2c15537fbfc4aaea17515b28a`;
- candidata `firestore.warehouse.rules`: `6e1f1050005314db4e17cb3136409abbddb0ee91`;
- produção atual `firestore.rules`: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- produção atual `firestore.warehouse.rules`: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`.

As candidatas diferem de `main`.

Portanto publicação exige:

1. registrar conteúdo/hash das Rules atuais;
2. registrar conteúdo/hash das Rules RC;
3. executar testes multi-tenant/workspace externo/legal/billing/Central;
4. preparar comando de republicação das Rules anteriores;
5. não confundir rollback Vercel com rollback de Rules.

### 22.4 RULES-AUDIT-01 — auditoria integral de compatibilidade das Firestore Rules

Decisão do Fundador em 2026-10-03:

**as Rules do SaaS R1 + Mobile R1 não serão publicadas em produção por tentativa e erro. Antes de qualquer publicação produtiva, o ruleset final do RC deve passar por uma auditoria integral de compatibilidade.**

Classificação:

**GATE TRANSVERSAL OBRIGATÓRIO PRÉ-RC / PRÉ-PUBLICAÇÃO DE RULES**

Owner:

**Program Control + Coordenação do RC**

#### 22.4.1 Objetivo

Garantir, antes da publicação, que as Rules finais:

1. preservem tudo o que já funciona corretamente na Performance R3;
2. incorporem apenas os novos contratos necessários de SaaS R1, Mobile R1 e SESSION-CAP-01;
3. não introduzam regressões de autorização;
4. não abram acesso indevido;
5. não criem bloqueios sistêmicos de usuários legítimos;
6. mantenham isolamento multi-tenant;
7. mantenham a Central de Depósitos funcional;
8. tenham rollback conhecido e testável;
9. sejam compatíveis com a ordem real de rollout entre aplicação e Rules;
10. possam ser publicadas sem depender de correções improvisadas em produção.

#### 22.4.2 Estado atual das Rules antes da SESSION-CAP-01

Banco principal:

- produção / `main`: `firestore.rules@0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- candidata SaaS: `firestore.rules@57a1394c921b2ab2c15537fbfc4aaea17515b28a`;
- candidata Mobile: **idêntica à candidata SaaS**;
- tamanho aproximado produção: **87,49 KiB / 2.380 linhas**;
- tamanho aproximado candidata: **92,11 KiB / 2.500 linhas**;
- delta observado: aproximadamente **+124 / -4 linhas**.

Banco `emprovex-warehouse`:

- produção / `main`: `firestore.warehouse.rules@b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- candidata SaaS: `firestore.warehouse.rules@6e1f1050005314db4e17cb3136409abbddb0ee91`;
- candidata Mobile: **idêntica à candidata SaaS**;
- tamanho aproximado produção: **151,55 KiB / 3.307 linhas**;
- tamanho aproximado candidata: **152,38 KiB / 3.330 linhas**;
- delta observado: aproximadamente **+24 / -1 linha**.

Conclusão atual:

**não existe conflito SaaS versus Mobile nas Rules candidatas conhecidas. O conflito a auditar é produção R3 versus ruleset final do novo release.**

Os hashes acima são baseline histórica desta auditoria. O PASS final deve usar os hashes do **ruleset pós-SESSION-CAP-01**, que podem ser diferentes.

#### 22.4.3 Dependência obrigatória da SESSION-CAP-01

A auditoria final só pode congelar PASS **depois** da SESSION-CAP-01.

Motivo:

- o runtime atual usa `sessionSlots/slot-1` e `slot-2`;
- as Rules atuais validam esse contrato fixo;
- SESSION-CAP-01 deverá permitir sessões dinâmicas ou mecanismo equivalente;
- portanto o ruleset final ainda sofrerá alteração estrutural.

Regra:

```text
SESSION-CAP-01
→ ruleset final estrutural
→ RULES-AUDIT-01
→ PASS RULES
→ composição/finalização do RC
```

Uma auditoria executada antes da SESSION-CAP-01 pode servir como **baseline**, mas não substitui a auditoria final.

#### 22.4.4 Princípio de compatibilidade

A auditoria não deve perguntar apenas:

> “o App RC funciona com Rules RC?”

Ela deve responder também:

> “as Rules RC preservam o comportamento legítimo já existente na Performance R3?”

Contrato:

**Rules finais = capacidades legítimas já existentes + novos contratos SaaS/Mobile + nenhum acesso indevido novo.**

Não é aceitável resolver uma necessidade nova apagando silenciosamente uma permissão legítima antiga.

#### 22.4.5 Fase A — captura da baseline realmente publicada

Antes de comparar arquivos do Git:

1. consultar o ruleset efetivamente ativo no banco principal;
2. consultar o ruleset efetivamente ativo no `emprovex-warehouse`;
3. registrar Ruleset ID/versão quando disponível;
4. guardar conteúdo/fingerprint/hash;
5. comparar com os blobs esperados de `main`;
6. registrar data/hora da captura;
7. registrar projeto/database alvo.

Se o ruleset realmente publicado divergir do `main` conhecido:

**STOP / DRIFT DE PRODUÇÃO**

Nenhuma publicação nova deve ocorrer antes de explicar e reconciliar a divergência.

#### 22.4.6 Fase B — diff estrutural e semântico

Não limitar a revisão a contagem de linhas.

Para cada arquivo:

- mapear helpers adicionados/removidos/alterados;
- mapear cada `match` adicionado/removido/alterado;
- mapear cada `allow read/get/list/create/update/delete/write`;
- identificar mudanças de provider;
- identificar mudanças de UID/e-mail/workspace/UG;
- identificar mudanças de lifecycle;
- identificar mudanças de billing/legal;
- identificar mudanças de sessão;
- identificar mudanças de `warehouseAccess`;
- identificar mudanças em validação de shape/tamanho/status;
- identificar mudança permissiva;
- identificar mudança restritiva;
- identificar mudança neutra/estrutural.

Cada delta deve possuir:

- origem;
- requisito que o justifica;
- superfície afetada;
- risco de falso ALLOW;
- risco de falso DENY;
- teste correspondente.

#### 22.4.7 Fase C — matriz ALLOW / DENY

Todo domínio modificado deve ter testes positivos e negativos.

Exemplo canônico:

```text
operação legítima do próprio workspace → ALLOW
mesma operação em outro workspace → DENY
sessão sem provider correto → DENY
sessão sem claim/identidade exigida → DENY
usuário não autenticado → DENY
admin onde não existe bypass operacional → DENY
payload válido → ALLOW
payload adulterado → DENY
```

A matriz deve cobrir no mínimo:

**Identidade / multi-tenant**
- founder Google;
- externo password;
- UID correto/incorreto;
- e-mail verificado;
- workspace próprio;
- workspace alheio;
- UG própria;
- UG divergente;
- sessão suspensa/desabilitada.

**Sessões**
- sessão dinâmica válida;
- renovação do próprio lease;
- tentativa de renovar lease de outra sessão;
- sessão revogada;
- tombstone;
- sessão expirada;
- múltiplas sessões legítimas;
- suspensão global do workspace;
- painel administrativo/encerramento remoto.

**Billing**
- configuração administrativa;
- preço R$ 70;
- VIP/`exempt`;
- VIP legado;
- competência;
- usuário externo sem permissão de alteração administrativa.

**Legal**
- GET do próprio aceite esperado;
- criação do próprio aceite vigente;
- versão errada;
- UID errado;
- workspace errado;
- listagem;
- update;
- delete.

**Central de Depósitos**
- founder;
- setor externo autorizado;
- setor externo sem claims;
- setor suspenso;
- `warehouseAccess active`;
- `warehouseAccess disabled`;
- workspace alheio;
- UG divergente.

**Operações logísticas**
- materiais;
- depósitos;
- posições/subposições;
- lotes;
- barcode;
- intake;
- allocation;
- transfer;
- inventory;
- outbound;
- ledger;
- saldos;
- configurações/layouts/destinos aplicáveis.

#### 22.4.8 Fase D — regressão do EMPROVEX legado

O ruleset novo deve rodar também contra as suítes de funcionalidades antigas.

Cobertura mínima:

- Empenhos;
- Itens;
- Notas Fiscais;
- Comissão;
- Liquidação/Tesouraria;
- Cronogramas;
- Fornecedores;
- Alertas;
- Relatórios/SAG;
- Auditoria;
- backup/status quando aplicável;
- Central Desktop;
- operações logísticas já certificadas.

Não é necessário criar teste manual novo para cada linha não alterada se já existir suíte automatizada confiável. Porém **todas as suítes relevantes devem ser executadas com o ruleset final**.

#### 22.4.9 Fase E — Emulator e suíte automatizada

Usar Firestore Emulator/Local Emulator Suite quando aplicável.

Suítes já existentes que devem ser reaproveitadas e ampliadas, entre outras:

- `scripts/firestore-multitenancy-security.test.mjs`;
- `scripts/warehouse-external-access-security.test.mjs`;
- `scripts/legal-acceptance-security.test.mjs`;
- `scripts/verify-saas-r1-security-enforcement.mjs`;
- `scripts/verify-sector-lifecycle.mjs`;
- `scripts/verify-saas-r1-integration.mjs`;
- guards Block 16.0/16.1/16.2;
- guards Block 17.1/17.2;
- testes da Central de Depósitos;
- segurança externa da Central.

Criar, quando a frente for executada, um orquestrador único ou comando equivalente:

`npm run verify:rc-rules-audit`

Objetivo:

**um comando deve reproduzir o gate das Rules do RC sem depender de uma sequência manual esquecível.**

#### 22.4.10 Fase F — matriz de compatibilidade de rollout

Avaliar explicitamente:

| Aplicação | Rules | Objetivo |
| --- | --- | --- |
| Performance R3 | Rules R3 | baseline conhecida |
| Performance R3 | Rules RC | provar compatibilidade durante publicação/rollback |
| App RC | Rules RC | produto final esperado |
| App RC | Rules R3 | identificar operações novas que exigem Rules novas e definir ordem segura de rollout |

A quarta combinação não precisa ser totalmente funcional; ela deve ser **conhecida**.

Se App RC depender obrigatoriamente de uma permissão inexistente nas Rules R3, documentar:

- qual fluxo falha;
- tipo de falha;
- ordem correta de rollout;
- impacto de rollback;
- janela aceitável.

Nenhuma ordem de deploy deve ser escolhida por suposição.

#### 22.4.11 Fase G — compatibilidade da migração de sessões

SESSION-CAP-01 merece análise explícita.

Se tecnicamente viável e seguro, preferir uma janela transitória em que as Rules reconheçam:

- slots legados `slot-1`/`slot-2`;
- IDs dinâmicos novos.

Objetivo:

- permitir rollout/rollback sem quebrar imediatamente clientes/versões anteriores;
- não obrigar migração destrutiva;
- manter segurança durante coexistência.

A compatibilidade legada só permanece enquanto necessária.

Não manter código/Rules legados indefinidamente sem motivo.

Se coexistência segura não for possível, documentar claramente:

- por que não;
- ordem obrigatória de rollout;
- procedimento de rollback;
- efeito sobre sessões já abertas.

#### 22.4.12 Fase H — análise de performance e custo das Rules

A auditoria deve verificar também:

- número de `get()`/`exists()` por avaliação;
- risco de exceder limites de document access calls;
- impacto de `warehouseLifecycleAllowsAccess`;
- impacto de sessões dinâmicas;
- tamanho do ruleset fonte;
- tamanho compilado quando disponível;
- tempo do Emulator;
- crescimento desnecessário de helpers duplicados.

Não resolver segurança aumentando de forma cega o número de leituras das Rules.

#### 22.4.13 Fase I — rollback de Rules

Antes da publicação, manter disponíveis:

**Banco principal**
- hash/blob da Rule anterior;
- arquivo exato anterior;
- comando/procedimento de republicação.

**Warehouse**
- hash/blob da Rule anterior;
- arquivo exato anterior;
- comando/procedimento de republicação.

Rollback de Rules deve ser independente do rollback da aplicação.

Regra:

```text
rollback Vercel != rollback Rules != rollback dados
```

Se uma Rule permissiva indevida tiver permitido escrita/leitura inadequada, republicar a Rule anterior **não desfaz dados já gravados**.

Nesse caso:

1. fechar acesso;
2. identificar janela;
3. auditar documentos/movimentos;
4. reconciliar dados;
5. só depois encerrar incidente.

#### 22.4.14 Fase J — evidência obrigatória

O handoff da RULES-AUDIT-01 deve entregar:

- RULES_MAIN_HASH;
- RULES_RC_HASH;
- WAREHOUSE_RULES_MAIN_HASH;
- WAREHOUSE_RULES_RC_HASH;
- ruleset IDs ativos quando capturáveis;
- diff estrutural;
- diff semântico;
- matriz ALLOW/DENY;
- testes executados;
- contagem PASS/FAIL;
- regressão do legado;
- regressão SaaS;
- regressão Mobile;
- regressão SESSION-CAP-01;
- compatibilidade de rollout;
- tamanho fonte/compilado quando disponível;
- rollback principal;
- rollback warehouse;
- riscos residuais;
- recomendação final.

Classificações permitidas:

- **PASS — RULES APTAS PARA RC**;
- **PARCIAL — CORREÇÃO NECESSÁRIA**;
- **FAIL — BLOQUEAR RC**.

Não existe “PASS por inferência”.

#### 22.4.15 Critérios mínimos de PASS

RULES-AUDIT-01 só pode ser PASS se:

1. Rules ativas atuais forem conhecidas e reconciliadas;
2. não existir drift produtivo inexplicado;
3. SESSION-CAP-01 já estiver refletida no ruleset final;
4. SaaS e Mobile apontarem para o mesmo ruleset final;
5. ALLOW legítimos críticos passarem;
6. DENY de segurança críticos passarem;
7. cross-workspace continuar DENY;
8. founder continuar funcional;
9. externos legítimos continuarem funcionais;
10. Legal Gate funcionar;
11. billing administrativo funcionar sem virar autorização operacional;
12. lifecycle/suspensão/reativação funcionar;
13. Central Desktop funcionar;
14. Central Mobile funcionar;
15. sessões dinâmicas funcionarem;
16. regressão R3 relevante passar;
17. nenhum acesso permissivo novo inexplicado existir;
18. nenhum bloqueio sistêmico novo existir;
19. rollback de ambos os bancos estiver preparado;
20. ordem de rollout estiver definida;
21. tamanho/complexidade do ruleset estiver dentro dos limites aplicáveis;
22. gates automatizados estiverem reproduzíveis.

#### 22.4.16 Regra de publicação

**Nenhuma Firestore Rule produtiva nova do SaaS R1/Mobile R1 poderá ser publicada sem RULES-AUDIT-01 = PASS.**

Exceção:

somente correção emergencial de segurança/incidente real, com autorização explícita do Fundador e Program Control, evidência mínima, rollback pronto e auditoria retrospectiva obrigatória.

CI verde isolado não substitui RULES-AUDIT-01.

PR mergeable não substitui RULES-AUDIT-01.

Preview aprovado não substitui RULES-AUDIT-01.

#### 22.4.17 Relação com o RC

A sequência oficial passa a ser:

```text
SESSION-CAP-01
→ ruleset final
→ RULES-AUDIT-01
→ PASS RULES
→ composição/finalização RC
→ CT-01/package/CI
→ gates combinados
→ RC CANDIDATE
→ RC FROZEN
→ Preview HTTPS
```

Se qualquer mudança posterior ao PASS alterar:

- `firestore.rules`;
- `firestore.warehouse.rules`;
- Auth/provider;
- UID/workspace/UG;
- lifecycle;
- Legal;
- billing enforcement;
- sessão;
- `warehouseAccess`;

o PASS de Rules deve ser considerado **afetado** e os blocos correspondentes da auditoria precisam ser repetidos antes do freeze.

### 22.5 Runbook de incidente

Sequência mínima:

1. confirmar domínio/deployment;
2. verificar health/runtime;
3. verificar Firestore/Monitoring;
4. classificar impacto;
5. interromper writes se houver dúvida de integridade;
6. corrigir ou rollback;
7. reconciliar dados antes de qualquer correção manual;
8. registrar incidente material.

Problema visual isolado não é automaticamente incidente de rollback.

## 23. CT-01 — contrato transversal obrigatório do RC

Estado atual:

- SaaS/main: `camera=(), microphone=(), geolocation=()`;
- Mobile: `camera=(self), microphone=(), geolocation=()`.

Contrato global do RC:

`camera=(self), microphone=(), geolocation=()`

Interpretação:

- câmera same-origin permitida;
- microfone continua bloqueado;
- geolocalização continua bloqueada;
- `getUserMedia` ainda depende de HTTPS/contexto seguro e permissão do navegador.

Ownership:

**Coordenação do RC.**

MOBILE-J não altera globalmente `next.config.ts` por conta própria.

Antes do PASS final:

- materializar CT-01 na branch RC;
- executar gates afetados;
- publicar Preview HTTPS;
- validar o header HTTP realmente servido;
- provar câmera real em dispositivo físico.

# PARTE VII — MOBILE R1

## 24. Objetivo e contrato Mobile R1

Levar operações físicas da Central de Depósitos ao navegador móvel sem criar segunda fonte da verdade.

Contrato:

- web mobile;
- online-first;
- mesma Auth/workspace/UG;
- mesmo Legal Gate/lifecycle/sessão;
- scanner compartilhado;
- EPX1 apenas como identidade física;
- resolver sempre contra entidades canônicas;
- repositories/ledger/saldo/lote/posição oficiais;
- fallback manual;
- sem banco Mobile paralelo;
- sem operação offline integral na R1.

## 25. Estado funcional consolidado

Concluído e integrado:

- MOBILE-A — plataforma/scanner;
- MOBILE-B — etiquetas/resolver;
- Integração 1;
- MOBILE-C — alocação;
- MOBILE-D — transferência;
- MOBILE-E — consulta;
- Integração 2;
- MOBILE-F — inventário;
- MOBILE-G — saída;
- MOBILE-H — conferência;
- Integração 3;
- MOBILE-I — integração controlada A–H.

MOBILE-I:

- worker certificado: `ea5ad10054e2aea608e270a970fde723cde41d93`;
- PR #245: merged;
- squash: `3a5689e0e613adfb7dbf48ef8d44085ec6c951b3`;
- gates principais: PASS;
- novo delta funcional SaaS↔Mobile: nenhum.

Não reabrir F/G/H/I sem regressão concreta.

## 26. MOBILE-J — certificação final

Branch:

`mobile-r1-j-final-certification@90d646372aae3e92318a78b90d71f72c5eb6b00e`

PR #246:

**OPEN / DRAFT / MERGEABLE**

Classificação:

**PARCIAL TECNICAMENTE SAUDÁVEL / CERTIFICAÇÃO EM EXECUÇÃO**

Escopo permitido:

- certificação;
- evidência;
- regressão concreta mínima;
- nenhuma feature nova.

Próximo marco real:

**RC em Preview HTTPS → testes físicos → reconciliação SaaS final → avaliação de PASS FINAL.**

Runbook especializado:

`mobile-r1-j-final-certification:docs/CENTRAL_MOBILE_R1_MOBILE_J_PHYSICAL_TEST_RUNBOOK.md`

## 27. Certificação física obrigatória

### Android / Chrome

Validar:

- Home Mobile;
- câmera permitida;
- câmera negada;
- câmera indisponível;
- fallback manual;
- abrir/fechar câmera;
- troca/retorno de rota;
- scan válido;
- double scan;
- cooldown;
- scans consecutivos;
- luz baixa/reflexo;
- perda/retorno de rede.

### iPhone / Safari

Executar os mesmos cenários quando houver aparelho disponível.

Se não houver aparelho:

**PENDENTE — APARELHO NÃO DISPONÍVEL**

Não inferir PASS de iPhone a partir de Android.

### Code128 físico

Imprimir e testar:

- COMPACT;
- MEDIUM;
- LARGE.

Validar no mínimo:

- LOCAL;
- SUBPOSITION;
- material/produto;
- distância/enquadramento/contraste;
- repetição;
- ausência de confusão entre etiquetas próximas.

Geração digital isolada não é certificação física.

### Feedback físico

Validar:

- som de sucesso;
- som de erro;
- vibração;
- feedback visual;
- ausência de duplo feedback enganoso;
- erro de persistência sem falso sucesso.

### UX real

Validar:

- uso com uma mão;
- legibilidade;
- botões;
- orientação/scroll;
- loading/empty states;
- foco/teclado;
- Enter quando aplicável;
- scanner ↔ formulário;
- recuperação após erro;
- mensagens de confirmação.

Classificar defeitos:

- BLOQUEANTE;
- IMPORTANTE;
- COSMÉTICO;
- BACKLOG.

Só regressão funcional concreta reabre desenvolvimento.

## 28. Jornada física, invariantes, performance e PASS final

Jornada mínima:

```text
LOGIN
→ CENTRAL MOBILE
→ LER MATERIAL/POSIÇÃO
→ ALLOCATE
→ CONSULTAR
→ TRANSFERIR
→ CONFERIR
→ INVENTARIAR
→ OUTBOUND
→ CONSULTAR ESTADO FINAL
→ CENTRAL DESKTOP
→ CONFIRMAR COERÊNCIA
```

Registrar IDs relevantes: workspace/UG/material/barcode/depósito/posições/lote/movementIds/inventoryId/outboundId.

Invariantes:

- ALLOCATE usa posição/barcode/material canônicos;
- TRANSFER preserva total agregado e não gera saldo negativo;
- inventário salvo não altera saldo antes da revisão/confirm;
- OUTBOUND respeita posição/lote/FEFO/idempotência;
- conferência é read-only e usa transferência como correção oficial;
- Desktop e Mobile mostram o mesmo material/saldo/posição/lote/histórico/ledger.

Rede:

- perda antes de operação crítica deve falhar fechada;
- nenhum falso sucesso;
- retorno permite retomada/reconciliação segura;
- idempotência deve impedir duplicação.

Performance de referência pós-Integração 3/MOBILE-I:

- `/central-mobile`: 257 kB;
- `/central-mobile/alocar`: 275 kB;
- `/central-mobile/transferir`: 261 kB;
- `/central-mobile/inventario`: 271 kB;
- `/central-mobile/saida`: 265 kB;
- `/central-mobile/conferir`: 260 kB;
- Shared First Load: 104 kB.

PASS FINAL Mobile exige:

- testes físicos reais;
- CT-01 observada no Preview;
- jornada ponta a ponta;
- coerência Desktop↔Mobile;
- gates técnicos verdes;
- reconciliação final contra o HEAD/RC SaaS;
- nenhum conflito transversal aberto.

O Coordenador Mobile recomenda; Program Control decide a barreira global.

# PARTE VIII — TESTES, CI E RELEASE

## 29. Política de testes e evidência

Browser E2E não é gate universal.

Prioridade:

- instalação reproduzível;
- TypeScript;
- production build;
- testes de domínio;
- guards estruturais;
- multi-tenant;
- Firestore Emulator quando aplicável;
- Core Protection;
- Recovery;
- Legal Validation;
- diff hygiene;
- testes específicos do RC.

Validação manual é legítima e obrigatória para câmera/scanner/barcode/UX física.

**Não inferir PASS sem execução real quando o requisito depende de hardware/navegador/ambiente publicado.**

## 30. Vercel e Preview HTTPS

Durante desenvolvimento, `build-rate-limit` isolado não é regressão de código.

Para RC:

- Preview HTTPS deve apontar para o **mesmo SHA congelado** que poderá ser promovido;
- não testar um build e reconstruir outro para produção;
- validar header CT-01 no HTTP efetivo;
- usar Preview para fechar MOBILE-J e smoke SaaS antes de tocar domínio produtivo.

## 31. Produção, main e autorizações

`main` é baseline conhecida/recuperável, não branch de experimentação.

Problema encontrado em teste:

```text
bug
→ branch curta/hotfix rastreável
→ teste
→ integração no RC
→ gates afetados
→ novo freeze quando necessário
```

Não “corrigir direto na main”.

Ações protegidas dependem de autorização explícita do Fundador:

- merge/release final para `main`;
- Vercel production/promotion;
- Rules produtivas;
- restore real quando aplicável;
- migração destrutiva;
- ação disruptiva em usuário/workspace real;
- GO/NO-GO de produção e lançamento.

### 31.1 Três planos de rollback

Rollback de aplicação não é rollback total do sistema.

Separar:

1. **Aplicação/Vercel** — voltar ao deployment conhecido;
2. **Rules** — republicar Rules anteriores;
3. **Dados** — reconciliar movimentos/writes; não existe “desfazer automático” por rollback Vercel.

Rollback de Vercel não apaga:

- movimentos;
- ledger;
- billing/legal/lifecycle persistido;
- documentos criados;
- alterações de estoque já gravadas.

### 31.2 Estratégia de teste com menor risco

Na certificação publicada:

- usar workspace/material controlado;
- evitar estoque institucional crítico;
- evitar deletes;
- evitar migração destrutiva;
- registrar IDs das operações;
- interromper writes diante de dúvida de integridade;
- auditar ledger/saldos antes de correção manual.

### 31.3 Gatilhos de NO-GO/rollback

Escalar imediatamente se houver:

- falha sistêmica de login;
- founder ou usuário legítimo bloqueado de forma generalizada;
- cross-workspace;
- Rules permitindo acesso indevido;
- Rules negando operação essencial de forma sistêmica;
- saldo negativo/divergente;
- ledger duplicado;
- idempotência quebrada;
- perda de material/lote/posição;
- billing/lifecycle incorreto;
- Legal Gate impedindo uso legítimo de forma sistêmica;
- scanner indisponível por CT-01;
- erro runtime grave;
- regressão grave do Desktop.

Problema exclusivamente visual não exige rollback automático.

# PARTE IX — RISCOS E GATES ABERTOS

## 32. Gates técnicos ainda abertos

### 32.1 Antes do RC CANDIDATE

- executar SESSION-CAP-01 e remover o teto fixo de 2 sessões externas;
- validar múltiplos operadores Desktop/Mobile simultâneos;
- repetir guards de sessão, Rules, lifecycle e telemetria;
- executar RULES-AUDIT-01 sobre o ruleset pós-SESSION-CAP-01;
- capturar Rules realmente publicadas e detectar eventual drift;
- concluir diff estrutural/semântico;
- concluir matriz ALLOW/DENY;
- concluir regressão R3 + SaaS + Mobile;
- concluir compatibilidade de rollout;
- preparar rollback independente dos dois bancos;
- obter **PASS — RULES APTAS PARA RC**;
- criar branch única de composição;
- fixar fontes SaaS e Mobile;
- incorporar semanticamente deltas;
- aplicar CT-01;
- reconciliar Auth/workspace/UG/sessão/Legal/billing/lifecycle;
- reconciliar Rules;
- reconciliar package/lockfile/Application CI;
- reconciliar repositories/shell/scanner/Central;
- registrar hashes;
- gates combinados verdes.

### 32.2 Antes do RC FROZEN

- nenhum conflito material;
- SHA único;
- manifesto de release;
- rollback de aplicação preparado;
- rollback de Rules preparado;
- baseline Performance R3 registrada;
- nenhuma mudança oportunista aberta.

### 32.3 Antes de produção controlada

- RULES-AUDIT-01 permanece válida para os hashes exatos do RC;
- nenhuma alteração de Rules posterior ao PASS ficou sem reauditoria;
- Preview aprovado;
- smoke crítico SaaS+Mobile;
- CT-01 comprovada;
- Rules comprovadas;
- integridade de dados sem dúvida;
- rollback pronto;
- risco HARDEN-B avaliado;
- autorização explícita do Fundador.

Preferência: backup READY nos dois bancos + `recovery:verify`.

### 32.4 Antes de PASS FINAL Mobile

- runbook físico executado;
- Android;
- iPhone ou pendência explicitamente classificada;
- Code128;
- som/vibração;
- rede;
- jornada ponta a ponta;
- Desktop↔Mobile;
- reconciliação final SaaS.

### 32.5 Antes da abertura comercial ampla

- piloto real;
- cliente pago real;
- trial→regularização;
- suspensão→bloqueio→reativação controlada;
- recovery/restore comprovado;
- uptime/alerta;
- custo/capacidade;
- SAAS-J;
- pendências classificadas;
- GO explícito.

## 33. Riscos que não podem ser esquecidos

- confundir billing comercial com autorização operacional;
- assumir que “pago” reativa automaticamente lifecycle desabilitado;
- apagar dados por inadimplência/cancelamento;
- deixar usuário suspenso sem regularização/recuperação acessível;
- duplicar Auth/sessão/legal na Mobile;
- confundir a remoção autorizada do teto de sessões com remoção do controle de sessão;
- manter por engano os IDs fixos `slot-1`/`slot-2` após declarar sessões sem teto;
- remover revogação/lease/telemetria junto com o limite;
- usar números históricos de lease/heartbeat em vez do runtime atual 30/15;
- sobrescrever CT-01;
- publicar Rules sem RULES-AUDIT-01 PASS;
- presumir que Rules do Git são idênticas às realmente ativas em produção;
- testar apenas ALLOW e esquecer DENY;
- validar apenas App RC + Rules RC e ignorar a janela de rollout/rollback;
- alterar Rules após auditoria sem invalidar/repetir o gate;
- publicar Rules sem rollback;
- confundir rollback Vercel com rollback de dados;
- merge/rebase cego entre SaaS e Mobile;
- criar fonte paralela logística;
- reabrir A1/A2 sem nova evidência;
- declarar uptime/backup/restore sem evidência real;
- declarar iPhone PASS por inferência;
- corrigir diretamente em `main`;
- tratar acabamento visual de PDF como blocker sem defeito funcional;
- considerar CI verde como autorização produtiva.

# PARTE X — CRONOLOGIA CANÔNICA

## 34. Marcos históricos principais

### 2026-09 — Central de Depósitos

Consolidados materiais, depósitos/posições, lotes/FEFO, intake, saída, consumo imediato, barcode, ledger, segurança externa e telemetria.

### 2026-10-01 — Performance R3

Rodada encerrada e publicada.

Baseline produtiva atual:

`main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

### 2026-10-01 a 2026-10-02 — SaaS R1 funcional

Integrados billing, onboarding, legal, recovery tooling, lifecycle/security e integração SaaS.

Contrato comercial consolidado em R$ 70 / Plano Completo.

### 2026-10-02 — Program Control

Instituída governança global acima dos programas, com barreiras transversais e autoridade global de RC.

### 2026-10-02 a 2026-10-03 — Mobile R1 funcional

A–H, Integrações 1–3 e MOBILE-I concluídas/integradas.

Desenvolvimento funcional Mobile encerrado.

### 2026-10-03 — Hardening final

- HARDEN-A1: PASS;
- HARDEN-A2: PASS com risco residual aceito;
- HARDEN-C/D: PASS;
- HARDEN-B: parcial/temporal;
- MOBILE-J: certificação final;
- RC conjunto: composição liberada;
- produção: inalterada.

### 2026-10-03 — Remoção do teto fixo de sessões autorizada

Decisão do Fundador:

- remover o limite fixo de 2 sessões externas por workspace/UG;
- motivação principal: permitir múltiplos operadores simultâneos na Central Móvel;
- preservar lease, heartbeat, revogação, painel administrativo, auditoria, lifecycle e telemetria;
- implementar em frente transversal controlada `SESSION-CAP-01`;
- executar antes do RC CANDIDATE/RC FROZEN;
- até a execução, o runtime permanece em 2 sessões externas.

### 2026-10-03 — Auditoria integral de Rules torna-se gate obrigatório

Decisão do Fundador:

- não publicar as novas Firestore Rules por tentativa e erro;
- instituir `RULES-AUDIT-01`;
- auditar banco principal e `emprovex-warehouse`;
- comparar produção real versus ruleset final;
- exigir matriz ALLOW/DENY;
- exigir regressão das funcionalidades antigas e novas;
- exigir compatibilidade de rollout/rollback;
- executar auditoria final depois da SESSION-CAP-01;
- bloquear publicação produtiva de Rules sem PASS formal.

### 2026-10-03 — SESSION-CAP-01 + RULES-AUDIT-01 ativadas

Program Control criou a frente transversal única:

- branch: `rc-session-cap-rules-audit`;
- base congelada: `c6c164c70a1be3e2e7e4e57b0bbf4866d61a71ce`;
- fase 1: SESSION-CAP-01 — remover o teto fixo de 2 sessões preservando segurança, revogação, lifecycle, painel, auditoria e telemetria;
- fase 2: RULES-AUDIT-01 — auditar o ruleset final pós-SESSION-CAP-01 contra a produção/R3, SaaS, Mobile e rollback;
- integração cruzada/merge/rebase da integradora durante a execução: proibidos;
- publicação de Rules, deploy produtivo, merge em `main` e restore: não autorizados;
- handoff final obrigatório ao Program Control.

A frente deve permanecer sequencial: RULES-AUDIT-01 só pode declarar PASS final depois que SESSION-CAP-01 estabilizar o ruleset estrutural.

### 2026-10-04 — SESSION-CAP-01 concluída tecnicamente

Worker `rc-session-cap-rules-audit` encerrou desenvolvimento técnico em:

`a97c1a94799cbbc240994d76fefc6f85925bffe1`

PR:

**#248 — DRAFT / MERGEABLE / NÃO INTEGRADO**

Resultado aceito pelo Program Control:

- SESSION-CAP-01: **PASS TÉCNICO COMPLETO**;
- teto fixo de 2 sessões removido no candidato;
- lease dinâmico por `browserInstanceId`;
- lease 30 min / heartbeat 15 min / revogação 24 h preservados;
- `slot-1` e `slot-2` preservados somente para compatibilidade transitória;
- 3ª e 4ª sessões legítimas: ALLOW;
- pseudo-slot `slot-3`, ID dinâmico adulterado e takeover de lease ativo: DENY;
- painel administrativo, lifecycle, provisioning, revogação, auditoria e telemetria reconciliados;
- suspensão do workspace permanece fail-closed para N sessões;
- multi-tenant preservado.

Gates confirmados no fechamento:

- Application CI #959 — SUCCESS;
- Core Protection #246 — SUCCESS;
- Recovery #637 — SUCCESS;
- Legal Validation #61 — SUCCESS;
- Production Build — PASS;
- TypeScript final — PASS;
- Diff Hygiene — PASS;
- Browser E2E #49 / run 37171327188 — SUCCESS no SHA certificado `44372599fe0526313d3650a55c649615a1ff14d4`;
- Bloco 16.8 — 8/8 PASS;
- quatro sessões independentes + multitab compartilhado — 1/1 PASS.

Vercel permaneceu vermelho apenas por `build-rate-limit`, sem evidência de regressão funcional.

Produção, `main`, Vercel Production e Rules produtivas permaneceram inalterados.

### 2026-10-04 — Baseline produtiva das Rules confirmada sem drift

Leitura somente de produção concluída nos dois bancos.

Ruleset ativo — banco principal:

- release: `cloud.firestore/ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`;
- ruleset ID: `06094fa5-0b5b-4dc0-a0b5-7ca032864860`;
- fingerprint Git normalizado: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- baseline esperada de `main`: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- drift: **NENHUM**.

Ruleset ativo — Warehouse:

- release: `cloud.firestore/emprovex-warehouse`;
- ruleset ID: `d246184a-350f-40a0-8241-f2b0fa631768`;
- fingerprint Git normalizado: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- baseline esperada de `main`: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- drift: **NENHUM**.

Primeiro gate externo da RULES-AUDIT-01: **PASS**.

### 2026-10-04 — Inventário pré-TTL validado

Leitura somente de produção executada antes de qualquer ativação de TTL.

`sessionSlots`:

- total: **5**;
- sem `expiresAt`: **0**;
- expirados: **5**;
- não expirados: **0**.

`sessionRevocations`:

- total: **0**;
- sem `expiresAt`: **0**;
- expirados: **0**;
- não expirados: **0**.

Conclusão operacional:

- não existe sessão ativa que seria atingida imediatamente pela ativação de TTL;
- os 5 documentos existentes em `sessionSlots` já estão expirados e são resíduos de lease;
- não existem tombstones de revogação pendentes;
- ativar TTL nos dois collection groups é tecnicamente coerente com o contrato da SESSION-CAP-01;
- a ativação continua sendo mudança produtiva de retenção e exige autorização explícita do Fundador.

### 2026-10-04 — TTL produtivo ausente

Consulta somente leitura de:

- `sessionSlots.expiresAt`;
- `sessionRevocations.expiresAt`;

retornou somente `indexConfig`, sem `ttlConfig`.

Conclusão:

**TTL NÃO CONFIGURADO** nos dois collection groups.

Impacto:

- RULES-AUDIT-01 ainda não recebe PASS FINAL;
- SESSION-CAP-01 continua PASS técnico;
- ativar TTL é mudança produtiva de retenção e pode excluir documentos já expirados;
- ativação exige decisão/autorização explícita do Fundador;
- antes da ativação, Program Control deve preferencialmente inspecionar os documentos existentes e confirmar que `expiresAt` está coerente.

### 2026-10-04 — RULES-AUDIT-01 em fechamento externo

Classificação:

**PRONTA PARA FECHAMENTO EXTERNO / AINDA NÃO PASS FINAL**

Rules candidatas pós-SESSION-CAP:

- principal RC: `bc91185f34bcdcb4437a4de1078d1089a09292ba`;
- Warehouse RC: `6e1f1050005314db4e17cb3136409abbddb0ee91`.

Faltam apenas dois gates vivos:

1. capturar em modo somente leitura os rulesets realmente ativos nos dois bancos e comparar drift;
2. confirmar TTL realmente configurado para:
   - `sessionSlots.expiresAt`;
   - `sessionRevocations.expiresAt`.

Se houver drift inexplicado:

**STOP PRODUCTION RULES DRIFT — NÃO PUBLICAR.**

Se baseline vivo e TTL forem coerentes, Program Control poderá fechar RULES-AUDIT-01 e seguir para integração/RC conforme governança.

Ordem de rollout candidata, se mantida após os gates vivos:

```text
Rules RC
→ aplicação RC
```

Compatibilidade comprovada:

- app antiga + Rules RC: compatível via `slot-1`/`slot-2`;
- app RC + Rules RC: alvo;
- app RC + Rules antigas: incompatível.

Rollback:

- aplicação pode voltar primeiro mantendo Rules RC;
- rollback das Rules exige rollback prévio da aplicação.

### 2026-10-03 — Transição para Release Engineering

Por decisão do Fundador:

- Coordenador Geral assume também Coordenação do RC;
- Coordenadores SaaS/Mobile entram em modo consulta/evidência;
- nenhuma nova wave funcional autorizada;
- próximo produto a ser construído é um único SHA de RC SaaS+Mobile.

# PARTE XI — DECISÕES PERMANENTES

## 35. Decisões que só podem mudar por decisão explícita

### Produto

- experiência operacional prevalece sobre otimização marginal;
- SaaS e Mobile são interfaces do mesmo produto;
- Central Mobile não cria backend/fonte de verdade paralelos;
- uma única autoridade por material/saldo/lote/posição/ledger.

### Comercial

- Plano Completo R$ 70/mês por workspace;
- trial padrão 30 dias;
- vencimento 5º dia útil;
- tolerância 10 dias;
- cobrança externa;
- confirmação manual;
- modo observe;
- sem suspensão automática;
- sem delete por inadimplência;
- API/webhook fora da R1;
- founder/VIP usam `exempt`;
- VIP não perde funcionalidades.

### Billing versus lifecycle

- `billingAccounts` é fonte comercial;
- `workspaces.status` + `platformAccounts.status` + `warehouseAccess` governam acesso;
- status comercial sozinho não deve virar autorização;
- suspensão/reativação real é ação administrativa explícita;
- pagamento confirmado não reativa automaticamente lifecycle desabilitado.

### Identidade e sessão

- founder Google-only;
- externo password-only;
- workspace/UG/UID/e-mail precisam ser coerentes;
- founder isento de capacidade;
- runtime atual dos externos: 2 sessões, **com remoção do teto fixo já autorizada pelo Fundador**;
- estado alvo: sessões externas sem limite fixo por workspace, preservando identidade/lease/revogação/auditoria/telemetria;
- a migração deve ocorrer antes do RC freeze;
- lease atual permanece 30 min;
- heartbeat atual permanece 15 min;
- revogação administrativa encerra sessões conhecidas;
- fail-closed em inconsistência.

### Legal

- pacote legal versionado;
- versão atual `saas-r1-2026-10-01`;
- aceite por UID + bundle;
- nenhum aceite é presumido em erro;
- VIP não possui exceção legal;
- regularização/Termos/Privacidade/recuperação não devem ser bloqueadas indevidamente.

### Dados

- cancelamento comercial não apaga dados;
- suspensão não altera estoque/documentos;
- exportação/retenção/exclusão são processos separados;
- nenhum rollback improvisado de estoque/ledger.

### Segurança e dependências

- RULES-AUDIT-01 é gate obrigatório antes de publicar Rules do novo release;
- Rules realmente ativas devem ser capturadas e comparadas ao Git antes de rollout;
- todo delta de Rule precisa de justificativa + teste ALLOW/DENY;
- regressão da Performance R3 é obrigatória com o ruleset final;
- rollback de Rules é separado de rollback Vercel;
- alteração de Rules após PASS invalida os blocos afetados da auditoria;
- Rules não são afrouxadas para facilitar teste;
- CT-01 permite somente câmera same-origin;
- microfone/geolocalização permanecem bloqueados;
- A2 não reabre sem nova evidência/upstream relevante;
- não usar `npm audit fix --force` como estratégia.

### PDFs

- jsPDF 4.2.1 / AutoTable 5.0.8;
- defeito funcional em PDF bloqueia;
- acabamento visual fino isolado não bloqueia e pode ir para backlog.

### Release

- `main` não é branch de experimentação;
- Preview testa o SHA que poderá ser promovido;
- aplicação, Rules e dados possuem rollback/reconciliação distintos;
- CI verde não autoriza produção;
- Fundador mantém GO/NO-GO produtivo final.

### Desenvolvimento

- novas features SaaS/Mobile estão congeladas durante a composição/certificação do RC;
- corrigir apenas regressão concreta;
- conflitos são resolvidos semanticamente;
- workers/frentes especializadas não integram cruzado por conveniência.

# PARTE XII — ÍNDICE OPERACIONAL

## 36. Documentos globais

- `docs/EMPROVEX_MEMORIAL_OFICIAL.md` — estado/contratos/governança;
- `docs/EMPROVEX_PROGRAM_CONTROL.md` — protocolo do Coordenador Geral;
- `docs/EMPROVEX_MEMORIAL_HISTORICO_ATE_2026-10-03.md` — histórico integral preservado.

## 37. SaaS R1

Documentos canônicos:

- `docs/SAAS_R1_PLANO_MESTRE.md`;
- `docs/SAAS_R1_EXECUCAO_PARALELA.md`;
- `docs/SAAS_R1_INTEGRATION_STATUS.md`;
- `docs/SAAS_R1_COORDENADOR_HANDOFF.md`;
- `docs/SAAS_R1_PRE_PILOTO_HARDENING.md`;
- `docs/SAAS_R1_HARDEN_A2_FIREBASE_FIRESTORE_GRPC.md`;
- documentação HARDEN-B/recovery.

Para contrato comercial/operacional vigente, este Memorial tem precedência sobre checkpoints históricos antigos.

## 38. Mobile R1

Documentos canônicos:

- `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md`;
- `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`;
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`;
- `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`;
- `docs/CENTRAL_MOBILE_R1_FINAL_CERTIFICATION.md` — MOBILE-J;
- `docs/CENTRAL_MOBILE_R1_MOBILE_J_PHYSICAL_TEST_RUNBOOK.md` — atualmente na branch `mobile-r1-j-final-certification`.

O runbook físico é procedural. Este Memorial registra os critérios canônicos; o runbook registra casos/evidências.

## 39. Central de Depósitos

- `docs/adm-deposito/README.md`;
- `docs/adm-deposito/STATUS.md`;
- `docs/adm-deposito/DECISIONS.md`;
- `docs/adm-deposito/ROADMAP.md`.

## 40. Performance R3

- `docs/PERFORMANCE_R3_COMERCIALIZACAO.md`;
- `docs/PERFORMANCE_R3_EXECUCAO_PARALELA.md`;
- `docs/PERFORMANCE_R3_INTEGRATION_STATUS.md`;
- `docs/PERFORMANCE_R3_COORDENADOR_HANDOFF.md`.

## 41. Testes e CI

- `docs/TESTING_POLICY.md`;
- `docs/DEVELOPMENT_CI_WORKFLOW.md`.

---

# PARTE XIII — PROTOCOLO DE ATUALIZAÇÃO DO MEMORIAL

## 42. O que deve ser atualizado imediatamente

Atualizar o Memorial quando houver:

- mudança de `main`;
- nova integradora relevante;
- conclusão de wave;
- mudança de semáforo global;
- conflito transversal;
- decisão arquitetural;
- mudança de contrato comercial;
- mudança de política de segurança;
- freeze de RC;
- produção/release;
- novo blocker global.

## 43. O que não deve inflar novamente o Memorial

Detalhes como:

- todos os runs;
- logs de terminal;
- cada tentativa de CI;
- cada commit intermediário;
- cada comentário de PR;
- cada prompt de worker;

devem continuar preservados nos documentos especializados/Git, mas não duplicados integralmente no corpo principal.

## 44. Regra de preservação histórica

Nenhuma reorganização documental pode apagar evidência histórica.

Quando uma seção crescer a ponto de prejudicar leitura:

1. consolidar o estado vigente neste Memorial;
2. preservar a versão detalhada em documento histórico/especializado;
3. registrar link explícito;
4. manter Git como trilha definitiva.

O arquivo:

`docs/EMPROVEX_MEMORIAL_HISTORICO_ATE_2026-10-03.md`

é a primeira aplicação formal dessa regra e contém o Memorial legado integral.

---

# 45. Estado para retomada imediata

```text
PRODUÇÃO
main@e90f92acae1514ee5cbc6ce95fed354bc1454330
Performance R3

GOVERNANÇA
Program Control + Coordenação do RC: ATIVO
Coordenadores SaaS/Mobile: consulta/evidência sob demanda
Fundador: autoridade final de produção/GO

SAAS R1
funcional: ENCERRADO
HARDEN-A1: PASS
HARDEN-A2: PASS — risco residual aceito
HARDEN-B: PARCIAL / temporal
HARDEN-C: PASS
HARDEN-D: PASS
nova feature SaaS: NÃO AUTORIZADA

BILLING R1
Plano Completo: R$ 70/mês
trial: 30 dias
vencimento: 5º dia útil
tolerância: 10 dias
modo: observe
requirePayment: false
automaticSuspension: false
pagamento: externo via Link HTTPS/Pix
confirmação: manual/auditada
suspensão operacional: manual via lifecycle
delete por inadimplência: NÃO

IDENTIDADE / SESSÕES
founder: Google-only / capacidade isenta
externo: e-mail+senha / e-mail verificado
workspace↔UG↔conta primária: obrigatório
sessões externas PRODUÇÃO ATUAL: 2
SESSION-CAP-01 candidato: PASS TÉCNICO COMPLETO
estado alvo implementado na branch: múltiplas sessões externas sem teto fixo, com controle individual
lease: 30 min
heartbeat: 15 min
fail-closed: SIM

LEGAL
bundle: saas-r1-2026-10-01
terms: terms-2026-10-01-r1
privacy: privacy-2026-10-01-r1
aceite: versionado por UID/workspace
erro de verificação: fail-closed

MOBILE R1
funcional A–I: ENCERRADO
MOBILE-J: CERTIFICAÇÃO FINAL EM EXECUÇÃO
HEAD J: 90d646372aae3e92318a78b90d71f72c5eb6b00e
blocker funcional: NENHUM
próximo trabalho: RC Preview HTTPS + runbook físico

RULES
SESSION-CAP branch: rc-session-cap-rules-audit@a97c1a94799cbbc240994d76fefc6f85925bffe1
PR #248: DRAFT / MERGEABLE / NÃO INTEGRADO
principal RC: bc91185f34bcdcb4437a4de1078d1089a09292ba
warehouse RC: 6e1f1050005314db4e17cb3136409abbddb0ee91
RULES-AUDIT-01: PRONTA PARA FECHAMENTO EXTERNO / PASS FINAL PENDENTE
gate 1: rulesets ativos + drift check — PASS / SEM DRIFT
pendência única: TTL de sessionSlots/sessionRevocations — NÃO CONFIGURADO
publicação produtiva sem PASS: PROIBIDA
rollback Rules: obrigatório e independente do Vercel

RECOVERY
PITR: ATIVO em ambos
delete protection: ATIVA
backup diário: ATIVO
retenção: 14 semanas
backup READY: PENDENTE
recovery:verify: PENDENTE
restore isolado real: PENDENTE / protegido

RELEASE
RC único SaaS+Mobile: COMPOSIÇÃO LIBERADA
RC Candidate: AINDA NÃO DECLARADO
RC Frozen: NÃO
CT-01: PENDENTE NO RC
Preview HTTPS: AINDA NÃO PUBLICADO
produção controlada: NÃO AUTORIZADA
piloto real: NÃO INICIADO
abertura comercial: NÃO AUTORIZADA

PRÓXIMA SEQUÊNCIA
capturar rulesets realmente ativos dos 2 bancos
→ comparar drift
→ confirmar TTL real de sessionSlots/sessionRevocations
→ fechar RULES-AUDIT-01
→ integrar semanticamente PR #248
→ criar/finalizar branch RC
→ compor SaaS+Mobile semanticamente
→ aplicar CT-01
→ reconciliar Rules/package/lockfile/CI/contratos
→ gates no SHA exato
→ declarar RC CANDIDATE
→ freeze
→ Preview HTTPS
→ testes SaaS + MOBILE-J físicos
→ corrigir regressões reais
→ GO/NO-GO de produção controlada
```

## Regra final de continuidade

Antes de qualquer decisão futura:

1. ler este bloco;
2. conferir HEADs vivos;
3. conferir se o evento é funcional, transversal ou produtivo;
4. nunca promover estado histórico a estado vigente;
5. nunca considerar uma pendência “resolvida” sem evidência;
6. nunca tratar PASS técnico como autorização de produção.