# WORKER 4 — CLOUD-RUN-R1
## PREPARAÇÃO TÉCNICA — ISOLAMENTO, ADC, CONTÊINER E TESTES LOCAIS

**MISSÃO AUTORIZADA PELO FUNDADOR EM 2026-10-15**
**ESCOPOS AUTORIZADOS: GitHub (branch isolada/PR DRAFT) e testes locais totalmente isolados.**
**MIGRAÇÃO, SERVIÇOS CLOUD, PRODUÇÃO, DNS, IAM E DADOS REAIS: NÃO AUTORIZADOS.**

Repositório: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov
Produto: EMPROVEX — Next.js 15 / React 19 / Firebase Auth + dois bancos Firestore nomeados / Warehouse.
Coordenação e memorial: docs/EMPROVEX_MEMORIAL_OFICIAL.md, PR #317.
Auditorias: W1 PR #316, W2 PR #318, W3 PR #319.
Baseline auditada pelos workers: main@2b1241fe3abd96c67766caf065d24a4b2a223b98. **Verifique HEAD vivo da main antes de agir.**

## 1. RESULTADO ESPERADO

**Preparar tecnicamente uma futura homologação isolada do EMPROVEX para Cloud Run, sem realizá-la.**

Entregar em branch técnica própria:
1. Avaliação e reconciliação semântica de PRs #286 e #289 versus HEAD atual da main.
2. Proteções explícitas **fail-closed** para impedir que builds/execuções de homologação/testes no destino Cloud Run usem acidentalmente o Firebase e os bancos de produção.
3. Camada de aquisição de tokens server-side preparada para Google Cloud Run **Application Default Credentials / identidade gerenciada**, com preservação estrita dos contratos administrativos e de autorização. Não exigir JSON de chave privada no Cloud Run; a Vercel em produção pode manter o mecanismo antigo até migração autorizada.
4. Testes negativos/isolados dessa camada e dos ambientes; executar suites relevantes sem chamadas reais à produção.
5. Contêiner Docker para Next.js standalone, apenas se possível de forma segura e verificável localmente, com .dockerignore e smoke de inicialização isolado; nenhuma imagem deve ser publicada em registry externo.
6. PR DRAFT com evidências, riscos remanescentes e handoff.

É uma etapa de **implementação local controlada**, não mais uma auditoria apenas documental. Priorize correção real e solução enxuta; não duplicar ferramentas ou produzir 12 relatórios quando um handoff objetivo bastar.

## 2. RESTRIÇÕES ABSOLUTAS — NÃO NEGOCIÁVEIS

PROIBIDO:
- Merge na main; deploy Vercel/Cloud Run; preview remoto; criar projeto Firebase/GCP; criar contas de serviço, chaves, Artifact Registry, WIF, Secret Manager, Cloud Scheduler, Cloud Run ou outros recursos faturáveis.
- Alterar DNS, domínio emprovex.com.br, OAuth, IAM, Rules vivas, dados, Firestore real, billing, cron da Vercel, variáveis Vercel ou configuração administrativa de produção.
- Utilizar credenciais verdadeiras de produção em testes, exportar JSON de conta de serviço, logs com segredos, capturas de dados pessoais ou requisições contra produção.
- Rodar qualquer teste que escreva dados reais, que dependa de autenticação de usuário real ou que possa disparar Cloud APIs remotamente.
- Desabilitar segurança, substituir IDs reais por (default), flexibilizar Rules, criar fallback inseguro do fast-path, enfraquecer isolamento multi-workspace ou mascarar erro com falso PASS.
- Misturar PRs de outros workers indiscriminadamente ou introduzir mudanças funcionais de Warehouse/billing fora do necessário à preparação de infraestrutura.
- Rodar o endpoint GET /api/central-depositos/status em contas reais como smoke read-only: a auditoria W3 demonstrou que pode atualizar claims Firebase Auth.

PERMITIDO:
- Criar/editar código, Dockerfile, testes, scripts e documentação necessários **somente em branch própria**.
- Instalar dependências e executar testes locais **somente com fixtures, stubs, mocks e Firebase Emulator**, após comprovar que a execução não alcançará Firebase produtivo nem endpoints de escrita externos.
- Trabalhar com credenciais fictícias não funcionais em testes.
- Abrir PR DRAFT com testes proporcionais ao risco; não fazer merge ou deploy.

Se algum passo exigir infraestrutura, alteração administrativa, acesso real, pagamento ou outra autorização, **pare esse passo**, documente e continue apenas o que for seguro no GitHub/local. A autorização presente não se estende a esses itens.

## 3. PRIMEIRO GATE — RECONCILIAR #286 E #289

