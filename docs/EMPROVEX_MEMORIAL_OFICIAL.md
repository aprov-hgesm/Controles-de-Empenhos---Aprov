# EMPROVEX — Memorial Oficial

Última sincronização global: **2026-10-03**

Produção vigente: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

Integradora SaaS R1: `feat/saas-r1-commercializacao@eca80c796e8d2916cafd6aa4d7419c8b27b931d5`

Integradora Mobile R1: `feat/central-mobile-r1@3f3b53f7a286a1eb9bc9c254a4350ca7595153a4`

Estado global: **Performance R3 permanece em produção; desenvolvimento funcional SaaS R1/Mobile R1 praticamente encerrado; HARDEN-A2 aguarda aceite formal do risco residual; HARDEN-B permanece parcial; MOBILE-J está em certificação final; RC conjunto SaaS+Mobile ainda não congelado; nenhuma publicação controlada foi autorizada ainda.**

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

| Domínio | Estado vigente | Observação |
| --- | --- | --- |
| Produção | **Performance R3 publicada** | `main@e90f92acae1514ee5cbc6ce95fed354bc1454330` |
| SaaS R1 | **HARDENING FINAL** | A1 PASS; A2 recomendada PASS com risco residual; B parcial; C/D PASS |
| Mobile R1 | **DESENVOLVIMENTO FUNCIONAL ENCERRADO / MOBILE-J EM CERTIFICAÇÃO** | PR #246 documental; testes físicos/ambiente publicado ainda pendentes |
| Release Candidate | **NÃO CONGELADO** | depende de aceite A2 + composição/reconciliação SaaS↔Mobile + CT-01 + gates exatos do RC |
| Piloto real SaaS | **NÃO INICIADO** | só após RC controlado |
| SAAS-J | **AGUARDANDO** | pós-piloto e correções finais |
| MOBILE-I | **BLOQUEADA** | aguarda Integração 3 + checkpoint transversal |
| MOBILE-J | **BLOQUEADA** | certificação final posterior |
| Produção alterada pelas ondas atuais | **NÃO** | nenhum merge/deploy produtivo autorizado |

## 2. Próxima barreira global

O próximo ponto de sincronização do EMPROVEX ocorrerá quando existirem simultaneamente:

- HARDEN-A concluída e auditada;
- HARDEN-B fechada com backup READY, `recovery:verify` e restore isolado validado;
- HARDEN-C e HARDEN-D permanecendo PASS;
- Integração 3 Mobile certificada;
- checkpoint transversal pós-MOBILE-F/G/H;
- CT-01 materializada no candidato;
- gates combinados finais executados.

Somente depois o Program Control poderá avaliar:

**EMPROVEX RC CANDIDATE → RC FROZEN**

O freeze do RC não constitui autorização automática de produção.

---

# PARTE II — GOVERNANÇA GLOBAL

## 3. Hierarquia oficial

```text
FUNDADOR
   │
COORDENADOR GERAL / PROGRAM CONTROL
   │
   ├── COORDENADOR SAAS-R1
   │      └── workers SAAS / HARDEN
   │
   └── COORDENADOR MOBILE-R1
          └── workers MOBILE
```

### Fundador

Permanece autoridade humana para ações protegidas, especialmente:

- merge/release final quando protegido;
- promoção/deploy produtivo;
- publicação de Firestore Rules produtivas;
- restore real quando exigir autorização;
- ações disruptivas sobre usuários/workspaces reais;
- GO/NO-GO de RC/release;
- mudanças fundamentais de contrato comercial.

### Coordenador Geral / Program Control

Responsável por:

- estado global;
- WIP entre programas;
- contratos transversais;
- barreiras de sincronização;
- reconciliação SaaS ↔ Mobile;
- composição/freeze de RC;
- consistência do Memorial;
- classificação de riscos globais.

Não atua como worker de rotina.

### Coordenadores de Programa

Mantêm:

- integradora do programa;
- Integration Status;
- Handoff;
- revisão de workers;
- integração semântica;
- gates do programa;
- escalonamento de conflitos transversais.

### Workers

Executam somente o escopo de sua frente.

Não devem:

- absorver outro domínio;
- resolver conflito transversal silenciosamente;
- rebasear/mover base congelada sem ordem;
- publicar produção;
- modificar contrato global fora do escopo.

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

## 9. Contratos de identidade e multi-tenant

Contratos globais que não podem ser bifurcados:

