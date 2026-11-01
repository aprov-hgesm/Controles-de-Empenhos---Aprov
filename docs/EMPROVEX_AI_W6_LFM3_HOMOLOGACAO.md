# EMPROVEX AI — W6 R0.1 — homologação isolada Cloud Run / LFM3

**Estado:** correção W6.1 em PR DRAFT #450, base PR #446. **Deploy do W6 ainda não realizado.**
**Diferenciação obrigatória:** código preparado e CI local/mock não significam homologação remota pronta; projeto Firebase de testes e IAM devem ser verificados antes do deploy.
Nenhuma promoção da `main`, alteração do Ollama ou de dados operacionais é autorizada por este memorial.

## Contrato de isolamento

- Projeto: `gen-lang-client-0982077967`; região `southamerica-east1`.
- **Novo serviço exclusivo:** `emprovex-ai-w6-homologation` (Cloud Run IAM privado, sem invocadores públicos, mínimo 0 e máximo 1 instância).
- **Serviço existente de inferência — somente invocação:** `emprovex-ai-inference`, modelo `lfm3:1.7b-q4_K_M`. Não alterar imagem, CPU, RAM, escala ou configuração do Ollama.
- Não usar os serviços existentes de produção, `emprovex-cloudrun-candidate` ou staging para validar o W6.
- **Identidade runtime já criada:** `emprovex-ai-w6-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com`, com `roles/run.invoker` exclusivo no serviço de inferência (informação fornecida na missão; confirmar IAM em leitura). **Não recriar.** Ela não deve receber acesso aos Firestores operacionais. Conceder somente as permissões de leitura estritamente necessárias no projeto isolado, se criado.
- Credencial Google: **ID token** de audiência restrita à inferência pelo Metadata Server; **OAuth access token** para W3 via Metadata Server somente no serviço W6, após conferir o e-mail exato da service account. Código produtivo `getGoogleAccessToken()` continua intocado. **Proibido** usar chave JSON.
- Para permitir a invocação privada, a identidade da candidata precisa ter `roles/run.invoker` sobre `emprovex-ai-inference`. **Verificar a política vigente; não modificá-la automaticamente.** Se a autorização estiver ausente, registrar bloqueio real e obter aprovação específica.
- Não incluir as variáveis de cobrança nem segredos financeiros de produção.

## Variáveis exigidas apenas na candidata

| Variável | Valor |
|---|---|
| `EMPROVEX_AI_W45_ENABLED` | `1` |
| `EMPROVEX_AI_HOMOLOGATION_ENABLED` | `1` |
| `EMPROVEX_AI_LFM3_ENABLED` | `1` |
| `EMPROVEX_AI_LFM3_URL` | URL HTTPS `*.run.app` **real** obtida de `emprovex-ai-inference`, sem caminho |
| `EMPROVEX_AI_W45_CONTEXT_SECRET` | segredo **exclusivo de homologação**, armazenado no Secret Manager |
| `EMPROVEX_AI_CURSOR_SECRET` | segredo exclusivo de homologação para as consultas paginadas do W3 |
| `EMPROVEX_AI_W6_FIREBASE_PROJECT_ID` | ID de projeto Firebase **real e distinto** de `gen-lang-client-0982077967`, com usuários exclusivamente sintéticos |
| `EMPROVEX_AI_W6_CORE_DATABASE_ID` | banco Firestore Core nesse projeto (p.ex., `(default)` quando criado) |
| `EMPROVEX_AI_W6_WAREHOUSE_DATABASE_ID` | banco Warehouse nesse projeto (p.ex., `emprovex-warehouse` quando criado) |
| `EMPROVEX_AI_LFM3_TIMEOUT_MS` | opcional: entre `5000` e `30000`; padrão `30000` |


`K_SERVICE`, `K_CONFIGURATION` e `K_REVISION` são injetadas pelo Cloud Run. A aplicação verifica nome exato do serviço, configuração e prefixo da revisão. Um deploy em outro serviço **não libera** `/api/emprovex-ai/ask` ou `/query`, mesmo com flags ativas.


## W6.1 — correções pontuais e contrato de falha fechada (01/11/2026)

