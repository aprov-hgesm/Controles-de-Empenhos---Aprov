# Preview Firebase isolado — candidata RC R1

## ONDE ESTAMOS

Branch rc-r1-preview-firebase-isolation-01, baseada na candidata #286 (906eddac). Não altera main nem freeze. Capturas do Fundador mostram variável administrativa apenas em Production e lista Project vazia no filtro Preview. Deployment #286 Ready, sem logs na última hora. Não prova a origem da tentativa anterior, nem inspeciona Shared variables ou valores efetivos de deployment antigo.

## O QUE ESTAMOS FAZENDO

Toda configuração Firebase de runtime passa por lib/firebaseRuntimeConfig.ts. Next.js marca o ambiente a partir de VERCEL_ENV e exige configuração completa e credencial do projeto separado antes de compilar Preview. UI, autorização Firebase, validação workspace, alocação, lifecycle, backups, métricas e billing consultam o mesmo projeto/bancos. Segredo administrativo permanece server-only.

Production/local sem override mantém baseline. Preview sem configuração, com projeto/domínio/bucket/chave pública/app produtivos, bancos unificados ou destinos Warehouse divergentes falha fechado. Não existe modo para liberar o projeto produtivo em Preview nesta candidata.

Configuração pública isolada NÃO prova Rules/IAM/cadastro/persistência/custos; os gates remotos permanecem pendentes. Pré-validação administrativa exige project_id e conta do projeto isolado. Nenhuma chamada OAuth/Firestore feita por essa validação.

## QUEM ESTÁ FAZENDO

Coordenador prepara código, testes, CI e documentação. Fundador/administrador precisa provisionar os recursos privados no Firebase/Vercel; esta sessão não possui ferramentas autorizadas para criar projetos GCP/Firebase nem acesso ao time Vercel profissional.

## O QUE FAZER A SEGUIR

### Recursos administrativos separados

1. Na conta profissional, abrir https://console.firebase.google.com/ e criar projeto exclusivo de teste. Nome sugerido EMPROVEX R1 Preview; anotar o projectId REAL, sem presumir que o nome sugerido é disponível. Não copiar os dados de produção.
2. Registrar app Web nesse projeto; obter configuração pública Firebase. Configuração pública contém apiKey do app Web, não chave privada administrativa. Habilitar Auth e provedores necessários para identidades fictícias; autorizar o domínio de Preview efetivamente usado. Não reutilizar usuários operacionais.
3. Criar banco principal e banco Warehouse distintos no projeto de teste. Sugestão: principal (default), Warehouse emprovex-warehouse. Verificar edição/compatibilidade, região e necessidade de billing antes da criação; ativar cobrança exige decisão específica. Não mudar edição/região/billing do projeto real.
4. Rules de TESTE devem corresponder às fontes do candidato, com auditoria do ruleset ativo nos dois bancos. Nenhum deploy de Rules deve usar o projectId real. Esta missão não executou publicação de Rules nem criação de bancos.
5. Criar conta de serviço apenas no projeto isolado, com acesso aos bancos de teste e funções Auth necessárias. Não conceder Owner, não vincular ao projeto real. Determinar IAM mínimo aplicável antes de conceder; nenhuma permissão exata é presumida como suficiente pelo preflight.
6. Se a política permitir chave, manter JSON administrativo apenas no gerenciador privado/Settings Vercel. Não compartilhar no chat ou GitHub. Configuração/key creation, Rules e deploy requerem autorização administrativa específica; código preparado não equivale a essas operações já realizadas.

### Duas variáveis, somente Preview e esta branch

No projeto Vercel controles-de-empenhos-aprov, time aprov-hgesms-projects:

- NEXT_PUBLIC_EMPROVEX_FIREBASE_CONFIG_JSON — tipo Config; target Preview; limitar à branch rc-r1-preview-firebase-isolation-01. JSON público completo do app Web, acrescido de firestoreDatabaseId e warehouseDatabaseId.
- FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON — tipo Secret; mesmo target/branch; JSON da conta do projeto ISOLADO. Production permanece intacta. Não copiar chave produtiva.

Modelo PÚBLICO, placeholders precisam ser substituídos pela configuração real do novo projeto:

```json
{
  "projectId": "PROJECT_ID_TESTE",
  "appId": "APP_ID_WEB_TESTE",
  "apiKey": "API_KEY_PUBLICA_WEB_TESTE",
  "authDomain": "PROJECT_ID_TESTE.firebaseapp.com",
  "firestoreDatabaseId": "(default)",
  "warehouseDatabaseId": "emprovex-warehouse",
  "storageBucket": "BUCKET_DO_PROJETO_TESTE",
  "messagingSenderId": "NUMERO_DO_PROJETO_TESTE"
}
```

measurementId é opcional. Não inserir private_key/client_email/token neste JSON público. Não configurar NEXT_PUBLIC_EMPROVEX_DEPLOYMENT_ENVIRONMENT manualmente: derivado de VERCEL_ENV no build. Não usar override legado Warehouse diferente do JSON.

### Pré-verificação e implantação

Em ambiente privado autorizado, com as variáveis carregadas por mecanismo seguro (não por linha de comando com valores):

```powershell
node scripts/firebase-preview-config-preflight.mjs
```

Preflight imprime apenas projeto/bancos e status CONFIG_VALID_ONLY_NOT_RUNTIME_CERTIFIED. Valida estrutura/projeto e chave RSA parseável sem autenticar remotamente. Sem IAM/Rules/Auth/saldos certificados.

A candidata vai recusar build Preview enquanto as duas variáveis não estiverem corretas. Essa falha de configuração é esperada e não invalida o CI local/Emulator. Após recursos e configuração autorizados, uma NOVA implantação Preview precisa ser autorizada e vinculada ao SHA exato. Não promover Production nem mergear esta candidata automaticamente.

### Reteste F05 condicionado

Conferir projeto/database IDs efetivos da UI e API, regras e IAM de teste, identidade/workspace/UG fictícios, ambos os destinos remotos separados de produção e SHA/deployment. Só depois preparar dados fictícios autorizados: dois depósitos/locais, material, NF e quantidades pequenas. Não importar documentos reais.

Antes/depois: intake, saldo agregado/físico, lote, movimento e histórico. Alocação única de 10 → movimento único e saldo 10; reload preserva. Reteste de replay apenas autorizado e não deve duplicar. Separação de projetos não prova ausência de vazamento por IAM: confirmar que a conta de teste não possui acesso ao projeto real. Registrar timestamps e evidência redigida.

## QUEM FARÁ

Fundador/administrador provisiona projeto/bancos/Auth/conta/configuração após aprovação específica. Coordenador audita fontes/regras/destinos e gates no SHA. Work/Fundador retestam navegação e F05 somente quando liberado. Novo freeze/GO posterior; Macroação 3 PARCIAL, Production NO-GO.
