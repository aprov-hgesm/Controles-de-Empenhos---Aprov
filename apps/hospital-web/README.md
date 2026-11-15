# Portal hospitalar — Firebase Hosting independente

Este diretório é **exclusivo** do sistema de dietas hospitalares e não substitui o `firebase.json` do EMPROVEX.

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

**Não execute `firebase deploy` na raiz do monorepo.** Use somente o diretório `apps/hospital-web`, depois que o frontend tiver sido compilado e o backend hospitalar estiver autenticado e operacional. A configuração atual contém **somente** o Hosting estático; nenhum rewrite para `cozinha-dietetica-qa` foi adicionado. O deploy de um frontend vazio ou de fachada não é a finalidade desta etapa.

Depois da etapa de build e gateway, a publicação autorizada será:

```powershell
cd apps/hospital-web
firebase.cmd deploy --only hosting:hospital-web --project cozinha-dietetica
```

**Status atual:** configuração e provisionamento preparados; a URL publicada só deve ser informada depois da execução e verificação de HTTPS e fluxos reais. Não há autorização para publicar dados ou prontuários de pacientes por esta operação de configuração.
