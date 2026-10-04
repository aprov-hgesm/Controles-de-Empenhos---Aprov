# EMPROVEX — Program Control / Coordenador Geral

Data de instituição: **2026-10-02**

Estado: **ARQUITETURA OFICIAL ATIVA / PROGRAM CONTROL + COORDENAÇÃO DO RC EM OPERAÇÃO / FASE DE RELEASE ENGINEERING**

## 1. Finalidade

O Coordenador Geral do EMPROVEX é a camada de governança acima dos Coordenadores de Programa.

Seu objetivo é preservar:
- coerência global;
- eficiência do desenvolvimento paralelo;
- integração segura entre programas;
- rastreabilidade de decisões;
- controle de WIP;
- integridade do Memorial Oficial;
- preparação correta de Release Candidates e releases.

Ele **não é um worker**.

Durante a fase funcional, ele não substitui os Coordenadores de Programa. Na fase atual de Release Candidate, por decisão do Fundador, o Coordenador Geral também acumula a **Coordenação operacional do RC**, enquanto os Coordenadores SaaS/Mobile permanecem como fontes especializadas de evidência e consulta sob demanda.

## 2. Hierarquia oficial

### 2.1 Durante desenvolvimento funcional

```text
FUNDADOR
   │
COORDENADOR GERAL / PROGRAM CONTROL
   │
   ├── COORDENADOR MOBILE-R1
   │      └── workers MOBILE
   │
   └── COORDENADOR SAAS-R1
          └── workers SAAS/HARDEN
```

### 2.2 Durante a fase atual de RC

```text
FUNDADOR
   │
PROGRAM CONTROL + COORDENAÇÃO DO RC
   │
   ├── COORDENADOR SAAS-R1 — consulta/evidência
   ├── COORDENADOR MOBILE-R1 — consulta/evidência
   ├── HARDEN-B — frente especializada temporal
   └── MOBILE-J — certificação física especializada
```

Regras vigentes:

- nenhuma nova wave funcional SaaS/Mobile está autorizada, **exceto SESSION-CAP-01, autorizada explicitamente pelo Fundador para remover o teto fixo de 2 sessões antes do RC freeze**;
- Coordenadores de Programa não foram descartados; ficam congelados operacionalmente e retornam apenas por necessidade específica;
- a Coordenação RC compõe o candidato e consolida evidências;
- Program Control continua sendo a camada que aceita/rejeita o checkpoint global;
- o Fundador continua autoridade final de produção e lançamento;
- mesmo quando Coordenação RC e Program Control estão no mesmo chat, PASS exige SHA/diff/gates/evidência e não autoaprovação subjetiva.

Não criar nova camada hierárquica acima do Coordenador Geral.

## 3. Autoridade do Fundador

Continuam exclusivas do fundador, quando aplicável:
- autorização de publicação produtiva;
- merge/release final quando explicitamente protegido;
- deploy/promoção Vercel produtiva;
- publicação de Rules produtivas;
- restore real quando exigir autorização;
- ações disruptivas sobre usuários/workspaces reais;
- decisão GO/NO-GO de Release Candidate e lançamento;
- alteração de contratos comerciais fundamentais quando não delegada.

O Coordenador Geral prepara a decisão; não substitui a autorização humana.

## 4. Responsabilidades exclusivas do Coordenador Geral

### 4.1 Estado global
Manter visão viva de:
- `main`/produção;
- integradora SaaS;
- integradora Mobile;
- bases congeladas;
- workers ativos;
- workers aguardando handoff;
- PRs relevantes;
- conflitos compartilhados;
- blockers;
- último ponto de reconciliação;
- próximo gate;
- estado do Release Candidate;
- autorização de produção.

### 4.2 Controle de concorrência e WIP
Decidir:
- quantos workers podem ficar ativos simultaneamente;
- quais frentes podem coexistir sem colisão;
- quais devem aguardar uma barreira de sincronização;
- quando não abrir uma nova onda porque a capacidade de revisão está saturada.

Princípio:
> **A capacidade de revisão determina o paralelismo; a capacidade de abrir chats não.**

Se handoffs se acumularem sem auditoria, não abrir nova onda.

### 4.3 Integração transversal
Arbitrar qualquer delta que atravesse mais de um programa, especialmente:
- Auth;
- workspace/UG;
- sessão/lease/heartbeat;
- legal gate;
- billing/lifecycle;
- Firestore Rules;
- `warehouseAccess`;
- Central de Depósitos;
- schemas/source of truth;
- shell/guards;
- APIs/serviços compartilhados;
- `next.config.ts` / políticas de navegador quando compartilhadas;
- telemetria/monitoramento com impacto comum.

