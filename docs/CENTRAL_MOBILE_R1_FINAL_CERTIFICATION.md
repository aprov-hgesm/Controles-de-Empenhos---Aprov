# EMPROVEX — Central Móvel R1 — MOBILE-J — Certificação Final

Data de abertura: **2026-10-03**
Programa: **MOBILE-R1**
Frente: **MOBILE-J — Certificação Final**
Branch: `mobile-r1-j-final-certification`

## 1. Estado de entrada

A MOBILE-J foi formalmente liberada pelo Program Control após encerramento da MOBILE-I.

Freeze de origem:
`feat/central-mobile-r1@2108a21208765e0d4155399667cf571b0fa127ff`

MOBILE-I:
- worker: `mobile-r1-i-integration@ea5ad10054e2aea608e270a970fde723cde41d93`;
- PR #245: MERGED;
- squash: `3a5689e0e613adfb7dbf48ef8d44085ec6c951b3`;
- estado: **PASS / APROVADA / INTEGRADA / ENCERRADA**.

MOBILE-A → H:
**PASS / INTEGRADAS**

Integrações 1 → 3:
**PASS**

Blocker funcional Mobile de entrada:
**NENHUM**

Produção:
**NÃO ALTERADA**

## 2. Freeze da MOBILE-J

Antes da criação da branch foi conferido o HEAD vivo de `feat/central-mobile-r1`.

Resultado:
- HEAD esperado: `2108a21208765e0d4155399667cf571b0fa127ff`;
- HEAD vivo: `2108a21208765e0d4155399667cf571b0fa127ff`;
- delta desde o checkpoint: **NENHUM**;
- branch MOBILE-J preexistente: **NÃO**.

A branch `mobile-r1-j-final-certification` foi criada exatamente desse SHA.

Após o freeze:
- não rebasear;
- não incorporar outras branches por conta própria;
- não fazer fast-forward sem reconciliação;
- não reabrir desenvolvimento funcional sem regressão concreta.

## 3. Natureza desta frente

MOBILE-J é **certificação**, não feature.

Objetivo:
> certificar a Central Móvel A–I como um único produto, reunindo evidência automatizada, estrutural, física e de reconciliação SaaS, sem criar domínio, source of truth, saldo, ledger, autorização ou sessão paralelos.

Não pertence ao escopo:
- redesign;
- nova wave funcional;
- app nativo;
- offline write queue;
- alteração ampla de Rules;
- refatoração de domínio;
- HARDEN-A2;
- HARDEN-B;
- release/produção.

## 4. Autoridades documentais consultadas

Consultados:
- `docs/EMPROVEX_MEMORIAL_OFICIAL.md`;
- `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md`;
- `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`;
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`;
- `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`;
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_1_VALIDATION.md`;
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_2_VALIDATION.md`;
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_3_VALIDATION.md`;
- `docs/CENTRAL_MOBILE_R1_PROGRAM_CONTROL_CHECKPOINT_POST_INTEGRATION_3.md`;
- `docs/CENTRAL_MOBILE_R1_PROGRAM_CONTROL_CHECKPOINT_POST_MOBILE_I.md`;
- `docs/CENTRAL_MOBILE_R1_WAVE3_FREEZE.md`;
- `docs/TESTING_POLICY.md`;
- `docs/DEVELOPMENT_CI_WORKFLOW.md`.

Observação:
`docs/EMPROVEX_PROGRAM_CONTROL.md` não existe no freeze atual. A autoridade operacional equivalente está nos checkpoints específicos de Program Control da MOBILE-R1 e na ordem formal de liberação da MOBILE-J.

## 5. Baseline automatizado herdado da MOBILE-I

No HEAD auditado da MOBILE-I `ea5ad10054e2aea608e270a970fde723cde41d93`:

- Application CI #945 — SUCCESS;
- Core Protection #232 — SUCCESS;
- Recovery #623 — SUCCESS;
- Legal Validation #47 — SUCCESS;
- Production Build — SUCCESS;
- Final TypeScript — SUCCESS;
- Diff Hygiene — SUCCESS;
- multi-tenant security — SUCCESS;
- external workspace security — SUCCESS;
- scanner — SUCCESS;
- Integration 1 — SUCCESS;
- physical query — SUCCESS;
- MOBILE-C — SUCCESS;
- Integration 2 — SUCCESS;
- MOBILE-F — SUCCESS;
- MOBILE-G — SUCCESS;
- MOBILE-H — SUCCESS;
- Integration 3 — SUCCESS;
- MOBILE-I integrated product guard — SUCCESS.

