# SAAS R1 — HARDEN-C — Health, Rules, Release e Rollback

Data da auditoria: 2026-10-03

Branch worker: `saas-harden-c-release-health-rules`

Base congelada: `f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`

Integrador SaaS vivo observado em leitura: `feat/saas-r1-commercializacao@5d272a466daf5ebdfc18ab12efaa30a19b5bdb0c`

`main` observado: `e90f92acae1514ee5cbc6ce95fed354bc1454330`

Esta frente prepara o futuro Release Candidate. Não publica aplicação, Rules, restore, Vercel promotion, piloto ou `main`.

## 1. Baseline e governança pós-freeze

A branch HARDEN-C foi confirmada idêntica à base congelada no início do trabalho: 0 commits à frente, 0 atrás.

A integradora SaaS avançou documentalmente depois do freeze. Esse avanço foi consultado somente em leitura. A worker não recebeu merge, rebase ou cherry-pick da integradora.

A HARDEN-D foi aceita como PASS técnico e deixou um requisito transversal obrigatório para o futuro RC:

`CT-01 — Permissions-Policy: camera=(self), microphone=(), geolocation=()`

Ownership formal de CT-01: integração SaaS / composição do Release Candidate.

## 2. Auditoria do PR #223

PR histórico: `#223 — SAAS-P: publicar endpoint mínimo de health`

Estado observado:

- aberto;
- draft;
- não mergeado;
- mergeable no momento da auditoria;
- base: `main`;
- head: `saas-p-ops-health-endpoint`;
- HEAD: `08ddbc92a602b3a09bb8728d648a0415b6831de6`;
- 4 arquivos alterados;
- escopo: rota health, teste do contrato, script `test:health` e handoff.

Conclusão semântica: **não fazer merge cego do PR #223**.

O conteúdo funcional do PR já está presente na base congelada HARDEN-C. A rota `app/api/health/route.ts` da base possui o mesmo blob SHA do PR #223 (`5c1915f925810c532d1eed9e472deb0e632568af`). O teste `scripts/health-endpoint.test.mjs` e o script `test:health` também já estão presentes.

Portanto:

- reaproveitamento: **SIM**;
- forma: integração semântica anterior já materializada na base;
- merge do PR #223 nesta worker: **NÃO**;
- risco de trazer histórico antigo sobre o estado SaaS novo: evitado.

Evidência histórica do HEAD do PR #223:

- Application CI: SUCCESS;
- EMPROVEX Core Protection: SUCCESS;
- Recovery guardrails: SUCCESS;
- Vercel: FAILURE externa por `build-rate-limit`.

A falha Vercel não foi classificada como regressão funcional porque o contexto era desenvolvimento sem intenção de publicação.

## 3. Health endpoint

Contrato efetivamente presente na base:

- `GET /api/health`;
- HTTP 200;
- JSON com `status: "ok"`;
- `timestamp` gerado no momento da resposta;
- `Cache-Control: no-store, max-age=0`;
- `dynamic = force-dynamic`;
- `revalidate = 0`;
- zero leitura Firestore;
- zero write;
- zero listener;
- zero billing/lifecycle;
- zero autenticação;
- zero workspace/UG;
- zero segredo/env;
- zero versão/commit;
- zero dependência externa operacional.

O teste oficial da rota, executado contra cópia exata dos blobs auditados, fechou em **2/2 PASS**.

Esse teste cobre:

1. export público de `GET`;
2. `status: ok`;
3. timestamp ISO;
4. HTTP 200;
5. `Cache-Control` com `no-store`;
6. ausência de Firestore/Firebase;
7. ausência de `process.env`, secrets e identificadores internos de versão.

Produção continua sem validação real do endpoint até existir publicação autorizada do RC. Portanto, health em produção permanece **PENDENTE DE ENDPOINT PUBLICADO**.

## 4. Firestore Rules — inventário e hashes

O `firebase.json` configura dois bancos:

1. `ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1` → `firestore.rules`;
2. `emprovex-warehouse` → `firestore.warehouse.rules`.