### 4.4 Release management
Somente o Coordenador Geral pode declarar, no nível global:
- `PROGRAMAS RECONCILIADOS`;
- `EMPROVEX RC CANDIDATO`;
- `RC FROZEN`;
- `PRONTO PARA SOLICITAR PUBLICAÇÃO CONTROLADA`;
- `PRONTO PARA PILOTO`;
- `PRONTO PARA CERTIFICAÇÃO FINAL`.

Coordenadores de Programa podem declarar seu programa PASS, mas não declarar sozinhos o EMPROVEX globalmente pronto.

### 4.5 Governança documental
O Memorial Oficial passa a ter **propriedade lógica do Coordenador Geral**.

Isso significa:
- preservar coerência entre estado atual e histórico;
- manter o topo do Memorial representando sempre o estado vivo

### SESSION-CAP-01 — exceção funcional autorizada

O Fundador autorizou remover o limite fixo de **2 sessões externas simultâneas por workspace/UG**.

Motivação:

- múltiplos operadores precisam utilizar a Central Móvel em paralelo;
- Desktop e vários celulares devem poder coexistir;
- o teto atual cria gargalo operacional artificial.

Regra:

- remover apenas o teto fixo;
- preservar identidade de sessão, lease, heartbeat, revogação, lifecycle, painel administrativo, auditoria e telemetria;
- não confundir “sem teto fixo” com “sem controle de sessão”.

A implementação atual usa `slot-1`/`slot-2`, portanto a frente exige migração estrutural para sessões dinâmicas ou mecanismo equivalente.

Momento obrigatório:

**antes do RC CANDIDATE / antes do RC FROZEN.**

Enquanto não implementada e certificada, o runtime permanece em 2 sessões externas.

A frente deve repetir gates de Auth/sessão/Rules/lifecycle/telemetria e ser reconciliada com Mobile antes do freeze.

## 4.6 Fase atual — Release Candidate

O próximo produto global não é uma nova feature: é um **único SHA de RC SaaS R1 + Mobile R1**.

Responsabilidades da Coordenação RC:

- escolher/fixar fontes SaaS e Mobile;
- compor semanticamente, sem merge cego;
- materializar CT-01;
- reconciliar Rules/package/lockfile/Application CI;
- reconciliar Auth/workspace/UG/sessão/Legal/billing/lifecycle/Central;
- executar gates no SHA exato;
- preparar rollback;
- publicar Preview HTTPS quando o candidato estiver congelado;
- consolidar testes SaaS e MOBILE-J;
- produzir checkpoint para decisão Program Control.

A Coordenação RC **não pode**:

- abrir feature nova por conveniência;
- editar diretamente `main` para “testar”;
- promover produção sem GO;
- publicar Rules produtivas sem autorização;
- executar restore real sem autorização;
- declarar lançamento amplo.

;

## 12. Estado corrente da governança

Snapshot em 2026-10-04:

