# Arquitetura candidata Cloud Run (proposta, sem provisão)
Baseline 2026-10-15.

## Desenho lógico
Navegador HTTPS / emprovex.com.br → borda gerenciada (preferência condicional: Firebase Hosting com rewrites) → serviço Next standalone em Cloud Run → Firebase Auth, Firestore Core nomeado e warehouse nomeado; Drive permanece via OAuth client; observabilidade Cloud Logging/Monitoring; cron: Scheduler com chamador autenticado. GitHub Actions → WIF/OIDC → Artifact Registry → Cloud Run revision imutável.

## Pontos a decidir
- **Borda:** Firebase Hosting fornece domínio/TLS e rewrites, mas impõe timeout HTTP 60 segundos; rotas longas devem ser medidas. Mapeamento direto Cloud Run segue em preview e não recomendado para produção pela documentação Google. Load Balancer é opção mais flexível, custo a medir.
- **Região:** não escolher us-central1 só pela franquia. Levantar local dos dois bancos Firestore, latência real do público brasileiro e transferência inter-regiões; comparar southamerica-east1 e eventual região de dados. Latências não medidas.
- **Imagem:** Docker multi-stage, npm ci, next build, output standalone; copiar .next/standalone, .next/static e public, executar Node em porta PORT e 0.0.0.0; .dockerignore exclui segredos e testes; imagem por digest SHA, verificação de dependências nativas (PDF/ZXing), SBOM e scan. Isso é especificação, não arquivo implementado.
- **Runtime:** Node 20 compatível com CI, teste versão suportada e upgrades; CPU/memória/concurrency/timeouts/min-max instances como parâmetros experimentais, não defaults presumidos. Comparar cold starts e custos, sem min-instance desnecessária.
- **Persistência:** container efêmero; não persistir PDF, estado operacional ou tokens em disco. Continuar Drive/Firebase.
- **Segurança:** runtime service identity separada da conta de deploy; entrada web pública para UI exige defesa em aplicação; API administrativa só com autorização de usuário/workspace e IAM mínimo. Controle de egress, headers e proxies.
- **Cache:** Next em multi-instância pode divergir em cache incremental e estados de memória; configurar estratégia explícita e provas de coerência. /api/health é liveness superficial; readiness real deve ser observada sem depender de gravação em produção.
- **DNS/cutover:** testes em URL temporária sem troca de DNS, publicação canário só após os gates; rollback de DNS e Vercel congelada; mudanças de banco proibidas no cutover inicial.

## Incompatibilidades/pendências concretas
A) token assinado por JSON em sectorProvisioningAdmin, firebaseAuthBackup, googleCloudMonitoring e globalUsageHistory. B) x-vercel-forwarded-for no limiter. C) regra vercel.json de cron e auto-deploy não migra. D) hosting rewrite timeout de 60s. E) configurações Firebase build-time, domínios OAuth. F) domínio, HTTPS e proteção de preview não certificados em console. G) custos desconhecidos.

## Referências oficiais (consulta 2026-10-15)
- https://docs.cloud.google.com/run/docs/configuring/services/service-identity
- https://docs.cloud.google.com/run/docs/mapping-custom-domains
- https://firebase.google.com/docs/hosting/cloud-run
- https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration
- https://cloud.google.com/run/pricing
