# EMPROVEX SaaS R1 — Hardening Pré-Piloto e Release Candidate

Data: **2026-10-02**

Branch coordenadora: `feat/saas-r1-commercializacao`

Estado: **FASE ATUAL / PILOTO REAL ADIADO ATÉ RELEASE CANDIDATE CONGELADO**

## 1. Decisão de sequência

O piloto real não será usado como continuação do desenvolvimento básico.

Sequência oficial revisada:

```text
DESENVOLVIMENTO/INTEGRAÇÃO CONCLUÍDOS
            ↓
HARDENING PRÉ-PILOTO
            ↓
RECONCILIAÇÃO SAAS ↔ MOBILE
            ↓
RECOVERY/RESTORE + SEGURANÇA + DEPENDÊNCIAS
            ↓
RELEASE CANDIDATE CONGELADO
            ↓
PUBLICAÇÃO CONTROLADA DO RC / SMOKE TÉCNICO
            ↓
PILOTO REAL FINAL
            ↓
CORREÇÕES FINAIS PÓS-PILOTO
            ↓
SAAS-J — CERTIFICAÇÃO FINAL
            ↓
AUTORIZAÇÃO EXPLÍCITA
            ↓
LANÇAMENTO COMPLETO / ABERTURA COMERCIAL
```

O piloto é a última prova operacional ampla antes da validação/correção final e do lançamento.

## 2. Baseline pré-release já capturado

T0 atual permanece válido como baseline da produção Performance R3:
- T0 técnico: PASS;
- T0 global: capturado;
- T0 por UG: capturado;
- T0 monetário: capturado;
- custo Google Cloud no snapshot: R$ 0,16;
- previsão mensal exibida no snapshot: R$ 2,30.

Não repetir T0 apenas porque o piloto foi reordenado.

## 3. O que precisa terminar antes do piloto

### 3.1 Código e integração
- consolidar todo código SaaS R1 na integradora;
- não deixar feature conhecida deliberadamente pendente para “ver no piloto”;
- integrar o contrato de health ao candidato quando aprovado;
- preservar billing, onboarding, legal, lifecycle, sessão, Rules e Central já certificados;
- nenhuma expansão funcional nova após o freeze do RC, exceto correção bloqueante.

### 3.2 Segurança e dependências
- revisar os advisories reportados pelo `npm ci`;
- classificar exposição real por dependência/ambiente;
- corrigir somente com alteração controlada e testes;
- proibir `npm audit fix --force` sem análise;
- repetir CI/build/Core Protection/Recovery/Legal e guards aplicáveis após qualquer correção.

### 3.3 Recovery
Antes do piloto real:
- confirmar backup READY nos dois bancos;
- executar `recovery:verify`;
- selecionar backup real;
- executar restore em database novo e isolado somente com autorização explícita;
- validar amostras;
- conferir IAM/Rules/TTL do target;
- documentar a prova.

### 3.4 Health, uptime e release
Antes de iniciar participantes no candidato publicado:
- integrar/publicar `/api/health` na janela controlada;
- smoke HTTP/SSL;
- configurar uptime;
- configurar alert policy;
- associar notification channel;
- testar a notificação.

A publicação necessária ao piloto não equivale à abertura comercial ampla.

### 3.5 Rules e rollout
- montar pacote exato de aplicação + Rules;
- validar em CI/emulador;
- documentar ordem de publicação;
- documentar rollback;
- não publicar Rules isoladas fora da janela aprovada quando dependam do código novo.

### 3.6 Reconciliação MOBILE-R1
Antes do freeze:
- consultar a integradora Mobile viva;
- comparar Auth, workspace/UG, sessão/lease, legal gate, lifecycle, Rules, shell, `warehouseAccess`, contratos da Central e schema;
- resolver conflitos semanticamente;
- não usar merge/rebase cego entre integradoras;
- registrar Impacto MOBILE-R1.

## 4. Release Candidate

O RC só pode ser congelado quando:
- build/typecheck verdes;
- Application CI e guards aplicáveis verdes;
- segurança/dependências triadas;
- recovery real comprovado;
- regras e rollout definidos;
- Mobile reconciliada;
- incidentes técnicos pré-piloto resolvidos;
- nenhum blocker conhecido de severidade alta/crítica sem decisão explícita.