- produção: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330` — Performance R3;
- SaaS funcional: encerrado;
- HARDEN-A1/A2/C/D: PASS;
- HARDEN-B: parcial/temporal;
- Mobile funcional A–I: encerrado;
- MOBILE-J: certificação final;
- nova feature SaaS/Mobile: congelada;
- SESSION-CAP-01: PASS técnico completo / integrada via PR #248;
- RULES-AUDIT-01: PASS — RULES APTAS PARA RC;
- TTL sessionSlots/sessionRevocations: ACTIVE;
- composição RC-A: concluída / semanticamente reconciliada;
- certificação RC-B: PASS com risco externo controlado;
- PROGRAMAS RECONCILIADOS: **DECLARADO**;
- RC CANDIDATE: **DECLARADO** em `54e60c2264588d8802a67a4cab3d875d64f6bfc1`;
- RC-F: **FREEZE READY / ACEITO**;
- RC FROZEN: **DECLARADO** em `54e60c2264588d8802a67a4cab3d875d64f6bfc1`;
- Preview HTTPS: ainda não publicado;
- produção controlada: não autorizada;
- piloto real: não iniciado;
- lançamento comercial: não autorizado.

A próxima barreira global é:

```text
SESSION-CAP-01 — PASS / integrada
→ RULES-AUDIT-01 — PASS
→ RC-A — composição PASS
→ RC-B — certificação PASS com risco externo controlado
→ PROGRAMAS RECONCILIADOS
→ RC CANDIDATE — DECLARADO
→ RC-F — FREEZE READY / ACEITO
→ RC FROZEN — DECLARADO
→ Preview HTTPS
→ certificação real
→ GO/NO-GO
```

## 13. Frente ativa — SESSION-CAP-01 + RULES-AUDIT-01

Estado: **ENCERRADA / INTEGRADA**

Branch exclusiva:

`rc-session-cap-rules-audit`

Base congelada:

`c6c164c70a1be3e2e7e4e57b0bbf4866d61a71ce`

Ordem obrigatória:

1. auditar arquitetura de sessão atual;
2. implementar SESSION-CAP-01;
3. estabilizar runtime/Rules/testes;
4. executar RULES-AUDIT-01 sobre o ruleset final;
5. entregar handoff ao Program Control.

Não autorizado:

- merge/rebase da integradora durante a execução;
- publicação de Rules produtivas;
- deploy Vercel produtivo;
- merge em `main`;
- restore real;
- mudança funcional fora do escopo;
- declarar RC CANDIDATE/FROZEN.

Critério de saída:

- SESSION-CAP-01 tecnicamente estável;
- RULES-AUDIT-01 com classificação formal;
- hashes/diff/testes/rollback documentados;
- impacto SaaS/Mobile reconciliado;
- PR/handoff prontos para auditoria do Program Control.

## 14. Checkpoint — SESSION-CAP-01 concluída

Estado aceito pelo Program Control:

- branch worker: `rc-session-cap-rules-audit`;
- HEAD final: `a97c1a94799cbbc240994d76fefc6f85925bffe1`;
- PR #248: READY / MERGED;
- squash de integração: `54aba792cb9e7bb195e21401fb50a21ed50add19`;
- SESSION-CAP-01: **PASS TÉCNICO COMPLETO**;
- Application CI #959: SUCCESS;
- Core Protection #246: SUCCESS;
- Recovery #637: SUCCESS;
- Legal Validation #61: SUCCESS;
- Browser E2E #49 / run 37171327188: SUCCESS;
- Vercel: falha externa por `build-rate-limit`, sem regressão funcional comprovada;
- produção: inalterada.

Contrato técnico aceito:

- sessões externas sem teto fixo no candidato;
- documento dinâmico por `browserInstanceId`;
- lease 30 min;
- heartbeat 15 min;
- revogação 24 h;
- compatibilidade transitória `slot-1`/`slot-2`;
- lifecycle fail-closed para N sessões;
- admin/revogação/auditoria/telemetria preservados.

## 15. Checkpoint — RULES-AUDIT-01

Estado:

**PASS — RULES APTAS PARA RC**

Gates externos concluídos:

1. Rules produtivas capturadas nos dois bancos — **SEM DRIFT**;
2. `sessionSlots.expiresAt` — **ACTIVE**;
3. `sessionRevocations.expiresAt` — **ACTIVE**.

Rules candidatas atuais:

- principal RC: `bc91185f34bcdcb4437a4de1078d1089a09292ba`;
- Warehouse RC: `6e1f1050005314db4e17cb3136409abbddb0ee91`.

Regra:

- drift inexplicado → **STOP PRODUCTION RULES DRIFT — NÃO PUBLICAR**;
- sem baseline vivo/TTL → não declarar PASS por inferência;
- nenhum deploy produtivo de Rules antes do PASS;
- nenhum merge de PR #248 antes da decisão do Program Control após esses gates.

Ordem candidata de rollout, condicionada ao fechamento dos gates:

```text
Rules RC
→ aplicação RC
```

Compatibilidade conhecida:

- app antiga + Rules RC: compatível;
- app RC + Rules RC: alvo;
- app RC + Rules antigas: incompatível.

Próxima ação global:

```text
compor RC único SaaS R1 + Mobile R1
→ materializar CT-01
→ reconciliar Rules/package/lockfile/Application CI
→ executar gates no SHA exato
→ declarar RC CANDIDATE se PASS
```

## 16. Checkpoint — baseline produtiva das Rules e TTL

Baseline viva capturada com sucesso:

- principal ativo: ruleset `06094fa5-0b5b-4dc0-a0b5-7ca032864860`;
- principal fingerprint: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- Warehouse ativo: ruleset `d246184a-350f-40a0-8241-f2b0fa631768`;
- Warehouse fingerprint: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- drift produtivo: **NENHUM**.

Gate baseline/drift: **PASS**.

TTL vivo:

- `sessionSlots.expiresAt`: sem `ttlConfig`;
- `sessionRevocations.expiresAt`: sem `ttlConfig`.

Conclusão:

**TTL NÃO CONFIGURADO**.

RULES-AUDIT-01 permanece:

**PARCIAL — PENDENTE APENAS DE TTL PRODUTIVO**

Ativação de TTL é alteração produtiva com efeito automático de exclusão de documentos expirados e exige autorização explícita do Fundador.

## 17. Checkpoint — inventário pré-TTL

Leitura somente de produção:

- sessionSlots: 5 total / 5 expirados / 0 ativos / 0 sem expiresAt;
- sessionRevocations: 0 total / 0 sem expiresAt.

Avaliação:

**SEGURO PARA ATIVAÇÃO CONTROLADA DE TTL**, condicionado à autorização explícita do Fundador.

Efeito esperado após ativação:

- os 5 leases expirados tornam-se elegíveis à exclusão automática;
- nenhuma sessão ativa foi identificada no inventário;
- futuros leases/tombstones passam a ser limpos pelo Firestore com base em `expiresAt`.

A ativação de TTL continua classificada como alteração produtiva e não pode ser executada sem autorização explícita.

## 18. Autorização do Fundador — TTL produtivo

Em 2026-10-04, o Fundador autorizou explicitamente a ativação produtiva de TTL exclusivamente em:

- `sessionSlots.expiresAt`;
- `sessionRevocations.expiresAt`;

no banco principal:

`ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`.

Pré-condições já confirmadas antes da autorização:

- Rules produtivas principal e Warehouse sem drift;
- `sessionSlots`: 5 documentos / 5 expirados / 0 ativos / 0 sem expiresAt;
- `sessionRevocations`: 0 documentos;
- nenhuma outra alteração produtiva autorizada.

Escopo autorizado:

**somente habilitar TTL nos dois campos acima e verificar o estado.**

Não inclui publicação de Rules, deploy de aplicação, IAM, restore ou outras mudanças produtivas.

## 19. Checkpoint — TTL produtivo em criação

Autorização do Fundador executada dentro do escopo aprovado.

Estado produtivo:

- `sessionSlots.expiresAt`: `CREATING`;
- `sessionRevocations.expiresAt`: `CREATING`.

Operações:

- sessionSlots: `AyBjNGNiYzA2Zjk5ZWQtOTU0YS01ZjY0LTQ3OGEtODg4OTM2ZGMkGnNlbmlsZXBpcAkKMxI`;
- sessionRevocations: `AyBiZjE1ZWYwMTMxMjgtMGU3OC03Yjc0LWQxZjUtZWYxNTNjY2EkGnNlbmlsZXBpcAkKMxI`.

Classificação atual:

- SESSION-CAP-01: **PASS TÉCNICO COMPLETO**;
- Rules baseline/drift: **PASS / SEM DRIFT**;
- TTL: **EM IMPLANTAÇÃO**;
- RULES-AUDIT-01: **PENDENTE APENAS DE TTL = ACTIVE**.

Nenhuma nova alteração produtiva deve ser realizada. Próximo passo: somente leitura/polling do estado TTL.

## 20. Fechamento — RULES-AUDIT-01 PASS e PR #248 integrado

Evidência final:

- Rules principal viva: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299` — MATCH baseline R3;
- Rules Warehouse viva: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2` — MATCH baseline R3;
- drift: **NENHUM**;
- TTL `sessionSlots.expiresAt`: **ACTIVE**;
- TTL `sessionRevocations.expiresAt`: **ACTIVE**;
- inventário pré-TTL: 5 leases expirados / 0 ativos / 0 sem expiresAt;
- sessionRevocations pré-TTL: 0;
- ativação TTL: explicitamente autorizada pelo Fundador.

Classificação final:

- **SESSION-CAP-01: PASS TÉCNICO COMPLETO**;
- **RULES-AUDIT-01: PASS — RULES APTAS PARA RC**.

Integração:

- PR #248: **MERGED**;
- método: squash;
- commit: `54aba792cb9e7bb195e21401fb50a21ed50add19`;
- branch alvo: `feat/saas-r1-commercializacao`;
- `main`: inalterado;
- Vercel Production: inalterado;
- Rules candidatas RC: ainda não publicadas.

Próxima barreira:

**composição do RC conjunto SaaS R1 + Mobile R1**.

## 21. Decisão Program Control — PROGRAMAS RECONCILIADOS / RC CANDIDATE

Data: 2026-10-04.

Após auditoria da RC-A e da RC-B, o Coordenador Geral aceita a certificação independente e registra:

**PROGRAMAS RECONCILIADOS**

**EMPROVEX RC CANDIDATE**

Identidade do candidato:

- RC branch: `rc-r1-a-composition`;
- RC_RUNTIME_SHA: `54e60c2264588d8802a67a4cab3d875d64f6bfc1`;
- RC_COMPOSITION_HEAD: `7f449db986da359091c70f6ae27934f0db18a0cb`;
- RC-B HEAD final documental: `851cbfc1c966847d1b5fc53c47e2708a48336f76`;
- SaaS source: `2c1eee759ea8024c296b4c6968ed935b9a59e880`;
- Mobile source: `7b7717b6eebabf911310d2b8ac56ed13c9cb9238`;
- main/produção: `e90f92acae1514ee5cbc6ce95fed354bc1454330` — inalterada.

Hashes:

- Rules principal RC: `bc91185f34bcdcb4437a4de1078d1089a09292ba`;
- Rules Warehouse RC: `6e1f1050005314db4e17cb3136409abbddb0ee91`;
- package-lock: `7c1ecd0dc074b8924c25123955f70e0ba10675dd`;
- next.config.ts: `a67a5f7855409185b72bdb2c392a6523d870b2e8`.

Evidência viva auditada pelo Program Control:

- Application CI #961 no RC_RUNTIME_SHA: SUCCESS;
- Core Protection #248: SUCCESS;
- Legal Validation #63: SUCCESS;
- Recovery guardrails #639: SUCCESS;
- Application CI #962 no RC_COMPOSITION_HEAD: SUCCESS;
- Core Protection #249: SUCCESS;
- Legal Validation #64: SUCCESS;
- Recovery guardrails #640: SUCCESS;
- RC-B PR #250: OPEN / DRAFT / MERGEABLE / não mergeado;
- delta RC-B: exclusivamente dois documentos de certificação.

Classificação aceita:

**PASS COM RISCO EXTERNO CONTROLADO — APTO PARA RC CANDIDATE**

Riscos que permanecem abertos sem invalidar o candidato:

1. Vercel Preview bloqueado por `build-rate-limit`;
2. HARDEN-B temporalmente pendente;
3. MOBILE-J física ainda não executada.

Semáforo:

- candidato técnico: **VERDE**;
- Preview/certificação física: **AMARELO por dependência externa**;
- produção: **NÃO AUTORIZADA**.

Esta decisão não equivale a:

- RC FROZEN;
- GO de produção;
- publicação de Rules;
- Vercel Production;
- MOBILE-J PASS;
- fechamento de HARDEN-B.

Próximo gate global:

**RC FROZEN**.

## 22. Decisão Program Control — RC FROZEN

Data: 2026-10-04.

Após auditoria da RC-F e do PR #251, o Program Control aceita a classificação **FREEZE READY** e declara formalmente:

**EMPROVEX RC FROZEN**

Runtime imutável:
`54e60c2264588d8802a67a4cab3d875d64f6bfc1`

Referências:
- RC composition: `7f449db986da359091c70f6ae27934f0db18a0cb`;
- RC-B final documental: `851cbfc1c966847d1b5fc53c47e2708a48336f76`;
- RC-F final documental: `bef824946715fe96227a9d3c4edf400e7b8f1304`;
- SaaS source: `2c1eee759ea8024c296b4c6968ed935b9a59e880`;
- Mobile source: `7b7717b6eebabf911310d2b8ac56ed13c9cb9238`;
- produção: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`.