### Banco principal

- `main`: blob `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- HARDEN-C/base: blob `57a1394c921b2ab2c15537fbfc4aaea17515b28a`;
- SaaS integradora viva: mesmo blob `57a1394c...`;
- MOBILE-R1 auditado: mesmo blob `57a1394c...`.

### Warehouse

- `main`: blob `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- HARDEN-C/base: blob `6e1f1050005314db4e17cb3136409abbddb0ee91`;
- SaaS integradora viva: mesmo blob `6e1f1050...`;
- MOBILE-R1 auditado: mesmo blob `6e1f1050...`.

Conclusão: o candidato SaaS usa Rules diferentes de `main`, mas **as Rules candidatas estão reconciliadas entre HARDEN-C, SaaS vivo e Mobile**.

## 5. Classificação das diferenças de Rules

| Área | Diferença versus `main` | Classificação | Motivo |
| --- | --- | --- | --- |
| Billing SaaS | contrato de preço mensal, link de pagamento e contato de suporte | NECESSÁRIA PARA RC | suporte ao contrato comercial SaaS R1 |
| VIP legado | `exemptionSource`, `legacyVipCutoff`, preservação de isenção | NECESSÁRIA PARA RC | preserva coorte VIP já materializada |
| Legal Gate | `legalAcceptances`, versões e aceite por UID/workspace | NECESSÁRIA PARA RC | requisito do aceite legal versionado |
| Warehouse lifecycle/access | `warehouseAccess` e estado ativo por workspace/UG | NECESSÁRIA PARA RC | mantém acesso externo/tenant do warehouse sob lifecycle |
| Rules candidatas SaaS ↔ Mobile | blobs iguais nos dois bancos | JÁ PRESENTE / SEM CONFLITO | reconciliação confirmada |
| Relaxamento de isolamento | nenhum identificado nesta auditoria | NÃO NECESSÁRIA | não reduzir segurança para facilitar release |

Nenhuma diferença foi classificada como `CONFLITO` nesta frente.

Antes do freeze do RC, o Coordenador deve re-resolver os hashes após integrar HARDEN-A/B e qualquer correção transversal. Se qualquer blob mudar, repetir validações afetadas antes da publicação.

## 6. Segurança das Rules

A evidência disponível para os blobs candidatos inclui o PR de integração SAAS-I (`#219`, HEAD `78d3e9afeeb4176a8d6423cdd8e65d32435ba0a9`), que possuía exatamente os mesmos blobs candidatos dos dois arquivos de Rules.

Nesse HEAD foram observados:

- Application CI: SUCCESS;
- EMPROVEX Core Protection: SUCCESS;
- SAAS-DL Legal Validation: SUCCESS;
- Recovery guardrails: SUCCESS;
- Vercel: SUCCESS;
- Browser específico SAAS-C: SKIPPED por escopo.

A matriz HARDEN-D também confirmou ausência de delta material em Auth, Workspace/UG, sessão/lease, Legal Gate, Billing/Lifecycle, `warehouseAccess` e Firestore Rules entre os alvos reconciliados.

Classificação HARDEN-C: **Rules candidatas tecnicamente identificadas e historicamente validadas; publicação NÃO executada**.

## 7. CT-01 — Permissions-Policy

Estado observado:

- `main`: `camera=(), microphone=(), geolocation=()`;
- HARDEN-C/base: `camera=(), microphone=(), geolocation=()`;
- SaaS vivo: `camera=(), microphone=(), geolocation=()`;
- Mobile: `camera=(self), microphone=(), geolocation=()`.

Contrato global obrigatório para o RC:

`camera=(self), microphone=(), geolocation=()`

Decisão desta worker: **NÃO alterar `next.config.ts` aqui**.

Motivo: ownership formal pertence à composição do RC; aplicar o delta numa branch congelada de hardening criaria risco de sobrepor a integradora viva e misturar ownerships. Não existe necessidade técnica de antecipar a mudança para produzir o manifesto.

