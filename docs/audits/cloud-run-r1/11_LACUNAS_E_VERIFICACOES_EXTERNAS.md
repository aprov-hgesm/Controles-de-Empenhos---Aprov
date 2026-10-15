# Lacunas, verificação externa e titulares da evidência
**Este documento é a fronteira entre observação de código e administração real.** Nenhum painel Vercel, Firebase/Google Cloud, DNS ou contas de billing foi acessado pelo Worker. Não executar ações mutáveis.

| ID | Informação indisponível | Quem verifica | Consulta segura e evidência |
|---|---|---|---|
| X01 | Projeto/conta GCP real vinculado ao Firebase, quota, região dos bancos nomeados | Administrador GCP/Firebase | Listagem read-only de projeto/databases/locations e quotas |
| X02 | IAM service accounts, Firebase Auth, Firestore e Cloud Monitoring | Administrador GCP | Roles por principal/banco/API, somente nomes e permissões, sem tokens |
| X03 | FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON no Vercel e secrets por ambiente | Administrador Vercel | Listar **nomes e escopos** de variables, nunca valores |
| X04 | Vercel deployment protection, team, domains, deploy hooks, cron ativo, produção e previews | Administrador Vercel | Export sanitizado do painel/contratos e URL/alias corretos |
| X05 | Dois backups nativos Firestore habilitados, agendamentos, retenção e viabilidade de restore | Administrador Firebase/Recovery | recovery:verify read-only + teste restore isolado supervisionado em fase autorizada |
| X06 | OAuth authorized domains, Google Sign-in, redirect URIs, Drive OAuth clients/scopes | Admin Firebase/OAuth | capturas mascaradas, teste em domínio temporário |
| X07 | Site key reCAPTCHA Enterprise/App Check e restrições por domínio | Admin Firebase | domínio e provider permitidos, sem publicar keys secretas |
| X08 | DNS atual e propriedade de emprovex.com.br; TTL, www, HSTS, CAA | Admin domínio | export de zona sanitizado + health/HTTPS de fora |
| X09 | Métricas Vercel 30/60/90d: requisições, duração, erros, regiões, cache e uso de bandwidth | Admin Vercel/FinOps | métricas agregadas, sem PII/URLs privadas |
| X10 | Custos/Free Tier efetivos, billing e outras cargas na conta | Admin GCP/FinOps | relatório mensal agregados por SKU e região |
| X11 | Políticas GitHub branch protection/rulesets e environment approvals | Proprietário GitHub | screenshots ou endpoints de configuração autorizados; main protected:false observado |
| X12 | Inventário completo de cron/agendadores externos, webhooks e Google Drive links compartilhados | Admin Vercel/Firebase/GCP/Drive | logs/eventos e configuração read-only |
| X13 | Regras de firewall/limites DDoS/proxy e cabeçalhos forwarded reais | Infra/Security | captura anonimizada de requests da borda |
| X14 | Métricas/smokes reais das rotas longas (PDF, backup, importação, Admin) | QA/Infra | duração, tamanho e status; sem executar mutações reais |
| X15 | Capacidade de rollback para domínio, auth e release Vercel preservado | Coordenador/Infra | runbook assinado e simulação isolada |
| X16 | Outras branches/prs ainda não integradas que alterem Fast Path, secrets ou deploy | Coordenador GitHub | comparar SHA alvo imediatamente antes do plano de implantação |

## Limites já comprovados
GitHub: repo public, conexão com permissão de push e leitura (sem admin), HEAD consultado; árvore completa e fontes de código específicas lidas. Nenhuma varredura automatizada exaustiva de semântica nos 893 arquivos foi executada; pesquisa de código GitHub não retornou resultados relevantes para termos amplos, sem permitir declarar ausência de dependência. Sem clone local por indisponibilidade de resolução de github.com no ambiente de execução; sem build ou browser tests; sem ping/login de produção; sem execução de recovery:verify no projeto real.

## Como reportar ao Worker/Coordenador
Para cada X: data, escopo, conta de responsabilidade, captura sem segredo, status VERIFICADO/INCONCLUSIVO/BLOQUEADO, mudança necessária e associação ao risco Rxx. Priorizar X01–X08, X11 e X05 antes de desenho do pipeline ou IAM.
