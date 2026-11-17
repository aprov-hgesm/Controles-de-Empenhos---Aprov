# Portal hospitalar — Firebase Hosting independente

Este diretório é **exclusivo** do sistema de dietas hospitalares e não substitui o `firebase.json` do EMPROVEX.

**Memorial canônico do produto e última auditoria de fluxo:** [Cozinha Dietética — Memorial Oficial](../../docs/cozinha-dietetica/MEMORIAL_OFICIAL.md). Inclui a experiência da Unidade, recebimento, produção, distribuição, auditoria, avanços testados e pendências reais sem etapas burocráticas adicionais.

## Objetivo imediato

Configurar o site Firebase Hosting vinculado ao projeto `cozinha-dietetica`, preservando o Cloud Run privado `cozinha-dietetica-qa` e os recursos financeiros do EMPROVEX.

O produto será preparado para operar com dados hospitalares reais por meio de autenticação, autorização por organização/unidade e APIs próprias. **Primeiros testes publicados: dados sintéticos**; não se trata de uma trava que limita a aplicação a `qa_*`.

## Publicação via chat — identidade GitHub exclusiva e temporária

É necessário configurar **uma única vez** a federação GitHub → Google Cloud no projeto hospitalar.
Usar o Cloud Shell com o clone do repositório na branch hospitalar:

```bash
cd "$HOME/CozinhaDietetica-F0"
git pull --ff-only
bash ops/hospital-f0-provision-github-wif.sh
```

O script valida o número do projeto `947369899527`, configura a conta de serviço
`hospital-hosting-deployer@cozinha-dietetica.iam.gserviceaccount.com`,
o pool `hospital-github` e o provedor `hosting-promotion`.
A autenticação OIDC é restrita aos IDs permanentes do repositório GitHub e do proprietário,
ao workflow hospitalar, ao evento `push` e aos refs autorizados (branch hospitalar e `main`).

Concede somente `roles/firebasehosting.admin`, `roles/serviceusage.apiKeysViewer`
e `roles/run.viewer` **no projeto hospitalar**; `roles/iam.workloadIdentityUser` é
concedido na conta de serviço somente para o repositório autorizado.
Não cria chaves privadas, acesso de escrita à API Cloud Run, Firebase Auth, Firestore ou EMPROVEX.
O papel Hosting Admin é limitado ao **projeto hospitalar**, não a um único site.

**O provisionamento não publica o site.** A publicação exige um commit que altere
exclusivamente `ops/hospital-f0-hosting-promotion-request.json` após
autorização explícita pelo chat, indicando SHA de código, motivo e destino.
O workflow `.github/workflows/hospital-f0-hosting-promote.yml` verifica pedido
e ator, reexecuta testes sintéticos, compila com a configuração pública oficial
e publica somente o Hosting. Valida o site e o proxy clínico e, se falhar
após iniciar o deploy, tenta restaurar a versão anterior via API REST.

**Estado:** arquivos preparados no GitHub; identidade ainda não comprovada como
provisionada até aparecer `SUCESSO: identidade de publicacao configurada` no Cloud Shell.
A primeira promoção deverá também confirmar na prática o uso do Firebase CLI com WIF.

## Publicação pelo Google Cloud Shell (Linux / Bash)

O terminal em `shell.cloud.google.com` **não é** PowerShell do Windows: não usar
`npm.cmd`, `powershell.exe`, `$LASTEXITCODE` ou caminhos `C:\\...`.

No Cloud Shell, autentique primeiro o acesso ao repositório GitHub privado
(com a conta autorizada). Faça checkout **somente** da branch hospitalar:

```bash
git clone --single-branch --branch feat/cozinha-dietetica-f0-firebase-hosting-20261115 \
  https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov.git \
  "$HOME/CozinhaDietetica-F0"
cd "$HOME/CozinhaDietetica-F0"
bash ops/hospital-f0-publish-cloud-shell.sh
```

