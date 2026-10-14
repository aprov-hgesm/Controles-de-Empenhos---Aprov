# EMPROVEX R1 — diagnóstico administrativo do Preview (14/10/2026)

## ONDE ESTAMOS

PR #286 OPEN/DRAFT, HEAD 906eddacda7d1b788c3404bb5ccdd744b2409071; Core, Application e regressão de logout SUCCESS. Freeze 61e372225834ed6060cd2b36dbdd55d1e1979c2c intacto. Preview da candidata: https://controles-de-empenhos-aprov-git-rc-8f7c85-aprov-hgesms-projects.vercel.app . Deployment 6bekYkqKwV7mAYFt13J5YcHAsH2u. Associação atestada por status GitHub no SHA e comentário do bot; inspeção administrativa independente ainda pendente.

## O QUE ESTAMOS FAZENDO

Diagnóstico read-only do erro WAREHOUSE_FAST_PATH_SERVER_CONFIGURATION, sem alteração administrativa, requests mutáveis ou cópia de segredos. Conta profissional informada pelo Fundador; conexão ChatGPT sem acesso ao time correto. Não é necessário migrar/reconectar a propriedade GitHub/Vercel.

## QUEM ESTÁ FAZENDO

Coordenador: código, diffs, Actions, status de implantação e documentação pelo GitHub. Fundador: leitura administrativa na conta profissional da Vercel.

## O QUE FAZER A SEGUIR

### 1. Leitura mínima pelo Fundador

1. Entrar na Vercel com a conta profissional aprovisionada pelo Fundador e selecionar o time aprov-hgesms-projects.
2. Abrir https://vercel.com/aprov-hgesms-projects/controles-de-empenhos-aprov/settings/environment-variables .
3. Localizar FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON **sem revelar o valor**. Anotar apenas: existe ou não; possui target Preview; restrição de branch, se houver; foi adicionada/alterada antes ou depois da implantação da tentativa. Presença em Production não comprova presença em Preview.
4. Em Deployments, abrir a implantação que apresentou o erro. Conferir Environment=Preview, URL, branch e commit. A imagem recebida não contém URL; não assumir que a tentativa ocorreu no freeze ou na candidata #286.
5. Abrir Runtime Logs/Logs, selecionar a requisição já existente de /api/adm-deposito/intake-action, perto de 14/10 às 02:12 Fortaleza (05:12 UTC, horário aproximado do relato). Registrar status e apenas mensagens sanitizadas.
6. Se a implantação for do #286, procurar Warehouse intake service authorization failed e copiar SOMENTE code e reason. O freeze anterior não possui esse log adicional. Ausência de log específico em implantação antiga não confirma credencial ausente.
7. Não clicar novamente em Confirmar alocação para gerar diagnóstico. Se o log expirou ou inexiste, comunicar isso; preparar diagnóstico sem escrita após acesso/configuração adequados.

Resposta mínima, sem segredos:

- Implantação/branch/commit da tentativa:
- Variável existe: SIM/NÃO
- Escopo Preview: SIM/NÃO
- Restrição de branch:
- Alterada antes/depois da implantação:
- Status HTTP e code/reason sanitizados do log, ou LOG INDISPONÍVEL:

Não enviar JSON, private_key, token, Authorization, cookies ou capturas com valores revelados. Email/UID de usuário operacional não são necessários.

### 2. Interpretação baseada no código

