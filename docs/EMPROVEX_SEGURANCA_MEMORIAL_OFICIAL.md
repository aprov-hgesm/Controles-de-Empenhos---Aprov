# EMPROVEX — Memorial Oficial de Segurança

**Versão:** R1 — 31/10/2026  
**Escopo:** segurança contínua do EMPROVEX (aplicação, dependências, infraestrutura e integrações).  
**Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`  
**Diretriz:** GOV-SIMP-01 — segurança essencial, economia operacional e testes proporcionais ao risco.

## 1. Finalidade e fonte de verdade

Este documento é o ponto único de referência para o chat de vigilância de segurança e futuras correções. Não substitui logs, inventários ou configuração efetiva de produção. Distinguir sempre: **confirmado**, **informado pelo responsável**, **não verificado** e **novo alerta**. Não reabrir entregas encerradas sem evidência nova e relevante.

## 2. Baseline de segurança — Security Patch R1.1

**Estado de entrega: CONCLUÍDO (desenvolvimento, integração e publicação).** Relatório de certificação fornecido pelo worker em 31/10/2026 e homologação operacional confirmada pelo responsável.

- PR #433: MERGED em `main`.
- Patch de origem: `dac890e20a575cab590965e14cb0582ac373e324`.
- Main na certificação: `c096b53d0bb3dda058cd91915cf7ffffa1d275d6` (commit posterior apenas de solicitação de promoção).
- Revisão promovida: `emprovex-cloudrun-candidate-gdac890e20a57-3`.
- Imagem: `sha256:f5610145b7e03f5162edd75e4e75f369170688cd47202778658c110a81bef4a3`.
- Projeto GCP: `gen-lang-client-0982077967`; região `southamerica-east1`; serviço `emprovex-cloudrun-candidate`.
- Workflow build/stage: [run 41250505948](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41250505948) — SUCCESS informado.
- Workflow promoção: [run 41250757180](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41250757180) — SUCCESS; tráfego 100% na revisão no momento da promoção (não é garantia de estado atual futuro).
- Application CI da main: [run 41250757106](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41250757106) — PASS informado.
- Fast CI 41250162661, Core Protection 41250162684, Application CI 41250162665, Domain CI 41250162647, Browser E2E automatizado 41250162633: PASS no relatório do worker. Bateria manual completa Browser E2E não executada; não constitui bloqueio de encerramento.
- Health `/api/health` da candidata e do domínio produtivo após promoção: PASS informado.
- Integrações Firebase Auth, Firestore, Google Drive e InfinitePay: homologação operacional anterior confirmada pelo responsável. Não exigir nova homologação sem indício de regressão.

**Baseline de componentes:** Next.js 15.5.28; Undici 6.29.1; DOMPurify 3.4.17; @grpc/grpc-js 1.13.6; PostCSS 8.5.28 (versões conforme manifesto/lockfile da certificação). Dockerfile usa `node:24-bookworm-slim`; versão patch exata de Node no contêiner não foi certificada. Não confundir Node 24.22.1 do CI com runtime da imagem.

## 3. Superfícies sob vigilância

- Node.js e imagem base do contêiner; Next.js, React e demais pacotes npm (inclusive dependências transitivas).
- GitHub Security Advisories, Dependabot, code scanning e GitHub Actions (actions de terceiros, permissões e credenciais).
- Firebase Authentication, Firestore, regras multitenant, Google Drive e InfinitePay.
- Google Cloud Run, Artifact Registry, IAM, Secret Manager, Workload Identity Federation e Firebase Hosting.
- Vercel apenas quando houver dependência residual real; não tratar legado documental como incidente ativo.

## 4. Protocolo do chat de vigilância

A cada execução:
1. Verificar **novos avisos oficiais desde a última checagem** e alterações relevantes em avisos anteriores: mantenedores, GHSA/CVE, GitHub Advisory Database, CISA KEV, Google Cloud e Firebase.
2. Confrontar faixa afetada com **versão instalada e, quando necessário, versão efetivamente implantada**. Uma vulnerabilidade genérica de biblioteca não prova exposição do EMPROVEX.
3. Priorizar exploração ativa, comprometimento de credenciais, vazamento multitenant, RCE, bypass de autenticação e vulnerabilidades altas/críticas aplicáveis.
4. Para cada alerta material registrar: identificador, publicação/atualização, fonte oficial, componente, versões afetadas e corrigidas, evidência de aplicabilidade, risco real, mitigação mínima e ação proposta.
5. Se não houver alerta novo aplicável, informar **“Sem novos alertas materiais identificados nas fontes consultadas”**. Não afirmar “zero vulnerabilidades” sem inventário autenticado completo.
6. Evitar repetir avisos já resolvidos e não sugerir auditorias amplas, rebuilds ou deployments apenas para obter certeza absoluta.
7. Ações de escrita (PR, alteração de regras, segredo, infraestrutura, merge ou deploy) exigem autorização específica. Monitoramento é somente leitura.

## 5. Critérios de acionamento

- **P0 — ação imediata:** exploração ativa ou risco crítico comprovadamente aplicável à produção; propor mitigação mínima e escalonamento.
- **P1 — planejar correção:** alta gravidade aplicável, sem exploração conhecida; corrigir de forma pontual e com testes proporcionais.
- **Informativo:** alerta sem evidência de aplicabilidade, baixa gravidade ou mera atualização sem impacto; acompanhar sem abrir trabalho.
- **Sem alerta material:** registrar resultado resumido; nenhuma ação.

## 6. Política de encerramento

Security Patch R1.1 e publicação Cloud Run **encerrados**. Não reabrir PR #433 nem repetir CI, homologação operacional ou promoção por padrão. Só reabrir diante de vulnerabilidade nova comprovadamente aplicável, regressão reproduzível, falha produtiva ou evidência concreta de configuração insegura.

Uma inspeção privada de alertas Dependabot/Artifact Analysis pode ser útil em manutenção programada, mas sua ausência isolada **não invalida a certificação R1.1**.

## 7. Modelo curto de relatório de vigilância

- **Data/hora e fontes consultadas:**
- **Novos alertas materiais:** nenhum / lista com GHSA ou CVE e links.
- **Aplicabilidade ao EMPROVEX:** confirmada / descartada / não verificada, com justificativa.
- **Ação:** nenhuma / monitorar / correção pontual autorizável.
- **Mudança de baseline:** somente após confirmação de merge e deploy.
- **Próxima verificação:** conforme automação já existente.

## 8. Histórico

- **31/10/2026 — R1:** memorial exclusivo de segurança criado; consolidação do patch R1.1, evidências do worker, decisão de encerramento e política de vigilância sem burocracia.