O squash e os commits posteriores da integradora não introduziram delta runtime em relação ao código auditado.

## 6. Baseline de performance

Valores certificados pós-Integração 3/MOBILE-I:

| Rota | First Load |
| --- | ---: |
| `/central-mobile` | 257 kB |
| `/central-mobile/alocar` | 275 kB |
| `/central-mobile/transferir` | 261 kB |
| `/central-mobile/inventario` | 271 kB |
| `/central-mobile/saida` | 265 kB |
| `/central-mobile/conferir` | 260 kB |
| Shared First Load | 104 kB |

MOBILE-J deve registrar novamente esses valores quando houver HEAD final que justifique novo build/gate.

## 7. Reconciliação SaaS na abertura

Snapshot funcional anteriormente auditado:
`feat/saas-r1-commercializacao@750d4c69cd3f233938631bcdd22db7e397ddc50e`

HEAD SaaS vivo na abertura da MOBILE-J:
`b95b5b050a9f08df2df77d699b066ea86e818146`

Comparação:
- ahead_by: 1;
- arquivo alterado: somente `docs/EMPROVEX_MEMORIAL_OFICIAL.md`;
- delta runtime: **NENHUM**;
- classificação: **SEM NOVO DELTA RUNTIME**.

HARDEN-A2:
- branch encontrada na abertura: **NENHUMA**;
- PR HARDEN-A2 aberto encontrado: **NENHUM**;
- estado: **NÃO INICIADA neste checkpoint**.

A reconciliação final deve ser repetida antes de eventual recomendação de PASS FINAL.

## 8. CT-01

Contrato obrigatório do futuro candidato:

`camera=(self), microphone=(), geolocation=()`

MOBILE-J:
- preserva o requisito;
- não altera o contrato global silenciosamente;
- não assume ownership da composição SaaS/RC;
- deve validar o header HTTP efetivo no candidato publicado quando ele existir.

## 9. Matriz de validação física

### Android / Chrome

| Cenário | Estado | Evidência |
| --- | --- | --- |
| câmera permitida | PENDENTE | aparelho real |
| câmera negada | PENDENTE | aparelho real |
| câmera indisponível | PENDENTE | aparelho real |
| fallback manual | PENDENTE | aparelho real |
| abrir/fechar câmera | PENDENTE | aparelho real |
| troca de rota e retorno | PENDENTE | aparelho real |
| reentrada da câmera | PENDENTE | aparelho real |
| múltiplas leituras | PENDENTE | aparelho real |
| double scan | PENDENTE | aparelho real |
| cooldown | PENDENTE | aparelho real |
| luz baixa/reflexo | PENDENTE | aparelho real |
| perda/retorno de internet | PENDENTE | aparelho real |

### iPhone / Safari

Estado inicial:
**PENDENTE — depende de aparelho real disponível.**

Não inferir PASS a partir do Android.

## 10. Code128 físico

Presets a certificar:

| Preset | Impressão | Leitura | Distância/enquadramento | Resultado |
| --- | --- | --- | --- | --- |
| COMPACT | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| MEDIUM | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| LARGE | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

A visualização digital não substitui etiqueta impressa.

## 11. Feedback físico

Pendências obrigatórias em aparelho real:
- som de sucesso;
- som de erro;
- vibração;
- feedback visual;
- leitura duplicada;
- cooldown;
- ausência de feedback enganoso em falha de persistência.

Estado:
**PENDENTE**

## 12. Jornada física ponta a ponta

Jornada a certificar:

```text
LOGIN
→ CENTRAL MOBILE
→ LER MATERIAL / POSIÇÃO
→ ALLOCATE
→ CONSULTA FÍSICA
→ TRANSFER
→ CONFERÊNCIA
→ INVENTÁRIO
→ OUTBOUND
→ CONSULTA FINAL
→ CENTRAL DESKTOP
→ COERÊNCIA DESKTOP ↔ MOBILE
```

Estado:
**PENDENTE DE EXECUÇÃO FÍSICA**

Invariantes a observar:
- mesmo material;
- mesmo lote;
- mesma posição;
- mesmo saldo;
- mesmo ledger;
- nenhuma fonte paralela.

