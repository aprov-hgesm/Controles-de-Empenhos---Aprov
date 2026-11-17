# Portal hospitalar — Firebase Hosting independente

Este diretório é **exclusivo** do sistema de dietas hospitalares e não substitui o `firebase.json` do EMPROVEX.

**Memorial canônico do produto e última auditoria de fluxo:** [Cozinha Dietética — Memorial Oficial](../../docs/cozinha-dietetica/MEMORIAL_OFICIAL.md). Inclui a experiência da Unidade, recebimento, produção, distribuição, auditoria, avanços testados e pendências reais sem etapas burocráticas adicionais.

## Objetivo imediato

Configurar o site Firebase Hosting vinculado ao projeto `cozinha-dietetica`, preservando o Cloud Run privado `cozinha-dietetica-qa` e os recursos financeiros do EMPROVEX.

O produto será preparado para operar com dados hospitalares reais por meio de autenticação, autorização por organização/unidade e APIs próprias. **Primeiros testes publicados: dados sintéticos**; não se trata de uma trava que limita a aplicação a `qa_*`.

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