Confira:
- PR #286 — DRAFT, HEAD observado 906eddacda7d1b788c3404bb5ccdd744b2409071, baseado em release antigo.
- PR #289 — DRAFT, HEAD observado 78dc23bb460059a83bd9ab3b18964bbe1a051222, que depende do #286 e contém lógica preliminar de isolamento de Preview. **Nenhum faz parte automaticamente da main.**
- A main atual já publicou evoluções posteriores no site. Não reintroduzir APIs/rotas antigas, nem regressar às versões anteriores da interface Warehouse.
- Ler docs/RC_R1_PREVIEW_FIREBASE_ISOLATION.md na ref do PR #289. Estudar lib/firebaseEnvironment.mjs, lib/firebaseRuntimeConfig.ts, next.config.ts e testes de preflight antes de escrever nova lógica.
- Comparar diffs semanticamente e relatar quais ideias/casos de teste são reutilizáveis, quais colidem com o código atual e quais devem ser descartados. **Não fazer cherry-pick/merge automático.**
- Distinguir o estado Vercel Preview e o novo alvo Cloud Run: variáveis como VERCEL_ENV não existem automaticamente no Cloud Run. O alvo exige detector explícito e inalterável de ambiente via configuração protegida; não confiar só em nomes NEXT_PUBLIC_ fornecidos por usuário.
- Projetar um contrato de configuração que impeça desacordo entre client SDK, Firebase Admin/REST, projeto, bancos e identidade; considerar os dois bancos nomeados no projeto real e dois bancos de TESTE isolados no futuro. Não reutilizar projeto produtivo no teste.

Produzir pequena tabela «arquivo/diferença/decisão/justificativa/prova» para a coordenação.

## 4. BLOQUEADOR R04 — ISOLAMENTO FAIL-CLOSED (PRIORIDADE P0)

Implementar verificações reutilizáveis e testáveis que, em contexto de homologação Cloud Run ou teste, recusem iniciar/gerar build/requisitar dados se:
- Config Firebase público aponta para projeto, app, authDomain ou banco de produção.
- Existe configuração pública parcialmente preenchida, bancos misturados, projeto incorreto, identidade Admin com project_id incompatível ou qualquer fallback silencioso para produção.
- Existe variável pública sensível, private_key, JWT, token de serviço, segredo ou JSON Admin no bundle; secrets ficam server-only.
- Um módulo usa IDs hardcoded da produção enquanto outro módulo usa override de teste.
- Não está comprovado que homologação seja distinta do projeto e dos bancos de produção.

Modelo desejado: identificar ambiente/objetivo claramente, exigir configuração isolada completa, validar consistência por build/runtime e nunca transformar ausência de config em conexão produtiva. **Production atual continua com comportamento preservado**, sem exigir novas variáveis em Vercel.

- Fazer testes negativos para projeto real em ambiente de teste, mistura de bancos, admin do projeto errado, config ausente ou variável alterada no build.
- O critério remoto de «sem acesso a produção por IAM» ainda depende de infraestrutura/administradores; **não declarar R04 resolvido só com teste local**.
- Nenhum teste com Firebase real. No Emulator, usar IDs sintéticos e verificar que o código não consegue escapar para endpoints externos.

## 5. BLOQUEADORES R01/R02 — TOKEN VIA ADC E SEGURANÇA

Rastrear e adaptar com mínimo delta os caminhos com JSON obrigatório:
- lib/server/sectorProvisioningAdmin.ts
- lib/server/firebaseAuthBackup.ts
- lib/server/googleCloudMonitoring.ts
- lib/server/globalUsageHistory.ts
- app/api/central-depositos/intake-action/route.ts
- Outros módulos que consomem getGoogleAccessToken/Identity Toolkit/Firestore REST.

Implementar camada de acesso a **Google OAuth access token** adequada ao Cloud Run com identidade gerenciada/ADC, testável por injeção de dependência, sem credenciais permanentes para o novo runtime.
- Separar Firebase ID token do usuário, OAuth access token para APIs Google e OIDC de invocação do serviço/cron. Não confundi-los.
- Verificar projectId/banco para todos os caminhos REST. Preservar autorização por founder, UID, workspace, UG, permissão, idempotência e isolamento multi-tenant.
- Preservar o caminho JSON existente na Vercel **sem exigir alteração de produção** e sem vazar segredos. Novo caminho ADC deve ser habilitado apenas por configuração segura/ambiente autorizado, com resposta explícita e fechada em credencial ausente/erro 403.
- Não conceder roles IAM nesta fase: a auditoria administrativa encontrou contas existentes, incluindo emprovex-provisioner, monitoring-reader e Firebase Admin SDK, mas ainda não certificou o desenho mínimo futuro.
- Testar credencial ausente, escopo errado, projeto divergente, token expirado, 401/403, acesso cross-workspace e falha de rede. Testes devem ser 100% mocks/Emulator.
- Não executar fluxo Admin real nem escrever no Firestore real.
- **Não declarar R01/R02 encerrados** sem teste posterior sob identidade Cloud Run e IAM efetivo em projeto isolado.

## 6. GATES DE WAREHOUSE / REGRESSÃO FUNCIONAL