Hashes congelados:
- Rules principal: `bc91185f34bcdcb4437a4de1078d1089a09292ba`;
- Rules Warehouse: `6e1f1050005314db4e17cb3136409abbddb0ee91`;
- package-lock: `7c1ecd0dc074b8924c25123955f70e0ba10675dd`;
- next.config.ts: `a67a5f7855409185b72bdb2c392a6523d870b2e8`.

Evidência aceita:
- PR #251: OPEN / DRAFT / MERGEABLE / não mergeado;
- delta RC-F: somente documentação;
- nenhum delta runtime após RC Candidate;
- drift da integradora SaaS: somente documental;
- Application CI #961/#962: SUCCESS;
- Core #248/#249: SUCCESS;
- Legal #63/#64: SUCCESS;
- Recovery #639/#640: SUCCESS;
- CT-01: PASS;
- SESSION-CAP: PASS;
- Mobile A-I: PASS.

Reabertura do freeze somente por blocker real, regressão funcional, falha de segurança, defeito real de certificação, incompatibilidade material ou impedimento de release.

Não justificam reabertura: melhoria visual, refactor, limpeza, feature nova, otimização oportunista ou atualização não essencial.

Pendências posteriores:
- Preview HTTPS bloqueado por Vercel build-rate-limit;
- MOBILE-J física pendente;
- HARDEN-B temporal pendente;
- produção continua não autorizada.

Próximo gate: **Preview HTTPS do RC congelado e certificação física/integrada**.