Congelar:
- commit exato;
- matriz de versões;
- Rules correspondentes;
- configuração necessária;
- rollback target;
- evidência dos gates.

## 5. Publicação controlada antes do piloto

Escolher uma única estratégia:
- preview/staging compatível, se Vercel/Auth/Rules permitirem; ou
- publicação controlada do RC no ambiente produtivo existente, sem abertura comercial ampla.

A decisão deve considerar:
- disponibilidade de builds Vercel;
- domínio/Auth;
- compatibilidade de Rules;
- risco para P-01/P-02;
- rollback.

Nenhuma publicação ocorre sem autorização explícita do fundador.

Depois do deploy:
- smoke técnico;
- health;
- login controlado;
- Central;
- Rules;
- sem iniciar ainda a coleta de evidência do piloto até o ambiente ser declarado estável.

## 6. Piloto real final — SAAS-P

Somente depois do RC estável.

Participantes:
- P-01 `aprovisionamento-3-gac-ap`: observacional, não disruptivo;
- P-02 `aprovisionamento-2-b-fv`: observacional, não disruptivo;
- `aprovisionamento-teste`: cenários disruptivos J15–J20;
- P-03: novo não-VIP real para onboarding/trial/pagamento.

Durante o piloto:
- evitar desenvolver features;
- registrar evidência e incidentes;
- corrigir imediatamente apenas falha de segurança, perda de dados ou indisponibilidade crítica;
- demais ajustes entram na etapa pós-piloto.

Coletar T1/T2 a partir do T0 já registrado.

## 7. Pós-piloto

Depois de encerrar a janela de piloto:
1. congelar lista de achados;
2. classificar defeitos, UX, segurança, custo e operação;
3. abrir branches curtas de correção;
4. integrar semanticamente;
5. repetir gates afetados;
6. repetir somente jornadas impactadas;
7. não reabrir escopo funcional amplo.

## 8. SAAS-J — certificação final

SAAS-J ocorre **depois** das correções do piloto.

Deve certificar o candidato final, incluindo:
- matriz J01–J24;
- CI/build/typecheck;
- segurança/dependências;
- Rules;
- recovery/restore;
- health/uptime/alertas;
- T0/T1/T2/custo;
- regressão funcional;
- isolamento multi-tenant;
- reconciliação final MOBILE-R1;
- pendências conhecidas classificadas.

SAAS-J não é piloto. É certificação do release final corrigido.

## 9. Lançamento completo

Somente após SAAS-J:
- decisão explícita GO/NO-GO do fundador;
- merge/release final;
- publicação necessária;
- smoke pós-release;
- observação de erros/custos;
- abertura comercial.

## 10. Desenvolvimento paralelo coordenado nesta fase

Máximo recomendado: **1 Coordenador + 4 workers**.

| Frente | Escopo | Pode rodar em paralelo? |
|---|---|---|
| HARDEN-A | segurança, dependências, CI, regressão | sim |
| HARDEN-B | backup READY, recovery:verify, restore isolado | sim, respeitando autorizações |
| HARDEN-C | health, Rules, pacote de release, Vercel/rollback | sim |
| HARDEN-D | reconciliação SaaS↔Mobile, matriz/evidências | sim |
| Coordenador | integração, conflitos, Memorial, freeze do RC | sempre |

Workers:
- branch exclusiva;
- base congelada;
- sem merge/rebase cruzado;
- handoff obrigatório;
- sem main/deploy/Rules/restore real sem autorização;
- qualquer conflito transversal retorna ao Coordenador.

## 11. Estado atual

- produção: Performance R3;
- SaaS R1: somente na integradora;
- T0 pré-release: completo;
- piloto real: **ADIADO**;
- fase ativa: **HARDENING PRÉ-PILOTO**;
- SAAS-J: aguardando piloto + correções finais;
- lançamento: não autorizado.

## 12. Plano de execução paralelo detalhado

Documento operacional complementar:

`docs/SAAS_R1_HARDENING_EXECUCAO_PARALELA.md`

Branches planejadas:
- `saas-harden-a-security-dependencies`;
- `saas-harden-b-recovery-restore`;
- `saas-harden-c-release-health-rules`;
- `saas-harden-d-mobile-reconciliation`.

