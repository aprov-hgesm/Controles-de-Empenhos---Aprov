# CLOUD-RUN-R1 — W8: primeiro build e pacote Cloud Run QA

**Data:** 2026-10-16  
**Estado:** preparação e auditoria automatizada, **NÃO há deploy**, **NÃO há liberação de startup**, **produção intocada**.

## Objetivo
Reduzir auditorias administrativas repetidas e concentrar as próximas entregas no **build real do EMPROVEX para Cloud Run em QA**, depois no **deploy privado** mediante novo gate explícito de segurança. Herda código W4 → W5 → W6 → W7; **base deste PR: branch W7**, não `main`.

## Entregas
- `scripts/cloud-run-qa-build-preflight.mjs`: executa o **gate W4 real** de isolamento de código usando configuração **sintética** do Web App, mantendo IDs QA reais de projeto e bancos. Não acessa Firebase/GCP e nunca usa credenciais. Gera `cloud-run-qa-build-preflight-report.json` e resumo CI com **caminhos de arquivos** bloqueadores, sem transcrever IDs/configs de produção. O job termina com êxito se conseguiu executar a AUDITORIA; `status=BLOCKED` **não é PASS de aptidão para build**.
- `Dockerfile.cloud-run.qa`: multi-stage Node 22 + Next `standalone`, escopo de build restrito a QA; build deve passar o gate W4 + artefato. Runtime mantém `instrumentation.ts` bloqueando `K_SERVICE`: **proibido deploy** sem nova certificação e autorização.
- `scripts/cloud-run-qa-artifact-audit.mjs`: varre partes textuais do artefato Next para impedir inclusão de Firebase `projectId`, database ID, app ID ou public API key produtivos. Falha sem imprimir esses identificadores. Não confundir verificação de artefato com verificação dinâmica de autenticação.
- `.github/workflows/cloud-run-qa-build-preflight.yml`: sempre faz auditoria **sem dependências/npm ci**; salva relatório curto como artifact 7 dias; **somente tenta Docker build** quando `source_ready=true` **e** variável de repositório `EMPROVEX_QA_FIREBASE_WEB_CONFIG_JSON` foi configurada com app **real QA**. Não publica imagem em registro, não cria serviço Cloud Run, sem IAM/credenciais, sem merge. O build real continua condicionado à prova R01/R02/R04 e aos gates de CI.

## O que sabemos sobre a infraestrutura
QA `emprovex-qa-r1-261015-6275`, bancos nomeados `qa-core` e `qa-warehouse`. Identidade `emprovex-qa-runtime@emprovex-qa-r1-261015-6275.iam.gserviceaccount.com` teve leituras reais HTTP 200 dos dois bancos por token temporário (positivos PASS). FirebaseProject QA registrado em 16/10; painel Firebase Authentication ainda sem provedores de login ativados; Rules isoladas W7 apenas propostas em branch, **não publicadas**. Teste de acesso negativo, bundle scanning real e isolamento R04 pendentes.

## Gates e NO-GO
A leitura positiva em QA não substitui teste de negação. GCP QA budget mensal R$20 **não é teto**. W4 runtime lock `CLOUD_RUN_RUNTIME_NOT_CERTIFIED_R01_R02_R04` intocado. Nenhum deploy real autorizado nesta execução, nem `gcloud run deploy`, WIF, Artifact Registry, DNS, Vercel, migração de bancos, edição de `main` ou alterações no projeto GCP produtivo. Para permitir o **primeiro deploy privado de QA**, obter primeiro config real do Web App, autenticação e Rules QA, prova de isolamento negativo, build que não contenha identificadores produtivos, segurança de invocation e nova autorização específica do Fundador.

## Evidência build-first e correção do vazamento de baseline

- **Primeiro Next build sintético (run [#38854051361](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38854051361))**: `SOURCE_GATE_PASS`, Next 15.5.24 compilou em 29 s, gerou **42 páginas estáticas**, mas scanner `QA_ARTIFACT_NOT_ISOLATED: 8 paths`, incluindo bundle client. O workflow original permitia `continue-on-error`; isso foi corrigido depois para **gate estrito**.
- **Origem encontrada:** a importação legítima do `firebase-applet-config.json` no resolver de produção era embutida também nos bundles QA. Implementada `NormalModuleReplacementPlugin` somente em `EMPROVEX_RUNTIME_TARGET=cloud-run-staging` dentro de `next.config.ts`, substituindo imports legados no **bundle** pelo stub `lib/firebaseCloudRunRedactedBaseline.json`. A importação real do baseline em `next.config.ts` continua executada fora do webpack para o gate de comparação W4. Na Vercel/legacy o plugin não atua.
- **Segundo Next build sintético (run [#38854546136](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38854546136))**: compilação **PASS**, **42 páginas**, scanner reduziu de **8 → 1**: só a cópia de `firebase-applet-config.json` em `.next/standalone/`; nenhum chunk server/browser listado como contendo o baseline produtivo.
- **Ajuste final em validação:** `scripts/cloud-run-qa-trim-legacy-build-file.mjs` remove apenas essa cópia **do pacote de build QA**, depois de validar conteúdo idêntico ao arquivo de origem e projeto `emprovex-qa-r1-261015-6275`. O arquivo de origem permanece intacto. `scripts/cloud-run-qa-standalone-smoke.mjs` exige boot HTTP local 2xx/3xx do Next standalone **sem o arquivo legado**, no localhost `127.0.0.1:8877`, sem `K_SERVICE`, sem token nem credenciais. O CI W8 agora **falha** quando qualquer gate não passa, em vez de marcar falsamente o conjunto como verde.
- **Ainda não aprovado:** o resultado da nova rodada de scanner + boot smoke é obrigatório antes de declarar artefato QA seguro. Mesmo com PASS, a imagem sintetizada **não pode ser publicada**; falta Web App QA real, Auth/Rules, IAM negativo e liberação distinta do interlock Cloud Run R01/R02/R04.
- **Progresso oficial inalterado:** Segurança QA **68,75%**, migração geral **53,75%** até gate real no ambiente QA.

## Handoff
- **Onde estamos:** etapa 3 Segurança/Isolamento QA, **68,75%**, migração geral **53,75%** — números de referência conservadores, sem acrescer marcos pela mera criação do PR.
- **O que estamos fazendo:** preparar artefato e primeiro build QA com auditoria automatizada para apontar bloqueios concretos.
- **Quem está fazendo:** Worker W8 executa branch/CI; Coordenador revisa riscos e memorial; Fundador valida eventual integração QA no Firebase em atividade separada.
- **O que fazer a seguir:** avaliar relatório de source blockers no CI W8; corrigir referências de produção com segurança; cadastrar Web App QA para config pública real; configurar Auth/Rules; concluir isolamentos; construir imagem e testar startup controlado; solicitar autorização de deploy privado ao Fundador depois dos gates.
- **Quem o fará:** Worker W8 em GitHub; equipe QA para Auth/Rules e validações; Fundador para mudanças administrativas delimitadas.

### Histórico e links
[Coordenação PR #317](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/317) · [W4 #320](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/320) · [W5 #321](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/321) · [W6 #322](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/322) · [W7 #323](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/323).