- Firebase Auth como identidade autenticada;
- workspace como unidade de isolamento;
- UG vinculada ao contexto operacional;
- UID/e-mail coerentes com conta;
- sessão/lease/heartbeat compartilhados;
- regras de acesso multi-tenant;
- `warehouseAccess` como autorização da Central;
- Legal Gate versionado;
- lifecycle e billing separados semanticamente.

A Mobile não possui autenticação, sessão, lifecycle ou legal gate paralelos.

---

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

Transformar o EMPROVEX já operacional em serviço comercial controlado, preservando:

- multi-tenant;
- segurança;
- continuidade de usuários existentes;
- recuperação;
- legal;
- billing simples;
- capacidade de piloto antes da abertura ampla.

## 17. Contratos comerciais congelados

Plano R1:

- **Plano Completo — R$ 70/mês**;
- acesso funcional completo;
- trial de 30 dias;
- vencimento no 5º dia útil;
- tolerância de 10 dias;
- cobrança externa simples;
- confirmação administrativa;
- suspensão manual;
- sem delete por inadimplência;
- founder = `exempt`;
- VIP externo = `exempt`;
- sem signup público;
- sem webhook/API de pagamento na R1;
- sem tiers;
- 1 workspace ↔ 1 UG ↔ 1 conta externa primária.

## 18. VIP legado

Decisão oficial de 2026-10-02:

todos os workspaces externos existentes no corte definido foram tratados como **VIP legado**.

Contrato:

- `billingAccounts.status = exempt`;
- preço efetivo R$ 0;
- Plano Completo;
- sem trial obrigatório;
- sem inadimplência financeira;
- sem suspensão por falta de pagamento;
- segurança/lifecycle normais continuam válidos.

Coorte materializada e verificada historicamente:

- `aprovisionamento-2-b-fv`;
- `aprovisionamento-3-gac-ap`;
- `aprovisionamento-teste`.

O histórico detalhado da migração permanece no arquivo histórico integral.

## 19. Ordem oficial da reta final SaaS

Sequência vigente:

```text
integração funcional SaaS
→ hardening pré-piloto
→ reconciliação SaaS ↔ Mobile
→ recovery / restore / segurança / release
→ composição do candidato
→ RC FROZEN
→ publicação controlada
→ piloto real
→ correções pós-piloto
→ SAAS-J
→ autorização explícita
→ abertura ampla
```

O piloto real foi deliberadamente movido para depois do RC.

## 20. HARDEN — estado vivo

Base comum das workers:

`f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`

| Frente | Estado | Evidência/pendência |
| --- | --- | --- |
| HARDEN-A — Segurança/Dependências/CI | **PARCIAL TECNICAMENTE SAUDÁVEL** | `00d6386d...`; PR #240; 22 → 14 vulnerabilidades; bloqueada por jsPDF crítico + decisão Firebase/Firestore/gRPC |
| HARDEN-B — Recovery/Restore | **PARCIAL** | `910cca1e...`; aguarda backups READY + restore isolado |
| HARDEN-C — Health/Rules/Release/Rollback | **PASS / ENCERRADA** | worker `0b2e801a...`; PR #238 fechado sem merge; integração documental `e0e4e13a...` |
| HARDEN-D — Reconciliação SaaS↔Mobile | **PASS / ENCERRADA** | worker `fb7b5006...`; PR #236 fechado sem merge; integração documental `22459625...` |


### 20.1 HARDEN-A — checkpoint parcial de segurança

### HARDEN-A — CHECKPOINT PARCIAL DE SEGURANÇA

A HARDEN-A foi auditada pelo Coordenador SaaS como **PARCIAL TECNICAMENTE SAUDÁVEL**.

Identidade:
- branch: `saas-harden-a-security-dependencies`;
- base: `f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`;
- HEAD final: `00d6386d212d6c139eec243d00b61c11a13017b8`;
- PR: `#240`.

Resultado:
- vulnerabilidades de pacote: **22 → 14**;
- nenhuma alteração em `package.json`;
- nenhuma major aplicada;
- nenhum `npm audit fix --force`;
- lockfile seguro integrado semanticamente no commit `040ec20c66a7d9c8e77070d12dd455fe43aef5d7`;
- evidência integrada em `66dc540b7d50a451e96cd16558a9219743543cd7`;
- CI/build/typecheck/core/diff verdes;
- nenhuma regressão detectada.

Pendência material:
- `jspdf@2.5.2` permanece CRITICAL e direto/runtime;
- upgrade conjunto jsPDF/jsPDF-AutoTable deve ocorrer em correção controlada com regressão específica dos PDFs;
- Firebase/Firestore/gRPC requer decisão coordenada, sem aceitar downgrade/force sugerido pelo audit.

