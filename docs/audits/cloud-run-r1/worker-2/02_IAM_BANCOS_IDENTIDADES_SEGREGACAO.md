# CLOUD-RUN-R1 / W2 — IAM, dois bancos e segregação

**Estado:** desenho não implementado; sem consulta autorizada a IAM/Firebase. **Riscos:** R01/R02/R03/R04/R18. **Gates:** G04/G05/G07/G08/G14.

## Fatos documentados x desconhecidos

1. REPO/main/firebase.json referencia explicitamente **Core nomeado** (identificador exato mantido no arquivo original) e **emprovex-warehouse**. O ID extenso do Core foi omitido deste relatório por parcimônia de exposição. NENHUM fluxo da migração deve usar (default) implicitamente. Projeto GCP real, localização, estado operacional, contas e grants não foram provados.
2. O código analisado pelo PR #316 em lib/server/sectorProvisioningAdmin.ts e app/api/central-depositos/intake-action/route.ts precisa de FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON para obter token servidor em F05/F09. lib/server/firebaseAuthBackup.ts, googleCloudMonitoring.ts e globalUsageHistory.ts têm dependências adicionais. A identidade Cloud Run + ADC **não basta sem adaptação de código e autorização futura**.
3. Auth dos usuários finais, isolamento por workspace e Rules do cliente não equivalem a autorização do serviço administrativo. SDK Admin e REST privilegiado exigem controles server-side preservados, testados contra acesso inter-UG.

## Matriz de responsabilidades proposta — não descreve ACL atual

| Ator/identidade | Responsabilidade pretendida | Permissão a inspecionar / decisão, não concessão |
|---|---|---|
| Titular aprov-hgesm | Decisão de negócio, autorização de produção, titularidade GitHub e acesso administrativo a validar por plataforma | Confirmar quem administra GCP/Firebase, billing, DNS e Vercel; permissões GitHub não se propagam. |
| Moriark (colaboração GitHub) | Implementação em branches e auditoria; não libera produção isoladamente | GH app tem push sem admin. Não presumir acesso ao projeto Vercel nem IAM. |
| Identidade runtime Cloud Run, **user-managed SA a projetar** | Executar apenas APIs necessárias ao runtime, consultar/gravar Core e Warehouse somente no escopo de negócio previsto, Auth admin estritamente quando indispensável, Monitoring read-only | Estudar permissões mínimas de Firestore e Identity Toolkit por operações; segmentar endpoint admin em identidade/serviço separado se privilégios inevitavelmente amplos. Conta NÃO criada. |
| Identidade CI/CD, **SA distinta via GitHub WIF/OIDC a projetar** | Build/publicação Artifact Registry, release Cloud Run em ambiente autorizado | Workflow de produção manual/protegido, confiança restrita a repositório/ref/ambiente, roles específicas (artefato, deploy, serviceAccountUser se estritamente necessária). NÃO concedidas. |
| Leitor FinOps/billing | Custos agregados, budgets, quotas | Somente acesso de leitura a reports/budget; não ativar billing ou alterar alertas. |
| Leitor secret metadata / titular Vercel | Verificar **nomes e escopos** de env e secrets | Não exibir valores; distinguir build/runtime e production/preview/development. |
| Aprovador release | Revisar gates e autorizar implantação | Titular/Coordenador designados; nunca depender apenas do autor do commit. |

## IAM e recursos: matriz de prova P0

| Recurso/fluxo | Evidência read-only exigida | Ameaça a negar |
|---|---|---|
| Projeto de produção e projeto de homologação | project identifiers **sanitizados**, políticas, localização, status de billing, lista de APIs | Mesmo projeto e SA concedendo escrita à produção durante testes. |
| Firestore Core nomeado | database ID confirmado contra main; local, proteção, IAM efetivo no escopo permitido | Criar/ler o (default), cross-workspace, uso de banco de teste errado. |
| Firestore Warehouse nomeado | ID emprovex-warehouse; local, IAM, política backup e Rules | Escrita privilegiada inter-UG, saldo/ledger incorretos. |
| Firebase Authentication / Identity Toolkit | Papéis/grants usados por Admin, validação de ID token e backup de Auth | Usuário com token comum adquirir privilégio admin. |
| Cloud Monitoring / histórico cron | Permission set para consultas métricas e persistência de observações | SA de observabilidade com autorização ampla de escrita. |
| Secret Manager (se futuramente usado) | Lista de **nomes** de segredos, service accounts com acesso e retenção | Segredo publicado em NEXT_PUBLIC_, logs ou build. |
| GitHub Actions/WIF | Workload identity pool/provider, subjects permitidos e environment reviewers | Qualquer branch/PR externo conseguir usar credencial de deploy. |

## Prova negativa mandatória G08 antes de qualquer teste com mutação

Futuro ambiente isolado deve possuir credenciais **sem permissão de produção**; mostrar negação IAM de escrita/leitura indevida e não apenas prefixo de nome. Comparar config compilada NEXT_PUBLIC_* e runtime, OAuth e bancos nomeados. Testes com escrita devem usar somente projeto/bancos de teste ou Emulator; nunca usar produção para verificar negação com carga mutável sem autorização expressa, isolamento prévio e plano de contenção.

## Decisões pendentes

- X01/X02: titular da conta deve confirmar locais/região dos bancos, principals reais, funções efetivas e se IAM database-level granular resolve necessidade.
- R01: backend deve futuramente adaptar token access de chaves JSON para ADC, mantendo checagem de usuário, setor, UG e escopo antes da escrita; nenhum código mudado por W2.
- X05: backup nativo de cada banco deve ser verificado e restore independente demonstrado em fase autorizada.
- X11: GitHub main protected:false e rulesets repositório [] foram observados, mas approval de Environments é desconhecido e protection detalhada retornou 403.

Fontes: PR #316 (04_FIREBASE_SEGURANCA_INTEGRIDADE); main/firebase.json; docs/SAAS_R1_OPERACAO_RECUPERACAO.md; https://docs.cloud.google.com/run/docs/securing/service-identity e https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines . **Não há inventário real de IAM, nem proposta de conceder papéis.**
