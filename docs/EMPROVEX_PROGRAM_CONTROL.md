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

Snapshot em 2026-10-03:

- produção: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330` — Performance R3;
- SaaS funcional: encerrado;
- HARDEN-A1/A2/C/D: PASS;
- HARDEN-B: parcial/temporal;
- Mobile funcional A–I: encerrado;
- MOBILE-J: certificação final;
- nova feature SaaS/Mobile: congelada;
- composição do RC conjunto: liberada;
- RC CANDIDATE: ainda não declarado;
- RC FROZEN: não;
- Preview HTTPS: ainda não publicado;
- produção controlada: não autorizada;
- piloto real: não iniciado;
- lançamento comercial: não autorizado.

A próxima barreira global é:

```text
SESSION-CAP-01 — remover teto fixo de 2 sessões
→ regressão de sessão/Rules/telemetria
→ composição do RC
→ reconciliação transversal
→ CT-01
→ gates
→ freeze
→ Preview HTTPS
→ certificação real
→ GO/NO-GO
```