Impacto MOBILE-R1: **DELTA COMPATÍVEL** por lockfile compartilhado.

HARDEN-A não está em PASS e continua bloqueando o freeze do RC até fechamento das pendências acima.

## 21. HARDEN-B — recovery

Estado confirmado:

- PITR ativo nos dois bancos;
- delete protection ativa;
- schedule diário ativo;
- retenção de 14 semanas;
- tooling `recovery:status` e `recovery:verify` disponível;
- ainda falta backup nativo READY de ambos os bancos;
- restore real isolado ainda não concluído.

O restore real deve:

1. usar banco novo/isolado;
2. partir de backup READY;
3. ter plano de restauração;
4. ser autorizado explicitamente pelo fundador quando chegar o momento;
5. validar dados, IAM, Rules, TTL e isolamento.

## 22. Health / Rules / release

HARDEN-C confirmou:

- health preparado;
- pacote de release/rollback auditado;
- Rules SaaS ↔ Mobile sem conflito material no escopo auditado;
- nenhum deploy produtivo autorizado por esse PASS.

## 23. CT-01 — contrato transversal obrigatório do RC

Divergência detectada entre SaaS e Mobile:

SaaS anterior:

`camera=(), microphone=(), geolocation=()`

Mobile:

`camera=(self), microphone=(), geolocation=()`

Contrato global definido para o futuro RC:

`camera=(self), microphone=(), geolocation=()`

Razão:

- scanner Mobile necessita de câmera same-origin;
- microfone não é necessário;
- geolocalização não é necessária;
- `getUserMedia` continua sujeito a contexto seguro e permissão do navegador.

Ownership:

**integração SaaS / composição do Release Candidate.**

Antes do freeze do RC:

- materializar CT-01;
- repetir gates afetados;
- validar o header HTTP efetivo do candidato publicado.

---

# PARTE VII — MOBILE R1

## 24. Objetivo

A Central Móvel R1 leva as operações físicas da Central de Depósitos para uso em celular sem criar uma segunda verdade logística.

Princípios:

- web mobile;
- online-first;
- mesma identidade/workspace/UG;
- scanner compartilhado;
- leitura física por EPX1;
- operações canônicas do backend;
- fallback manual;
- sem banco Mobile paralelo.

## 25. Ondas concluídas

### Onda 1

MOBILE-A — Plataforma/Scanner:

**integrada**, com pendências físicas finais de dispositivo/runtime.

MOBILE-B — Etiquetas/Resolver:

**integrada**.

Integração 1 certificou:

```text
scanner
→ EPX1
→ resolver
→ WarehouseStockPosition
```

### Onda 2

MOBILE-C — Alocação:

**integrada semanticamente**.

MOBILE-D — Transferência:

**corrigida e integrada semanticamente**.

MOBILE-E — Consulta Física:

**integrada**.

Integração 2 certificou jornada:

```text
alocar
→ consultar posição A
→ transferir A → B
→ consultar A/B
→ preservar total físico
```

Último estado operacional certificado da Integração 2:

`d8148f01b877adad1e7880fc0b7fc6d4b3d60249`

## 26. Reconciliação SaaS ↔ Mobile

HARDEN-D concluiu que, para C/D/E:

- Auth — sem delta;
- workspace/UG — sem delta;
- sessão/lease/heartbeat — sem delta;
- Legal Gate — sem delta;
- billing/lifecycle — sem delta;
- `warehouseAccess` — sem delta;
- Firestore Rules — sem delta;
- schema/source of truth — compatíveis;
- shell/guards — compatíveis;
- APIs compartilhadas — compatíveis;
- telemetria — compatível;
- Permissions-Policy — compatível com CT-01.

Resultado:

**PASS técnico, sem conflito funcional material.**

## 27. Onda 3 — estado vivo

Freeze comum:

`c971d5356c343a0819bf96ec016de73dd96a435d`

Esse freeze já contém a Integração 2 certificada. As branches não devem ser movidas para “acompanhar” documentação posterior.

Estado atual:

| Frente | Escopo | Estado |
| --- | --- | --- |
| MOBILE-F | Inventário móvel | **VERDE / INTEGRADA / CERTIFICADA** — PR #239 fechado sem merge direto |
| MOBILE-G | Saída de material móvel | **VERDE / INTEGRADA / CERTIFICADA** — PR #242 fechado sem merge direto |
| MOBILE-H | Conferência física/digital | **VERDE / INTEGRADA / CERTIFICADA** — PR #241 fechado sem merge direto |
| Integração 3 | combinação F/G/H | **VERDE / CERTIFICADA** — PR #243 / squash `f11b7bf2...` |
| MOBILE-I | integração controlada | **PASS / APROVADA / INTEGRADA** |
| MOBILE-J | certificação final | **PRÉ-CERTIFICAÇÃO LIBERADA / PASS FINAL BLOQUEADO** |