## 13. Critérios de domínio a reconfirmar

### ALLOCATE
- autoridade canônica;
- pending quantity;
- lote/validade;
- posição revalidada;
- sem write paralelo.

### TRANSFER
- origem/destino válidos;
- saldo revalidado;
- total agregado preservado;
- idempotência.

### INVENTÁRIO
- salvar contagem não altera saldo;
- ajuste somente após confirmação;
- `INVENTORY_ADJUSTMENT` canônico;
- stale/revision protegidos.

### OUTBOUND
- sem saldo negativo;
- posição/lote/FEFO;
- idempotência/replay;
- write oficial único.

### CONFERÊNCIA
- read-only;
- divergência não corrige silenciosamente;
- correção direciona para TRANSFER oficial.

## 14. Estado permitido nesta etapa

Enquanto faltarem evidências físicas e a última reconciliação SaaS, a classificação máxima é:

**PARCIAL TECNICAMENTE SAUDÁVEL / CERTIFICAÇÃO EM EXECUÇÃO / AGUARDANDO EVIDÊNCIA FÍSICA E RECONCILIAÇÃO FINAL SAAS**

PASS FINAL não pode ser inferido a partir do CI.

## 15. Próximas ações

1. manter runtime funcional congelado;
2. abrir PR draft documental da MOBILE-J;
3. preservar evidências automatizadas já certificadas;
4. executar validação física em Android;
5. executar iPhone/Safari se aparelho estiver disponível;
6. imprimir e testar Code128 COMPACT/MEDIUM/LARGE;
7. executar jornada física ponta a ponta;
8. registrar nova performance caso exista delta que justifique build;
9. obter HEAD SaaS final;
10. reconciliar contratos compartilhados;
11. repetir gates afetados se houver delta;
12. entregar handoff final ao Program Control.

## 17. Evidências coletadas pela MOBILE-J na abertura

PR da certificação:
- **#246** — `MOBILE-J: certificação final da Central Móvel R1`;
- estado: **OPEN / DRAFT / MERGEABLE**;
- base: `feat/central-mobile-r1@2108a21208765e0d4155399667cf571b0fa127ff`;
- primeiro commit MOBILE-J: `bf39df76320941eeda30bc6f9c3857225e9ead61`;
- diff inicial: **1 arquivo documental / 0 delta runtime**.

Política de CI:
- o diff MOBILE-J atual está restrito a `docs/**`;
- `Application CI` não foi disparado, coerente com a política `paths-ignore: docs/**`;
- nenhum arquivo artificial de runtime/tooling foi modificado apenas para forçar CI;
- a evidência automatizada continua ancorada no HEAD MOBILE-I certificado porque o código executável é idêntico.

GitHub Actions reconfirmado no HEAD MOBILE-I:
- Application CI run `37115147825`: **SUCCESS**;
- Recovery run `37115147839`: **SUCCESS**;
- EMPROVEX Core Protection run `37115147823`: **SUCCESS**;
- SAAS-DL Legal Validation run `37115147827`: **SUCCESS**.

CT-01 no código:
- `next.config.ts` contém exatamente `camera=(self), microphone=(), geolocation=()`;
- classificação estrutural: **PASS**;
- validação do header HTTP efetivamente servido: **PENDENTE**.

Scanner no código:
- decoder permanece lazy via `await import('./scannerDecoder')`;
- `facingMode: { ideal: 'environment' }`;
- cooldown padrão: `900 ms`;
- teardown usa `session.stop()`;
- `stopCamera()` reseta cooldown;
- fallback manual usa formulário `onSubmit`;
- vibração opcional usa `navigator.vibrate(35)`;
- feedback sonoro usa `AudioContext`;
- formatos declarados: EAN-13, EAN-8, UPC-A, UPC-E, CODE-128, CODE-39, ITF, QR Code e Data Matrix;
- dependências preservadas: `@zxing/browser ^0.1.5` e `@zxing/library ^0.21.3`.

Etiquetas no código:
- presets `COMPACT`, `MEDIUM` e `LARGE` permanecem presentes;
- etiquetas de DEPOT/LOCAL/SUBPOSITION usam `physicalBarcode`;
- LOCAL/SUBPOSITION geram identidade física estável;
- PDF desenha Code128 pelo contrato de `locationBarcode`;
- evidência física de impressão/leitura continua **PENDENTE**.