Registro obrigatório:

**CT-01 DEVE SER APLICADA NA COMPOSIÇÃO DO RC.**

Validação futura não pode se limitar ao arquivo. O smoke do candidato publicado deve inspecionar o header HTTP efetivo e encontrar:

`Permissions-Policy: camera=(self), microphone=(), geolocation=()`

O rollback não pode restaurar cegamente uma configuração com `camera=()`, pois isso quebraria o scanner Mobile.

## 8. Release Manifest

### Identidade do candidato

- branch integradora: `feat/saas-r1-commercializacao`;
- referência viva durante esta auditoria: `5d272a466daf5ebdfc18ab12efaa30a19b5bdb0c`;
- RC final: **AINDA NÃO CONGELADO**;
- authority para freeze: Coordenador SaaS / Coordenador Geral.

### Componentes obrigatórios

- health: `app/api/health/route.ts` presente e auditado;
- teste health: `scripts/health-endpoint.test.mjs` presente e PASS;
- Rules principal candidata: blob `57a1394c921b2ab2c15537fbfc4aaea17515b28a`;
- Rules warehouse candidata: blob `6e1f1050005314db4e17cb3136409abbddb0ee91`;
- CT-01: aplicar na composição do RC;
- `firebase.json`: dois bancos configurados explicitamente;
- recovery contract: PITR + delete protection + backup diário 14 semanas para ambos os bancos;
- uptime: preparar `/api/health`, Cloud Monitoring, alert policy e notification channel;
- Vercel: considerar `build-rate-limit` como limitação externa quando for o único motivo de falha;
- smoke: obrigatório depois da publicação controlada;
- rollback: aplicação + Rules + configuração/header;
- produção: nenhuma autorização implícita.

### Migrations / backfills / scripts

HARDEN-C não introduz migration nem backfill novo.

A governança viva registra que a materialização VIP legado já foi aplicada e verificada. O comando `saas:r1:legacy-vip` não deve ser repetido automaticamente durante o RC.

Qualquer migration/backfill proveniente de outra frente deve ser explicitamente incorporado ao manifesto final pelo Coordenador antes do freeze.

### Dependências externas

- Vercel para deployment/promotion;
- Firebase CLI para publicação de Rules;
- Google Cloud Monitoring para uptime/alerting;
- estado de backup/restore tratado pela HARDEN-B;
- authorization explícita para publicação, Rules e restore.

## 9. Env / Config

Nenhum valor secreto foi lido ou registrado.

A `.env.example` é idêntica entre a base HARDEN-C e a integradora viva.

| Nome | Finalidade | Ambiente | Obrigatória? | Existe no template? | Validada nesta worker? | Impacto se ausente |
| --- | --- | --- | --- | --- | --- | --- |
| `GEMINI_API_KEY` | chamadas Gemini | runtime aplicável | para recursos Gemini | SIM | NÃO | recursos Gemini indisponíveis |
| `APP_URL` | links próprios, callbacks e APIs | runtime | para fluxos que dependem da URL pública | SIM | NÃO | callbacks/links podem falhar |
| `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` | rotas administrativas e leitura Monitoring quando autorizada | server-only | para operações server/admin que a usam | SIM | NÃO | funções administrativas/monitoramento dependentes podem falhar |
| `EMPROVEX_DISABLE_SECTOR_LIFECYCLE` | kill switch de lifecycle | server | NÃO; opcional | SIM | contrato documentado | quando `1`, bloqueia novas suspensões/reativações |
| `EMPROVEX_GCP_MONITORING_CLIENT_EMAIL` | fallback Monitoring | server-only | condicional | SIM | NÃO | sem fallback dedicado se admin credential não cobrir Monitoring |
| `EMPROVEX_GCP_MONITORING_PRIVATE_KEY` | fallback Monitoring | server-only | condicional | SIM | NÃO | idem |
| `EMPROVEX_FIRESTORE_FREE_TIER_ELIGIBLE` | referência administrativa de franquia | server/config | configurável | SIM | template validado | estimativa administrativa pode usar default/ficar incorreta |
| `EMPROVEX_FIRESTORE_DAILY_READ_UNIT_FREE_LIMIT` | limite administrativo de reads | server/config | configurável | SIM | template validado | estimativa pode usar default |
| `EMPROVEX_FIRESTORE_DAILY_REALTIME_READ_UNIT_FREE_LIMIT` | limite administrativo realtime | server/config | configurável | SIM | template validado | estimativa pode usar default |
| `EMPROVEX_FIRESTORE_DAILY_WRITE_UNIT_FREE_LIMIT` | limite administrativo de writes | server/config | configurável | SIM | template validado | estimativa pode usar default |
| `CRON_SECRET` | proteção do cron de consolidação | server/Vercel | para cron produtivo | SIM | NÃO | rota cron não deve operar sem segredo válido |