A ordem de integração F/G/H deve ser definida por dependência e sobreposição reais, não por ordem cronológica de conclusão.

### 27.1 Checkpoint pós-Integração 3 — 2026-10-03

Estado operacional certificado:

`f11b7bf29f8b3fe9525ff80880f4e0f87cd1c67e`

HEAD documental Mobile:

`816c1c07cf251ce3705098a3a65b9d84e2fc8614`

Resultado:

- MOBILE-F/G/H integradas semanticamente;
- Application CI #940 — SUCCESS;
- Core Protection #227 — SUCCESS;
- Recovery #618 — SUCCESS;
- Legal Validation #42 — SUCCESS;
- Production Build — SUCCESS;
- TypeScript — SUCCESS;
- Diff Hygiene — SUCCESS;
- segurança multi-tenant — SUCCESS;
- nenhum novo schema;
- nenhuma nova API SaaS compartilhada;
- nenhum novo delta funcional SaaS↔Mobile;
- CT-01 permanece preexistente e pendente para o futuro RC;
- package/Application CI contém tooling Mobile aditivo e compatível.

Decisão do Program Control:

**INTEGRAÇÃO 3 ACEITA / MOBILE-I LIBERADA.**

MOBILE-I deve ser criada a partir do HEAD Mobile vivo congelado pelo Coordenador Mobile e atuar somente como integração controlada, UX/regressão e reconciliação final da experiência Mobile. MOBILE-J continua bloqueada.

### 27.2 Checkpoint pós-MOBILE-I — 2026-10-03

Integradora Mobile:

`feat/central-mobile-r1@2108a21208765e0d4155399667cf571b0fa127ff`

Worker MOBILE-I certificado:

`mobile-r1-i-integration@ea5ad10054e2aea608e270a970fde723cde41d93`

PR #245:

**MERGED**

Squash:

`3a5689e0e613adfb7dbf48ef8d44085ec6c951b3`

Resultado:

- MOBILE-I — PASS / APROVADA / INTEGRADA;
- Application CI #945 — SUCCESS;
- Core Protection #232 — SUCCESS;
- Recovery #623 — SUCCESS;
- Legal #47 — SUCCESS;
- Production Build — SUCCESS;
- TypeScript — SUCCESS;
- Diff Hygiene — SUCCESS;
- multi-tenant e segurança externa — SUCCESS;
- Integrações 1–3 e F/G/H — SUCCESS;
- novo delta funcional SaaS↔Mobile — NENHUM;
- performance da Integração 3 preservada;
- CT-01 não alterada;
- produção não alterada.

Decisão do Program Control:

**MOBILE-J está liberada para PRÉ-CERTIFICAÇÃO**, incluindo gates finais, validação manual/física, métricas e experiência real.

Entretanto, o **PASS FINAL da MOBILE-J permanece bloqueado** até:

1. validação física obrigatória em celular real;
2. HARDEN-A1 integrada;
3. HARDEN-A2 Firebase/Firestore/gRPC estabilizada;
4. reconciliação semântica final SaaS↔Mobile dos contratos compartilhados;
5. repetição dos gates afetados pelo upstream.

Essa separação permite avançar em paralelo sem certificar a Mobile sobre um upstream SaaS ainda sujeito a mudança em Firebase/Firestore.

## 28. Pendências físicas Mobile

Continuam obrigatórias antes da certificação final:

- câmera real Android;
- câmera real iPhone;
- header HTTP efetivo em ambiente publicado;
- som/vibração físicos;
- impressão/leitura Code 128 nos formatos previstos.

Essas pendências não invalidam as certificações de domínio já concluídas, mas precisam ser fechadas até MOBILE-J/release.

---

# PARTE VIII — TESTES, CI E RELEASE

## 29. Política de testes

Browser E2E não é gate universal.

Gates prioritários conforme risco:

- instalação reproduzível;
- TypeScript;
- production build;
- testes de domínio;
- guards estruturais;
- segurança multi-tenant;
- Firestore Emulator quando aplicável;
- Core Protection;
- Recovery;
- Legal Validation;
- diff hygiene;
- gates específicos de cada rodada.

Browser/E2E deve ser usado quando o risco de interação justificar.

Validação manual é legítima e obrigatória em fluxos físicos/visuais como:

- scanner;
- câmera;
- teclado/foco;
- barcode;
- layout;
- ergonomia operacional.

## 30. Vercel durante desenvolvimento

Falha Vercel exclusivamente por `build-rate-limit` durante desenvolvimento ativo não caracteriza automaticamente regressão funcional.

Deve ser registrada como limitação externa e distinguida de falha real de código/build.

## 31. Produção e autorizações

Nenhum worker ou coordenador de programa recebe autorização implícita de produção por:

- PASS;
- mergeable;
- CI verde;
- “continue”;
- “próximo passo”;
- conclusão de uma wave.

Ações protegidas continuam dependendo da governança definida, especialmente:

- `main`;
- Vercel production/promotion;
- Firestore Rules produtivas;
- restore real;
- migrações produtivas;
- usuários/workspaces reais;
- GO/NO-GO de RC/release.


## 31.1 Publicação controlada para certificação

Decisão vigente do Program Control:

o estágio atual do EMPROVEX **permite preparar e executar testes em ambiente publicado**, desde que a publicação seja tratada como certificação controlada de um Release Candidate e não como desenvolvimento improvisado em `main`.

Fluxo obrigatório:

```text
fechar HARDEN-A2
→ compor RC único SaaS + Mobile
→ reconciliar Rules/package/CI/contratos compartilhados
→ aplicar CT-01
→ congelar SHA
→ executar gates no SHA exato
→ Preview HTTPS
→ testes SaaS + Mobile
→ GO/NO-GO explícito
→ eventual promoção controlada
```

### Regra sobre `main`

`main` continua sendo baseline conhecida e recuperável.

Problemas encontrados em Preview ou produção controlada devem ser corrigidos em branch curta/hotfix rastreável, testados e integrados conscientemente.

**Não usar `main` como branch de experimentação ou correção direta.**

### Reversibilidade e risco

Rollback de aplicação Vercel reverte código, mas **não reverte automaticamente**:

- Firestore Rules;
- Warehouse Rules;
- documentos gravados;
- movimentos de estoque;
- ledger;
- aceite legal;
- billing/lifecycle;
- demais writes persistidos.

Por isso, publicação controlada exige três planos separados:

1. rollback de aplicação;
2. rollback de Rules;
3. reconciliação/recuperação de dados quando necessário.

Não executar rollback manual improvisado de estoque/ledger.

### Estratégia de menor risco

Durante certificação publicada:

- usar workspace e materiais de teste;
- evitar estoque institucional crítico;
- evitar deletes;
- evitar migração destrutiva;
- evitar alterações massivas;
- registrar IDs das operações de teste;
- interromper novas escritas diante de dúvida de integridade.

Problemas exclusivamente visuais não implicam rollback automático. Problemas de Auth, Rules, isolamento, saldo, ledger, idempotência ou integridade devem acionar NO-GO/rollback.


---

# PARTE IX — RISCOS E GATES ABERTOS

## 32. Gates técnicos ainda abertos

### SaaS — antes do RC

1. **HARDEN-A2 — aceite formal**
   - PR #247;
   - HEAD `d647793f256c28eb412950d306d0427549577ee0`;
   - delta somente documental;
   - recomendação técnica: **PASS — RISCO RESIDUAL ACEITO TECNICAMENTE**;
   - nenhuma dependência/runtime/Rules alterados;
   - falta decisão formal do Coordenador SaaS/Program Control para encerrar a frente.

2. **HARDEN-B — recovery**
   - continua PARCIAL;
   - PITR/delete protection/schedule/retenção já confirmados;
   - permanecem pendentes backup READY, `recovery:verify` e restore isolado real.

Para **Preview HTTPS sem writes críticos**, HARDEN-B parcial não bloqueia.

Para **produção controlada com writes reais**, o caminho mais seguro é exigir backup READY dos dois bancos e `recovery:verify` antes do GO. Se isso ainda não existir, qualquer promoção exige aceitação explícita do risco residual pelo Fundador.

### Mobile — antes do PASS final

- desenvolvimento funcional A–I encerrado;
- MOBILE-J em certificação final no PR #246;
- executar testes físicos em dispositivo real;
- validar câmera/fallback/Code128/som/vibração;
- validar jornada física ponta a ponta;
- repetir reconciliação contra o RC SaaS final.

Não há nova feature Mobile obrigatória antes da janela de testes.

### RC conjunto — antes de publicar

Obrigatório:

1. encerrar A2 formalmente;
2. criar branch RC única;
3. reconciliar semanticamente SaaS + Mobile;
4. preservar Rules SaaS/Mobile já idênticas entre si;
5. registrar conteúdo/hash das Rules atualmente produtivas e das Rules do RC;
6. materializar CT-01: `camera=(self), microphone=(), geolocation=()`;
7. reconciliar `package.json`, lockfile e Application CI sem perder gates Mobile/SaaS;
8. rodar todos os gates obrigatórios no SHA exato do RC;
9. congelar o SHA;
10. testar primeiro em Preview HTTPS;
11. somente depois decidir GO/NO-GO de produção controlada.

### Correções encontradas nos testes

Correção deve seguir:

```text
bug
→ branch curta/hotfix
→ teste
→ integração no RC
→ gates afetados
→ novo freeze quando necessário
```

Não corrigir diretamente em `main`.

## 33. Riscos que não podem ser esquecidos

- publicar antes do aceite formal da HARDEN-A2;
- promover código sem RC único/reconciliado;
- sobrescrever CT-01 e quebrar câmera Mobile;
- publicar Rules sem cópia/hash e procedimento de rollback;
- confundir rollback Vercel com rollback de dados;
- testar operações destrutivas em workspace/estoque institucional;
- corrigir diretamente em `main`;
- criar fonte paralela logística;
- merge/rebase cego entre integradoras;
- perder evidência de backup/restore;
- considerar CI verde como autorização produtiva;
- declarar MOBILE-J PASS final antes da reconciliação contra o RC;
- considerar ajuste visual de PDF como blocker sem defeito funcional real.

---

# PARTE X — CRONOLOGIA CANÔNICA

## 34. Marcos históricos principais

### 2026-09 — Central de Depósitos

Foram consolidados:

- materiais;
- depósitos/localizações/subposições;
- intake;
- saída;
- consumo imediato;
- lotes/FEFO;
- barcode;
- relatórios;
- segurança externa;
- telemetria;
- fases de operação e hardening.

Detalhamento completo permanece nos documentos `docs/adm-deposito/*` e no Memorial Histórico Integral.

### 2026-10-01 — Performance R3

PERF-A/B/C/D/E/F/G/H/X foram integradas e reconciliadas.

PERF-I realizou integração/UX.

PERF-J certificou a rodada.

A R3 foi posteriormente publicada em produção e tornou-se a baseline `main@e90f92...`.

### 2026-10-01 a 2026-10-02 — SaaS R1

Foram implementadas/integradas:

- SAAS-B — billing;
- SAAS-C — onboarding;
- SAAS-DL — legal;
- SAAS-E — operações/recovery;
- SAAS-DS — security/enforcement;
- SAAS-I — integração.

Decisões consolidadas:

- R$ 70/mês;
- VIP/founder `exempt`;
- coorte VIP legado;
- Legal Gate;
- lifecycle separado de billing;
- recovery nativo obrigatório;
- piloto real somente após hardening/RC.

### 2026-10-02 — Piloto reorganizado

O trabalho preparatório SAAS-P produziu baseline T0, evidências, custos, VIP e recovery.

A sequência foi posteriormente reorganizada:

**hardening antes do piloto real.**

Os registros PILOT-A/B/C/D permanecem históricos e não significam que o piloto real comercial tenha iniciado.

### 2026-10-02 — Program Control

Foi instituído o Coordenador Geral acima dos Coordenadores SaaS e Mobile.

Passaram a ser oficiais:

- WIP global;
- semáforos;
- barreiras;
- reconciliação transversal;
- propriedade global do Memorial;
- freeze de RC sob Program Control.

### 2026-10-02 a 2026-10-03 — Mobile R1

- Onda 1 concluída;
- Integração 1 certificada;
- Onda 2 concluída;
- Integração 2 certificada;
- HARDEN-D reconciliou SaaS↔Mobile;
- Onda 3 liberada;
- F/G/H iniciadas.

### 2026-10-03 — Hardening final e preparação de certificação publicada

- HARDEN-A1/jsPDF: PASS/encerrada; CRITICAL eliminado; acabamento visual fino movido para backlog não bloqueante;
- HARDEN-A2/Firebase-Firestore-gRPC: auditoria concluída sem alteração de runtime; recomendação PASS com risco residual tecnicamente aceito; aguarda aceite formal;
- HARDEN-B: parcial por dependência temporal de backup READY/restore;
- HARDEN-C/D: PASS/encerradas;
- MOBILE-I: PASS/integrada;
- MOBILE-J: certificação final em execução;
- CT-01 permanece obrigatória no RC;
- Program Control aprovou a estratégia de RC conjunto + Preview HTTPS + eventual produção controlada com rollback preparado;
- produção continua na Performance R3.