Guard final:
- `verify:mobile-r1-integration-final` continua presente;
- verifica scanner/resolver, ALLOCATE, TRANSFER, inventário, OUTBOUND, conferência read-only, CT-01 e registro dos gates no Application CI.

Preview Vercel do PR #246:
- status de commit `Vercel`: **SUCCESS**;
- o deployment foi criado pelo projeto EMPROVEX;
- a conexão Vercel disponível ao executor não possui acesso ao time/projeto correspondente, portanto o conteúdo/header do preview não pôde ser consultado diretamente;
- esta limitação não foi convertida em PASS físico ou PASS de header.

Classificação após evidência automatizada/estrutural:
**PARCIAL TECNICAMENTE SAUDÁVEL / EVIDÊNCIA AUTOMATIZADA E ESTRUTURAL PRESERVADA / AGUARDANDO CERTIFICAÇÃO FÍSICA E RECONCILIAÇÃO SAAS FINAL**.

## 16. Produção

**NÃO ALTERADA**

Esta frente não autoriza:
- merge em `main`;
- deploy de produção;
- Vercel production;
- Rules produtivas;
- migração;
- restore;
- lançamento Mobile.


## 18. Checkpoint vivo do Coordenador Mobile — 2026-10-03

A abertura da MOBILE-J foi auditada contra o estado vivo do repositório.

### Branch / PR

- branch: `mobile-r1-j-final-certification`;
- freeze: `2108a21208765e0d4155399667cf571b0fa127ff`;
- HEAD corrente na auditoria: `0cdf7de46630c055bd01e58423fd997d907ae3cf`;
- PR #246: OPEN / DRAFT / MERGEABLE;
- delta desde o freeze: 2 commits;
- arquivos alterados: apenas `docs/CENTRAL_MOBILE_R1_FINAL_CERTIFICATION.md`;
- delta runtime Mobile: **NENHUM**.

### SaaS vivo

HEAD observado:
`feat/saas-r1-commercializacao@f308ff601fe923467b8ccc1489be91b318bc3e8c`.

O estado mudou em relação ao snapshot de abertura da J.

#### HARDEN-A1

Estado vivo:
**PASS TÉCNICO / ENCERRADA / INTEGRADA NO SAAS**.

Resultado:
- jsPDF 4.2.1;
- jsPDF-AutoTable 5.0.8;
- CRITICAL jsPDF eliminado;
- regressão automatizada 7/7 PASS;
- Application CI/Core/Recovery/Legal/Build/TypeScript/Diff PASS;
- inspeção visual fina reclassificada como não bloqueante;
- impacto MOBILE-R1: **DELTA COMPATÍVEL**.

PR #244:
- CLOSED;
- não mergeado diretamente;
- integração semântica já materializada na integradora SaaS.

#### HARDEN-A2

Na auditoria atual:
- branch encontrada: **NENHUMA**;
- PR encontrado: **NENHUM**;
- estado: **AINDA NÃO INICIADA**.

Escopo futuro:
Firebase / Firestore / gRPC.

Qualquer avanço da A2 exigirá nova reconciliação antes do PASS FINAL da MOBILE-J.

#### HARDEN-B

Permanece:
**PARCIAL — DEPENDÊNCIA TEMPORAL LEGÍTIMA**.

Pendentes:
- primeiro backup READY;
- recovery:verify;
- restore real isolado com autorização explícita.

Impacto funcional Mobile:
**SEM DELTA**.

### CT-01

Mobile:
`camera=(self), microphone=(), geolocation=()`.

SaaS:
`camera=(), microphone=(), geolocation=()`.

Classificação:
**PREEXISTENTE / CONHECIDA / OBRIGATÓRIA PARA O FUTURO RC**.

A MOBILE-J não deve corrigir CT-01 por conta própria.

### Classificação corrente

MOBILE-J:
**PARCIAL TECNICAMENTE SAUDÁVEL / CERTIFICAÇÃO EM EXECUÇÃO**.

Razões:
- desenvolvimento funcional encerrado;
- baseline automatizado verde;
- branch de certificação sem delta runtime;
- HARDEN-A1 resolvida;
- HARDEN-B não bloqueia execução física;
- HARDEN-A2 ainda não começou;
- evidência física continua pendente;
- reconciliação SaaS final continua pendente para PASS FINAL.

Não declarar PASS FINAL antes das evidências físicas e da última reconciliação upstream.