As quatro branches devem nascer do mesmo HEAD congelado da integradora. A criação das branches é preparação da onda e não equivale à ativação dos chats.

O Memorial Oficial contém a versão normativa expandida do escopo, ownership, gates, critérios de status, handoff e integração.

## Checkpoint — HARDEN-D concluída

HARDEN-D: **PASS TÉCNICO**

Reconciliação contra:
- SaaS auditado: `1216f8cf97edec55fd94c98e39f156a6f76cb056`;
- Mobile estável: `7b745fa0b7979e643b83b7de94dd96a0290930ab`.

Resultado:
- nenhum conflito funcional material;
- contratos compartilhados principais preservados;
- deltas Mobile classificados como compatíveis;
- uma correção transversal obrigatória antes do RC.

### CT-01

Aplicar no candidato global:
`Permissions-Policy: camera=(self), microphone=(), geolocation=()`

Não ampliar microfone nem geolocalização.

Validar no header HTTP efetivo do candidato publicado.

A conclusão da HARDEN-D não congela o RC e não substitui HARDEN-A/B/C.

## Checkpoint — HARDEN-C concluída

HARDEN-C: **PASS TÉCNICO**

Resultado:
- health auditado e presente no candidato;
- PR #223 não deve ser mergeado cegamente;
- Rules principal/warehouse classificadas e reconciliadas;
- Release Manifest completo;
- rollout e rollback preparados;
- smoke preparado;
- env/config inventariado sem expor secrets;
- uptime/alerting preparados para ativação futura;
- CT-01 registrada como correção obrigatória de composição do RC.

Integração documental semântica:
`e0e4e13a73aad18850a3bf5b70b64ebf22a3d11b`

Pendências antes do RC:
- HARDEN-A;
- HARDEN-B;
- materialização CT-01;
- gates do HEAD composto;
- confirmação de recovery readiness;
- GO explícito para qualquer publicação.

PASS HARDEN-C não congela o RC.

## Checkpoint — HARDEN-A parcial

HARDEN-A: **PARCIAL**

Concluído:
- baseline 22 confirmado;
- correção segura de lockfile aplicada;
- estado reduzido para 14 advisories;
- Application CI/Core Protection/Build/TypeScript/Diff Hygiene verdes;
- lockfile seguro incorporado à integradora.

Pendências antes de PASS:
- correção controlada de jsPDF/jsPDF-AutoTable;
- decisão suportada para Firebase/Firestore/gRPC;
- novo `npm audit`;
- regressão específica de PDFs;
- repetição dos gates.

Commits de integração:
- `040ec20c66a7d9c8e77070d12dd455fe43aef5d7`;
- `66dc540b7d50a451e96cd16558a9219743543cd7`.

Não usar `npm audit fix --force` e não executar downgrade oportunista do Firebase.

## HARDEN-A1 — jsPDF security fix

Autorizada pelo Program Control após HARDEN-A parcial.

Base viva congelada:
`9a294bc543ec7150b9144ed96e767a161864d72f`

Branch:
`saas-harden-a-jspdf-security`

Target:
- `jspdf@4.2.1`;
- `jspdf-autotable@5.0.8`.

PASS esperado:
- CRITICAL jsPDF eliminado;
- PDFs existentes funcionalmente preservados;
- audit atualizado;
- build/TypeScript/CI/Core/Diff verdes;
- regressão específica dos fluxos PDF documentada;
- nenhuma alteração Firebase na mesma frente.

HARDEN-A2 permanece bloqueada até esse gate fechar.

## HARDEN-A1 — encerrada

Status: **PASS TÉCNICO**

- jsPDF seguro: PASS;
- AutoTable compatível: PASS;
- CRITICAL: eliminado;
- regressão técnica PDF: PASS;
- gates: verdes;
- validação visual fina: reclassificada como backlog não bloqueante.

HARDEN-A2 deixa de estar bloqueada pela A1.

## HARDEN-A2 — encerrada

Status: **PASS — RISCO RESIDUAL ACEITO TECNICAMENTE**

- dependências: sem alteração;
- runtime: sem alteração;
- Rules: sem alteração;
- Mobile: SEM DELTA;
- risco residual gRPC: documentado e aceito tecnicamente;
- produção: não alterada.

Não criar nova frente Firebase/gRPC sem nova evidência técnica.