O publicador extrai os módulos hospitalares em Linux, busca a configuração
**pública** do app Firebase Web `cozinha-dietetica`, compila o frontend, configura
o alvo `hospital-web` e faz deploy **somente desse Hosting**, nunca da API,
Firestore, QA ou EMPROVEX. Se o Firebase CLI ainda não estiver autenticado,
ele exibirá a orientação `firebase login --no-localhost`.

Se a pasta já existir em uma sessão posterior, use `cd ...; git pull --ff-only`
e depois repita apenas o comando `bash ops/hospital-f0-publish-cloud-shell.sh`.
Não colocar tokens GitHub, chaves de serviço ou senhas no script ou no chat.

## Começar pelo PowerShell

No terminal com `git`, `gcloud` e `firebase` disponíveis, na raiz do repositório:

```powershell
.\ops\hospital-f0-setup-hosting.ps1
.\ops\hospital-f0-setup-hosting.ps1 -Provision
```

O primeiro comando faz verificação **somente leitura** e mostra a situação da conta, projeto, sites e serviço privado. O segundo cria o SITE_ID técnico `cozinha-dietetica-web` (se ainda não existir) e associa o destino `hospital-web` **neste diretório**, sem publicar arquivos e sem alterar regras de banco.

Pode trocar `-SiteId cozinha-dietetica-web` por outro ID disponível. O ID técnico não é necessariamente o nome comercial final.

## Publicação

**Não execute `firebase deploy` na raiz do monorepo.** Use somente o diretório `apps/hospital-web`, depois que o frontend tiver sido compilado e o backend hospitalar estiver autenticado e operacional. A configuração atual contém o frontend estático e um rewrite **somente** de `/api/hospital/**` para o serviço dedicado `cozinha-dietetica-api` em `southamerica-east1`. O serviço privado `cozinha-dietetica-qa` nunca é exposto por esse rewrite. O deploy funcional exige que a nova API tenha sido compilada e implantada, com autenticação/organização verificadas.

Depois da etapa de build e gateway, a publicação autorizada será:

```powershell
cd apps/hospital-web
firebase.cmd deploy --only hosting:hospital-web --project cozinha-dietetica
```

**Status atual:** configuração e provisionamento preparados; a URL publicada só deve ser informada depois da execução e verificação de HTTPS e fluxos reais. Não há autorização para publicar dados ou prontuários de pacientes por esta operação de configuração.

## Configuracao automatica do aplicativo Web Firebase existente

O Firebase Web App **Cozinha Dietetica** do projeto `cozinha-dietetica` ja foi localizado. Em vez de copiar a API key manualmente, na raiz do repositorio execute:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\ops\hospital-f0-configure-web.ps1 -Build
```

O script usa `firebase apps:sdkconfig WEB` para obter apenas a configuracao publica do aplicativo Web (ID `1:947369899527:web:d2da054f7b9ce707195ca2`), valida os identificadores e grava `apps/hospital-web/.env.local`, que e ignorado pelo Git. O ID da organizacao pode ser digitado na interface ou passado como `-OrganizationId` se ja estiver configurado. Nenhum segredo IAM, conta de servico ou dado clinico e incluido.

**Nao execute firebase deploy apenas por ter o build.** O novo Cloud Run `cozinha-dietetica-api`, a autorizacao do Firebase Auth e a integracao Hosting/API precisam estar operacionais e verificados primeiro. O script acima nao faz deploy.

## Compilação do frontend real

Na raiz do repositório, execute `powershell.exe -ExecutionPolicy Bypass -File .\ops\hospital-f0-extract-web.ps1`, depois `cd apps/hospital-web`, copie `.env.example` para `.env.local` e preencha exclusivamente o `apiKey` e `appId` públicos do app Web Firebase de `cozinha-dietetica`. Execute `npm.cmd install` e `npm.cmd run build`. Esses arquivos são gerados no diretório independente, sem compilar os módulos financeiros.

O backend próprio está em `apps/hospital-api`, com extração por `ops/hospital-f0-extract-api.ps1`. Não use `firebase deploy` antes de ter API real acessível e validada.