| Mensagem sanitizada | Interpretação | Próxima verificação |
| --- | --- | --- |
| O provisionamento seguro ainda não está configurado no servidor. | Variável ausente/vazia no processo | target Preview, override de branch e data da implantação |
| A credencial administrativa do Firebase está inválida no servidor. | JSON não parseável | administrador valida formato no ambiente privado |
| A credencial administrativa do Firebase está incompleta no servidor. | client_email/private_key ausentes ou vazios | administrador valida estrutura sem divulgar conteúdo |
| A credencial administrativa pertence a outro projeto Firebase. | project_id declarado difere do código | confrontar projeto do deployment; não copiar Production |
| Não foi possível autorizar o serviço administrativo do Firebase. | Emissão OAuth não retornou token válido | verificar identidade/chave/revogação/política em ambiente autorizado |
| WAREHOUSE_FAST_PATH_UPSTREAM_PERMISSION | Firestore recusou acesso depois da emissão do token | verificar IAM efetivo no banco/projeto, sem ampliar permissões cegamente |

Na rota auditada, SERVER_CONFIGURATION ocorre antes de performAllocation/commit. Falta de permissão Firestore normalmente gera UPSTREAM_PERMISSION, código distinto; não atribuir automaticamente o erro observado a IAM. Chave PEM inválida ou exceções não classificadas podem gerar UNAVAILABLE, não necessariamente SERVER_CONFIGURATION. O teste de UI não confere sozinho ausência de writes; histórico/saldos precisam de conferência autoritativa.

### 3. Alteração administrativa posterior, condicionada a autorização específica

Diagnóstico separado de correção. Não editar variável ou redeploy nesta missão. Depois da causa comprovada e do destino dos dados auditado, preparar alteração restrita ao Preview/branch aplicável, usando credencial adequada ao ambiente e permissões necessárias. Não mexer em Production nem criar/copiar chave ampla sem aprovação. Alteração de variável não muda retroativamente deployment já criado; nova implantação precisa ser explicitamente autorizada e ter SHA conferido.

### 4. Reteste F05

Antes da primeira escrita:
- confirmar deployment ID/SHA e destino Firebase da UI e API; não basta rótulo Preview;
- confrontar projeto/banco principal/Warehouse, Rules ativas, IAM administrativo e workspace/UG/identidades fictícias;
- atenção: no RC a rota intake-action fixa projeto/bancos pelo JSON e Warehouse em emprovex-warehouse; mudar apenas variável de Warehouse do cliente pode divergir da API;
- demonstrar isolamento real e obter autorização do conjunto fictício; não usar workspaces externos;
- registrar saldo físico/agregado, intake e movimentos antes.

Execução: alocação fictícia pequena única → movimento único, avanço do intake, saldo e lote corretos → recarga e leitura autoritativa demonstram persistência. Replay somente se autorizado e em dados fictícios; não repetir operação incerta. Conferir que o conjunto externo não sofreu mudanças por meio de evidência delimitada e auditoria adequada, sem varredura indiscriminada.

Sem prova do isolamento: BLOCKED, mesmo se o erro de autenticação desaparecer. DEF-01 pode ser retestado em navegação autorizada sem operações logísticas.

### 5. GitHub Actions: decisão

A integração GitHub→Vercel publica builds e devolve status, mas não concede automaticamente ao workflow acesso aos envs/runtime logs da conta Vercel. Actions existentes continuam úteis para Emulator, contratos, UI, build e segurança, sem comprovar configuração efetiva remota.

**Não criar workflow administrativo/token nesta etapa:** leitura manual de presença/escopo e logs é mais simples para este bloqueio pontual. Se futuramente recorrente, desenhar workflow_dispatch read-only com projeto/team/Preview fixos, sem deploy/mutações, secret Vercel em GitHub Secrets com escopo e duração mínimos disponíveis, sem valores/logs brutos, e revisão prévia do script que receberá o token. Não presumir granularidade de token que o provedor não disponibilize; avaliar os privilégios reais. Não transferir credencial Firebase ao GitHub.

## QUEM FARÁ

Fundador executa somente as leituras do item 1; Coordenador interpreta e prepara a correção específica. Administrator autorizado altera configuração apenas depois de aprovação. Work/Fundador retestam; Coordenador consolida ledger, matriz e Memorial. Macroação 3 PARCIAL, Macroação 4 PENDENTE, novo RC Production NO-GO.