Sem alterar lógica de negócio por conveniência, executar suites locais seguras para:
- F05: alocação REST/preconditions, replay idêntico/divergente, 409/412, persistência conjunta/ledger/lote/saldo.
- F06: transferência mesma/diferente chave, planejamento de lote anterior à transação e race tests de Emulator.
- F09: consumo imediato e retirada multi-linha são **diferentes**; evitar alegar atomicidade global da retirada. Injeção de falha sequencial só com fixture isolada.
- Multi-workspace, permissions, rejeição de acesso ao banco/projeto errado.
- Gestão de Empenhos, PDFs, relatórios, autenticação externa, Mobile/Scanner e visual devem permanecer com contratos atuais. Não rodar browser sobre produção.
- Segurança, Core Protection, Recovery Guardrails e Application CI pertinentes.

A W3 constatou que GET /api/central-depositos/status pode modificar claims; W3-R19 deve ser considerado ao projetar smoke, sem efetuar chamada produtiva. O cron pode retornar ok:true e persisted:false: **NÃO** alterar cron Vercel agora; registrar contrato para fase Scheduler.

**Importante:** next build atual ignora erros TS/ESLint; build PASS sozinho não prova segurança. Usar testes de tipo/lint/gates explícitos e relatar qualquer budget preexistente sem «passar pano».

## 7. CONTAINER NEXT STANDALONE — SOMENTE LOCAL

Se os gates de isolamento estiverem estabelecidos:
- Criar Dockerfile multi-stage de Node suportado, npm ci, output standalone + .next/static + public, user não-root, listen em 0.0.0.0/PORT, sinais de término e sem chaves no build/contexto.
- Criar/validar .dockerignore protegendo .env*, JSON de service accounts, .git, logs, caches e arquivos de dados.
- Validar build com Docker Desktop/WSL **local**, sem push e sem deployment.
- Smoke local com variáveis deliberadamente sintéticas / endpoints mocks/Emulator. Não expor contêiner à rede pública nem conectar prod por fallback.
- Medir dados básicos de startup, tamanho da imagem e falha segura de configuração. Registrar "NÃO EXECUTADO" se Docker não estiver disponível, sem inventar PASS.
- Não criar Firebase Hosting, Load Balancer, Scheduler ou arquivos de produção (terraform/infra) nesta missão.

## 8. ECONOMIA E PRÁTICA

Prioridade: correção real, menos burocracia e **zero chamadas Firestore de produção**.
- Não executar suites pesadas desnecessárias; usar workflow focal antes do full CI.
- Aproveitar componentes e testes existentes do #289 somente se semanticamente compatíveis com main atual.
- Não adicionar dependência pesada sem justificar. Não converter client SDK para Admin indiscriminadamente.
- Registrar leituras, simulações e impacto de latência/custo somente em dados sintéticos; não inferir custos reais.
- Evitar reformatar grandes arquivos ou alterar os visuais do EMPROVEX.

## 9. ENTREGA GITHUB

1. Confirmar HEAD real da main; abrir branch isolada sugerida: feat/cloud-run-r1-w4-local-preparation (ajustar se já existente).
2. Não usar branch #317 como base de código; consultar os documentos de PRs #316/#318/#319 pelas refs específicas.
3. Commits pequenos e coerentes; preservar o app publicado. Alterar apenas arquivos necessários.
4. Abrir **PR DRAFT**, sem merge, apontando para main.
5. Anexar ao PR um único relatório em docs/audits/cloud-run-r1/worker-4/HANDOFF.md com tabela de arquivos, evidências e riscos restantes.
6. Explicitar os resultados: testes executados, PASS/FAIL/NÃO EXECUTADO, logs sanitizados, SHA, recursos externos não tocados, limites de cobertura e check-list de release futuro.
7. NUNCA transformar esta autorização em aceite de mudança produtiva.

## 10. GATES E HANDOFF FINAL

Critério de conclusão de W4: patch isolado revisável + testes locais focais + documentação clara do que está preparado e do que depende de credenciais/infra. Se alguma adaptação exigir alterar semântica de autorização ou bancos reais, **bloquear** essa parte e pedir ao Coordenador decisão técnica; não forçar.

Classificação final permitida:
- "PREPARAÇÃO LOCAL PASS — HOMOLOGAÇÃO CLOUD AINDA NÃO AUTORIZADA";
- "PREPARAÇÃO PARCIAL — DEPENDÊNCIAS EXTERNAS/TESTES PENDENTES";
- "BLOCKER — NÃO PROMOVER".

Handoff obrigatório:
**ONDE ESTAMOS / O QUE ESTAMOS FAZENDO / QUEM ESTÁ FAZENDO / O QUE FAZER A SEGUIR / QUEM O FARÁ**
+ PR DRAFT, branch, HEAD, arquivos alterados, testes, R01/R02/R04 remanescentes, dependências do Fundador para criar projeto de testes e Cloud Run, sem pedir segredos.

**INICIE A PREPARAÇÃO TÉCNICA AUTORIZADA. NÃO EXECUTE DEPLOY. NÃO TOQUE NA PRODUÇÃO.**