- `lib/emprovex-ai/integration/w6Isolation.ts`: adaptador **exclusivo W6**. Exige identidade Cloud Run `K_SERVICE`/`K_CONFIGURATION`/`K_REVISION` correta, três variáveis de projeto/banco explícitas, projeto distinto do operacional, ausência de emuladores hospedados, ausência de `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` e `GOOGLE_APPLICATION_CREDENTIALS`. Configuração inválida gera `AI_W6_ISOLATION_NOT_CONFIGURED`, **sem fallback** para o projeto produtivo. Confere e-mail exato da identidade gerenciada antes de solicitar o OAuth access token ao Metadata Server. Separação entre OAuth W3 e ID token de invocação Ollama.
- `lib/emprovex-ai/authorize.ts`: apenas o caminho W6 usa `verifyW6FirebaseRequest()` (JWKS Google + `RS256`, emissor/audiência do **projeto de testes**, e-mail verificado, UID e provedor) e `getW6GoogleAccessToken()`. Validações de workspace, UG, vínculo UID, status, assinatura e limites dos contratos W3 **permanecem**. Outros ambientes continuam com o fluxo anterior.
- `lib/emprovex-ai/reader.ts`: URLs REST Core, consultas e leitura Warehouse da candidata apontam **exclusivamente** aos bancos do projeto de testes; retornos checados contra projeto, banco, workspace e UG. Fora de W6, transporte do Warehouse e Core permanecem inalterados. Não há leitura direta do modelo: W3 é o único executor.
- `lib/emprovex-ai/integration/lfm3.ts`: timeout de inferência 30 s (limite superior 30 s), sem retries; Metadata IAM separado em 1,8 s; `think=false`, `stream=false`, `temperature=0`, até 128 tokens e fallback seguro mantidos.

### Condições prévias da homologação remota — não presumir que já existam

1. **Projeto Firebase de testes independente** do EMPROVEX: Firebase Authentication habilitado para login e verificação de e-mail; permitir emissão de ID tokens RS256 reais para **usuários de teste**, não de produção. Não usar emulador no Cloud Run nem aceitar tokens fictícios.
2. **Duas bases no projeto de testes**, IDs informados explicitamente: Core e Warehouse (se houver testes C07/C08). Criar somente o que não existir; consultar a configuração real antes. Popular apenas fixtures sintéticas de pelo menos dois workspaces/UGs seguindo a PR #446, com diretório `platformAccounts`, `workspaces`, `billingAccounts`, itens operacionais e posições Warehouse. Não copiar dados reais.
3. **IAM mínimo entre projetos:** a service account W6 tem invocação do LFM3 no projeto de execução; no projeto **de testes**, somente acesso Firestore de leitura necessário para Core e Warehouse. Se as permissões não puderem ser limitadas a esses bancos/consultas por IAM, avaliar o escopo antes de conceder — nunca dar `Owner`, `Editor`, `datastore.owner` nem permissões no projeto operacional. A configuração do código **não substitui** uma conferência IAM efetiva de ausência de acesso aos dados reais.
4. **Serviço de homologação não herda** secrets de produção: somente dois secrets AI exclusivos (contexto e cursor) no Secret Manager e a configuração acima. O cliente web existente usa configuração Firebase produtiva; os primeiros testes remotos devem usar token do projeto Firebase de testes diretamente contra a API privada. Alteração da UI/client Firebase não está incluída na R0.1.

### PowerShell — implantação privada mínima (somente após confirmar as condições acima)

```powershell
$PROJECT = 'gen-lang-client-0982077967'
$REGION  = 'southamerica-east1'
$SERVICE = 'emprovex-ai-w6-homologation'
$SA      = "emprovex-ai-w6-runtime@$PROJECT.iam.gserviceaccount.com"
$TEST_PROJECT = '<ID_FIREBASE_TESTES_REAL>'
$CORE_DB = '<BANCO_CORE_TESTES>'
$WAREHOUSE_DB = '<BANCO_WAREHOUSE_TESTES>'
$INFERENCE_URL = (gcloud run services describe emprovex-ai-inference --project $PROJECT --region $REGION --format 'value(status.url)').Trim()
# Execute dentro do checkout da PR #450, com HEAD e CI conferidos.
# $IMAGE deve ser digest/tag IMUTÁVEL produzido especificamente desse HEAD,
# em um Artifact Registry autorizado; não reutilizar imagem/candidate de produção.
$IMAGE = '<IMAGEM_W6_1_IMUTAVEL>'
# Dois segredos distintos e já criados no Secret Manager:
$CONTEXT_SECRET = '<NOME_SECRET_W6_CONTEXT>'
$CURSOR_SECRET  = '<NOME_SECRET_W6_CURSOR>'
$deployArgs = @(
  'run', 'deploy', $SERVICE,
  "--project=$PROJECT", "--region=$REGION",
  "--image=$IMAGE", "--service-account=$SA",
  '--no-allow-unauthenticated', '--min-instances=0', '--max-instances=1',
  "--set-env-vars=EMPROVEX_AI_W45_ENABLED=1,EMPROVEX_AI_HOMOLOGATION_ENABLED=1,EMPROVEX_AI_LFM3_ENABLED=1,EMPROVEX_AI_LFM3_URL=$INFERENCE_URL,EMPROVEX_AI_W6_FIREBASE_PROJECT_ID=$TEST_PROJECT,EMPROVEX_AI_W6_CORE_DATABASE_ID=$CORE_DB,EMPROVEX_AI_W6_WAREHOUSE_DATABASE_ID=$WAREHOUSE_DB",
  "--set-secrets=EMPROVEX_AI_W45_CONTEXT_SECRET=$($CONTEXT_SECRET):latest,EMPROVEX_AI_CURSOR_SECRET=$($CURSOR_SECRET):latest"
)
& gcloud.cmd @deployArgs
if ($LASTEXITCODE -ne 0) { throw 'Deploy da candidata W6.1 falhou' }
# Conferir ao final: configuração da revisão, IAM privado e somente runtime W6.
# Nenhuma modificação de tráfego ou de serviços de produção.
```

