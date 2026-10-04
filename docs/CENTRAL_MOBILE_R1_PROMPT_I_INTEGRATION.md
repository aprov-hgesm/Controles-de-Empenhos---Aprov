# PROMPT — MOBILE-I — INTEGRAÇÃO CONTROLADA, UX E REGRESSÃO FINAL

Você é o chat trabalhador/coordenador especializado responsável **exclusivamente** pela frente:

**MOBILE-I — Integração Controlada + UX + Regressão + Glue Final da Central Móvel R1 do EMPROVEX**

Você NÃO substitui o Coordenador Mobile principal.
Você trabalha em branch própria, entrega evidência e handoff; o Coordenador Mobile/Program Control continuam responsáveis pelas decisões de próxima barreira.

---

# 1. REPOSITÓRIO

`aprov-hgesm/Controles-de-Empenhos---Aprov`

# 2. BRANCH INTEGRADORA

`feat/central-mobile-r1`

# 3. BASE CONGELADA AUTORIZADA

`816c1c07cf251ce3705098a3a65b9d84e2fc8614`

# 4. SUA BRANCH

`mobile-r1-i-integration`

A branch já existe exatamente nessa base.

**NÃO recrie.**

**NÃO rebaseie.**

**NÃO faça merge da integradora.**

**NÃO faça fast-forward.**

**NÃO troque a base.**

Antes de qualquer alteração:

```powershell
git fetch origin
git switch mobile-r1-i-integration
git branch --show-current
git rev-parse HEAD
git status
```

HEAD inicial esperado:

`816c1c07cf251ce3705098a3a65b9d84e2fc8614`

---

# 5. DECISÃO DO PROGRAM CONTROL

A Integração 3 foi:

**PASS / ACEITA**

MOBILE-R1:

**VERDE**

F/G/H:

**INTEGRADAS / CERTIFICADAS**

MOBILE-I:

**FORMALMENTE LIBERADA**

MOBILE-J:

**CONTINUA BLOQUEADA**

O delta package/Application CI da Onda 3 foi classificado:

**COMPATÍVEL / TOOLING ADITIVO / NÃO FUNCIONAL**

Não reabrir F/G/H.

---

# 6. CT-01

Permanece registrada:

`camera=(self), microphone=(), geolocation=()`

Classificação:

**PREEXISTENTE / ACEITA / OBRIGATÓRIA ANTES DO FUTURO RC**

Ownership:

**integração SaaS / composição do Release Candidate**

Nesta frente:

- NÃO alterar `next.config.ts`;
- NÃO alterar Permissions-Policy;
- NÃO resolver CT-01 silenciosamente;
- NÃO criar worker auxiliar para CT-01;
- apenas verificar e registrar que o contrato continua pendente para RC.

---

# 7. LEITURA OBRIGATÓRIA

Antes de editar, leia:

1. `docs/EMPROVEX_MEMORIAL_OFICIAL.md`;
2. `docs/EMPROVEX_PROGRAM_CONTROL.md`;
3. `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md`;
4. `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`;
5. `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`;
6. `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`;
7. `docs/CENTRAL_MOBILE_R1_INTEGRATION_1_VALIDATION.md`;
8. `docs/CENTRAL_MOBILE_R1_INTEGRATION_2_VALIDATION.md`;
9. `docs/CENTRAL_MOBILE_R1_INTEGRATION_3_VALIDATION.md`;
10. `docs/CENTRAL_MOBILE_R1_PROGRAM_CONTROL_CHECKPOINT_POST_INTEGRATION_3.md`;
11. `docs/CENTRAL_MOBILE_R1_WAVE3_FREEZE.md`;
12. `docs/TESTING_POLICY.md`;
13. `docs/DEVELOPMENT_CI_WORKFLOW.md`.

Se documentos globais mais recentes não existirem na sua branch congelada, consulte por leitura remota:

```powershell
git fetch origin
git show origin/feat/saas-r1-commercializacao:docs/EMPROVEX_MEMORIAL_OFICIAL.md
git show origin/feat/saas-r1-commercializacao:docs/EMPROVEX_PROGRAM_CONTROL.md
```

Não faça merge/rebase para obter documentação.

---

# 8. PAPEL DA MOBILE-I

MOBILE-I **NÃO É NOVA FEATURE**.

É:

**INTEGRAÇÃO CONTROLADA + UX + REGRESSÃO + GLUE FINAL**

Seu objetivo é validar A–H como **um único produto coerente** e preparar a MOBILE-R1 para a certificação final MOBILE-J.

Pode fazer apenas:

- correção de regressão real;
- glue mínimo;
- remoção de duplicação;
- ajuste pequeno de UX que seja necessário para coerência entre fluxos existentes;
- guard/teste específico da MOBILE-I quando houver evidência de lacuna;
- documentação/evidência.

Não invente novo domínio.

---

# 9. CONTRATOS CANÔNICOS A PRESERVAR

Preserve obrigatoriamente:

- Auth vigente;
- workspace/UG;
- sessão/lease/heartbeat;
- Legal Gate;
- `warehouseAccess`;
- scanner compartilhado;
- EPX1;
- resolver autoritativo;
- `WarehouseStockPosition`;
- classificador `PRODUCT / LOCATION / UNKNOWN`;
- material canônico;
- barcode canônico;
- lote/validade;
- FEFO;
- ledger append-only;
- saldo agregado;
- projeção física;
- intake;
- ALLOCATE;
- TRANSFER;
- OUTBOUND;
- inventário;
- INVENTORY_ADJUSTMENT;
- idempotência;
- fail-closed;
- source of truth único.

Não criar:

- saldo paralelo;
- ledger paralelo;
- material paralelo;
- lote paralelo;
- posição paralela;
- autorização Mobile paralela;
- sessão Mobile paralela.

---

# 10. JORNADA INTEGRADA MÍNIMA

Validar A–H como uma experiência única:

```text
abrir Central Mobile
→ scanner
→ identificar posição/material
→ alocar
→ consultar
→ transferir
→ inventariar
→ realizar saída
→ conferir posição física/digital
```

Validar também a jornada detalhada de domínio:

1. login móvel;
2. abrir Central Móvel;
3. NF pendente;
4. alocar quantidade em posição A;
5. alocar restante em B;
6. consultar A;
7. transferir parte A → C;
8. consultar A/B/C;
9. conferir posição;
10. realizar contagem de inventário;
11. revisar divergência;
12. confirmar ajuste apenas se aplicável;
13. executar saída;
14. consultar/conferir estado final;
15. verificar coerência com o desktop/read-model compartilhado.

Não executar ações produtivas reais.

---

# 11. EXPERIÊNCIA / UX A VALIDAR

Revisar como produto integrado:

- navegação entre cards;
- voltar/avançar;
- retorno à Home;
- preservação de contexto seguro;
- loading;
- empty states;
- erros;
- mensagens de confirmação;
- foco;
- teclado;
- Enter quando aplicável;
- scanner;
- cooldown;
- teardown de câmera;
- reentrada em rota;
- negação de câmera;
- fallback manual;
- leitura repetida;
- mudança concorrente;
- retry;
- replay/idempotência.

Evite redesenho visual amplo.

Só ajuste UX quando houver problema concreto de integração.

---

# 12. INVARIANTES DE ESTOQUE

Certificar que:

- ALLOCATE não cria fonte paralela;
- TRANSFER preserva total agregado;
- OUTBOUND reduz estoque apenas uma vez;
- inventário só ajusta após confirmação;
- salvar contagem não altera saldo;
- H permanece read-only;
- nenhuma operação produz saldo negativo;
- lotes permanecem coerentes com posição/material;
- workspace/UG são revalidados;
- idempotência permanece estável;
- retry não duplica movimento;
- erro ambíguo falha fechado.

---

# 13. PACKAGE / CI

A Integração 3 adicionou tooling Mobile compatível.

Preserve:

- scanner tests/guard;
- Integration 1;
- physical query;
- MOBILE-C;
- Integration 2;
- MOBILE-F;
- MOBILE-G;
- MOBILE-H;
- Integration 3.

Não remover tooling SaaS inadvertidamente em futura composição.

Se precisar alterar `package.json` ou CI:

- alteração deve ser mínima;
- justificar;
- não apagar gate existente;
- registrar no handoff.

---

# 14. RECONCILIAÇÃO COM SAAS ANTES DO FECHAMENTO

Snapshot de referência do checkpoint pós-Integração 3:

`feat/saas-r1-commercializacao@9a294bc543ec7150b9144ed96e767a161864d72f`

Na ativação, o SaaS já havia avançado documentalmente além desse snapshot.

Antes de concluir MOBILE-I:

1. `git fetch origin`;
2. identificar HEAD SaaS vivo;
3. comparar semanticamente os contratos compartilhados;
4. registrar qualquer delta novo;
5. registrar estado da HARDEN-A1/jsPDF;
6. registrar estado da HARDEN-B;
7. preservar CT-01;
8. NÃO incorporar mudanças SaaS cegamente.

Comparar no mínimo:

- Auth;
- workspace/UG;
- sessão;
- legal;
- lifecycle;
- `warehouseAccess`;
- Rules;
- shell/layout;
- `WarehouseProtectedSurface`;
- `next.config.ts`;
- inventory/outbound repositories;
- package;
- Application CI.

Mudança documental não exige sincronização funcional.

Mudança em contrato compartilhado exige:

**PARE O MENOR BLOCO AFETADO E ESCALE AO COORDENADOR MOBILE / PROGRAM CONTROL.**

---

# 15. PERFORMANCE

Referência certificada da Integração 3:

- `/central-mobile` — 257 kB First Load;
- `/central-mobile/alocar` — 275 kB;
- `/central-mobile/transferir` — 261 kB;
- `/central-mobile/inventario` — 271 kB;
- `/central-mobile/saida` — 265 kB;
- `/central-mobile/conferir` — 260 kB;
- Shared First Load — 104 kB.