---

# PARTE XI — DECISÕES PERMANENTES

## 35. Decisões que só podem mudar por decisão explícita

### Produto

- experiência do usuário prevalece sobre otimização marginal;
- Central Mobile não cria backend paralelo;
- uma única fonte de verdade por domínio.

### SaaS

- plano único completo R$ 70/mês na R1;
- trial 30 dias;
- VIP/founder `exempt`;
- sem signup público;
- sem webhook de pagamento;
- suspensão manual;
- piloto depois do RC.

### Segurança

- Auth/workspace/UG permanecem compartilhados;
- Legal Gate versionado;
- `warehouseAccess` compartilhado;
- Rules não são afrouxadas para facilitar worker;
- microfone/geolocalização permanecem bloqueados no contrato CT-01.

### Desenvolvimento

- workers isolados;
- branches congeladas não são movidas por conveniência;
- conflitos são resolvidos semanticamente;
- integração não equivale a produção;
- validação manual pode ser gate legítimo.

---

# PARTE XII — ÍNDICE OPERACIONAL

## 36. Documentos globais

- `docs/EMPROVEX_MEMORIAL_OFICIAL.md` — estado/contratos/governança;
- `docs/EMPROVEX_PROGRAM_CONTROL.md` — protocolo do Coordenador Geral;
- `docs/EMPROVEX_MEMORIAL_HISTORICO_ATE_2026-10-03.md` — histórico integral preservado.

## 37. SaaS R1

- `docs/SAAS_R1_INTEGRATION_STATUS.md`;
- `docs/SAAS_R1_COORDENADOR_HANDOFF.md`;
- `docs/SAAS_R1_PRE_PILOTO_HARDENING.md`;
- `docs/SAAS_R1_HARDENING_EXECUCAO_PARALELA.md`;
- `docs/SAAS_R1_HARDEN_C_RELEASE_HEALTH_RULES.md`;
- `docs/SAAS_R1_HARDEN_D_MOBILE_RECONCILIATION.md`;
- demais handoffs/documentos `SAAS_R1_*`.

## 38. Mobile R1

- `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md`;
- `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`;
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`;
- `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`;
- documentos especializados `CENTRAL_MOBILE_R1_*`.

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

Se um novo Coordenador assumir agora, deve considerar:

```text
PRODUÇÃO
main@e90f92acae1514ee5cbc6ce95fed354bc1454330
Performance R3

SAAS R1
integrador: feat/saas-r1-commercializacao@eca80c796e8d2916cafd6aa4d7419c8b27b931d5
HARDEN-A1: PASS / encerrada
HARDEN-A2: auditoria concluída / recomendação PASS com risco residual / aguarda aceite formal
HARDEN-B: parcial / backup READY + recovery:verify + restore pendentes
HARDEN-C: PASS
HARDEN-D: PASS

MOBILE R1
integrador: feat/central-mobile-r1@3f3b53f7a286a1eb9bc9c254a4350ca7595153a4
desenvolvimento funcional: encerrado
MOBILE-I: PASS / integrada
MOBILE-J: certificação final em execução — PR #246
blocker funcional: nenhum

RELEASE
RC conjunto SaaS + Mobile: ainda não congelado
CT-01: obrigatória
Rules SaaS/Mobile: reconciliadas entre si; diferentes de main
Preview HTTPS: próximo ambiente recomendado após freeze/gates
produção controlada: exige GO explícito posterior
abertura comercial: fora de escopo da janela de certificação

PRÓXIMA SEQUÊNCIA SEGURA
aceitar/encerrar HARDEN-A2
→ compor RC único
→ reconciliar SaaS↔Mobile/package/CI/Rules
→ aplicar CT-01
→ preparar rollback
→ gates no SHA exato
→ Preview HTTPS
→ testes físicos + SaaS
→ decidir GO/NO-GO de produção controlada
```

Este bloco deve ser mantido coerente com o Snapshot Global do início do documento.

### HARDEN-A1 — CORREÇÃO CONTROLADA JSPDF

Program Control autorizou a HARDEN-A1 para remover o bloqueador CRITICAL remanescente de jsPDF.

Base:
`feat/saas-r1-commercializacao@9a294bc543ec7150b9144ed96e767a161864d72f`

Branch:
`saas-harden-a-jspdf-security`

Alvos:
- `jspdf@4.2.1`;
- `jspdf-autotable@5.0.8`.

A branch foi criada exatamente no HEAD acima.

A frente deve tratar apenas o upgrade controlado de jsPDF/AutoTable, adaptações estritamente necessárias e regressão dos PDFs existentes.

A correção Firebase/Firestore/gRPC fica classificada como **HARDEN-A2** e permanece **BLOQUEADA** até o encerramento da A1.

Nenhuma ação produtiva foi autorizada.

### HARDEN-A1 — SECURITY PASS / VALIDAÇÃO VISUAL PENDENTE

A HARDEN-A1 concluiu com sucesso a correção técnica do bloqueador jsPDF.

Identidade:
- branch: `saas-harden-a-jspdf-security`;
- base: `9a294bc543ec7150b9144ed96e767a161864d72f`;
- HEAD: `5ae4984bb9580faf5197737eeeeb0d5cf5aae838`;
- PR: `#244`.