**Nota PowerShell:** o comando usa splatting com array de argumentos, compatível com Windows PowerShell. Nunca copie placeholders literalmente para uma implantação; confirme previamente que a imagem foi gerada a partir do SHA exato da PR e que os secrets de homologação existem.

Para invocar o Cloud Run privado, use um chamador previamente autorizado no IAM da **candidata**, obtenha ID token com audience da URL dessa candidata e envie um segundo token Firebase do projeto **de testes** no cabeçalho HTTP esperado pelo endpoint; como ambos usam `Authorization`, a homologação remota pode exigir um proxy/gateway de teste autenticado ou a passagem do token Cloud Run por `X-Serverless-Authorization` (Cloud Run verifica IAM e encaminha o `Authorization` do usuário). Não habilitar invocação anônima apenas para simplificar o teste.

## Sequência mínima para homologação autorizada

1. Confirmar a PR #450 e o SHA de seu HEAD, e a certificação TypeScript + W6/W5 no GitHub.
2. Verificar em leitura a URL real de `emprovex-ai-inference`, a ausência de `emprovex-ai-w6-homologation` e o vínculo IAM `run.invoker` da nova identidade. Não mudar o serviço Ollama.
3. Construir a imagem **a partir do HEAD exato desta PR**, sem merge na `main`. Usar um tag/digest imutável e diferenciado dos releases de produção.
4. Com autorização GCP para esta PR e identidade separada, criar **apenas** `emprovex-ai-w6-homologation` com `--no-allow-unauthenticated`, sem domínio público próprio, escala 0–1, secrets independentes, sem tráfego dos serviços atuais.
5. Realizar teste privado autenticado com fixture sintética: a pergunta de fornecedor operacional ambígua deve acionar `MODEL_ELIGIBLE`, retornar a interpretação JSON do Ollama, passar pela validação W5, por `parseAiQuery()` e executar somente W3. **Não registrar prompts, ID tokens ou dados de clientes nos logs.**
6. Executar caso determinístico: `Quanto resta da NE 2026NE66?` (fixture). Esperado: `lfm3Calls=0`. Repetir modelo com endpoint artificialmente indisponível **somente na candidata**: esperado `fallback_unavailable`, zero consultas W3 via fallback.
7. Reutilizar a homologação de dois setores, Auth/Firestore emulados da PR #446; complementar com W6 usando a mesma fixture e confirmar separação de workspace, autenticação de tokens e rejeição de filtros não representáveis.
8. Documentar apenas evidências reais: revisão privada, SHA, status IAM, resultados e falhas. **Não promover para produção.**

## Bloqueios conhecidos

- A conexão disponível neste chat executa mudanças no GitHub, mas **não oferece API autenticada do GCP Cloud Run** para criar/verificar a candidata.
- Os fluxos GitHub WIF de release identificados estão vinculados à `main` e ao serviço candidato de produção. Não reutilizar nem ampliar automaticamente suas permissões para implantar esta branch DRAFT.
- A URL real do serviço de inferência, as permissões efetivas da identidade da nova candidata e o acesso a fixtures no ambiente privado ainda exigem verificação GCP.
- Testes sintéticos do cliente e regressões W3–W5 **não substituem uma chamada real de serviço para serviço no Cloud Run**.

**Critério de fechamento:** CI focal PASS + revisão privada operacional + IAM real PASS + execução sintética W4/W5 → LFM3 → W3 PASS + fallback e isolamento PASS. Até lá, manter DRAFT.
