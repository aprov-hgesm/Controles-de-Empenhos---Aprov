# EMPROVEX — Homologação funcional integrada (Cloud Run)

**Uma entrega, sem novos workers.** Branch `feat/cloud-run-r7-service-identity-20261031`, PR #426 DRAFT. `main`, Vercel, `emprovex.com.br`, InfinitePay e cron permanecem em produção sem mudanças.

## Situação comprovada (31/10/2026)

- 11 segredos copiados para Secret Manager R4/R6; pontes temporárias de transferência revogadas.
- Identidade nativa Cloud Run sem chave privada: `emprovex-run-runtime`; Firebase Auth e Cloud Monitoring receberam os papéis previstos; os dois bancos Firestore contam com condições por banco.
- Cloud Run Job `emprovex-r7-iam-probe-44l8g` confirmou, por leitura de documentos inexistentes, acesso aos dois bancos operacionais e negação aos três restantes.
- Build Docker Next.js standalone PASS; hospedagem privada `emprovex-cloudrun-staging` implantada em `southamerica-east1`, revisão `00001-mhq`.
- Teste real da URL privada, via token IAM: `/api/health` PASS e `/` HTTP 200.
- PR #426 com checks aplicáveis aprovados no commit do deploy; checks novos podem precisar concluir após novos commits documentais.
- O staging tem `EMPROVEX_CLOUD_RUN_STAGE=1`, `INFINITEPAY_BILLING_ENABLED=0`, `EMPROVEX_BILLING_ENFORCEMENT_ENABLED=0`. Nenhum segredo InfinitePay foi montado no serviço de homologação.

## Executar a homologação integrada em uma única operação

No PowerShell, dentro de `$HOME\EMPROVEX-R7-IDENTITY`:

```powershell
git pull --ff-only origin feat/cloud-run-r7-service-identity-20261031
if ($LASTEXITCODE -ne 0) { throw 'Falha ao atualizar o codigo.' }
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\ops\homologate-cloud-run-integrated.ps1 -Browser
if ($LASTEXITCODE -ne 0) { throw 'Homologacao integrada falhou.' }
```

O script faz um só checklist de HTTP e segurança (GET apenas, sem ler documentos reais), depois abre um **proxy privado local** em `http://localhost:8089/central-empenhos`. Para usar, manter a janela do proxy aberta. O acesso direto à URL `.run.app` permanece protegido por IAM.

## Checklist da homologação pelo navegador

1. **Visual**: login, identidade visual, modo Normal/Essencial, navegação pública, ícones e responsividade.
2. **Autenticação Firebase**: somente conta designada de teste; testar com cuidado, pois o navegador usa o Firebase de produção e o fluxo de sessão pode **escrever** (renovações de lease, registros etc.). Login Google por popup/redirect pode depender de `localhost` como domínio autorizado. Não adicionar `localhost` ao projeto de produção apenas para contornar um erro do teste; revisar alternativa isolada.
3. **Áreas operacionais**: acesso, menus, painéis, NF, relatórios, Central de Depósitos. Na hospedagem atual, usar apenas navegação/leitura em conta de teste — não cadastrar/alterar/excluir documentos, estoque ou contas.
4. **Integrações**: Google Drive, Firebase App Check, permissões de assinatura e outros provedores ainda dependem de configuração específica do host e da homologação. Não apresentar como validados com base apenas em HTTP 200.
5. **Cobrança**: InfinitePay sem segredos no staging, checkout e webhooks NÃO testáveis nessa hospedagem; testar em ambiente isolado e sem transação real antes de corte.
6. **Agendamento**: `vercel.json` tem cron de `/api/cron/usage-snapshot`; Cloud Scheduler não deve rodar em paralelo com cron Vercel. Só migrar com coordenação de corte.
7. **Corte**: somente após configurações reais, backup/rollback, validação de custo e latência (Cloud Run São Paulo, Firestore us-east1), domínio, OAuth/App Check, storage e webhooks. Nunca remover Vercel antes do novo serviço estar certificado.

## Limitações e bloqueio de liberação pública

O aplicativo cliente importa `firebase-applet-config.json`, que referencia diretamente o projeto Firestore de produção. As Firestore Security Rules e as políticas de cliente não são equivalentes ao IAM do serviço. A conta Cloud Run tem acesso administrativo aos bancos operacionais; **um navegador autenticado no aplicativo também pode chamar diretamente o Firebase**. O modo de staging e o bloqueio de cobrança não constituem uma barreira global contra escritas no Firebase pelo cliente.

Por isso, o serviço permanece privado e os testes de gravação precisam de dados/ambiente isolados e configuração de autenticação adequada. Este documento não autoriza tornar staging público, trocar domínio ou promover a PR.

## Critério de conclusão

1. Smoke integrado PASS + navegador via proxy alcançando login.
2. Homologação funcional das integrações e operações **com dados de teste isolados** sem afetar workspaces reais.
3. Cutover Vercel -> Cloud Run (DNS, callbacks, agendamento) com rollback conferido.

Executar estes critérios como **um único plano de homologação e corte**, sem abrir novas trilhas de auditorias fragmentadas.