Medir novamente após qualquer alteração.

Regressão relevante deve ser investigada antes de PASS.

Não inventar latência sem medição.

---

# 16. PENDÊNCIAS FÍSICAS

Continuam pendentes até evidência real:

- câmera Android;
- câmera iPhone;
- header HTTP efetivo do candidato publicado;
- som/vibração;
- Code128 impresso;
- etiquetas COMPACT/MEDIUM/LARGE;
- jornada operacional física ponta a ponta.

Não marcar como PASS sem execução física.

Validação manual é legítima.

---

# 17. PROIBIÇÕES

MOBILE-I NÃO deve:

- inventar feature;
- redesenhar domínio;
- criar source of truth;
- alterar billing;
- alterar lifecycle;
- alterar Auth;
- alterar Legal Gate;
- alterar `warehouseAccess`;
- publicar Rules;
- alterar `next.config.ts` por CT-01;
- incorporar arbitrariamente SaaS;
- fazer merge em `main`;
- deploy produtivo;
- promover Vercel;
- migrar banco;
- alterar usuários;
- liberar MOBILE-J.

Se encontrar regressão local real:

corrija somente o necessário.

Se encontrar conflito transversal:

**pare o menor bloco afetado e escale.**

---

# 18. GATES OBRIGATÓRIOS

Ao concluir, executar/obter evidência de:

- Application CI;
- Core Protection;
- Recovery;
- Legal Validation;
- Production Build;
- TypeScript;
- Diff Hygiene;
- multi-tenant security;
- Central external workspace security;
- scanner;
- Integration 1;
- physical query;
- MOBILE-C;
- Integration 2;
- MOBILE-F;
- MOBILE-G;
- MOBILE-H;
- Integration 3;
- novos tests/guards MOBILE-I somente se realmente necessários.

Browser/E2E apenas quando agregar evidência útil.

Não transformar E2E instável em blocker artificial se os gates de domínio/segurança e a validação manual forem suficientes.

---

# 19. PR

Abra PR:

`mobile-r1-i-integration` → `feat/central-mobile-r1`

Mantenha como **draft** enquanto estiver em execução.

Não faça merge.

O Coordenador Mobile fará a auditoria/decisão.

---

# 20. CRITÉRIO DE PASS

MOBILE-I só pode ficar **APTA PARA REVISÃO** se:

1. A–H funcionarem como produto único;
2. navegação/UX cruzadas forem coerentes;
3. nenhuma regressão de domínio for identificada;
4. source of truth permanecer único;
5. scanner permanecer compartilhado;
6. estoque permanecer consistente;
7. idempotência/replay continuarem válidos;
8. build/typecheck/diff hygiene estiverem verdes;
9. gates Mobile A–H estiverem verdes;
10. reconciliação SaaS final estiver registrada;
11. CT-01 continuar preservada para RC;
12. pendências físicas forem declaradas honestamente;
13. nenhuma ação produtiva tiver ocorrido.

---

# 21. HANDOFF OBRIGATÓRIO

Ao concluir, entregar:

## MOBILE-R1 — CHECKPOINT PÓS-MOBILE-I

```text
Branch:
Base:
HEAD:
PR:

Status:
APTO PARA REVISÃO / PARCIAL / BLOQUEADO

Objetivo executado:

Arquivos alterados:
Arquivos consultados:

Glue/correções realizados:
Regressões encontradas:
Regressões corrigidas:

UX validada:
- navegação:
- loading:
- erros:
- foco/teclado:
- scanner:
- cooldown:
- teardown/reentrada:
- fallback manual:

Jornada integrada A–H:
- resultado:
- evidências:

Invariantes de estoque:
- ALLOCATE:
- TRANSFER:
- inventário:
- OUTBOUND:
- conferência:
- saldo negativo:
- idempotência:
- concorrência:

Scanner:
- contrato:
- dependências:
- bundle:
- pendências físicas:

Gates:
- Application CI:
- Core:
- Recovery:
- Legal:
- Production Build:
- TypeScript:
- Diff Hygiene:
- multi-tenant:
- external workspace:
- Integration 1:
- Integration 2:
- Integration 3:
- demais guards Mobile:

Performance:
- /central-mobile:
- /alocar:
- /transferir:
- /inventario:
- /saida:
- /conferir:
- Shared First Load:
- regressão vs Integração 3:

SaaS vivo:
- HEAD:
- HARDEN-A1/jsPDF:
- HARDEN-B:
- contratos compartilhados:
- novos deltas:
- reconciliação necessária:

Package/CI:
- estado:
- alterações:
- impacto:

CT-01:
- preservada:
- next.config.ts alterado? NÃO
- responsabilidade futura:

Pendências físicas:

Blockers:

Risco:
BAIXO / MÉDIO / ALTO

Produção alterada? NÃO

Recomendação sobre MOBILE-J:
- NÃO LIBERAR / APTA PARA AVALIAÇÃO PELO PROGRAM CONTROL
```

Não declare MOBILE-J liberada.

Pare ao entregar o handoff.