O endpoint `/api/health` não depende de nenhuma dessas variáveis.

## 10. Rollout preparado

Ordem proposta para a futura janela autorizada:

1. congelar o HEAD final do RC após integração de HARDEN-A/B/C e correções aceitas;
2. confirmar que CT-01 está aplicada exatamente como `camera=(self), microphone=(), geolocation=()`;
3. re-resolver hashes de `firestore.rules`, `firestore.warehouse.rules` e `next.config.ts`;
4. confirmar gates do HEAD final;
5. confirmar recovery readiness da HARDEN-B, inclusive backup/restore status;
6. revisar env/config sem expor valores;
7. capturar a versão/deployment produtivo anterior e os arquivos de Rules efetivamente em vigor para rollback;
8. preparar deployment do RC sem promoção automática não autorizada;
9. publicar/promover somente após GO explícito;
10. aplicar Rules somente se a janela autorizar e somente depois de confirmar os blobs finais;
11. validar domínio/TLS;
12. validar `GET /api/health`;
13. validar header `Permissions-Policy` efetivo;
14. executar smoke de Auth, Legal Gate, workspace/UG, lifecycle/billing e Central;
15. validar scanner/câmera same-origin;
16. validar acesso externo e deny cross-workspace;
17. validar observabilidade;
18. criar/confirmar uptime check, alert policy e notification channel;
19. testar alerta/canal;
20. registrar evidências e somente então decidir continuidade do piloto.

## 11. Publicação de Rules — procedimento preparado

O `firebase.json` associa cada banco ao arquivo correto.

Comando de referência para publicar somente Firestore Rules de todos os bancos configurados, **somente em janela autorizada**:

```bash
firebase deploy --only firestore:rules --project gen-lang-client-0982077967
```

Para um banco configurado específico, a CLI suporta `firestore:<databaseId>`.

Antes de qualquer execução produtiva:

- confirmar versão da CLI;
- confirmar projeto ativo;
- confirmar hashes dos dois arquivos;
- executar testes/emuladores aplicáveis;
- capturar Rules anteriores para rollback;
- exigir autorização explícita.

HARDEN-C **não executou** esse comando.

## 12. Rollback reproduzível

### Aplicação

Antes da publicação do RC, registrar:

- deployment produtivo anterior;
- commit anterior (`main` observado nesta auditoria: `e90f92acae1514ee5cbc6ce95fed354bc1454330`);
- URL/ID do deployment Vercel anterior;
- compatibilidade de config/header com Mobile.

Rollback de aplicação deve promover novamente o deployment anterior ou um build reproduzível do commit aprovado, conforme procedimento Vercel autorizado.

**Restrição:** se o deployment anterior emitir `camera=()`, não usar rollback cego quando o scanner Mobile depender de câmera. Nesse caso, o rollback precisa preservar CT-01 ou usar um candidato de rollback já corrigido.

### Firestore Rules

Antes de publicar Rules novas:

1. capturar e versionar as Rules efetivamente produtivas dos dois bancos;
2. registrar seus hashes e horário;
3. manter cópia imutável para retorno;
4. se rollback for necessário, restaurar os dois arquivos capturados e executar a publicação seletiva de Rules na mesma janela autorizada;
5. reexecutar smoke de Auth/workspace/legal/lifecycle/warehouse após retorno.