Resultado técnico:
- jsPDF: 2.5.2 → 4.2.1;
- jsPDF-AutoTable: 3.8.4 → 5.0.8;
- DOMPurify transitivo atualizado;
- audit CRITICAL: 1 → 0;
- regressão PDF automatizada: 7/7 PASS;
- Application CI/Core/Recovery/Legal/Build/TypeScript/Diff: PASS;
- lazy loading preservado;
- produção não alterada.

Estado oficial:
**PARCIAL TECNICAMENTE SAUDÁVEL / SECURITY PASS**

Motivo único:
**validação visual/manual dos PDFs ainda pendente**.

Antes do aceite final da A1, validar:
- Cronograma;
- Relatório/Termo;
- Folha de Alocação;
- Documento de Saída;
- Etiquetas.

HARDEN-A2 — Firebase/Firestore/gRPC permanece **BLOQUEADA**.

### HARDEN-A1 — PASS TÉCNICO

A HARDEN-A1 foi encerrada com sucesso após migração de jsPDF para linha segura e regressão técnica dos fluxos PDF.

A decisão de produto/coordenação estabelece que **detalhes visuais finos de PDFs não são requisito fundamental de lançamento** e podem ser ajustados de forma incremental após a entrada oficial em produção, desde que a geração funcional permaneça válida.

Estado:
- jsPDF CRITICAL: RESOLVIDO;
- regressão técnica: PASS;
- visual fino: backlog pós-lançamento;
- impacto MOBILE-R1: DELTA COMPATÍVEL;
- produção: não alterada.

Com o fechamento da A1, a HARDEN-A2 — Firebase/Firestore/gRPC pode ser liberada em frente separada e controlada.

### HARDEN-A2 — Firebase / Firestore / gRPC

Program Control liberou a HARDEN-A2 após o encerramento técnico da A1.

Branch:
`saas-harden-a2-firebase-firestore-grpc`

Base congelada:
`f308ff601fe923467b8ccc1489be91b318bc3e8c`

A frente deve primeiro provar alcance real dos advisories e compatibilidade do caminho suportado. O objetivo não é zerar `npm audit` a qualquer custo, e sim reduzir risco real sem quebrar Auth, Firestore, multi-tenant, Central, SaaS ou Mobile.

MOBILE-J pode continuar em paralelo em pré-certificação; HARDEN-B segue aguardando recovery.

### HARDEN-A2 — PASS / ENCERRADA

A HARDEN-A2 — Firebase / Firestore / gRPC foi encerrada como **PASS — RISCO RESIDUAL ACEITO TECNICAMENTE**.

A cadeia transitiva permanece instalada, mas a auditoria de alcançabilidade concluiu que os advisories avaliados dependem de primitivas de servidor gRPC não utilizadas pelo EMPROVEX. O runtime browser não carrega o transporte Node gRPC; os caminhos Node identificados usam Firestore como cliente.

Nenhuma dependência foi alterada. Não houve delta em Auth, Firestore client, Rules, Central, Mobile ou bundle.

Impacto MOBILE-R1: **SEM DELTA**.

Política:
- não usar `npm audit fix --force`;
- não aplicar downgrade automático;
- não forçar override gRPC fora do contrato suportado;
- reabrir somente diante de nova evidência técnica, mudança de alcance ou correção upstream suportada.

Com A1 e A2 encerradas, o objetivo SaaS passa a ser **fechar o hardening remanescente e deixar o programa pronto para composição do RC ÚNICO SAAS R1 + MOBILE R1**.

HARDEN-B permanece PARCIAL por dependência temporal de backup/recovery. HARDEN-C/D permanecem PASS.

Até nova autorização, não há permissão para merge em `main`, deploy produtivo, Rules produtivas, restore real, migração, piloto ou freeze RC.