O `main` atual serve como referência de código, mas **não substitui a captura do estado produtivo efetivo no momento do deploy**.

### Configuração / Headers

Rollback deve preservar:

`camera=(self), microphone=(), geolocation=()`

Não ampliar microfone, geolocalização ou origens de câmera.

As variáveis de ambiente não devem ser sobrescritas em massa durante rollback. Reverter apenas deltas explicitamente registrados no release manifest.

## 13. Smoke pós-publicação

Checklist obrigatório e reproduzível:

- [ ] domínio responde;
- [ ] TLS/SSL válido;
- [ ] `GET /api/health` responde 200;
- [ ] JSON contém `status: ok`;
- [ ] timestamp é válido;
- [ ] `Cache-Control` contém `no-store`;
- [ ] header efetivo contém `Permissions-Policy: camera=(self), microphone=(), geolocation=()`;
- [ ] login/Auth;
- [ ] Legal Gate;
- [ ] workspace;
- [ ] UG;
- [ ] lifecycle;
- [ ] billing gate;
- [ ] dashboard;
- [ ] Central de Depósitos;
- [ ] scanner;
- [ ] câmera same-origin;
- [ ] microfone bloqueado;
- [ ] geolocalização bloqueada;
- [ ] console sem erro crítico;
- [ ] Rules principal;
- [ ] Rules warehouse;
- [ ] acesso externo autorizado;
- [ ] isolamento cross-workspace negado;
- [ ] nenhuma regressão Mobile observada.

Método de conferência do header futuro:

```bash
curl -I https://emprovex.com.br/
```

ou inspeção equivalente do response header no DevTools/HTTP client. Não marcar essa etapa como PASS antes de existir candidato publicado.

## 14. Uptime / Alerting

Runbook existente: `docs/SAAS_R1_UPTIME_MONITORING.md`.

Estado HARDEN-C:

- health no código: PASS técnico;
- endpoint produtivo: PENDENTE DE ENDPOINT PUBLICADO;
- uptime check `EMPROVEX HTTPS`: PREPARADO;
- alert policy: PREPARADO;
- notification channel: PREPARADO;
- teste real de alerta: PENDENTE DE ENDPOINT PUBLICADO / AUTORIZAÇÃO.

O uptime deve apontar para `https://emprovex.com.br/api/health`, usar HTTPS com validação SSL e checar 2xx + conteúdo `"status":"ok"`.

Nenhum uptime, alerta ou canal foi criado por esta worker.

## 15. Recovery readiness

Contrato de recovery da base:

- dois bancos;
- PITR requerido;
- delete protection requerida;
- backup diário;
- retenção 14 semanas;
- RPO 24 h;
- RTO 4 h;
- restore alvo: database novo e isolado.

A evidência operacional mais recente disponível na governança da base ainda tratava backup READY/restore isolado como dependência externa. A certificação final de recovery pertence à HARDEN-B e deve ser importada pelo Coordenador antes do freeze do RC.

HARDEN-C não executou restore.

## 16. Gates

### Executado nesta worker

`node --test scripts/health-endpoint.test.mjs` contra cópia exata dos blobs auditados:

- 2 testes;
- 2 PASS;
- 0 FAIL.

### Evidência herdada — PR #223 / health

- Application CI: SUCCESS;
- EMPROVEX Core Protection: SUCCESS;
- Recovery guardrails: SUCCESS;
- Vercel: falha externa `build-rate-limit`.

### Evidência herdada — PR #219 / Rules SaaS candidatas

- Application CI: SUCCESS;
- EMPROVEX Core Protection: SUCCESS;
- Recovery guardrails: SUCCESS;
- SAAS-DL Legal Validation: SUCCESS;
- Vercel: SUCCESS;
- Rules blobs: exatamente iguais aos blobs candidatos atuais.

### Alteração desta worker

A alteração HARDEN-C é documental em `docs/**`. O Application CI possui `paths-ignore: docs/**`; portanto não é correto inventar um novo PASS de build/typecheck para este commit documental.

No freeze final do RC, o Coordenador deve exigir novamente, sobre o HEAD composto:

- Application CI;
- Production Build;
- TypeScript final;
- `git diff --check`;
- Core Protection;
- Recovery guardrails;
- Legal Validation;
- Rules/security suites afetadas;
- testes Mobile/CT-01 afetados.

## 17. Impacto MOBILE-R1

Classificação: **DELTA COMPATÍVEL / CORREÇÃO NECESSÁRIA**.

Único delta transversal material confirmado nesta frente:

`CT-01 — Permissions-Policy`

Contrato a preservar:

`camera=(self), microphone=(), geolocation=()`

As Rules candidatas dos dois bancos são iguais entre SaaS e Mobile no alvo reconciliado. Nenhum outro conflito funcional material foi identificado por esta worker.

## 18. Conflitos transversais

- CT-01: conhecido, ownership da composição do RC, não aplicado nesta branch;
- Rules: sem conflito SaaS↔Mobile nos blobs auditados;
- recovery: depende do handoff HARDEN-B;
- segurança/dependências: depende do handoff HARDEN-A;
- qualquer novo delta após estes handoffs deve retornar ao Coordenador.

## 19. O que NÃO foi executado

- nenhum merge em `main`;
- nenhum merge/rebase da integradora nesta worker;
- nenhum deploy produtivo;
- nenhuma Vercel promotion;
- nenhuma publicação de Firestore Rules;
- nenhum restore;
- nenhuma alteração em usuário real;
- nenhum piloto;
- nenhum freeze de RC;
- nenhuma criação de uptime/alert/channel;
- nenhuma alteração de secret/env;
- nenhuma aplicação de CT-01 nesta branch.

## 20. Riscos restantes

1. RC final ainda não está congelado;
2. CT-01 ainda precisa ser aplicada na composição;
3. header HTTP efetivo só pode ser validado após publicação autorizada;
4. Rules finais precisam ser re-hashadas depois de integrar HARDEN-A/B e demais deltas aceitos;
5. estado produtivo efetivo das Rules deve ser capturado imediatamente antes de qualquer publicação;
6. recovery final depende da HARDEN-B;
7. uptime/alert/channel dependem de endpoint publicado e autorização;
8. Vercel possui histórico de `build-rate-limit`;
9. rollback não pode reintroduzir `camera=()`.

## 21. Conclusão HARDEN-C

Status técnico da worker: **PASS PARA HANDOFF / NÃO É GO DE PRODUÇÃO**.

Critérios atendidos no escopo:

- PR #223 auditado semanticamente;
- health já integrado e teste oficial PASS;
- Rules candidatas identificadas e reconciliadas com SaaS/Mobile;
- diferenças versus `main` classificadas;
- Release Manifest explícito;
- rollout reproduzível preparado;
- rollback preparado para aplicação, Rules e headers;
- smoke preparado;
- CT-01 explicitamente tratada sem violar ownership;
- env/config inventariados sem secrets;
- dependências externas e limitações documentadas.

Esse PASS não significa RC frozen, release aprovado, produção autorizada ou piloto liberado.

## 22. Recomendação ao Coordenador SaaS

Integrar semanticamente este handoff; não mergear o PR #223; após receber HARDEN-A e HARDEN-B, compor o RC em uma única revisão, aplicar CT-01 nessa composição, re-hashar Rules/config e repetir os gates do HEAD final antes de qualquer autorização de publicação.

## 23. Recomendação ao Coordenador Geral

Manter a barreira de produção até que:

1. HARDEN-A/B/C estejam aceitas;
2. CT-01 esteja materializada no RC;
3. recovery tenha evidência suficiente;
4. gates do HEAD final estejam verdes;
5. rollback e estado produtivo anterior estejam capturados;
6. exista GO explícito para a janela controlada.