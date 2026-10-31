# EMPROVEX — Memorial Oficial


## ESTADO OPERACIONAL VIGENTE — PRODUÇÃO MIGRADA PARA GOOGLE CLOUD RUN (31/10/2026, Brasília)

> **PRECEDÊNCIA OBRIGATÓRIA:** esta seção substitui todas as referências abaixo que descrevam a **Vercel como hospedagem produtiva atual**, `vercel deploy/promote` como **publicação canônica**, ou a migração Cloud Run como ainda não iniciada. As seções antigas são **histórico imutável de releases**, não procedimentos aplicáveis hoje. **As alterações deste documento foram registradas na branch da PR #426; não confundir atualização do GitHub com novo deployment do aplicativo.**

### Endereço, infraestrutura e prova do corte

- **URL pública canônica:** `https://emprovex.com.br`. Domínio gerenciado no Registro.br, zona avançada. Registro A autoritativo: `199.36.158.100` (**Firebase Hosting**, antigo Vercel `216.198.79.1` retirado). Manter TXT `hosting-site=emprovex-cloudrun-943599311487`, verificação Google e `_acme-challenge` emitido pelo Firebase.
- **Entrada HTTPS/CDN:** Firebase Hosting, site `emprovex-cloudrun-943599311487`, URL `https://emprovex-cloudrun-943599311487.web.app`, rewrite `**` para serviço `emprovex-cloudrun-candidate`, região `southamerica-east1` (São Paulo). Definição isolada em `ops/cloud-run-hosting/firebase.json`. Domínio apresentou `OWNERSHIP_ACTIVE` e certificado `CERT_ACTIVE`.
- **Runtime em produção:** Google Cloud Run, projeto `gen-lang-client-0982077967` (`943599311487`), serviço `emprovex-cloudrun-candidate`, executando Next.js standalone em Docker. O nome *candidate* é legado do plano de transição, mas **é o serviço real destinado à produção**; **não renomear precipitadamente**, pois o rewrite do Hosting aponta para ele.
- **Identidade da execução:** `emprovex-run-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com`, tokens curtos obtidos no metadata server. Firestore operacional e Warehouse têm IAM direcionado; sem JSON privado `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` nem chave dedicada Monitoring no Cloud Run. Firebase Auth/Rules e guardas de workspace, UID e UG continuam aplicáveis.
- **Acesso:** `roles/run.invoker` para `allUsers` permite o tráfego público de HTTP ao serviço, **não** autentica usuários. O serviço mantém autenticação Firebase e autorização no próprio aplicativo; prova pontual: `GET /api/billing/portal` anônimo → HTTP **401** `BILLING_AUTH_REQUIRED`.
- **Cobrança:** 11 variáveis/segredos de produção em Secret Manager (versão 1) mapeados ao serviço, incluindo InfinitePay e políticas de enforcement. O controle de domínio do checkout segue `https://emprovex.com.br`. A lista Production da Vercel em 31/10/2026 não apresentou `EMPROVEX_SHARED_BILLING_ENABLED`, também ausente no Cloud Run: não ativar rateio sem decisão explícita.
- **Agendamento:** `vercel.json` mantém somente como legado `/api/cron/usage-snapshot` às `15 9 * * *`; `CRON_SECRET` estava ausente da listagem Production da Vercel consultada no corte. Não afirmar execução efetiva do cron, nem instalar Cloud Scheduler duplicado. A futura transição de cron é separada do deploy web.
- **Provas reais do corte (31/10/2026):** DNS `a.sec.dns.br` e `c.sec.dns.br` retornaram `199.36.158.100`. `curl.exe --resolve emprovex.com.br:443:199.36.158.100 https://emprovex.com.br/api/health` retornou **HTTP 200**, `Server: Google Frontend`, JSON `{"status":"ok",...}` e certificado HTTPS aceito. No mesmo momento, o DNS recursivo `8.8.8.8` ainda tinha o endereço Vercel em cache (TTL ~3.256s). Portanto **a implantação no novo destino está comprovada, mas a propagação global do DNS não foi certificada nesse instante**.
- **Homologação operacional reaproveitada:** acesso administrativo e operacional, 3D, autenticação, Google Drive com download de NE, NF criada/excluída e PDF, saída de material e documento via proxy privado Cloud Run. Reaproveitar a evidência; **não repetir toda a bateria** em futuras mudanças meramente operacionais.

### PUBLICAÇÃO CANÔNICA (substitui Vercel)

**Documento normativo:** [EMPROVEX_RELEASE_CLOUD_RUN.md](./EMPROVEX_RELEASE_CLOUD_RUN.md). **Comando operacional:** `ops/release-emprovex-cloud-run.ps1`.

**Fluxo:** integração/CI proporcional na `main` → `-Status` → `-Stage` (**um build de Dockerfile no Cloud Run, nova revisão `--no-traffic`**) → smoke mínimo do novo revision tag → `-PromoteRevision <REVISAO>` (**100% do tráfego**) → `/api/health` com SSL pelo domínio → guardar revisão anterior para `-RollbackRevision <ANTERIOR>`. A publicação não modifica DNS, Firebase Hosting, IAM, secrets, dados, Firestore Rules ou o cron. Fonte de release deve estar na `main` integrada e em árvore limpa; a PR [#426](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/426) foi mantida **DRAFT durante a implementação da documentação**, não presumir merge ou publicação do HEAD documental.

**Vercel agora é contingência, não produção de novos releases.** Preservar equipe/projeto `aprov-hgesms-projects/controles-de-empenhos-aprov`, última versão preservada e `vercel.json` com `git.deploymentEnabled=false`. Não executar `vercel deploy/promote` para colocar novas versões no domínio. Em falha, preferir rollback de revisão no Cloud Run; rollback por DNS para o IP anterior da Vercel somente como contingência excepcional e com consciência do cache. Dados/Rules/webhooks não retrocedem com rollback de código.

**Regra para agentes futuros:** o procedimento histórico [EMPROVEX_RELEASE_POWERSHELL.md](./EMPROVEX_RELEASE_POWERSHELL.md) **não é mais canônico**. A hospedagem padrão de novas versões é Cloud Run, região `southamerica-east1`, sempre via Firebase Hosting. Evitar migrações adicionais, novos workers ou auditorias repetidas sem mudança funcional de risco.

**Referências do corte:** [Memorial de cutover](./EMPROVEX_CLOUD_RUN_CUTOVER_GO_20261031.md), [Homologação integrada](./EMPROVEX_CLOUD_RUN_HOMOLOGACAO_INTEGRADA.md), [Identidade R7](./EMPROVEX_CLOUD_RUN_R7_IDENTITY_20261031.md).

---


## PUBLICAÇÃO CONFIRMADA — PDF DE NOTA DE EMPENHO SALVO AUTOMATICAMENTE NO GOOGLE DRIVE (29/10/2026, BRT)

> **PUBLICADO / CONFIRMADO NO DOMÍNIO PELO PROPRIETÁRIO.** Este é o estado produtivo mais recente comprovado para a funcionalidade de importação de NE por PDF. Substitui apenas o estado de implantação registrado nos checkpoints abaixo, que permanecem históricos. **NÃO repetir clone, build, deploy nem promote desta release.**

- **Origem funcional imutável:** PR [#412](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/412) integrada à `main` por squash em `e0b69f448461564a3c68371c70a5a3e7a4f81376`. O código desse SHA foi obtido por clone limpo de `main`, conferência de `git rev-parse HEAD` e `git archive` para `D:\EMPROVEX-RELEASE-e0b69f448461\deploy`. Commits documentais posteriores na `main` não alteram o código publicado (`vercel.json` desativa Git deployment).
- **Escopo:** no cadastro de empenho por importação de PDF, o arquivo original é mantido apenas durante a revisão; após confirmação, é enviado ao Google Drive conectado ao workspace pela integração documental já existente, com verificação de integridade; os metadados `notaEmpenhoPdf` e `notaEmpenhoPdfVersions` acompanham o cadastro para permitir visualização, impressão e download. Limite coerente de **10 MB** e bloqueio da criação da NE quando o upload não é confirmado. **Nenhuma mudança em Firestore Rules, IAM, dados, Warehouse, assinatura, preços ou motor financeiro.**
- **Equipe/projeto Vercel:** `aprov-hgesms-projects/controles-de-empenhos-aprov` (`prj_DZ2y10DUaXrcHoRMaZ58FkTCvOHB`). Publicação manual via PowerShell do proprietário, usando `vercel.cmd deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects` **uma única vez**; sem publicação Git automática.
- **Versão imediatamente anterior (rollback de código):** `dpl_86m6g6i3Qc3j6zedvmUEYqYYVofW`, URL individual `https://controles-de-empenhos-aprov-89zn41p93-aprov-hgesms-projects.vercel.app`. Antes da promoção da nova versão, `vercel inspect https://emprovex.com.br` confirmou explicitamente que o domínio ainda servia esse ID em `production / Ready`.
- **Deployment novo, imutável e PUBLICADO:** `dpl_J6WEeRc6Eza2pr5944CLttHsouBE`, URL individual `https://controles-de-empenhos-aprov-3kmpu7k0u-aprov-hgesms-projects.vercel.app`. `vercel deploy` devolveu `Ready`; o `vercel inspect` confirmou `target=production`, `status=Ready`. Build de 50s, pós-build 42s e 4 CPU-minutos na inspeção.
- **Validação anterior à promoção:** `vercel.cmd curl /api/health --deployment <URL_IMUTAVEL> --scope aprov-hgesms-projects` respondeu `{"status":"ok","timestamp":"2026-10-29T23:27:28.791Z"}`. O proprietário **confirmou sucesso do teste funcional real** de cadastrar NE por PDF, salvar automaticamente no Google Drive e baixar o mesmo arquivo no ambiente de homologação, antes do GO para promoção.
- **Promoção e prova definitiva do domínio:** o proprietário executou `vercel.cmd promote <URL_IMUTAVEL> --yes --scope aprov-hgesms-projects` e recebeu **`Success!`** para **o mesmo** `dpl_J6WEeRc6Eza2pr5944CLttHsouBE`. Logo depois, `vercel.cmd inspect https://emprovex.com.br --scope aprov-hgesms-projects` apresentou **o mesmo ID**, `target production` e `status Ready`. Saúde após promoção: `vercel.cmd curl /api/health --deployment https://emprovex.com.br --scope aprov-hgesms-projects` respondeu `{"status":"ok","timestamp":"2026-10-29T23:28:58.382Z"}`. **PUBLICAÇÃO CONFIRMADA.**
- **Testes de código e limites honestos:** no HEAD da PR #412, Fast CI, Core Protection, Domain CI R2 e W4 Evidence = PASS; TypeScript = PASS. O Core Protection da `main` integrada também passou. O Application CI da `main` = **FAIL** no guard legado de onboarding SaaS-C (reset/troca de senha/checklist de primeiro acesso), falha também observada no SHA anterior R3; isto **não é** certificação de Application CI. O smoke funcional Drive/NE foi reportado pelo proprietário no staged; não há evidência aqui de teste real autenticado pós-promoção para todas as áreas do sistema, endpoint fundador `/api/central-depositos/health`, nem de teste integral das operações Warehouse, InfinitePay, NF/TR e demais cenários. `/api/health=ok` não comprova essas operações.
- **Operação / GOV-SIMP-01:** não repetir deploy/promote nem executar Rules/migrações por esta publicação. Se houver incidente, diagnosticar na versão vigente antes de qualquer ação; a versão R3 acima fica identificada para possível rollback de código, que **não** reverte dados ou Firestore Rules. Registrar incidentes e smoke complementar de QA separadamente. O PR #413 de saída de materiais Warehouse não faz parte desta release.

**Método canônico:** [EMPROVEX_RELEASE_POWERSHELL.md](./EMPROVEX_RELEASE_POWERSHELL.md). **PR funcional:** [#412](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/412).

---

## PUBLICAÇÃO CONFIRMADA — MODO NORMAL/ESSENCIAL + RAM R3 (29/10/2026, BRT)

> **ESTADO PRODUTIVO CONFIRMADO PELO LOG DO PROPRIETÁRIO.** Esta seção substitui, somente para o **estado de implantação**, os checkpoints anteriores que identificam a PR #411 como DRAFT ou afirmam que o Modo Essencial ainda não foi publicado. Os registros anteriores são históricos. **NÃO repetir deploy nem promote.**

- **Fonte imutável publicada:** PR [#411](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/411) integrada por squash na `main` como commit funcional `b3a7d764fd645303c4aa5e204143cf9dc56d5566`. A versão implantada veio de clone limpo e `git archive` deste SHA para `D:\EMPROVEX-RELEASE-b3a7d764fd64\deploy`; alterações documentais na `main` feitas depois desta publicação **não são novo código publicado**.
- **Equipe/projeto Vercel:** `aprov-hgesms-projects/controles-de-empenhos-aprov`; ID `prj_DZ2y10DUaXrcHoRMaZ58FkTCvOHB`; runtime Node.js 24.x. O `vercel.json` continua com `git.deploymentEnabled=false`, exigindo publicação manual.
- **Deployment anterior, para referência de rollback:** `dpl_5JqtJf5gEpcCTv6pXKYPM1WtV1Yr`; URL individual `https://controles-de-empenhos-aprov-atdvtofri-aprov-hgesms-projects.vercel.app`; constava `production / Ready` no domínio `emprovex.com.br` **antes** da promoção.
- **Novo deployment:** `dpl_86m6g6i3Qc3j6zedvmUEYqYYVofW`; URL individual `https://controles-de-empenhos-aprov-89zn41p93-aprov-hgesms-projects.vercel.app`. O comando executado **uma única vez** foi `vercel.cmd deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects`; a inspeção subsequente confirmou `target=production` e `status=Ready`. Vercel exibiu build de 1m40s, pós-build de 1m05s e 6 CPU-minutos.
- **Saúde antes da promoção:** `vercel.cmd curl /api/health --deployment <URL_IMUTAVEL> --scope aprov-hgesms-projects` retornou `{"status":"ok","timestamp":"2026-10-29T22:23:53.365Z"}`. Uma segunda inspeção do domínio antes do promote ainda apontava ao ID anterior, demonstrando a separação staged/domínio.
- **Prova definitiva:** o proprietário executou `vercel.cmd promote <URL_IMUTAVEL> --yes --scope aprov-hgesms-projects`, recebeu **`Success!`** para `dpl_86m6g6i3Qc3j6zedvmUEYqYYVofW` e logo em seguida `vercel.cmd inspect https://emprovex.com.br --scope aprov-hgesms-projects` apontou **o MESMO ID**, `target=production`, `status=Ready`. **O domínio oficial está publicado com a versão R3. Nenhum segundo build foi executado para a promoção.**
- **Escopo de código:** seletor Normal/Essencial por sessão, navegação e carregamento mais leves, fallback seguro ao Normal em falhas visuais detectáveis e R3 de Painel (projeção limitada de linhas com totais/contagens integrais). Renderizador 3D preservado e sem novas migrações de dados, APIs financeiras ou Firestore Rules solicitadas por esta release.
- **Certificação pré-release:** no HEAD da PR #411, Fast CI, Core Protection, Recovery, SAAS-DL Legal, InfinitePay Payment UI Preview, W4 QA e evidência de integração PASS; [VISUAL-R2 Integrity Audit #40963203483](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40963203483): **5/5 jobs Linux PASS**, incluindo E2E Chromium autenticado com Firebase Emulator. O job de inicializador local **Windows** foi isolado como diagnóstico manual; as execuções anteriores registram timeout de porta 8081, não certificado como PASS.
- **Limites honestos da homologação:** antes do promote houve QA visual humano da **prévia local** e teste HTTP `/api/health` do deployment staged. **Não foram fornecidas evidências de smoke autenticado completo no staged nem após a promoção** (teste real de OAuth/Drive, InfinitePay, saída/transferência/inventário de estoque e `/api/central-depositos/health` com identidade do fundador). Não transformar CI sintético e health em prova dessas operações reais. Usar exclusivamente workspace QA, sem movimentações de produção para testes. **Ganho em RAM de clientes ainda não foi quantificado em ambiente controlado**; os 800 MB observados são diferença de RAM total do Windows.
- **GOV-SIMP-01 / próximos passos:** não repetir clone/deploy/promote; conferir login e alternância de modos, relatórios, NF, 3D e autorização no domínio publicado com identidades de QA, observar incidentes reais e usar rollback para o deployment anterior apenas se necessário e com conferência de efeitos. Vercel rollback não reverte dados nem Rules.

**Procedimento canônico:** [EMPROVEX_RELEASE_POWERSHELL.md](./EMPROVEX_RELEASE_POWERSHELL.md). **Runbook desta release:** [EMPROVEX_ESSENCIAL_R3_RELEASE_20261029.md](./releases/EMPROVEX_ESSENCIAL_R3_RELEASE_20261029.md).

---

## CHECKPOINT ATUAL — MODO ESSENCIAL, CERTIFICAÇÃO E FOCO EM MEMÓRIA (29/10/2026)

> **Precedência de status:** esta seção atualiza os registros de planejamento abaixo. **Somente desenvolvimento em PR #411, sem merge nem deploy Vercel.** Não altera contratos da produção, banco, Firestore Rules, cobrança ou IAM. Todo resultado é escopado à sua evidência.

- **Implementação em branch:** [PR #411](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/411), `feat/visual-mode-r1-session-navigation`, DRAFT. Seletor Normal/Essencial por `sessionStorage`; no Essencial, pular Início decorativo para Painel e Início da Central para Controle de Materiais; lazy-load dos painéis/backup, estilos com menos filtros, tabela do Painel progressiva (60 linhas por classificação inicialmente, totais do conjunto inteiro), primeira segmentação R2-C e fallback automático em falha detectável de interface para Normal, sem reload e com quarentena local até fim da sessão. O 3D de Meus Depósitos não foi rebaixado.
- **Integridade:** aceitação legal, cobrança, UID/UG e demais gates continuam exigidos; não alterar `firestore.rules`, `app/api/**`, `lib/server/**`, motores de TR/PDF/NE/NF/NS/relatórios, Drive ou Warehouse para economizar RAM. Rascunhos NF/PDF vinculados à NE atual e limpos na troca de identidade; não descartar campos não salvos.
- **Evidência concluída:** [GitHub Actions #40951319841](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40951319841) = 5/5 jobs de integridade PASS, incluindo **11/11 E2E Playwright Chromium** (2 fallback, 9 fluxos operacionais autenticados usando Firebase Auth/Firestore Emulator), além de contratos de documentos e Warehouse. Fast CI, TypeScript e Core Protection PASS nas rodadas associadas. **Dados sintéticos e adaptadores somente no Playwright** para legal/billing; não equivalem a transações com OAuth Drive/InfinitePay em produção.
- **Prévia Windows:** runner local criado com Firebase Emulator, mas [Windows Node 24 CI #40956724787](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40956724787) **NÃO PASSOU integralmente**: 5/5 testes sintáticos/isolamento PASS, mas o smoke de inicialização do segundo Firestore Emulator em porta 8081 encerrou por timeout. **NO-GO da certificação da prévia Windows** até prova real. Nesse mesmo run as outras cinco suítes (documentos, segurança, Warehouse, Auth/Firestore e browser E2E Linux) passaram. Não declarar que o launcher Windows foi certificado.
- **Observação do fundador em PC ~8 GB:** capturas com RAM total do Windows **6,8/7,8 GB (87%) no Essencial e 7,6/7,8 GB (97%) no Normal**, CPU momentânea 5% vs 81%. **São amostras do sistema inteiro**, sem processo controlado nem causalidade/benchmark atribuível ao EMPROVEX; localhost agrega Node/Next dev, Java/Firestore Emulator e Chromium. Diferença visual de RAM = 0,8 GB no sistema, **não declarar economia de 800 MB do aplicativo**.
- **Auditoria estática de RAM:** `hooks/useOperationalRealtimeCollections.ts` encerra listeners por aba, mas os arrays `empenhos, alerts, invoices, comissoes, cronogramas` podem permanecer em React ao trocar de aba; `OperationalWorkspace` mantém hooks transacionais montados após a primeira visita; CSS/motion e SVG 3D representam carga adicional principalmente de renderização/composição; tabelas limitam DOM visível, **não os dados retidos**. Hipóteses de impacto, **sem heap snapshot/RSS ou bytes por componente medidos**.
- **Próxima frente aprovada para investigação, NÃO certificação:** perfil de heap JS, DOM, process RSS e memória gráfica por aba, mesmo dataset e produção-like build; comparar Normal/Essencial após estabilização e navegação. Priorizar liberações seletivas de **dados de leitura comprovadamente não utilizados**, preservando documentos históricos, rascunhos NF/PDF, transações assíncronas, cálculos, relatórios, termo de recebimento, Drive e 3D. **Proibido limpar todos os arrays ao trocar de aba:** `relatorios` não assina invoices por padrão e pode reutilizar histórico carregado. Antes de liberar qualquer cache, demonstrar restauração e ausência de perda.
- **Regra GOV-SIMP-01:** benchmark antes/depois; correções pequenas e reversíveis, testes contratuais e E2E autenticado quando houver mudança de retenção/lifecycle; PR isolada; **sem promover ou mesclar a PR sem aprovação explícita**.

Memorial específico: [MODO_ESSENCIAL_MEMORIAL_OFICIAL.md](./MODO_ESSENCIAL_MEMORIAL_OFICIAL.md). Histórico técnico: [MODO_ESSENCIAL_AUDITORIA_FUNCIONAL_INTEGRAL_2026-10-29.md](./MODO_ESSENCIAL_AUDITORIA_FUNCIONAL_INTEGRAL_2026-10-29.md) (documento da branch, retrata estágio anterior e não deve ser lido como status final).

---

## FRENTE VINCULADA — MODO NORMAL/ESSENCIAL R1 (29/10/2026)

- **Memorial canônico do projeto:** [MODO_ESSENCIAL_MEMORIAL_OFICIAL.md](./MODO_ESSENCIAL_MEMORIAL_OFICIAL.md) — decisões irrenunciáveis, plano executivo integral de 24/10, arquitetura, Workers, VF-01 a VF-16, metas, riscos e GO/NO-GO.
- **Auditoria original e evidências históricas:** [MODO_ESSENCIAL_AUDITORIA_2026-10-24.md](./MODO_ESSENCIAL_AUDITORIA_2026-10-24.md) — diagnóstico estático, baseline histórico e oportunidades DV-01 a DV-20.
- **Estado:** DOCUMENTAÇÃO CRIADA; implementação, benchmark real, certificação e deploy específicos do Modo Essencial **não comprovados** neste registro.
- **Contrato superior:** um só sistema com Normal/Premium e Essencial; escolha **por sessão em `sessionStorage`**, nunca por UG/workspace; no Essencial, ocultar e não montar as abas Início do EMPROVEX e Início da Central; **preservar integralmente toda a Central de Depósitos 3D em ambos os modos**; manter operações e segurança; sem alteração de produção por esta documentação.
- **Governança:** GOV-SIMP-01; branch/PR isolados, validação proporcional a risco e publicação somente mediante aprovação expressa, pelo procedimento manual de release vigente.

---



## PUBLICAÇÃO CONFIRMADA — NOVO NÚCLEO INÍCIO + SAAS MATURITY R1 (27/10/2026 23h46 BRT / 28/10/2026 02h46 UTC)

> **ESTE É O ESTADO PRODUTIVO MAIS RECENTE COMPROVADO NESTE REGISTRO.** Prevalece sobre os checkpoints abaixo que afirmam que a produção ainda serve apenas a release Comercial R4 anterior, ou que o jurídico R4 ainda não foi publicado. **Não repetir build, deploy ou promoção deste SHA/deployment.** A criação deste registro na `main` é somente documental, pois `vercel.json` desabilita Git deployment.

- **PR visual integrado:** [#404](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/404), squash e **SHA exato da fonte publicada** `1e3dd437dbaeb3c039e0b6f8e1fd77545fa7114b`. Na aba Início, Orb antigo substituído pelo logotipo original `public/emprovex-logo (2).png`, apresentado com máscara transparente `public/emprovex-logo-core-mask.svg`, órbitas/animações CSS leves e resumo de pendências/avisos sob hover ou foco. Sem novos listeners/consultas ao Firestore; remove componentes orbitais legados. Essa mesma `main` incorpora o jurídico Comercial R4 do PR #402 e a proteção de recuperação do PR #403, além das demais funcionalidades vigentes.
- **Projeto/equipe:** `aprov-hgesms-projects/controles-de-empenhos-aprov`, ID `prj_DZ2y10DUaXrcHoRMaZ58FkTCvOHB`. Runtime de projeto Node.js 24.x, Next.js, equipe Vercel autenticada pelo fundador via PowerShell; conector Vercel do chat sem autorização ao escopo. O GitHub não publica automaticamente (`git.deploymentEnabled=false`).
- **Deployment anterior verificado imediatamente antes:** `dpl_Ff7WZwrmsJgA1CRF6nzAPydcye1A`, URL `https://controles-de-empenhos-aprov-9ssw5rjyc-aprov-hgesms-projects.vercel.app`, domínio `https://emprovex.com.br` em `Ready` antes desta promoção.
- **Novo deployment imutável:** `dpl_68MA69rfotu5GGLomvodHExG9S4L`, URL `https://controles-de-empenhos-aprov-ddrsmtqlm-aprov-hgesms-projects.vercel.app`; `target production`, `status Ready`. Build remoto: 1m18s; pós-build: 49s; consumo exibido: 6 CPU-minutos em 2 vCPU. Fonte exportada por `git archive` da `main` no SHA acima para `D:\EMPROVEX-RELEASE-1e3dd437dbae\deploy`; publicação por `vercel.cmd deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects`. **Um único deploy deste SHA**.
- **Evidência antes da promoção:** `vercel.cmd inspect <URL_NOVA> --scope aprov-hgesms-projects` confirmou ID, `production` e `Ready`. `vercel.cmd curl /api/health --deployment <URL_NOVA> --scope aprov-hgesms-projects` retornou `{"status":"ok","timestamp":"2026-10-28T02:45:13.786Z"}`. A versão anterior também estava saudável, mas não confundir esse health antigo com a nova release.
- **PROMOÇÃO REAL E PROVA DEFINITIVA:** `vercel.cmd promote <URL_NOVA> --yes --scope aprov-hgesms-projects` retornou **`Success!`** para exatamente `dpl_68MA69rfotu5GGLomvodHExG9S4L`. Depois, `vercel.cmd inspect https://emprovex.com.br --scope aprov-hgesms-projects` retornou **exatamente o mesmo ID**, `target production`, `status Ready` e a URL individual nova. **PUBLICAÇÃO DO DOMÍNIO = CONFIRMADA**. Não repetir `promote` nem criar outro deployment para esta release.
- **Certificação conhecida / limites:** Fast CI, Core Protection e Domain CI R2 do head do PR #404 concluíram `success`; TypeScript no Application CI passou. Application CI desse HEAD **falhou** no grupo legado G10: `verify:inicio-slow-planet-orbits` ainda tentava abrir o arquivo removido `InicioOrbitSystem.module.css`; outros gates legados foram consequência e o build do workflow ficou `skipped`. A compilação da Vercel, entretanto, terminou em `Ready`, e o fundador já havia aprovado a aparência no localhost. **Não registrar Application CI PASS nem declarar smoke autenticado integral, aceite jurídico R4 real, fluxos de cobrança, operações Warehouse ou backup/restauração testados em produção com base apenas no health básico.**
- **Escopo e continuidade:** deploy de código não publicou `firestore.rules`, não alterou IAM, dados, preços nem configurações de bancos. Para uma próxima release, usar `docs/EMPROVEX_RELEASE_POWERSHELL.md`: um SHA novo certificado, um novo staged, verificação, promoção do mesmo ID; inspecionar domínio antes de qualquer retry. Se houver erro do núcleo ou das áreas jurídicas, fazer correção em novo PR/SHA, nunca redeploy desnecessário do SHA já promovido.

---



## ESTADO VIGENTE — SAAS MATURITY R1 FINALIZADO EM CÓDIGO (27/10/2026, BRT)

> **Este checkpoint prevalece sobre o registro anterior “WORKERS 1/2” que descrevia W1 em DRAFT e a certificação de backups ainda não comprovada.** Integração no GitHub não equivale a nova publicação. **A produção do domínio continua na versão Comercial R4 anteriormente confirmada até uma promoção manual do fundador.**

- **Worker 1 concluído e INTEGRADO**: [PR #402](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/402), squash **`cc1909d2a84a652ccbb849298668569df733459d`**. Termos e Privacidade atualizados para Comercial R4, política de dados do cliente, links institucionais e aceite jurídico por versão R4 (`saas-r4-2026-10-27`). O aceite R4 é realizado pela API autenticada `/api/legal-acceptance` com token Firebase verificado, vínculo de workspace/identidade e criação imutável no Firestore via credencial administrativa do backend existente. Aceites R1 permanecem históricos; o aceite financeiro progressivo é independente. **`firestore.rules` NÃO foi alterado; não publicar/reaplicar Rules.** Verificações SAAS-DL Legal Validation (incluindo build e testes legados de Rules), Fast CI, Core Protection, W4 e InfinitePay Portal Integration: SUCCESS no SHA do PR.
- **Worker 2 concluído e INTEGRADO**: [PR #403](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/403), squash **`4f8c7a2ef1b51af70f2b7928085862e8ab3b1bbe`**, com proteção do `restore-inspect` e runbooks; validações de código da frente PASS.
- **Evidência Google Cloud fornecida pelo fundador em 27/10**: ambos os bancos (`ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1` e `emprovex-warehouse`) em `us-east1`, com PITR e delete protection ativos, agendamentos diários de retenção 14 semanas. Listagem real retornou **25 backups READY por banco (50 no total)**. Últimos snapshots READY de 27/10/2026 às 11:03:04Z no principal (`ccd1adc6-a15a-4a4a-adab-c0fbf2e88d32`) e 20:11:53Z no Warehouse (`352c3b02-2b70-45bc-b401-83b77af29ec6`).
- **Restauração real histórica DO WAREHOUSE comprovada no plano técnico**: operação Google Cloud `VBGHTglagY-cTVmjSXHn4RAqMXRzYWUtc3UIIgoQHho`, banco isolado `emprovex-restore-warehouse-2026-10-04`, backup snapshot 03/10/2026, iniciou 04/10 às 05:16:14Z, terminou às 05:25:24Z, `SUCCESSFUL` / `COMPLETED`; durou cerca de 9min10s. **Não confundir com RTO medido nem com certificação de integridade dos dados; recuperação isolada do banco principal também não foi executada neste ciclo.** Aplicar GOV-SIMP-01: sem nova restauração desnecessária agora.
- **Release futuro**: publicar o código jurídico R4 e sua API no MESMO deployment, **sem alterações em Rules, IAM, preços, billing ou bancos**, usando `docs/EMPROVEX_RELEASE_POWERSHELL.md`. Não tentar ativar apenas `CURRENT_LEGAL_BUNDLE` isoladamente. Git deployment está desabilitado; publicação Vercel depende de procedimento manual do proprietário, com smoke do novo aceite R4 e decisão de promoção. Não existe prova de deployment deste SHA neste checkpoint.

---



## CHECKPOINT SAAS MATURITY R1 — WORKERS 1/2 (27/10/2026, após Comercial R4)

> **Atualização de engenharia, SEM publicação no domínio**. A versão de produção confirmada permanece Comercial R4 `dpl_7f1s17cuDKevJYA5DLHd2EhqW7G8` até nova promoção explícita pelo fundador. Alterações GitHub `main` não fazem deploy automaticamente.

- **Worker 2 / Recuperação — CONCLUÍDO E INTEGRADO**: branch `feat/saas-maturity-w2-backup-recovery-r1`; PR [#403](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/403), squash na `main` **`4f8c7a2ef1b51af70f2b7928085862e8ab3b1bbe`**. Código `scripts/firestore-recovery.mjs`: novo `restore-inspect` *somente leitura* para conferir `backup.database`, `READY`, snapshot, expiração, identificador de backup e destino novo não utilizado; `restore-plan` explicitamente offline e NÃO verificado. Protege os bancos principal, Warehouse e `(default)` como destino de restore. Runbooks e template de evidência em `docs/RECUPERACAO_FIRESTORE.md`, `docs/BACKUP_RECOVERY.md` e `docs/saas-maturity/`.
- **Certificação de código do W2, NÃO de infraestrutura**: o coordenador corrigiu dois contratos textuais de regressão e acrescentou testes offline com gcloud simulado, cobrindo sucesso e falhas por backup de origem errada, estado não-READY, expiração, destino preexistente e erro de API; **14/14 testes de recuperação PASS**, além de `Recovery guardrails`, `EMPROVEX Fast CI` e `EMPROVEX Core Protection` **SUCCESS** no commit W2 antes do merge. A suíte W4 estava em execução no momento do merge, sem alegar PASS dessa suíte.
- **RECUPERAÇÃO REAL — PENDENTE DE EVIDÊNCIA EXTERNA**: nenhum `recovery:status` / `recovery:verify` real foi executado pelo coordenador nesta etapa, nenhuma confirmação atual de backup nativo `READY` dos dois bancos, nenhum restore isolado nem reconciliação de dados, nenhum RPO/RTO medido. Para certificar: obter resultado autorizado de leitura dos backups no Google Cloud e, em ação separada, autorização específica de restauração real em banco isolado, com avaliação de custos. **Não afirmar backup/restauração comprovados só por CI ou PR.**
- **Worker 1 / Jurídico — EM REVISÃO, SEM MERGE**: branch `feat/saas-maturity-w1-commercial-legal-r1`; PR [#402](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/402) em DRAFT. Documentos comerciais R4 e política de dados próprios preparados; bundle R4 proposto permanece INATIVO. O `CURRENT_LEGAL_BUNDLE` e as Firestore Rules existentes referem-se a `saas-r1-2026-10-01`: não publicar textos jurídicos materialmente alterados com aceite antigo e não ativar novo bundle sem alinhar leitura/criação autorizada de registro de aceite. O coordenador iniciou os checks e corrigiu contratos de texto sem tocar produção. Revisão jurídica humana e estratégia controlada de nova versão permanecem pendentes.
- **GOV-SIMP-01**: nenhuma Firestore Rule financeira extra será implementada para impedir extração dos próprios dados de cliente inadimplente. A eventual adequação de Rules para **aceite legal versionado** é assunto distinto e deverá preservar autenticação, imutabilidade e isolamento entre workspaces.
- **Handoff operacional**: nenhum redeploy da R4, nenhuma criação de banco, nenhuma alteração de IAM, billing/PITR, Rules, segredo ou cobrança foi executada neste checkpoint.

---



## ESTADO VIGENTE — LIBERAÇÃO COMERCIAL R4 E DIRETRIZ DE DADOS DO CLIENTE (27/10/2026, BRT)

> **ESTE REGISTRO É O ESTADO OPERACIONAL MAIS RECENTE e prevalece sobre afirmações históricas de que a cobrança InfinitePay está apenas em piloto, que o modo é OBSERVE ou que a release R16/R2 é a versão corrente do domínio.** Histórico anterior permanece para rastreabilidade. Detalhamento, evidências, limitações e nova política permanente estão no capítulo **“COMERCIAL R4 — LIBERAÇÃO E DIRETRIZ DE PROPRIEDADE/PORTABILIDADE DOS DADOS”**, ao final deste memorial.

- **Produção confirmada pelo fundador:** `https://emprovex.com.br` → Vercel `dpl_7f1s17cuDKevJYA5DLHd2EhqW7G8`, URL individual `https://controles-de-empenhos-aprov-fa2kg1jn0-aprov-hgesms-projects.vercel.app`, `Ready`, `production`, após promoção e `vercel.cmd inspect`. Fonte de código PR #401 (squash `a34bec2d86af23b45b8f31eff40ebc449ec8925d`).
- **Cobrança comercial ATIVA:** painel Admin → Assinaturas mostra `ENFORCE`, `EXIGINDO PAGAMENTO` e `Entitlements preparados`; pagamento pela InfinitePay e liberação pós-Pix efetivamente verificados pelo fundador em perfil de teste. Controle financeiro por workspace elegível, não por usuário avulso. VIPs/contratos legados preservados.
- **Decisão comercial e técnica permanente — GOV-SIMP-01:** **a assinatura remunera as funcionalidades e os serviços do EMPROVEX, NÃO a propriedade dos dados do cliente.** A inadimplência suspende a experiência operacional contratada, mas não deve impedir a recuperação legítima dos dados do próprio setor por responsável autorizado. **Não criar uma nova camada de bloqueio financeiro nas Firestore Rules apenas para dificultar essa recuperação** nem promover migração massiva para APIs por esse motivo isolado. **Preservar integralmente isolamento entre workspaces/UGs, autenticação, integridade, confidencialidade, autorização de operações sensíveis e proteção contra acesso indevido.** O acesso a dados de outras OMs jamais é permitido por esta diretriz.
- **Separação de evidências:** testes reais comprovam o bloqueio e a liberação pela interface/API, **não** uma certificação universal do acesso direto via SDK/Firestore; Rules efetivamente publicadas não foram alteradas nesta release nem certificadas nesta sequência. Permissão de consulta/exportação de dados próprios não equivale à concessão irrestrita de alterações ou execução de funcionalidades.
- **Operação:** **não refazer** build, deploy ou `promote` da R4; documentos podem ser atualizados na `main` sem publicar novamente (deploy Git desabilitado). Rollback comercial: Admin → Assinaturas → `Voltar para observação`, sem redeploy.

---


## ESTADO VIGENTE — EMPROVEX R2 PUBLICADO E MÉTODO DE PUBLICAÇÃO VERCEL (24/10/2026)

> **Atualização que prevalece sobre os checkpoints anteriores de release.** Os registros antigos abaixo permanecem históricos, inclusive instruções com `--prebuilt`, PR #371 ainda aberto ou publicação bloqueada. A fonte operacional atual é o [runbook revisado](./EMPROVEX_RELEASE_POWERSHELL.md).

**Release confirmada pelo Fundador em PowerShell:** PR [#371](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/371) mesclado por squash; **SHA do código publicado** `7d4eafd582bff8620d98258c560e8cd0a1f2ef60`; domínio oficial `https://emprovex.com.br`.

- **Equipe/projeto:** `aprov-hgesms-projects` / `controles-de-empenhos-aprov` (`prj_DZ2y10DUaXrcHoRMaZ58FkTCvOHB`).
- **Deployment imutável publicado:** `dpl_86S1rK9dAZoAgQ385AEfB81LEPbz`, `https://controles-de-empenhos-aprov-3srmos6lf-aprov-hgesms-projects.vercel.app`. Ambiente `production`; status `Ready`.
- **Provas da publicação:** `vercel.cmd curl /api/health --deployment <URL_IMUTAVEL> --scope aprov-hgesms-projects` retornou `{"status":"ok","timestamp":"2026-10-24T20:57:35.433Z"}`; `vercel.cmd promote <URL_IMUTAVEL> --yes --scope aprov-hgesms-projects` retornou `Success!`; `vercel.cmd inspect https://emprovex.com.br --scope aprov-hgesms-projects` apresentou o **mesmo ID**, target `production`, `Ready`. Build remoto 58s; pós-build 40s; uso de 4 CPU-minutos. **DEPLOY/PROMOÇÃO/DOMÍNIO=PASS.**
- **Limites da evidência:** saúde básica e promoção estão comprovadas; smoke autenticado da câmera/saída móvel, autorização/IAM de escrita e triagem de avisos de dependências são verificações separadas. Firestore Rules não foram alteradas nesta publicação.

### Procedimento canônico consolidado — GOV-SIMP-01

1. **Uma release, um deployment:** integrar o commit funcional certificado na `main` e verificar o SHA; exportar os arquivos com `git archive` para uma pasta limpa **sem `.git`**, vincular ao projeto existente, conferir nomes dos segredos e executar **uma única vez** `vercel.cmd deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects`. Este é o método de **build remoto** efetivamente aprovado no plano Hobby em 19/10 e 24/10; não usar `vercel build --prod`/`--prebuilt` por hábito.
2. **Retomada sem redeploy:** guardar URL individual e ID do deployment assim que estiver `Ready`. A partir daí, erros de shell, parser, TTY, health ou codificação **NÃO AUTORIZAM** repetir clone, `link`, build, deploy ou promoção sem conferir estado. Usar diretamente `vercel.cmd inspect <URL> --scope ...` e `vercel.cmd curl /api/health --deployment <URL> --scope ...`.
3. **Sem wrappers frágeis:** não extrair `target`, `Ready` ou URL de `vercel inspect` por regex sobre stdout/stderr, formato de tabela, cores ou caracteres Unicode. Não passar `--no-color` para `vercel curl` na CLI 64.0.2 — a opção é repassada ao `curl` nativo, que falha com exit code 2. Preferir os comandos oficiais isolados.
4. **GO antes da promoção:** conferir `target production`, ID e `Ready`, health básico, health restrito do Warehouse autenticado e smoke em workspace QA isolado (incluindo câmera, retirada multilinha, saldos e regras de validade), sem imprimir token ou segredo. Em seguida `vercel.cmd promote <MESMA_URL> --yes --scope aprov-hgesms-projects` e `vercel.cmd inspect https://emprovex.com.br --scope aprov-hgesms-projects` para confirmar o **mesmo ID**. Falha/timeout após `promote`: inspecionar domínio **antes** de repetir.
5. **Separação de responsabilidades:** deploy de código não altera Firestore Rules nem deve gerar migração de dados. `vercel.json` mantém `git.deploymentEnabled=false`: commits de documentação posteriores ao SHA funcional não exigem redeploy. Proibir novos scripts de release que reinstalem verificações falhas sem teste em CLI real.

### Auditoria da sequência de cinco erros que não podem se repetir

- Primeiro script: tentou promover sem staged preparado e fez verificações desnecessárias antes de consultar estado.
- Segundo bloqueio: checou árvore Git após `vercel link`, confundindo modificações locais com código de release (arquivo específico não comprovado).
- Terceiro: retomada refez preparação e vínculo antes de verificar a existência de staged.
- Quarto: parser rejeitou `target production`/`status Ready` já exibidos pelo `vercel inspect`; falso negativo.
- Quinto: `--no-color` encaminhado ao `vercel curl` causou exit code 2 por argumento inválido. **São erros dos scripts de automação, não do build do EMPROVEX.**

**Regra operacional permanente:** um SHA funcional, um staged imutável, uma verificação e uma promoção por ID. Registro complementar de evidências no [PR #371](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/371#issuecomment-6389486383).

---
## R2 OPERADOR MÓVEL — COMPLEMENTO EXECUTIVO DE 24/10/2026 (REVISÃO ESPECIAL, GOV-SIMP-01)

**Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`. **PR:** #371, branch `feat/mobile-outbound-unified-scan-r2`. **HEAD de código deste checkpoint, antes do presente memorial:** `949852a342be7f79819c69a2093b646ddc7b465f`. Reconsultar HEAD atual, nunca confundir checkpoint com release validado.

**Autorização atual do Fundador:** o Application CI está sob revisão de eficiência e foi dispensado como critério de bloqueio nesta missão. Não alterar seu arquivo/política nem reintroduzir guards de FEFO. Em substituição, exigir uma revisão final independente com typecheck, Fast CI, autenticação Firestore Emulator, inspeção de código e testes adversariais de saída. **Não usar ausência de CI para liberar falhas de segurança ou estoque.**

**O que foi gravado nesta sequência de commits:**
- `d6d7d87`: corrige `SyntaxError` do guard MOBILE-C (`scripts/verify-mobile-r1-intake-allocation.mjs`), identificado nos logs do Application CI anterior. O Application CI não é mais gate obrigatório nesta missão.
- `f85381b`, `8ff31d4`, `be72f3a`, `4cb3e23`: saída móvel preserva `withdrawalId` e linhas idênticas em `sessionStorage` antes do envio, permite reconciliar após resposta perdida/reload com mesma identidade, impede nova retirada quando resultado é desconhecido; bloqueia recuperação corrompida; seleciona automaticamente material único de local lido; valida UG não nula; inclui testes contratuais.
- `3e58589`: prioriza reconhecimento de movimento legado comprometido antes de aplicar restrição atual de vencimento/local; evita que alteração posterior à baixa impeça replay idempotente (sem alterar o motor de saída nova).
- `65ff69e`: no legado v1, a resposta `FINALIZED` exige prova read-only de movimentos e consumos determinísticos por linha (incluindo o caso de header falsamente finalizado). Injeções de interrupção limitadas estritamente ao Emulator de teste.
- `7b2a42d`, `2150c5b`, `949852a`: testes QA no Firestore Emulator de seis pontos de interrupção v1, repetição sem nova baixa e rejeição de header falso `FINALIZED`; verificação do auditor.
- `cca22ed`: `warehouseWithdrawalLegacyAudit.ts` fornece auditoria explicitamente solicitada, limitada, somente leitura e escopada por workspace/UG, incluindo conferência dos consumos e movimentos de headers FINALIZED. Não reconcilia registros reais nem substitui o comando original.

**Evidências prévias verificadas:** no `5a60f5b`, Fast CI, Core Protection, Recovery, SAAS Legal, Warehouse Server R2 Smoke, Visual QA e Browser E2E exibiam sucesso; Application CI 40114104513 falhou por sintaxe do guard MOBILE-C (corrigido depois). Os resultados prévios NÃO certificam os commits deste checkpoint. O workflow Legal no `be72f3a` apontou TS2322 por UG anulável em `WarehouseMobileOutbound.tsx`; corrigido em `4cb3e23`, ainda exige nova prova no HEAD final. O `npm ci` desse workflow reportou 15 advisories (6 moderados, 7 altos, 2 críticos); classificação de alcance e exposição pendente — não executar `npm audit fix --force` cegamente.

**Critérios de fechamento:** após estabilizar HEAD, marcar PR Ready uma única vez para disparar `Warehouse Server R2 Smoke`, `Browser E2E`, Fast CI, Legal/typecheck, Core, Recovery e Visual QA. **Application CI pode falhar/ficar skip sem invalidar, conforme autorização atual**. Inspecionar logs do Emulator para os 6 testes legados e falso FINALIZED; corrigir falhas reais. Validar câmera em aparelho físico e confirmar isoladamente ausência de FEFO/seleção de lotes; não modificar Central 3D. Nenhum merge, publish Vercel, alteração de Rules ou dados reais foi autorizado.

**Handoff:** onde — PR #371 com melhorias de confiança v2+recuperação v1; o que — certificação independente do Application CI; quem — executor GitHub/ChatGPT; próximo — terminar QA no HEAD final, publicar evidências no PR sem criar commit após CI; quem — executor; Fundador somente autoriza eventual publicação final, em etapa distinta.

---


## CERTIFICAÇÃO DE ATOMICIDADE R2 — 24/10/2026

### Decisão arquitetural e implementação final
**Novas retiradas com múltiplas linhas passam a ser um único commit transacional Firestore (ACID), sem saga parcial.** Arquivo `lib/server/warehouseWithdrawalAtomicWrite.ts`; ativado por `finalizeWarehouseWithdrawalServer` em `lib/server/warehouseWithdrawalWrite.ts` quando o identificador da retirada ainda não possui cabeçalho. Os cabeçalhos da implementação anterior permanecem no caminho histórico de recuperação, sem conversão para v2.

A transação lê e valida no servidor, sob workspace/UG autenticados: destino ativo, material/unidade/código de barras, posição/local/subposição ativos, saldo oficial, referências de validade, incluindo bloqueio de vencidos, e idempotência. A função prepara **todas** as linhas em memória (atualizando virtualmente o mesmo saldo/local/referência entre linhas) e só entrega writes ao Firestore se todas validarem. O único commit abrange movimentos, saldos material e por posição, referências de validade, consumos SISCOFIS `PENDING` e cabeçalho `FINALIZED` com `atomicVersion:2`. Até 40 linhas pelo contrato existente; leitura e escrita limitadas para falhar fechado se a operação ficar grande demais.

A identidade imutável é formada pelo `withdrawalId` e hash integral dos campos do comando. Movimentos e consumos têm IDs determinísticos. Uma retirada já finalizada é retornada como replay sem escritas, sem depender do saldo/validade atual; um payload divergente com o mesmo ID retorna conflito. Duas requisições concorrentes do mesmo ID são serializadas por precondições transacionais Firestore; basta repetir a mesma identidade após erro de concorrência ou resposta perdida. `lotId:null` só consome saldo comprovadamente sem atribuição de validade, com leitura de referências e mutex de atribuição. Sem FEFO nas interfaces nem alteração visual da Central 3D.

### Provas de testes autenticados isolados
**Código testado:** `61cef6e1939f441f6fa844bf4cebe71f49e47f52`.
**GitHub Actions:**
- Warehouse Server R2 Smoke `40113559078`: **PASS** (Firestore Emulator e autenticação, `demo-emprovex-security`). Job `120930391110`.
- EMPROVEX Fast CI `40113559067`: **PASS**.
- EMPROVEX Core Protection, Recovery guardrails, SAAS-DL Legal Validation, VISUAL-R1 W4 QA e Browser E2E On Demand `40113559083`: **PASS**.
- Application CI integral `40113559099`: **PENDING** no instante deste registro. Confirmar antes de qualquer GO; não alegar sucesso antecipadamente.

Log verificável do Emulator:
- `PASS: falha injetada na linha 2 = rollback integral, sem header/consumo`.
- `PASS: falta de estoque na linha 2 não confirma a linha 1`.
- `PASS: 2 linhas confirmadas com saldo/lote/consumo/cabeçalho em um commit; replay sem duplicação`.
- `PASS: concorrência e retry mesma identidade resultam em uma única baixa`.
- `PASS: resposta perdida após commit recuperada por replay exato, sem débito duplicado`.
- `SERVER MANUAL ENTRY EMULATOR PASS`.

Injeções de falha só ficam ativas em Emulator `EMPROVEX_WAREHOUSE_ADMIN_EMULATOR=1` combinado ao projeto `demo-emprovex-security`. Nenhum script de produção usa essas variáveis; nenhum deploy, alteração de Rules, escrita em workspace real ou merge foi executado.

### Gate de release e legado
**Atomicidade da nova retirada v2: CERTIFICADA EM EMULATOR.** **Publicação: NÃO AUTORIZADA.** Antes de liberar: Application CI integral no SHA correto, validação QA autenticada, e avaliar cabeçalhos v1 antigos `FINALIZING/PARTIALLY_APPLIED`: não podem ser reemitidos com novo withdrawalId. O recuperador v1 idempotente permanece por compatibilidade histórica, mas não é convertido automaticamente nem foi certificado nesta rodada com injeção multietapa v1. Encaminhar eventuais registros incompletos para reconciliação supervisionada. Sem atalhos de merge nem alteração das Firestore Rules.

**Handoff GOV-SIMP-01:** Onde estamos — PR #371 branch `feat/mobile-outbound-unified-scan-r2`, v2 transacional commit `61cef6e...`; o que fazemos — certificação de release além do contrato atômico; quem faz — executor ChatGPT/GitHub; próximo — observar Application CI, conferir backlog legado e smoke autenticado em QA; quem fará — executor conclui testes e Founder valida promoção manual somente após GO expresso.

---


## CHECKPOINT ADICIONAL — REMOÇÃO DE FEFO DA TRANSFERÊNCIA E GATE DE RELEASE (24/10/2026)

**Estado verificável:** branch `feat/mobile-outbound-unified-scan-r2` no código `e1bfa2606658631c6b25999d5b54cc0305067713` antes deste commit de memorial; PR #371 aberto, **NO-GO**. Antes de qualquer sequência, verificar se o novo HEAD/CI mudou. Produção R1 `47323e3b8583e68c8344336a265ddd7d63563c36` preservada.

**Auditoria adicional:** o motor `lib/warehouse/transfer.ts`, compartilhado entre Transferência Mobile e servidor, ainda ordenava as referências técnicas por `expiresOn` e código, priorizando vencimento indiretamente. Isso contrariava remoção integral do FEFO. Alterado `sortLotsForTransfer` para ordenação determinística por `lot.id`, sem comparar validade ou código (commit `771133ca`). Novo teste em `scripts/warehouse-location-transfer.test.mjs` cria dois registros com expiração inversa à ordem de ID e comprova atribuição estável pelo ID (commit `e1bfa260`). Mantém intactos saldos, posições e identificadores históricos. **Validar teste no CI novo**.

**Gates de CI legados adicionais corrigidos:** `scripts/verify-mobile-r1-physical-query.mjs` deixou de exigir `warehouseLotOriginLabel` e passa a verificar `expiryLabel(lot.expiresOn)`; `scripts/verify-mobile-r1-outbound.mjs` não exige `selectWarehouseFefoLot`; `scripts/verify-adm-deposito-phase-9.mjs` rejeita `selectWarehouseFefoLot` e confirma projeção por depósito, sem alterar arquitetura do croqui. A última execução confirmada de Application CI tinha alcançado e passado Fase 7 e Fase 8, mas parou no guard antigo MOBILE-E; o HEAD posterior precisa de certificação completa. **Não declarar Application CI PASS enquanto não houver run completa com conclusão success**.

**Segurança de saída:** teste autenticado Firestore Emulator (run `40069216965`, SHA histórico `65980d...`) passou para bloqueio de expedição com `lotId:null` quando todo saldo está atribuído, rejeição de referência vencida, rejeição de base falsa e compatibilidade Excel 10/11 colunas. Confirmar reexecução no SHA final. O endpoint ainda tem **BLOCKER S2**: a retirada com várias linhas não é atômica, registra consumos após cada movimento e pode falhar parcialmente; idempotência por linha não equivale a rollback de toda retirada. Exige solução transacional/saga certificada e smoke humano QA. **PUBLICAÇÃO EXPRESSAMENTE BLOQUEADA**, não fazer merge, Vercel, Rules ou dados reais.

**Handoff:** onde — PR #371/branch acima; fazendo — remover FEFO residual e certificar servidor; quem — executor ChatGPT/GitHub; próximo — CI completo, solucionar S2, testes multi-linha e smoke autenticado; quem fará — executor implementa, fundador valida e promove somente após GO explícito.

---


## ATUALIZAÇÃO EXECUTIVA DE AUDITORIA — PR #371, 24/10/2026

**STATUS: NO-GO / PR #371 DRAFT após os testes.** Verificar o HEAD corrente antes de executar; HEAD de código no checkpoint: `d6666263bae229826283721d4d3a881966759078`. A versão anterior na main/produção permanece `47323e3b8583e68c8344336a265ddd7d63563c36`; sem publicação, sem merge ou alteração de Rules.

### Evidência mais recente
- **Application CI:** correção real e confirmada para guard da **FASE 7** (FEFO extinto) e da **FASE 8** (FEFO extinto). CI alcançou o guard **MOBILE-E**, que falhou por exigir `warehouseLotOriginLabel` na tela; adaptado para validade `expiryLabel(lot.expiresOn)` em commit `98c1966`. Guard **MOBILE-G** também passou a rejeitar FEFO e exigir planejamento neutro, commit `d666626`. Nova execução de CI integral acionada; **obter conclusão do SHA vigente**.
- **Warehouse Server R2 Smoke**, execução **40069216965** no SHA `65980d2...`: **PASS no Firestore Emulator**, com passos de autenticação, segurança multi-tenant, XLSX, Motor de Confiança, novo bloqueio de `lotId:null` com saldo atribuído, bloqueio de referência vencida e rejeição de quantidade-base adulterada. Evidências nos logs (ex.: `PASS: servidor rejeita bypass lotId nulo`, `PASS: retirada rejeita base forjada`, `PASS: novo Excel com 10 colunas ... legado 11`). Esses resultados pertencem ao SHA citado; repetir/confirmar no HEAD final.
- Código `lib/server/warehouseOutboundWrite.ts` agora consulta referências canônicas ao baixar `lotId:null` e calcula saldo livre na transação, com mutex `lotAttributionLocks`. O servidor compara `expectedBaseQuantity` com a conversão canônica antes do débito. `lib/server/warehouseWithdrawalWrite.ts` faz validação sintática/campo e repassa expectativa de base. Retenção de identificadores técnicos `lotId` para histórico, sem visualização de códigos no operador. Referência explícita vencida rejeitada no servidor.
- Modelo Excel novo sem lote, 10 colunas; importador ainda lê histórico de 11 colunas. Menções antigas a lotes físicos nas interfaces revisadas foram substituídas por validade/referências de validade; Central 3D não foi alterada.

### Impedimento de release que não é um simples guard
**S2 CRÍTICO — retirada composta não é atômica:** `finalizeWarehouseWithdrawalServer` aplica linhas em transações distintas e só depois registra consumo/progresso. Se uma linha posterior falhar, pode haver retirada parcial. A idempotência por linha facilita recuperação, mas não garante rollback, ausência de consumo pendente ou ausência de inconsistências em caso de concorrência. **Antes de GO**: implementar fechamento transacional de todos os movimentos e consumos num único commit, quando viável, **ou** saga de recuperação robusta, observável e certificada no Emulator com injeção de falhas a cada passo, incluindo múltiplas linhas, replays, concorrência, falhas de rede, invariantes de saldo, consumo e SISCOFIS. O servidor não deve aceitar plano adulterado. Outro ponto: metadados textuais client-side em documento de consumo exigem validação de origem server-side antes de certificação.

### Handoff padrão GOV-SIMP-01
**ONDE ESTAMOS:** branch do PR #371 com correções de CI FASE 7, 8, MOBILE-E e MOBILE-G; Smoke server PASS em checkpoint anterior, nova certificação completa em andamento; NO-GO.
**O QUE ESTAMOS FAZENDO:** finalizar CI e validar atomicidade/recuperação do fluxo de saída automatizado sem FEFO nem seleção de lotes.
**QUEM ESTÁ FAZENDO:** ChatGPT executor GitHub; Fundador apenas autoriza versão e opera Vercel no PowerShell.
**O QUE FAZER A SEGUIR:** consultar HEAD, logs do Application CI e Warehouse Server R2 Smoke do SHA final, corrigir novos guards legados sem restaurar FEFO, solucionar S2 com testes adversariais, executar smoke autenticado em QA isolado; somente então pedir GO do Fundador.
**QUEM FARÁ:** executor técnico nas branches; Fundador valida visual/manual e promove o deployment apenas depois de autorização.

---


## AUDITORIA FUNCIONAL E DE SEGURANÇA R2 — CHECKPOINT E BLOQUEIO DE RELEASE (24/10/2026)

**PR #371: DRAFT / NÃO PUBLICAR / NO-GO.** Repositório `aprov-hgesm/Controles-de-Empenhos---Aprov`; branch `feat/mobile-outbound-unified-scan-r2`. HEAD de código auditado imediatamente antes deste commit documental: `11030cd4249dde0dd1279f26b8f58f3b66d522cd`. Após salvar este documento, obter novo HEAD e verificar novamente pipelines no SHA vigente. Nenhum merge, deploy, alteração de Rules ou dados reais foi executado nesta auditoria.

### 1. Correções efetivamente gravadas na branch
- **Guard do Application CI, FASE 7:** `scripts/verify-adm-deposito-phase-7.mjs` já não exige `selectWarehouseFefoLot` ou `warehouse-fefo-recommendation` como funcionalidades ativas. Em vez disso, rejeita seu reaparecimento na implementação. O teste Playwright `tests/e2e/warehouse-phase-7.spec.mjs` passou a verificar a *ausência* de recomendação FEFO. O histórico da FASE 7 pode conservar FEFO em testes/documentos legados sem habilitar a função na operação.
- **Varredura de UX** nos componentes relacionados: WarehouseItemControlOperational, WarehouseCroquisR1Operational, WarehouseIsometricPreview, WarehouseImmediateConsumptionPanel, WarehouseLocationInspectionLocalPreview e WarehouseMobileOutbound; mensagens ao operador mostram validade ou referências de validade, não escolha/código de lotes. Preservados croqui e Central 3D sem alteração de geometria, comportamento ou renderização.
- **Excel:** `lib/server/warehouseBulkStockWorkbook.ts` gera template novo com **10 colunas**, excluindo `Lote (opcional)`. Seu parser identifica e aceita cabeçalhos antigos de **11 colunas**, conservando a informação lida na estrutura interna para compatibilidade. `WarehouseBulkManualEntryOperational.tsx` não propaga `row.lot` ao comando de entrada, deixando o motor gerar referência técnica de validade. Teste `scripts/warehouse-bulk-stock-r1.test.ts` passa a cobrir formatos novo/legado, cabeçalhos e índices de procedência/referência.
- **Validade vencida diretamente na API:** `lib/server/warehouseOutboundWrite.ts` rejeita referência de validade explicitamente vencida usando `warehouseLotExpiryState(lot)==='EXPIRED'` com `WAREHOUSE_OUTBOUND_LOT_EXPIRED`; teste contratual adicionado em `scripts/mobile-outbound-unified.test.mjs`. A proteção se aplica ao motor canônico server-side, independente do planejamento do navegador.
- Histórico de commits de implementação desta intervenção: `1b4b932`, `dac2eaf`, `9b32936`, `b78b742`, `9d15f3e`, `0f3e307`, `c8a89ad`, `51bbb25`, `e7ed2ca`, `caefc03`, `9aba38c`, `844f0e9`, `11030cd`. Consultar PR #371 para HEAD real e patches.

### 2. Auditoria funcional — observações comprovadas por inspeção de código
- Scanner unificado limita `EXPECT_PRODUCT_OR_LOCATION` ao fluxo de saída. Produto com único local ativo é escolhido automaticamente; código de posição permite selecionar material naquele local. Quatro etapas: leitura, quantidade, destino, revisão/confirmar. Necessário smoke em celular real para câmera, recuperação de rede e acessibilidade.
- `WITHDRAWAL_FINALIZE_MOBILE` passa por `verifyWarehouseRequest` e `bindWarehouseMobileTrust`; o endpoint ignora `withdrawnBy` vindo do aparelho e injeta `access.email` autenticado. Não é uma identidade digitável no Mobile. `WITHDRAWAL_FINALIZE` no Desktop mantém contrato legado.
- `applyWarehouseExpressOutboundServer` reconstrói material, saldo, local, subposição, barcode e referência técnica a partir de registros em Firestore do **workspace/UG autenticados**; valida quantidades e idempotencyKey; movimentação, saldo agregado, saldo por posição e redução de referência explícita compartilham commit da transação **por linha**. Guard novo impede referência vencida explícita.
- Planificador `planMobileOutboundAutomaticLots` é determinístico por ID de referência, sem priorizar vencimento, rejeita atribuição superior ao saldo e não escolhe referências vencidas/inativas. Mas é executado no **cliente**, razão pela qual não é uma validação autoritativa.
- Verificação textual dos componentes de UX do escopo modificado não identificou seleção ativa FEFO nem rótulos visíveis de lote. `lotId/lotCode` técnicos permanecem no ledger, no servidor e em contratos históricos. **Uma varredura estática não equivale a smoke visual completo.**

### 3. BLOQUEADORES DE SEGURANÇA E INTEGRIDADE — NÃO OMITIR
**BLOCKER S1 — plano sem referência pode burlar saldo rastreado.** `applyWarehouseExpressOutboundServer` aceita `lotId:null` e, nesse caso, faz baixa em saldo agregado/local sem verificar, na mesma transação, a quantidade do local já atribuída a referências de validade; o navegador decide quando enviar null. Um cliente autenticado adulterado pode enviar linha sem lotId, mesmo quando o saldo não atribuído seja insuficiente, produzindo divergência entre referências de validade e saldo físico. Confirmado por leitura da implementação; **não foi explorado contra produção**. Correção requerida: cálculo/revalidação autoritativa do saldo livre no servidor, sem confiar no plano do cliente, com proteção contra inserção/alteração concorrente de referências. Criar testes autenticados no Emulator para freeQty=0, freeQty parcial, referência vencida/inativa, outra UG e concorrência.

**BLOCKER S2 — retirada completa não é transação atômica.** `finalizeWarehouseWithdrawalServer` cria cabeçalho `FINALIZING`, depois itera as linhas e chama `applyWarehouseExpressOutboundServer` em commits separados; só depois de cada baixa grava consumo e `appliedLineCount`. Falha de rede, bloqueio na linha N ou interrupção entre baixa/consumo pode deixar retirada `PARTIALLY_APPLIED` ou movimento sem consumo até retomada. Idempotência por linha e retry mitigam duplicações, mas **não garantem rollback total nem finalização automática**. A UX não deve afirmar que nenhuma linha foi aplicada após falha. Correção requerida: transação atômica por retirada (quando dentro dos limites Firestore) OU protocolo de saga recuperável certificado, com estado de recuperação explícito ao operador, compensação/consistência comprovadas e rejeição de encerramento incompleto. Testar injeção de falhas após cada estágio, mesma chave e chaves diferentes, concorrência, reconciliação sem baixa duplicada, estado de consumo/SISCOFIS, saldos e lotes.

**BLOCKER S3 — campos de quantidade/cadastro aceitos do cliente sem pré-validação do lote completo.** `isLine` confere sintaxe e números positivos, mas os campos `baseQuantity`, `materialDescription`, `lotCode`, `positionLabel` e `presentationLabel` provêm do input do cliente. O motor por linha recalcula baseQuantity a partir da apresentação autorizada; deve-se comparar explicitamente baseQuantity declarado à soma server-side antes de gravar e derivar os dados de documentação exclusivamente de entidades verificadas. O hash de payload por linha não valida integridade econômica ou soma cross-line antes do primeiro movimento. Criar casos de adulteração e verificar saída fail-closed sem gravações.

**Conclusão da auditoria:** as proteções existentes de autenticação, isolamento, idempotência por linha e validação de saldo são úteis, porém não bastam para certificar a nova saída automatizada em várias referências. **NÃO LIBERAR RELEASE R2**, ainda que todos os checks existentes fiquem verdes: a matriz adversarial precisa cobrir S1/S2/S3 com evidência de Emulator + smoke autenticado. Não reduzir as barreiras apenas para tornar o CI verde.

### 4. Estado CI e orientação
- Na base de código `c6c356a3`, Fast CI, Core Protection, Recovery, Warehouse Server R2 Smoke, Legal, Visual e Browser E2E passaram; Application CI falhou precisamente porque o guard FASE 7 exigia `selectWarehouseFefoLot` e `warehouse-fefo-recommendation`.
- O ajuste de guard foi commitado. No checkpoint deste documento, as execuções para `11030cd...` ainda estavam **em andamento**; nunca converter `in_progress` ou `skipped` em PASS. Retomar pelo PR #371, consultar SHA atual e logs, corrigir quaisquer regressões.
- Core e Recovery já exibiram PASS nas primeiras rodadas de `11030cd...`; Fast CI também retornou PASS, mas **certificação completa no HEAD final ainda não foi observada** e checks podem ser refeitos por este commit documental.
- Não realizar deploy Vercel, merge, promoção, alteração de Rules/IAM nem acesso de escrita a dados reais nesta fase. Autorizar publicação somente após cobertura autenticada de todas as retiradas e decisão explícita do Fundador.

### 5. Próximo executor — handoff exigido
**ONDE ESTAMOS:** PR #371 em DRAFT, código R2 implementado e guard histórico corrigido; segurança de retirada multi-linhas **NO-GO**. HEAD de código `11030cd...` antes do checkpoint; main anterior `47323e3...`.
**O QUE ESTAMOS FAZENDO:** validação server-side das referências e estoque livre, transação/reconciliação de retirada multi-linha, CI completo.
**QUEM ESTÁ FAZENDO:** executor ChatGPT com acesso ao GitHub; não delegar publicação ao executor.
**O QUE FAZER A SEGUIR:** implementar correção S1/S2/S3 reaproveitando o motor canônico e preservando contratos; testar no Firestore Emulator concorrência e rollback/retry; validar Desktop + Mobile e validade; observar Application CI e todos os workflows no SHA final; executar smoke real autenticado em QA isolado; atualizar memorial e PR com evidências de GO/NO-GO.
**QUEM FARÁ:** próximo executor ChatGPT para implementação e certificação; Fundador só valida smoke e, quando autorizado, executa PowerShell/Vercel manualmente.

---

## CHECKPOINT VERIFICADO — PR #371 / WAREHOUSE R2 / RESULTADO DOS CHECKS (24/10/2026)

**Esta seção é o PONTO DE RETOMADA MAIS RECENTE; prevalece sobre status históricos abaixo.** Fonte primária: [PR #371](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/371), [handoff integral](./EMPROVEX_HANDOFF_WAREHOUSE_R2_SAIDA_VALIDADE_2026-10-24.md) e [handoff técnico](./MOBILE_OUTBOUND_R2_VALIDITY_ONLY_HANDOFF.md). Verificado no GitHub em 24/10/2026, nos checks associados ao **HEAD DE CÓDIGO c6c356a336e24e90116dc074b70894e815d4cdd5** (antes deste commit documental). Ao retomar, consultar o HEAD **novo** e repetir os checks no SHA final — nenhuma linha aqui é certificação do commit que atualiza o memorial.

### Estado de branch e segurança operacional
- Repositório correto: `aprov-hgesm/Controles-de-Empenhos---Aprov`. PR **#371 ABERTO, NÃO MESCLADO**; branch `feat/mobile-outbound-unified-scan-r2`, alvo `main`.
- Base `main` no checkpoint: `47323e3b8583e68c8344336a265ddd7d63563c36`, versão R1 anterior. Não houve nesta frente merge, deploy, mudança de Firestore Rules, IAM, dados reais, domínio ou promoção de Vercel; **R2 NÃO está em produção**.
- Não confundir PR #371 (Saída Móvel R2 + validade sem FEFO) com PR #369 (Motor de Confiança R1 já em produção). Reusar API canônica, identidade de servidor, autorizações e idempotência existentes.
- O PR tinha **38 arquivos alterados e 16 commits** no HEAD de código referenciado. O documento é apenas checkpoint, não aprovação de release.

### Contrato funcional irrevogável nesta frente
1. Saída Móvel com **quatro etapas**: ler **item OU local/subposição** no mesmo scanner; escolher item quando o código for de local, ou escolher local apenas quando houver mais de um com saldo do item; informar quantidade; indicar destino; revisar/confirmar. A identidade de quem retira é a do usuário autenticado, definida no servidor — não exibir campo livre de responsável no Móvel. Mantido campo Desktop fora do escopo desse pedido específico.
2. Eliminar recomendações, priorização, seleção e rótulos **FEFO** na Central (Desktop/Mobile), mas **manter validade, alertas e bloqueios de integridade aplicáveis**. Não equivale a permitir saída de materiais vencidos.
3. Retirar códigos, seleção e exposição de **lotes** em UX, relatórios, documentos PDF/CSV e planilhas novas. **Não apagar** `lotId`, `lotCode`, documentos, referências persistidas ou contratos de compatibilidade necessários a saldos, conciliação e histórico. Retirada técnica automaticamente repartida entre referências rastreáveis; sem ordenar por vencimento.
4. Central de Depósitos **3D e 2D integralmente preservadas**, sem simplificação visual, perda de informações operacionais ou regressão no modo Essencial. Desburocratização máxima GOV-SIMP-01, sem abrir mão de isolamento workspace/UG, idempotência e segurança.

### Código existente no PR (implementado, não completamente certificado)
- `WarehouseMobileOutbound.tsx`: novo fluxo de quatro passos; `mobileScanner.ts`: expectativa dual somente no outbound; `mobileOutbound.ts`: consulta contextual; `mobileOutboundPlan.mjs`: divisão técnica por ID neutro e limites de saldo, sem FEFO.
- `app/api/central-depositos/operations/route.ts` + `lib/server/warehouseMobileTrust.mjs`: `WITHDRAWAL_FINALIZE_MOBILE` com verificação de confiança/autorização e autoria server-side `access.email`; `finalizeWarehouseWithdrawalServer` canônico.
- Desktop `WarehouseMaterialWithdrawal.tsx` usando planner sem seleção de lote; Alocação Móvel sem `lotCode` digitável mas mantendo validade e contrato interno; Home, Estoque, Consultas, Croqui, Alertas, Relatórios, CSV/PDF atualizados em parte. Novos testes `scripts/mobile-outbound-unified.test.mjs` e `scripts/warehouse-validity-only-r2.test.mjs`. Ver lista integral no handoff.

### Resultado real dos workflows do SHA c6c356a3 (NÃO CONFUNDIR com GO)
- **PASS:** EMPROVEX Fast CI (run `40067713862`), EMPROVEX Core Protection (`40067713873`), Recovery guardrails (`40067713865`), Warehouse Server R2 Smoke (`40067713875`), SAAS-DL Legal Validation (`40067713867`), VISUAL-R1 W4 QA (`40067713915`) e Browser E2E On Demand (`40067713924`, job com Emulator PASS; cenário automático do job ignorado por desenho do dispatch). São checks de CI, **não prova de smoke humano autenticado R2**.
- **FAIL — Application CI run `40067713864`:** job `validate-application` interrompido no passo 55, `ADM Depósito Phase 7 permanent guard` (`npm run verify:adm-deposito-phase-7`). Log objetivo: `Domínio de lote/validade/FEFO incompleto: selectWarehouseFefoLot` e `Superfície Estoque FASE 7 incompleta: warehouse-fefo-recommendation`. O guard `scripts/verify-adm-deposito-phase-7.mjs` ainda EXIGE dois marcadores legados que o Fundador mandou remover. Testes de domínio Phase 7 (19/19), TypeScript error budget, verificação de zero writes client SDK, Core e vários contratos anteriores passaram antes da interrupção; steps posteriores foram **skipped, não PASS**. Gates finais Block 16–21 ficaram FAIL por dependência desse job. **Não restaurar a seleção FEFO para satisfazer teste velho**: atualizar guard/evidências conforme o novo contrato de validade e manter as demais checagens de lotes técnicos, Rules, segurança e UX. Revisar também `tests/e2e/warehouse-phase-7.spec.mjs` que contém marcador FEFO legado.
- Revisões anteriores documentadas no handoff: guard MOBILE-C legado exigia `lotCode.trim()` (corrigido); importadores FEFO em Home e DepotView corrigidos; asserção FEFO de `warehouse-depot-layout.test.mjs` corrigida. Não ressuscitar esses requisitos.

### Pendências técnicas antes de GO
1. Adaptar `scripts/verify-adm-deposito-phase-7.mjs` e cenários históricos para validação de **validade sem FEFO**; executar **Application CI completo no mesmo HEAD final**, além de Fast CI, Core, Recovery, Legal, Warehouse Smoke e Browser E2E. Evitar aprovação baseada em gates parciais/skipped.
2. `lib/server/warehouseBulkStockWorkbook.ts` ainda oferece coluna `Lote` em template novo, e `WarehouseBulkManualEntryOperational.tsx` ainda envia `lotCode:row.lot`: remover na **nova** planilha de 10 colunas e preservar leitura compatível das **antigas** de 11; teste das duas versões. Alteração anterior **não foi commitada**.
3. Corrigir menções visíveis remanescentes, particularmente `WarehouseItemControlOperational.tsx` (texto FEFO), `WarehouseCroquisR1Operational.tsx` (lotes ativos em proteção de remoção), `WarehouseIsometricPreview.tsx`, `WarehouseImmediateConsumptionPanel.tsx`, `WarehouseLocationInspectionLocalPreview.tsx`. Escanear demais telas, exportações e documentos. Não confundir “operação em lote” (ação massiva) com código de lote físico. Preservar guardas de exclusão/inativação e a estética/funcionalidade 3D.
4. **Auditar confiança da baixa multi-linha no servidor:** a seleção neutra feita no navegador não pode criar autoridade para submeter plano adulterado. Revalidar lotId, saldo global/local, workspace/UG, validade, quantidades por referência, concorrência, idempotência, rollback e ausência de baixa parcial. Corrigir onde necessário, com testes adversariais.
5. Smoke autenticado com workspace QA isolado, sem alterar produção: item com 1/N locais, posição com 1/N itens, material sem validade, validades diferentes, estoque insuficiente, expirados/inativos, destino, replay/chave duplicada, outros workspaces, Desktop (carrinho/PDF), Mobile, transferência/inventário e consistência de saldos.

### Handoff GOV-SIMP-01
**ONDE ESTAMOS:** PR #371 aberto, base R1 em `main@47323e3...`, último HEAD de código avaliado `c6c356a3...`; este checkpoint documental produzirá um SHA posterior. R2 não publicada.
**O QUE ESTAMOS FAZENDO:** finalizar fluxo de saída, validade sem FEFO/lotes visíveis, auditar integridade e obter CI integral verde.
**QUEM ESTÁ FAZENDO:** executor ChatGPT/GitHub em branch do PR; Fundador não precisa manipular código.
**O QUE FAZER A SEGUIR:** ler os dois handoffs vinculados; obter novo HEAD e logs; corrigir guard Phase 7 sem reintroduzir FEFO; completar Excel e varredura UX; auditar servidor e testes; certificar todas as pipelines e smoke autenticado; só então preparar GO/revisão.
**QUEM FARÁ:** próximo ChatGPT executor no GitHub; **Fundador** faz validação humana e eventual publicação **manual PowerShell / Vercel**, com staged/health/smoke e promoção do mesmo deployment, após autorização expressa.
**CLASSIFICAÇÃO: IMPLEMENTAÇÃO EM ANDAMENTO — CI AINDA FALHA — NÃO PUBLICAR.**

---


## HANDOFF VIGENTE — WAREHOUSE R2 / SAÍDA MÓVEL / VALIDADE SEM FEFO (24/10/2026)

**PR #371 aberto e ainda não publicado.** Branch: feat/mobile-outbound-unified-scan-r2. Meta: saída móvel em quatro etapas (item/local → quantidade → destino → revisar/confirmar), remover FEFO e indicação de lotes na Central sem apagar dados internos de rastreabilidade/validade. O HEAD de código anterior ao handoff era 77127c2fa2d79b9b9566a4694f3f1f8ef63c1e42; consultar HEAD atual ao retomar. Main/produção: 47323e3b8583e68c8344336a265ddd7d63563c36.

**MEMORIAL COMPLETO PARA OUTRO CHAT:** [EMPROVEX_HANDOFF_WAREHOUSE_R2_SAIDA_VALIDADE_2026-10-24.md](./EMPROVEX_HANDOFF_WAREHOUSE_R2_SAIDA_VALIDADE_2026-10-24.md). Contém implementação, commits, CI PASS/FAIL/CANCELLED, pendências Excel/croqui/segurança e sequência exata. **NÃO fazer merge ou deploy com os gates ainda incompletos.**

**Onde:** PR #371. **Fazendo:** código e testes R2. **Quem:** executor GitHub. **Próximo:** eliminar indicações residuais de FEFO/lote, endurecer a baixa server, corrigir CI, testar cenário autenticado e certificar. **Quem fará:** executor; Fundador apenas smoke final e Vercel via PowerShell após GO.

---


## ATUALIZAÇÃO PRIORITÁRIA — R2 SAÍDA MÓVEL / REMOÇÃO FEFO / VALIDADE APENAS — 24/10/2026

**LEIA ANTES DE QUALQUER DESENVOLVIMENTO:** docs/MOBILE_OUTBOUND_R2_VALIDITY_ONLY_HANDOFF.md (handoff completo e único ponto de continuidade deste trabalho).

- **PR #371** (https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/371), branch feat/mobile-outbound-unified-scan-r2, HEAD de checkpoint 4a2a2dc44bd505749c689bdc978b534b2315985f; main 47323e3b8583e68c8344336a265ddd7d63563c36. **NÃO MERGED, NÃO PUBLICADO**. A produção permanece no R1 Motor de Confiança, PR #369, promovido pelo Fundador no PowerShell.
- O Fundador determinou Saída Móvel de quatro passos: ler item OU posição (se local, escolher item; se item único local, autoescolher); quantidade; destino; revisar/confirmar; usuário logado é o autor, sem campo de responsável.
- Remover toda indicação de **FEFO** e códigos/seleção de **lotes** em Desktop e Mobile e documentos, mostrando apenas **validade**. Preservar IDs/contratos históricos de lote para conservar saldos, auditoria, concorrência e as baixas transacionais; validade vencida continua relevante para alertas/integridade.
- Alterações distribuídas por 35 arquivos do PR: mobile scanner, saída, API autorizada, leitor físico, alocação, carrinho Desktop, fichas, Início/Depósito 3D, relatórios, PDF/CSV, alertas, lot.ts e testes. Novos scripts mobile-outbound-unified.test.mjs, warehouse-validity-only-r2.test.mjs e planejador mobileOutboundPlan.mjs.
- **CI ainda NÃO certificado no último HEAD:** 357ddb teve gates PASS exceto guard antigo de Alocação (corrigido); c850 teve Fast CI FAIL porque teste de croqui ainda exigia FEFO (corrigido em 4a2a2dc44bd505749c689bdc978b534b2315985f); outros gates aprovaram ou foram interrompidos por novo push. Reexecutar tudo no HEAD final, inspecionar saídas reais e manter main/Vercel/Rules intocados até GO.
- Próximo responsável: chat sucessor via ferramentas GitHub; Fundador somente smoke manual e publicação pelo PowerShell após aceite. **Não promover R2 automaticamente.**

**Handoff:** onde — PR #371, branch feat/mobile-outbound-unified-scan-r2; fazendo — corrigir retirada, UI de validades e testes sem FEFO; quem — executor GitHub; próximo — CI final e testes autenticados no Emulator, correção de regressões, smoke staging; quem fará — chat sucessor e Fundador na publicação.

---


## PUBLICAÇÃO CONGELADA — RELEASE ÚNICA, POWERSHELL PROPRIETÁRIO (20/10/2026)

- Processo de deploy já validado pelo Fundador: alterações consolidadas em um único commit na main, gates de CI, prebuild e deploy manual Vercel pelo PowerShell na equipe `aprov-hgesms-projects`.
- A ausência de acesso do conector Vercel do ChatGPT é **irrelevante** para a publicação pelo PowerShell proprietário. Não exigir novas contas ou membros pagos; não criar projeto alternativo.
- A configuração `vercel.json` mantém `git.deploymentEnabled=false`, portanto integrar a main não atualiza automaticamente `emprovex.com.br`.
- Runbook: `docs/EMPROVEX_RELEASE_POWERSHELL.md`. Fazer `vercel.cmd pull --environment=production`, `vercel.cmd build --prod`, `vercel.cmd deploy --prebuilt --archive=tgz --prod --skip-domain` e, após smoke/IAM GO, `vercel.cmd promote` usando o MESMO deployment.
- Regras Firestore reduzidas **não** são ativadas no mesmo deploy. Preservar as Rules produtivas até validação e janela de corte própria. O Marco Zero SISCOFIS ainda usa projeção UNASSIGNED de compatibilidade; acompanhar em release.
- O executor GitHub pode compor/certificar/mesclar o código, mas não operar a sessão PowerShell local. O Fundador executa prebuild e deploy na própria conta.

**Handoff:** onde — PR #349 certificado e preparando squash único em main; fazendo — commit/documentação/gates; quem — executor GitHub; próximo — PowerShell proprietário: prebuild, staged, testes de IAM e promover; quem — Fundador.

---

## HARDENING DE SEGURANÇA E PREPARAÇÃO DA HOSPEDAGEM — 20/10/2026

- **PR #349 (RC sobre main, sem merge):** motor de ledger limitado internamente ao Marco Zero SISCOFIS (chave de origem validada, tipo `INITIAL_BALANCE`, fonte nula); API `LEDGER_MOVEMENT` agora retorna 403 `WAREHOUSE_LEDGER_DIRECT_COMMAND_DISABLED` sem executar transação. Elimina a capacidade de forjar `quantityDelta` e saldo `UNASSIGNED` pela operação genérica. Motores especializados de NF/alocação, saída, devolução, transferência e inventário permanecem disponíveis. Atenção: helper legado `ensureWarehouseIntakeEntryContext` chama `applyWarehouseMovement`; se reutilizado no futuro precisa migrar, a alocação ativa delega a `allocateWarehousePendingItemFast`.
- **Provas regressivas:** novo `scripts/warehouse-server-command-security.test.mjs` no Application CI, Emulator rejeita tentativas internas fora do SISCOFIS e Browser E2E testa recusa explícita de seis tipos de ledger com 403; não considerar aprovado sem resultados SUCCESS do HEAD final.
- **Hospedagem:** nova API restrita ao fundador `GET /api/central-depositos/health`, que valida token de servidor e transação somente de leitura em `emprovex-warehouse`, sem devolver chaves ou payload Firestore. O E2E localhost cobre acesso sem token negado e caminho fundador no Emulator; check com IAM real só no deployment de staging autorizado.
- **Bloqueio externo confirmado:** integração Vercel disponível pertence a outra equipe e retorna 403 para `aprov-hgesms-projects`. Não foi possível ler, criar ou alterar variáveis do projeto real; não foram usados segredos fora da equipe. `vercel.json` mantém deploy por Git desativado.
- **Plano e segurança operacional:** `docs/WAREHOUSE_HOSTING_PREPUBLICACAO.md`. Configurar `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` apenas server-side no escopo correto com IAM mínimo; jamais compartilhar segredo na conversa ou rodar workflow PR com secret de produção. Validar staging `--prod --skip-domain`, founder-only health, workspace isolado, rollback, só depois Rules server-only e promoção ao domínio.
- **Produção:** não tocada. NO-GO para merge/deploy/promote/Rules até CI integral do HEAD, credenciais Vercel e IAM real comprovadas, QA/aceite isolado e autorização do Fundador.

**Handoff:** onde — PR #349 Draft com hardening de segurança; fazendo — validar TypeScript, guard de ledger, Playwright localhost e CI integral; quem — executor GitHub; próximo — obter concessão da integração à equipe Vercel proprietária, executar staged check e decidir GO sem tocar em workspaces reais; quem fará — Fundador para acesso/autorização, executor para CI e QA.

---

## RELEASE CANDIDATE DE INTEGRAÇÃO — 20/10/2026 · WAREHOUSE SERVER R2 + CI LEAN

> **Documento de integração, não comprovante de publicação.** Esta branch é composta diretamente sobre a main atual, preservando as atualizações anteriores do memorial e unindo as mudanças dos PRs #347 e #348. Os testes do RC e o aceite de Preview/Rules ainda devem ser verificados separadamente.

- **Origem funcional:** PR #348, HEAD `049d7e55e3b890ecb85b45cc01f2f5ac9137a89e` (sobre PR #347). No HEAD original, Application CI integral com seis gates, Core Protection, Fast CI, Auth/Firestore Smoke e Browser E2E tiveram **SUCCESS**.
- **Motivo da composição:** PR #347 ainda era DRAFT e incompatível para merge direto com a main atual; não descartar as atualizações da main nem tentar alterar produção sem validação da composição.
- **Política CI LEAN:** PR em desenvolvimento recebe Fast CI/Core; PR pronto para revisão e main mantêm certificação integral. Os gates completos de release permanecem obrigatórios.
- **Rules:** `firestore.warehouse.server-only.rules` é candidato NÃO PUBLICADO. O banco atual continua com as Rules vigentes até análise de equivalência e validação em ambiente isolado; não aplicar o arquivo reduzido por simples substituição sem conferir os demais acessos.
- **Não é autorização automática de publicação:** nunca fazer merge/publicar/promover sem CI PASS no RC, verificação de configuração administrativa do backend, Preview autenticado, isolamento workspace/UG e aprovação operacional. O conector Vercel não possui autorização atual na equipe administrativa de produção.

**Handoff:** onde — branch release candidate construída em cima de `main@abb111e6`, com conteúdo funcional de #347+#348; fazendo — validar CI e identificar blockers externos de Preview/Rules; quem — executor GitHub; próximo — PR de integração para main, CI completo e QA isolado, publicação apenas com autorização e ambiente acessível; quem fará — executor GitHub/Coordenador e Fundador para operação Vercel.

---
## CONFIRMAÇÃO FINAL DE TESTES — EMPROVEX CI LEAN (20/10/2026)

- **Fast CI do código atualizado:** `cd6308ae95d0a82737f5b84438ec24a5107ac517` — [EMPROVEX Fast CI #39526632360](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/39526632360) **SUCCESS**, incluindo TypeScript, scanner estrito zero SDK client writes e testes unitários selecionados por diff. [Core Protection #39526632356](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/39526632356) **SUCCESS**.
- O Fast CI identificou um teste de devolução anteriormente não executado na suíte integral. Foi modernizado para verificar o tipo de movimento **OUTBOUND_RETURN**, autorização/posição física, limite de devolução, saldo, histórico e idempotência **no motor servidor**. O teste atualizado passou e agora também está incluído como gate do Application CI integral.
- **Estado intencional da branch:** Application CI, Warehouse Smoke e Browser E2E aparecem como SKIPPED no SHA `cd6308ae` por se tratar de PR **DRAFT**. Isso NÃO é um PASS de release. A última certificação integral efetivamente executada permanece no SHA funcional `40c5a6ad`, com todos os jobs SUCCESS. A mudança posterior abrange testes, documentação e workflows, não motores de produção.
- **Obrigação antes de merge/publicação:** marcar PR como ready, executar Application CI integral (incluindo o novo teste de devolução), Core, Smoke, Browser E2E e QA necessário no HEAD de release. Não houve merge, alteração de Rules em produção ou deploy nesta execução.

**Handoff:** onde estamos — PR #348 DRAFT e CI LEAN validado; o que fazemos — apenas registrar evidência, preservando a produção; quem faz — executor GitHub; próximo — preparar PR para ready e recertificar HEAD completo quando houver decisão de integrar/ativar Rules; quem fará — executor/Coordenador com autorização expressa do Fundador.

---

## EMPROVEX CI LEAN — Implementação real após certificação (20/10/2026)

> Este registro é posterior à seção de proposta CI LEAN. O modelo foi implementado nos workflows do PR #348, mas não publicado nem incorporado à main.

- **Certificação do código funcional:** commit `40c5a6ad7f11fc5dbbbf720191f895ad177a30df`. Application CI completo **SUCCESS** (run #39524796663, com seis gates finais PASS), Core Protection **SUCCESS** (#39524796550), Warehouse Server R2 Smoke **SUCCESS** (#39524796528), Browser E2E **SUCCESS** (#39524796594). Build, TypeScript, Recovery, segurança e auditoria estrita zero SDK writes concluídos no Application CI. A auditoria de SDK é estática e cobre os diretórios mapeados.
- **Implementação CI LEAN:** commit `871c1ee4833f180527b7245d284e8e10996e9b18` cria `.github/workflows/emprovex-fast-ci.yml` e `scripts/ci-fast-tests.mjs`, separa Draft (Fast CI + Core Protection) de PR pronto (Application CI completo, Smoke e Browser E2E aplicável). Preserva Application CI em push main e workflow_dispatch.
- **Seleção de testes:** alterações Warehouse executam subconjuntos unitários por arquivos afetados, deduplicados; o runner acumula as falhas e reprova se alguma ocorrer. Mudanças de autenticação, Rules e recuperação possuem guards rápidos específicos. TypeScript e scanner zero-client-write executam sempre no Fast CI.
- **Economia:** PR Draft não inicializa repetidamente Browser/Chromium e Firestore Emulator nem roda Application CI integral em cada commit. Os jobs pesados continuam disponíveis por workflow_dispatch e são executados ao marcar PR como ready para revisão; não se dispensou o gate de release. O Core Protection separado permanece automático.
- **Proteção:** Full CI em SKIPPED no Draft **não é PASS de release**. Antes do merge, deixar PR não-Draft e exigir todos os gates no HEAD final, incluindo Firestore/Rules, isolamento, recuperação, QA e teste humano aplicável. Proteção efetiva de branch/ruleset deve ser conferida separadamente; não pressupor existência.
- **Sem impacto na produção:** nenhum merge, deploy, alteração das Rules ativas, gravação de dados reais ou mudança de workspaces.
- **Documentação:** `docs/CI_LEAN_20261020.md` e `docs/WAREHOUSE_SERVER_R2_MIGRATION.md`.

**Handoff:** onde estamos — PR #348 DRAFT, motor certificado no SHA `40c5a6ad`, CI LEAN implementado no SHA `871c1ee4`; o que fazemos — confirmar Fast CI e manutenção dos gatilhos; quem faz — executor GitHub; próximo — revisar FAST PASS no SHA do código CI, ativar release gates ao converter PR para ready somente na preparação do merge, manter Rules de produção intactas até autorização; quem fará — executor/Coordenador e Fundador para publicação.

---

## DIRETRIZ DE DESENVOLVIMENTO — EMPROVEX CI LEAN (20/10/2026)

> **Decisão de organização registrada, ainda não implementada nos workflows.** Objetivo: desburocratizar a validação durante o desenvolvimento, sem reduzir as garantias de segurança, integridade de estoque ou exigências de release. Não confundir recomendação com gate já alterado.

### Diagnóstico objetivo
- O `.github/workflows/application-ci.yml` da branch WAREHOUSE-SERVER-R2 possui **738 linhas**, dezenas de guards e três grandes sobreposições de validação: Application CI, Warehouse Server R2 Smoke e Browser E2E. Um ajuste isolado no Warehouse pode provocar testes de SAG, Administração, relatórios e estética sem mudanças nesses módulos.
- Houve múltiplas falhas de **guards de presença literal de código antigo**, que exigiam `runTransaction`/`writeBatch` ou variáveis no navegador após migração para transações autenticadas no servidor. Corrigir esses guards preservando seus invariantes de comportamento; não recriar o código cliente antigo e não silenciar a reprovação.
- Parte do custo/tempo é repetição de `npm ci`, inicialização de Firebase Emulator e instalação do Chromium em cada rodada. O ganho de tempo ainda **não foi medido**; não registrar percentuais inventados.

### Política proposta de testes proporcionais ao risco
1. **Nível 1 — Fast CI (cada alteração):** TypeScript, auditoria estrita de zero gravações diretas no cliente, Core Protection e testes unitários/contratuais dos arquivos/domínios alterados. Execução curta, automática e bloqueante.
2. **Nível 2 — Integração dirigida (ao concluir uma funcionalidade e após mudanças de risco):** Firestore Auth/Emulator com cenários positivos e negativos do motor afetado. Obrigatórios sempre que houver efeitos sobre saldo agregado/localizado, lotes FEFO, histórico, replay/idempotência, concorrência, autenticação, workspace/UG ou contratos de API. Testar estados adversos e degradação, sem usar dados produtivos para o smoke.
3. **Nível 3 — Certificação integral (antes do merge/deploy/corte de Rules):** Application CI completo, proteção Core, segurança multi-tenant, Recovery, build, testes de integração, Browser E2E aplicável, QA Preview e aceite humano quando necessário. Reexecutar sobre o **HEAD funcional final** se uma correção invalidar a certificação.

### Simplificações aprovadas como diretriz de trabalho (não executadas ainda)
- Criar pipeline **EMPROVEX Fast CI**, orientado a caminhos alterados. Mudanças em bibliotecas compartilhadas, autenticação, modelos, persistência, Rules, CI ou infraestrutura acionam validações transversais adequadas; nunca permitir que um filtro deixe uma alteração crítica sem gate.
- Substituir progressivamente guards que procuram strings por testes de **resultado observável**, preservando bloqueio para regressão. Preferir resultado de movimento/saldo/lote, isolamento de workspace/UG, transação, replay e concorrência a nomes ou posição textual de funções.
- **Consolidar falhas por rodada:** executar os testes pertinentes de modo que gerem um relatório único de erros e falhar ao final se qualquer um reprovar. Não usar `continue-on-error` como aprovação e não mascarar erros.
- Evitar rodar o mesmo smoke do servidor simultaneamente em múltiplos workflows: reutilizar o resultado de um job especializado ou racionalizar testes, preservando o gate. Corrigir `paths` do Warehouse Smoke para cobrir todos os novos motores e seus testes.
- Executar Browser E2E completo sob demanda e na certificação; nos commits apenas de testes/guard internos, rodar o subconjunto atingido. Não repetir publicação Vercel nem modificar Rules por causa de ajustes documentais ou de testes.
- Um PR/branch de integração, commits objetivos e workers paralelos **somente** em frentes independentes quando reduzirem trabalho real. Não criar PRs, rounds de auditoria e memorializações redundantes a cada correção.
- **Não dispensar:** estoque não negativo, conservação da transferência, FEFO, movimentações e histórico imutável, idempotência, concorrência, autorização real, workspace/UG, casos negativos, rollback/recovery e prova de zero escritas diretas pelo cliente.

### Estado real do WAREHOUSE-SERVER-R2 neste registro
- **PR [#348](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/348) DRAFT**, branch `feat/warehouse-server-r2-migration-20261020`, HEAD funcional auditado `690d20da9fca104bc66451a04ab42d95029bf8a8`. Não houve merge, deploy nem corte/ativação de Rules server-only.
- Nesse HEAD, **Core Protection**, **Warehouse Server R2 Smoke (Auth + Firestore Emulator)** e **Browser E2E** concluíram em **SUCCESS**. No Application CI, TypeScript, auditoria estrita **0 SDK client writes** (dentro dos diretórios examinados), os testes de segurança/contratos anteriores ao bloqueio passaram; o job completo terminou **FAIL**, não PASS.
- **Bloqueio exato:** `scripts/warehouse-depot-layout.test.mjs:451`, expressão regular inválida no teste de arquivamento: `assert.doesNotMatch(repository, /\\b(?:writeBatch|runTransaction)\\s*\\(/)` causa `SyntaxError: Invalid regular expression: Unterminated group`. Falha do arquivo **de teste**; corrigir sintaxe, verificar o teste localmente com `node --check` e `npm run test:adm-deposito-depot-layout` antes de repetir Application CI. Após isso, tratar quaisquer falhas reais posteriores sem eliminá-las.
- **Limitação importante:** o scanner `scripts/warehouse-r2-direct-write-audit.mjs` verifica padrões de operações do SDK em `lib/warehouse`, `features/warehouse`, `app/central-depositos` e `components/warehouse`; **zero ocorrências estáticas não é prova suficiente de segurança de todos os caminhos dinâmicos**. Manter review da autorização do motor, concorrência, transações, integridade, Rules e cobertura de rotas.
- CI LEAN é uma **proposta registrada**, não uma alteração feita agora. A certificação completa da migração #348 e a manutenção da produção continuam sob a política de bloqueios vigente até aprovação e implementação explícita de um novo pipeline.

### Handoff de continuidade — quem faz o quê
**Onde estamos:** migração server-only em PR #348/DRAFT, sem publicação; há um teste da Fase 9 com `SyntaxError` no HEAD funcional `690d20d`. **O que fazemos:** primeiro fechar corretamente a auditoria/certificação desse PR; em seguida separar e implementar o Fast CI/seleção de testes sem dispensar gates de release. **Quem faz:** executor técnico/GitHub. **O que fazer a seguir:** corrigir a regex do teste, executar o teste isolado, rerodar Application CI e resolver apenas blockers reais; após PASS completo, planejar refatoração de CI em alteração controlada. **Quem fará:** assistente executor no GitHub; Fundador autoriza qualquer merge, Rules ou deploy.

---

## REGISTRO DE INCIDENTE — 20/10/2026 · LIMPEZA DE MATERIAIS DE TESTE CONCLUÍDA (PR #347 DRAFT)

> **Registro documental na branch do PR #347, não publicado na `main`.** O estado de release do EMPROVEX continua sujeito aos gates independentes.

- **Banco/escopo:** `gen-lang-client-0982077967`, database `emprovex-warehouse`, workspace `hgesm-aprov`, UG `160416`. Autorização expressa do Fundador para excluir dados de materiais de teste, preservando a estrutura física.
- **Resultado do PowerShell:** `EXCLUÍDOS=3241/3241`; verificação final apresentada pelo Fundador: `VERIFICACAO=PASS; DOCUMENTOS_OPERACIONAIS_RESTANTES=0; ESTRUTURA_FISICA_PRESERVADA=PASS`.
- **Preservado e conferido:** 11 depósitos, 268 locais/subposições, 25 croquis, 1 configuração e 4 destinos (309 documentos).
- **Coleções de material/estoque/histórico/índices:** sem documentos operacionais restantes no momento da verificação. Backup local existente no ambiente do Fundador; manter protegido.
- **Nota operacional:** `intakeQueueIndex/state` é atualizado pela sincronização da fila; plano anterior abortou ao detectar mudança de versão (nenhuma exclusão), seguido de novo plano e execução bem-sucedida. A fila pode se reconstruir a partir de NFs que permanecem no módulo operacional.
- **Próximo passo P0:** PR #347 contém implementação parcial das Rules de `MANUAL_ENTRY` localizada e tratamento de leitura histórica. Falta executar Emulator, regressão, compilação e smoke humano; nenhuma publicação desse PR foi validada. Simplificar cadastro em transação consistente e economizar leituras redundantes mantendo workspace/UG, rastreabilidade e saldos corretos.
- **Detalhes:** `docs/incidents/WAREHOUSE_MANUAL_ENTRY_P0_20261020.md`.

---


## WAREHOUSE-SERVER-R2 — HANDOFF DE CONTINUIDADE (20/10/2026 · PR #348 · HEAD 94306ab)

**Natureza deste registro:** snapshot técnico para continuidade em outro chat; não representa conclusão, liberação de release nem autorização para cortar Rules. Verificado no GitHub em 20/10/2026 por ocasião da solicitação do Fundador. Em caso de commits posteriores, atualizar o HEAD/checks antes de continuar.

### Decisão e objetivo do Fundador
- Concluir a migração **integral** de TODAS as gravações da Central de Depósitos para motores no servidor confiável, prioritariamente **saída/devolução → inventário → alocação/NF → demais produtores**.
- Eliminar definitivamente SDK writes do navegador e celular e habilitar Rules mínimas de leitura/autorização e **negação total de gravação direta cliente**, **somente após** inventário estrito ZERO e CI/Emulator/E2E/segurança aprovados.
- Manter Firestore como banco, dados existentes (estrutura, saldo, lote, movimento, consumo, trilha histórica), isolamento por workspace/UG, autorização por identidade e proteção contra operações concorrentes/replay; preservar os demais módulos do EMPROVEX. Como o Fundador informou não haver usuários ativos na Central de Depósitos, a implantação pode ser única após certificação, não por fases operacionais.
- Diretriz de otimização: evitar leituras e writes redundantes; medir consumo efetivo do Firestore e impacto em custo antes/depois; não confundir redução de Rules com economia automática.

### Repositório e estado EXATO consultado
- Repositório: `aprov-hgesm/Controles-de-Empenhos---Aprov`.
- **PR #348 DRAFT e aberto**: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/348
- Branch: `feat/warehouse-server-r2-migration-20261020`, HEAD consultado: **`94306ab51d1f0d8914b54ee0ad38352fcfc8dcc1`**; base empilhada `fix/warehouse-manual-entry-p0-audit-20261020` (PR #347, entrada avulsa server-side).
- **Sem merge, sem deploy, sem publicação das Rules server-only** deste PR; produção não alterada pela migração documentada nesta sessão.
- Memorial técnico da branch: `docs/WAREHOUSE_SERVER_R2_MIGRATION.md`. Auditoria de pontos restantes: `scripts/warehouse-r2-direct-write-audit.mjs`.
- Rules mínimas **somente preparadas**: `firestore.warehouse.server-only.rules`. Rules operacionais ativas não devem ser substituídas antes dos gates.

### Código já adicionado/refatorado no PR #348 (IMPLEMENTADO ≠ APROVADO)
- API autenticada `app/api/central-depositos/operations/route.ts`, `lib/warehouse/serverCommandClient.ts`, verificação de autorização por `verifyWarehouseRequest`, backend Firestore REST `lib/server/warehouseFirestoreTransaction.ts`.
- Operações expostas na rota: `TRANSFER`, `MATERIAL_SAVE`, `DESTINATION_CREATE`, `DESTINATION_STATUS`, `STRUCTURE`, `LANDING_VISUAL_SAVE`, `LOGISTICS_SETTINGS_SAVE`, `QUEUE_EXCLUDE`, `LOT_CREATE`, `LOT_UPDATE`, `EXPRESS_OUTBOUND`, `STOCK_RETURN`, `WITHDRAWAL_FINALIZE`, `INVENTORY_COUNT`, `INVENTORY_REVIEW`, `INVENTORY_REOPEN`, `INVENTORY_BEGIN_CONFIRM`, `INVENTORY_FINISH_CONFIRM`, `INVENTORY_CANCEL`, `INVENTORY_STALE`, `INVENTORY_ADJUST`, `INVENTORY_START`, `LEGACY_INTAKE_POSTED`. A presença no `switch` não comprova sucesso ou eliminação total do legado.
- Transferência por FEFO com lote/split e replay; material, destinos, depósito/local/subposição; configurações visuais/logísticas, fila NF, lotes manuais; saída expressa; devolução; retirada de múltiplas linhas com consumo e progresso retomável; inventário server-side em desenvolvimento (`lib/server/warehouseInventoryLifecycle.ts`, `warehouseInventoryAdjustment.ts` e demais motores). Registrar como **parcialmente certificado**, não como migração completa.
- A retirada processa linhas com progresso/idempotência: conferir consistência em falhas intermediárias e paralelismo; não presumir commit único para uma retirada inteira. O arquivamento estrutural via simples update foi bloqueado (`WAREHOUSE_ARCHIVE_SERVER_FLOW_REQUIRED`); falta implementar operação própria segura.

### RESULTADOS dos checks no HEAD 94306ab (consultados em 20/10)
- **EMPROVEX Core Protection: SUCCESS** — run `39507486562`.
- **Application CI: FAILURE** — run `39507486428`, job `validate-application` falhou em **TypeScript error budget** (10 erros; orçamento zero), principalmente:
  - `lib/server/warehouseInventoryLifecycle.ts`: retorno de tipos diferentes no mesmo `warehouseAdminTransaction` (item / summary / `{ok:true}`) nas linhas próximas a 75 e 103.
  - `lib/server/warehouseWithdrawalWrite.ts`: `WarehouseMaterialWithdrawal` incompatível com `Record<string, unknown>` no campo de `writes`, fazendo `header` ficar inferido como `unknown`; erros em torno das linhas 86, 113, 164, 165, 191 e 205.
  - Os gates finais derivados ficaram FAIL em cascata porque o job crítico falhou. **Não declarar Application CI PASS.**
- **Warehouse Server R2 Smoke: FAILURE** — run `39507486127`. Antes de parar, o log confirmou PASS para entrada avulsa e replay, transferência FEFO com split, lotes, saída expressa, devolução, estrutura e duplicidade, retirada com consumo e replay. Ao começar inventário, `warehouseInventoryLifecycleServer` disparou **`WarehouseStoreError: WAREHOUSE_SERVER_INVALID_DOCUMENT_PATH`**, `lib/server/warehouseFirestoreTransaction.ts:62`, originado em `fullName()` durante `warehouseAdminTransaction` chamada em `warehouseInventoryLifecycle.ts:103` (fixture `scripts/warehouse-server-manual-entry-emulator.ts:325`). **Investigar o caminho real, validar regex/estrutura de itens aninhados e manter o guard de escopo estrito; não relaxar paths genericamente.**
- **Browser E2E On Demand: IN PROGRESS** — run `39507486395` na consulta; verificar conclusão do run/novo HEAD antes de relatar PASS.
- Execuções PASS anteriores pertencem a SHAs anteriores e **não liberam** o HEAD atual.

### BLOQUEIOS restantes para a meta zero direct writes
- A auditoria histórica em começo da R2 identificou **109 pontos de escrita SDK cliente**; migrações subsequentes eliminaram parte deles. **Contagem atual NÃO certificada**. Não supor ZERO nem publicar porcentagem de conclusão.
- Ainda verificar e migrar completamente: inventário inteiro (início, contagem, revisão, ajuste, confirmação, cancelamento); retirada/consumo/devolução de todos os caminhos alternativos; alocação NF/intakes legados, código de barras, `ledgerRepository`, arquivamento de estrutura, croquis/layouts, índices/filas, SISCOFIS e demais gravações de `lib/warehouse`, `features/warehouse` e componentes auxiliares. Rastrear call sites e evitar manter bypass em outro repositório.
- Os testes dinâmicos precisam cobrir tenant/UG diferente, token não autorizado, estado suspenso/revogado, concorrência, saldo negativo, FEFO, lote órfão, duplicidade/replay, interrupção de lote de retirada, reativação de depósito e reconciliação de inventário; considerar limites/cotas Firestore.

### Passos operacionais para o PRÓXIMO CHAT (ordem obrigatória)
1. Reabrir PR #348 no GitHub, **consultar o HEAD atual** e os runs (não assumir que ainda é `94306ab`).
2. Corrigir todos os erros TypeScript relatados sem `any`, sem aumento de error budget, sem ignorar guard. Para warehouseInventoryLifecycle usar tipagem explícita de união retornada por transação; para WithdrawalWrite converter objetos de domínio para `Record<string,unknown>` sem perder validação, e tipar retorno `WarehouseMaterialWithdrawal`.
3. Reproduzir e corrigir o `WAREHOUSE_SERVER_INVALID_DOCUMENT_PATH` do inventário; inspecionar caminho exato e preservar o validador de documentos, sem abrir acesso genérico.
4. Rerodar `Warehouse Server R2 Smoke`, `Application CI`, `Core Protection` e `Browser E2E` no MESMO HEAD; investigar e corrigir cada FAIL, cobrindo cenários positivos/negativos.
5. Concluir operações ainda mutáveis pelo SDK cliente e executar `WAREHOUSE_R2_STRICT=1 node scripts/warehouse-r2-direct-write-audit.mjs`. Gate de corte: **ZERO**. Auditar também código fora dos diretórios percorridos pelo script e chamadas indiretas.
6. Validar Rules mínimas no Firestore Emulator: isolamento por workspace/UG, leitura autorizada, cliente sem escrita, motor backend IAM sem bypass; garantir Backup/Recovery e métricas de custo.
7. Somente com gates completos PASS, planejar corte único de Rules e release; **não publicar automaticamente sem validação/aceite do Fundador**. Não testar gravação com materiais reais em produção.

### Handoff no formato exigido
- **Onde estamos:** PR #348 DRAFT, branch `feat/warehouse-server-r2-migration-20261020`, HEAD de referência `94306ab`, migração parcial e CI/smoke bloqueados.
- **O que estamos fazendo:** levar todas as mutações Warehouse para servidores transacionais com segurança e economia de Firestore; o corte de Rules não ocorreu.
- **Quem está fazendo:** executor técnico com acesso ao GitHub e Actions; Fundador fornece diretrizes e aprova release.
- **O que fazer a seguir:** corrigir TS e path do inventário, certificar smoke, finalizar módulos legados, comprovar ZERO direct writes, CI/E2E/Core/Recovery PASS; só depois habilitar Rules simplificadas.
- **Quem o fará:** próximo worker/assistente técnico; Fundador apenas no aceite da publicação.

---

## BACKLOG APÓS WAREHOUSE-SERVER-R2 — MIGRAÇÃO DAS FIRESTORE RULES DO EMPROVEX PRINCIPAL (DECISÃO 20/10/2026)

> **PLANEJADO, NÃO IMPLEMENTADO. EXECUTAR SOMENTE APÓS A CONCLUSÃO E HOMOLOGAÇÃO DA CENTRAL DE DEPÓSITOS (WAREHOUSE-SERVER-R2, PR #348 DRAFT, dependente do PR #347).** Este registro é uma decisão de arquitetura e prioridade futura; não constitui autorização de merge, deploy, alteração imediata das Rules do banco principal ou modificação da produção.

### Objetivo e fundamento
- **Desburocratizar, reduzir consumo cobrado do Firestore e diminuir falhas de Security Rules**, sem enfraquecer o isolamento SaaS por usuário, workspace e UG.
- Repetir no restante do EMPROVEX o padrão arquitetural do Warehouse: cliente computador/celular -> API autenticada -> motores de domínio **no servidor confiável** -> transações Firestore com precondições, idempotência e auditoria. **Firestore continua sendo o banco.**
- Regras operacionais/de negócio passam para código executado no backend (não para JavaScript do navegador). Security Rules permanecem como **fronteira restritiva de acesso direto**, com leituras autorizadas e, para comandos efetivamente migrados, **nenhuma gravação pelo SDK cliente**. SDK Admin/REST com credencial de serviço deve ser protegido por IAM e nunca exposto ao cliente.
- Não usar `allow write: if true`; não liberar permissões genéricas; não aceitar workspace, UG, papel, ator, total, contador, saldo ou mudança de estado informados pelo navegador sem validação no servidor. Verificar Firebase ID token e estado ativo/autorizações, incluindo revogações/suspensões e acesso multi-tenant.

### Escopo da próxima frente, em ordem recomendada
1. **Notas Fiscais/SAG/NS (prioridade máxima):** mover para motor server-side as verificações atuais de `validInvoiceCreate/Update/Delete`, correspondência entre NF, empenho, fornecedor, UG, trava `sagNsLock_*`, unicidade por número/UG, mudança de titular, atualização e exclusão segura. Reservar NS em transação com identificador determinístico e reconciliar referências; evitar documentos órfãos e disputas concorrentes.
2. **Gestão de Empenhos (prioridade máxima):** cadastro, edição, revisão sequencial, vínculos com alertas/cronogramas/NF e exclusão por ciclo de vida com trava. Centralizar integridade, autoria, auditoria e tratamento de repetição no motor do servidor.
3. **Termos de Recebimento e Fornecedores (alta):** contador/numeração atômicos, proteção de duplicidade, identidade/CNPJ, campos imutáveis e vínculos documentais.
4. **Comissões, Cronogramas, Avisos e documentos (alta):** fluxos de atualização, condições de vínculo, estados e validações no servidor; preservar direitos específicos de cada setor.
5. **Auditoria, backups e legal (alta sensibilidade):** geração de eventos e status confiáveis no backend, preservando histórico append-only, autoria, horário e evidência de aceite expresso. Não flexibilizar a leitura das aceitações ou permitir que um operador forje aceite, backup ou auditoria.
6. **Indicadores, snapshots e cotas (otimização):** geração server-side do snapshot da Home, consolidação e contabilização por UG, eliminação de escritas sem alteração e leituras/listeners redundantes. Consolidar cálculo diário/semanal/mensal em R$ com valores de tarifa e consumo efetivamente observados.
7. **Administração SaaS e sessões (fase sensível):** contas/workspaces, faturamento, ciclos, assinaturas, suspensão, leases e revogação; priorizar backends já existentes e preservar resposta rápida de sessão, limites de acesso e revogação de identidades. Não migrar leases sem testes de concorrência e encerramento remoto.

### Observações técnicas da auditoria
- O banco principal usa `firestore.rules` (aproximadamente 2.552 linhas na revisão de 20/10/2026); o Warehouse usa `firestore.warehouse.rules` separadamente (aproximadamente 3.462 linhas). A redução de linhas é consequência desejável, **não a métrica de economia**.
- Pontos de custo: leituras dependentes nas Rules (`get`, `exists`, `getAfter`), consultas redundantes, ouvintes desnecessários, varreduras, atualizações inalteradas e projeções regravadas. **Mover lógica não economiza automaticamente**: leituras administrativas do servidor também são cobradas; pode haver custo de hospedagem adicional.
- Medir **antes e depois por comando/UG**: leituras, gravações, exclusões, verificações de Rules, latência, tamanho das operações, custo diário/semanal/mensal em R$ e economia real. Considerar preços e condições vigentes e que a cota gratuita não se multiplica por banco adicional.
- Conferir quais operações já utilizam servidor antes de reconstruí-las. Priorizar reutilizar infraestrutura de autenticação, verificação de papel, IAM, limites, logs, proteção de replay e testes.

### Gates obrigatórios — sem corte antecipado
- [ ] Central de Depósitos concluída, testes e QA aprovados; PR #348 e dependências tratados formalmente.
- [ ] Abrir **nova frente/PR específica para o banco principal**, sem substituir silenciosamente regras dos usuários ativos.
- [ ] Inventariar todos os call-sites de escrita direta, operações de negócio e permissões do banco principal; definir migração por domínio e plano de rollback.
- [ ] Implementar backend de cada domínio, testar escopos UG/workspace/papéis, concorrência, replays, limites, suspensão/revogação, preservação de trilha de auditoria e consistência transacional.
- [ ] Comparar consumo/custo real antes/depois; não prometer percentual de economia sem medição.
- [ ] Habilitar Rules mínimas/read-only **apenas depois** de constatar que os caminhos legítimos foram migrados, com Emulator Security, Browser E2E, Application CI, Core Protection, Recovery e smoke em QA.
- [ ] Nenhum merge/deploy de Rules ou alterações de produção sem gates PASS e autorização de release.

### Handoff futuro obrigatório
- **Onde estamos:** concluir a migração do Warehouse no PR #348; este tema do banco principal é backlog **pós-Warehouse**.
- **O que estamos fazendo agora:** registrar a decisão e seus critérios no memorial oficial; **não iniciar** esta nova migração nesta etapa.
- **Quem está fazendo:** coordenação técnica documenta e realiza auditoria; Fundador valida prioridade e posterior release.
- **O que fazer a seguir:** após a conclusão do Warehouse, abrir frente `FIRESTORE-CORE-SERVER-R1` começando por Notas Fiscais/SAG/NS, depois Empenhos, demais módulos e otimização de custo.
- **Quem o fará:** worker/coordenação técnica com GitHub, Emulator e CI; Fundador dá aceite de Preview/produção.

---

## ESTADO VIGENTE GLOBAL — 19/10/2026 · 3D PREMIUM R4 — PR #346 PUBLICADO

> **ESTADO DE PRODUÇÃO MAIS RECENTE.** Este registro prevalece sobre a seção histórica imediatamente abaixo intitulada “EMPROVEX R4 PUBLICADA”, que continua correta como marco anterior, mas não representa mais o deployment atualmente associado ao domínio.

### GitHub — melhoria pós-R4 consolidada

- **PR #346:** [WAREHOUSE R4 — profundidade de paletes e acabamento premium do piso/paredes](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/346), **MERGED / CLOSED**.
- **Commit funcional integrado por squash único:** `6d3fddae4b7212e745a75b241504f71541148a54`, sobre `main@9075c8e766ecd330210394238bf4cae63e503df0`. Não reexecutar o merge.
- **Mudança funcional:** apenas `features/warehouse/components/WarehouseIsometricPreview.tsx`. Ordem de pintura dos objetos considera a extensão da planta física, reduzindo sobreposição indevida entre paletes/freezers. Piso com tratamento industrial, juntas e brilho discreto; paredes com painéis e acabamento refinado.
- **Aceite visual:** Fundador aprovou a prévia em localhost:3001 antes do merge.
- **Gates no HEAD do PR pré-squash `0edf9a6d...`:** Application CI **SUCCESS**, EMPROVEX Core Protection **SUCCESS**, VISUAL-R1 W4 QA (isolated) **SUCCESS após reexecução**. O primeiro run de QA falhou em teste de hover de local vazio; a reexecução do mesmo run foi aprovada. Não atribuir essas execuções ao SHA pós-squash.
- **Sem alteração de Firestore, Rules, esquema, autorização, saldos ou migração.** As funcionalidades anteriores R4 permanecem preservadas.

### Vercel — publicação e promoção efetivamente confirmadas

- **Equipe/projeto:** `aprov-hgesms-projects/controles-de-empenhos-aprov`.
- **Domínio oficial:** https://emprovex.com.br
- **Deployment atual:** `dpl_FKhz2Jq9d6jpLRF1kvDL3y4QuiTV`, URL individual `https://controles-de-empenhos-aprov-qxnc2nql2-aprov-hgesms-projects.vercel.app`.
- **Método:** exportação limpa do commit aprovado, `vercel.cmd link`, `vercel.cmd deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects`, teste de `/api/health`, promoção do **mesmo deployment** com `vercel.cmd promote`, seguida por `vercel.cmd inspect https://emprovex.com.br`.
- **Evidência fornecida pelo Fundador:** deploy `Ready`; `/api/health` do URL individual retornou `{"status":"ok","timestamp":"2026-10-19T22:28:23.273Z"}`; comando de promoção retornou `Success!`; `inspect` do domínio oficial resolveu para o **mesmo ID `dpl_FKhz2Jq9d6jpLRF1kvDL3y4QuiTV`**, com status `Ready`. Assim, **promoção concluída e domínio conferido**.
- **Custo operacional reportado:** build 1m01s, pós-build 47s, duração faturável 2m / 4 CPU-minutos. Não realizar novo deployment para repetir a publicação.
- **Referência histórica para eventual rollback:** deployment anterior `dpl_6mQA5J1tuLNvQBnsaqdbVQcV9MUA` (R4 antes do PR #346). Rollback somente com autorização expressa.
- **Limite da evidência:** não houve confirmação documental de um novo smoke autenticado completo de todos os fluxos no domínio após a promoção. Saúde e inspeção de domínio foram verificadas, e o aceite visual ocorreu no localhost.

### Handoff oficial

**Onde estamos:** `main@6d3fddae` com PR #346 incorporado em squash único; melhoria 3D **publicada no domínio oficial** no deployment `dpl_FKhz2Jq9d6jpLRF1kvDL3y4QuiTV`. **O que estamos fazendo:** encerramento documental e preservação de evidências. **Quem está fazendo:** Fundador realizou publicação/promoção via Vercel CLI; Coordenador registra rastreabilidade. **O que fazer a seguir:** verificar a nova visualização no navegador autenticado em `emprovex.com.br` e acompanhar possíveis regressões; novos ajustes somente por branch isolada e sem redeploy redundante. **Quem fará:** Fundador valida o fluxo real, Coordenador trata eventuais regressões.

---

## ESTADO VIGENTE GLOBAL — 19/10/2026 · EMPROVEX R4 PUBLICADA

> **REGISTRO DE PRODUÇÃO VERIFICADO.** Esta seção supera os estados históricos que, mais abaixo, ainda mencionam PR #345 DRAFT, R4 aguardando publicação, PR #341 sem merge, ou itens de R2/R3 ausentes da main. As seções históricas continuam úteis como evidência da evolução, **não como o estado atual de publicação**.

### GitHub — consolidação definitiva em commit único

- **Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`.
- **PR integrado:** [#345 — RELEASE R4 Warehouse R2/R3 + 3D premium](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/345), **MERGED / CLOSED**.
- **Main consolidada:** `e61c2675e97990c6dd78ccdce0fc1a56a98561ca`, título `feat(release): EMPROVEX R4 depósitos 3D e funcionalidades recuperadas`.
- **Composição:** squash em **um único commit** diretamente sobre `main@2c30a354a466b6c727c90f1f4f83428ac8a54cfb`; o commit R4 tem um único pai, `2c30a354...`. A release anterior da main não foi descartada.
- **Head funcional aprovado e testado antes do merge:** `1664f805021ddcf7aa4baf913c75a243514f92b1` (`feat/warehouse-r3-restoration-consolidated`). O merge usa o mesmo conteúdo da entrega aprovada.
- **PR #344:** continua DRAFT como registro de desenvolvimento anterior; **seu conteúdo foi incorporado pela release consolidada #345**. Não fazer um segundo merge do #344 para repetir as mudanças. PRs históricos #331–#338 permanecem referências da origem do código recuperado, não uma fila de merges obrigatórios.

### Vercel — deployment R4 confirmado pelo Fundador

- **Projeto:** `controles-de-empenhos-aprov`; **equipe:** `aprov-hgesms-projects`.
- **Domínio oficial em produção:** [https://emprovex.com.br](https://emprovex.com.br).
- **Deployment R4 promovido:** `dpl_6mQA5J1tuLNvQBnsaqdbVQcV9MUA`.
- **URL individual:** `https://controles-de-empenhos-aprov-bvhzq2yed-aprov-hgesms-projects.vercel.app`.
- **Logs informados pelo Fundador:** `GITHUB_R4=PASS`, `FONTE_R4=PASS`, `PROJETO_VERCEL=PASS`, `DEPLOY_R4=PASS` (`Ready`), `SAUDE_R4=PASS`, `PROMOCAO_R4=PASS`, `INSPECAO_R4=PASS`.
- **Confirmação da promoção:** CLI retornou `Success!` para o **mesmo deployment `dpl_6mQA5J1tuLNvQBnsaqdbVQcV9MUA`** e consulta subsequente do domínio `emprovex.com.br` retornou o mesmo ID com `status Ready`.
- **Duração informada:** build remoto 1m19s, pós-build 56s, consumo de 3 minutos faturáveis (6 CPU-minutos). Não houve necessidade de um segundo build após o `promote`.
- **Método operacional certificado:** `git archive` do SHA aprovado em pasta isolada **sem `.git`**, `vercel.cmd link` no projeto administrativo correto, `vercel.cmd deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects`; consultar `/api/health`; depois `vercel.cmd promote <URL> --yes --scope aprov-hgesms-projects` e confirmar domínio com `vercel.cmd inspect`. Não utilizar `--prebuilt` nesta infraestrutura Hobby.
- **Referência histórica de rollback imediato:** deployment anterior confirmado `dpl_73K2tXFi9NQMw4v1YLn6HSuxtR8c` (main `2c30a354`). Qualquer rollback exige decisão expressa e conferência do alvo atual; não executar automaticamente.

### Cinco workflows aprovados — HEAD funcional `1664f805`

1. [Application CI #39310659373](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/39310659373): **SUCCESS**.
2. [EMPROVEX Core Protection #39310659282](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/39310659282): **SUCCESS**.
3. [Recovery Guardrails #39310659261](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/39310659261): **SUCCESS**.
4. [SAAS-DL Legal Validation #39310659257](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/39310659257): **SUCCESS**.
5. [VISUAL-R1 W4 QA (isolated) #39310659259](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/39310659259): **SUCCESS**.

**Precisão:** esses cinco resultados se referem ao **HEAD funcional pré-squash `1664f805...`**, não a uma suposta nova execução no SHA do squash. O Fundador informou aprovação da prévia localhost antes de autorizar o merge e o deploy. A publicação foi validada pela saúde e inspeção do domínio; não afirmar que foi realizado um segundo smoke autenticado completo de todas as funções em produção sem nova evidência.

### Funcionalidades efetivamente incluídas na R4

- **R2 recuperada:** inspeção de locais no hover/foco/teclado, painel fixo abaixo da cena que não cobre equipamentos, modal de detalhes por local, relatório PDF com conteúdo/local/prateleira/lote/validade; detecção de locais vazios com saldo zero; pesquisa de material **em todos os depósitos do mesmo workspace**, navegando ao local e à subposição; cadastro de novos locais e subposições **em depósitos existentes**, com validações de integridade.
- **R3 recuperada:** apresentação sem sobreposição para inspeção e empilhamento de volumes em paletes com projeção isométrica; correções de `Meus Depósitos`; entrada detalhada de alocação de NF preservada em paralelo às ações em lote. Referência histórica da R3: `release/emprovex-r3-hotfix-inspecao-20261017@eb1935a9` e PRs #331–#338.
- **3D premium atual preservado:** geladeira de portas duplas e freezer baú, frente física coerente com o lado maior e quatro câmeras; **reflexo branco discreto se o equipamento estiver ocupado**; volumes apoiados e empilhados em paletes/mesas; caixas em níveis físicos e subposições de estantes; indicação de validade pela cor da caixa (**amarelo entre hoje e 14 dias inclusive**, **vermelho para vencidos**), com destaque suave do local.
- **Sem alerta inventado:** vínculo entre lote ativo, quantidade positiva, mesmo material e mesma posição física (depósito/local/subposição), baseado em saldo real; estados agregados para a estrutura sem confundir o saldo de outra posição.
- **Experiência existente preservada:** sidebar organizada e acesso à Central de Depósitos por setores externos autorizados, sem bypass do servidor, autenticação nem isolamento multi-workspace.

### Limites, banco e economia de cota

- **Sem alteração de Firestore Rules, esquema ou migração no ato da publicação da R4.** A atualização de código não executou movimentações ou alteração de saldos do Firestore; operações futuras da interface continuam sujeitas aos contratos de domínio e autorização.
- A sinalização visual usa leitura indexada de lotes por `expiresOn` até o 14º dia (inclui já vencidos), sob demanda, com limite de **500** e aviso explícito de cobertura potencialmente incompleta quando saturado. A inspeção detalhada e emissão de PDF consultam lotes completos separadamente somente quando necessárias, evitando listeners e leituras por hover/tecla/câmera.
- A regra geral de FEFO/alerta de vencimento de **30 dias** no domínio não foi substituída: **14 dias é a convenção visual da cena 3D**.
- Preservadas cautelas de custo de Firestore, integridade, permissões e isolamento entre UGs/workspaces.

### Handoff oficial — estado após a publicação

**Onde estamos:** `main@e61c2675` consolidada e **R4 promovida, Ready em `emprovex.com.br`**, deployment `dpl_6mQA5J1tuLNvQBnsaqdbVQcV9MUA`. **O que estamos fazendo:** registrar encerramento operacional da release e preservar rastreabilidade. **Quem está fazendo:** Fundador fez aceite local e deploy/promote administrativo via PowerShell; GitHub/assistente fez a reconciliação e integração. **O que fazer a seguir:** apenas conferir no navegador autenticado os fluxos de 3D, inspeção, PDF, busca global, cadastro e validade com dados permitidos; não executar novo deploy apenas para repetir publicação. **Quem fará:** Fundador valida operação, próximo executor corrige qualquer regressão em branch isolada. A migração Cloud Run permanece assunto independente e não foi executada nesta release.

**Documentação de origem:** `docs/releases/EMPROVEX_WAREHOUSE_R4_RECONCILIACAO_20261019.md`, `docs/adm-deposito/STOCK_3D_VISUAL_R1_20261019.md`; os textos desses arquivos descrevem etapas anteriores ao fechamento e devem ser lidos à luz deste estado de produção.

---


## HISTÓRICO — 2026-10-19 · ADMINISTRAÇÃO ORIGINAL VISUAL + TELEMETRIA POR UG R3 · PR #341

> **Este é o recorte vigente para o trabalho da Administração.** As notas históricas abaixo sobre ADMIN-2.0, EMPROVEX Command, novos módulos/13 abas ou CORE V2 foram **superadas** pela decisão expressa de abandonar aquele desenvolvimento. Permanecem como histórico, não como escopo autorizado.

### Decisões do Fundador e estado efetivo

- **ADMIN-2.0 abandonada:** PR [#339](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/339) fechado **sem merge**; antiga branch `feat/admin2-w01-sidebar-local-preview` excluída remotamente pelo Fundador via PowerShell (comando `git push origin --delete` confirmado). Não reativar o código antigo, as 13 abas propostas nem criar outra Administração paralela.
- **Novo trabalho autorizado:** melhorar **a Administração original de oito abas**, preservar todas as funções existentes e reaproveitar identidade visual do EMPROVEX operacional. Primeira etapa: fundo claro `#edf3fb`, cartões claros, tipografia contrastante, header escuro fixo e **sidebar escura fixa no desktop** com navegação agrupada e indicador luminoso do App Shell. Rota **`/admin`**, e não `/admin2-preview`.
- **Ampliação expressa posterior:** por solicitação do Fundador, foi implementada **telemetria por UG R3** dentro do mesmo desenvolvimento, ultrapassando o escopo inicialmente só estético. A alteração inclui código operacional de atribuição de eventos e `firestore.rules` **candidatas na branch**, não publicadas.
- **Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`.
- **Branch isolada:** `feat/admin-visual-organizacao-base-emprovex`.
- **PR:** [#341 — ADMIN-VISUAL + UG R3](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/341), **OPEN/DRAFT, sem merge**.
- **SHA de código certificado antes desta atualização documental:** `5c61636799c53b7464f387a07d37131ead490808`; o SHA mudará ao gravar este memorial, logo **reverifique os runs do novo HEAD antes de declarar certificação daquele SHA**.
- **Validações no SHA certificado:** Application CI **SUCCESS**, EMPROVEX Core Protection **SUCCESS**, SAAS-DL Legal Validation **SUCCESS**. Application CI incluiu testes multi-tenant no Firestore Emulator (novas categorias permitidas/rejeitadas), guardas das telemetrias v1/v2/R3, painel global, reconciliação, alertas, build e TypeScript. **CI verde não é autorização de publicação**.
- **Produção:** `main`, deploys, dados reais, cobrança, Auth, workspaces de usuários e Rules ativas **não alterados por esta iniciativa**.

### Escopo entregue no código da branch

1. **Navegação e estética:** mesma Administração de oito abas: Visão Geral, Setores, Cadastrar Setor, Consumo e Cotas, Sessões, Assinaturas, Backups e Segurança. Fundo claro, sidebar fixa, cabeçalho EMPROVEX, abas agrupadas, acabamento visual; funções originais mantidas.
2. **Consumo e Cotas compreensível:** resumo da cota; conceitos de leituras, gravações, listeners, atualização e `Read Units` explicados; Google global separado de estimativa por UG; diagnósticos técnicos recolhidos; ausência de amostra não apresentada como consumo zero.
3. **UG R3 — origem por módulo:** `empenhos`, `notas`, `deposito`, `sessoes`, `outros` nos eventos **que já são instrumentados**. O campo opcional `moduleOperations` fica no documento diário `workspaces/{workspaceId}/usageEstimates/{billingDay}`, usando buffer local e `increment()` no `setDoc(..., {merge:true})` existente, sem consulta/assinatura por evento.
4. **Compatibilidade e segurança:** registros antigos sem `moduleOperations` mostram ausência de detalhamento. Rules candidatas limitam chaves e proíbem decrementos, preservando a identidade da UG. Testes Emulator ALLOW/DENY incluídos.
5. **Reconciliação com Google:** leitura das mesmas métricas globais já carregadas, aproximação proporcional de `Read Units` por UG apenas para fração instrumentada. Parcela **não atribuída não é rateada**; módulos representam contagem de operações observadas, **não custo real**.
6. **Qualidade observacional:** snapshots exclusivamente locais/cache não são classificados como leitura de servidor comprovada; falta de cobertura continua declarada.

**Limitações R3 explícitas:** cobertura incompleta de caminhos não instrumentados (backend, índices, Security Rules, retries/transações etc.), peso real das consultas não calibrado por Query Explain, e buffer com `increment()` ainda sem garantia de entrega exatamente uma vez se houver confirmação de rede ambígua. Não anunciar 100% de precisão nem fatura oficial por UG. Evoluções futuras exigem teste e análise de custo adicional, não improvisar em produção.

### Próxima solicitação exata do Fundador — estimador financeiro Firestore em reais (**PENDENTE, AINDA NÃO IMPLEMENTADO**)

Pergunta formulada antes deste pedido de atualização:

> **“é possível incluir um calculo em cima do consumo do firestore para saber qual vai ser o meu custo (diário, semanal e mensal) em reais considerando os dados que o firebase dispoe?”**

**Primeiro próximo passo do chat sucessor:** responder a viabilidade e **propor um cálculo auditável** antes de alterar código. Se o Fundador solicitar execução, implementar na mesma branch do PR #341, com CI e validação isolada, sem produção.

Critérios para esse cálculo:
- Separar claramente **(a) uso observado**, **(b) custo parcial estimado**, **(c) projeção diária/semanal/mensal**, **(d) gasto/fatura oficial do Google Cloud Billing**, que não são conceitos equivalentes.
- Utilizar dados já existentes: `lib/server/googleCloudMonitoring.ts` (métricas globais e referência diária), `lib/platformCapacity.ts`, `lib/platformAdminUsageHistory.ts`, `lib/server/globalUsageHistory.ts`, `lib/usageReconciliation.ts`, `components/admin/AdminConsumptionHub.tsx` e subpainéis. Confirmar SKU/região/banco Firestore Enterprise, free tier elegível, preços atuais do Google Cloud, armazenamento, rede, backups, operações e créditos/impostos antes de afirmar **R$**; cobertura parcial deve ser indicada.
- Conversão cambial BRL deve ter fonte/data da cotação ou parâmetro configurável explícito. **Não inventar preços, câmbio ou impostos**. Melhor distinguir preços configurados e medidos; se preços/cotação ausentes, mostrar “estimativa indisponível”, não `R$ 0`.
- Dia deve respeitar a janela de faturamento já adotada (`America/Los_Angeles`); semanal e mensal devem declarar se são soma de dias fechados ou projeção com base no período parcial. Métricas do Cloud Monitoring têm atraso e snapshots não são a fatura.
- Preferir **computação em memória sobre histórico já disponível**, sem polling/listeners ou leituras adicionais desnecessárias. Não inventar rateio financeiro por UG; se incluído, rotular como proxy experimental e não faturamento.
- Registrar cenários de exemplo com resultados conhecidos e testes de falta de medição, free tier, excedente, projeção, câmbio, limites e mudança de preços, com testes automatizados.

### Handoff operacional vigente

**Onde estamos:** PR #341 DRAFT com modernização visual da Administração existente + UG R3 tecnicamente implementada e CI aprovado no SHA de código `5c616367`. **O que estamos fazendo:** aguardando aceite humano no navegador/localhost; preparar decisão sobre estimativa do custo global do Firestore em BRL. **Quem está fazendo:** executor GitHub no PR e Fundador como autoridade de aceite/publicação. **O que fazer a seguir:** responder à pergunta financeira, verificar fontes reais de preço/metricas, decidir se deve implementar, validar em branch e certificar novo HEAD. **Quem o fará:** próximo chat como executor sob solicitação do Fundador, sem merge/deploy sem autorização.

**Como abrir localmente se a pasta ainda não existir:** clonar a **nova** branch em `$HOME\emprovex-admin-visual` usando `git clone --single-branch --branch feat/admin-visual-organizacao-base-emprovex https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov.git "$HOME\emprovex-admin-visual"`; depois `npm.cmd ci`, `npm.cmd run dev -- --port 3001`, abrir `http://localhost:3001/admin?tab=consumo`. Se já existir, executar `git pull --ff-only origin feat/admin-visual-organizacao-base-emprovex` **na pasta nova**. Não usar a antiga `emprovex-admin2-preview`, cuja branch remota foi excluída.

**Memorial especializado:** [ADMIN_VISUAL_REORGANIZACAO_BASE_20261018.md](./admin/ADMIN_VISUAL_REORGANIZACAO_BASE_20261018.md). O presente recorte tem precedência, para esta frente, sobre planejamento ADMIN-2.0 histórico abaixo.

---


## Recorte vigente ADMIN-2.0 — 2026-10-18 · CORE V2 (decisão posterior do Fundador)

- **Diretriz atual e prioritária:** desenvolver a nova Administração premium **sem** os três objetivos anteriormente previstos: **(1)** entrar e modificar registros operacionais nos workspaces externos; **(2)** operar a Central de Depósitos de outros setores; **(3)** acessar arquivos privados Google Drive dos clientes. Os três foram **ADIADOS**, não cancelados definitivamente, e **não bloqueiam o CORE V2**.
- **Escopo de execução imediato:** Clientes 360° com **metadados administrativos/comerciais** (sem abrir dados operacionais do cliente), dashboard, onboarding/gestão de setores existentes, financeiro/billing, CRM/atendimento, indicadores, sessões, consumo/cotas, backup/segurança e identidade visual EMPROVEX Command, com escalabilidade e economia Firestore.
- **Plano Mestre de referência:** [ADMIN_2_0_PLANO_MESTRE_WORKERS.md](./ADMIN_2_0_PLANO_MESTRE_WORKERS.md) **V2 / CORE**, 13 capacidades em escopo, W00 + 8 especialistas (W01/W02/W03/W04/W05/W09/W10/W11); W06/W07/W08/W12 e futuro W13 **NÃO são ativados nesta etapa**.
- **Gates:** contrato G0, backend/UI, compatibilidade, economia Firestore, QA e GO produtivo. **O G-1 de acesso global cross-workspace da auditoria anterior foi retirado como pré-requisito do CORE**, porque os objetivos que ele validaria foram adiados. Permanecem obrigatórios testes negativos de acesso a dados operacionais de outros tenants.
- **Precedência documental:** este registro de 2026-10-18 **substitui apenas o escopo e a prioridade** das notas de 2026-10-17 e do veredito prévio de G-1. A auditoria histórica conserva seu valor técnico **para o dia em que as funcionalidades adiadas forem retomadas**. Nenhum código/dado/regra/deploy alterado por esta decisão documental.

---

## Programa ADMIN-2.0 — decisão de produto 2026-10-17 · EMPROVEX Command (DESENVOLVIMENTO)

- **Estado:** estudo estratégico e diretrizes funcionais **registrados para desenvolvimento futuro**; estética EMPROVEX Command em refinamento/validação humana; **nenhuma implementação, alteração de Rules/Firestore, migração ou deploy** realizada neste marco.
- **Objetivo:** transformar a Administração em uma central de gestão SaaS escalável, com **Clientes 360°**, CRM compacto, relação cliente↔OM/UG↔workspace↔identidade↔assinatura, onboarding assistido, financeiro, atendimento, telemetria, indicadores, governança e auditoria.
- **Navegação proposta:** Central; Gestão de Negócio; Operação da Plataforma; Inteligência; Governança. Ação Cadastrar Setor permanece disponível como fluxo contextual, preservando o provisionamento atual.
- **Sidebar Admin 2.0 — contrato visual confirmado em 2026-10-18:** lateral esquerda como EMPROVEX/Central de Depósitos, com grupos administrativos próprios; desktop expandido e modo compacto apenas com ícones (melhoria nova), mobile drawer, item ativo iluminado discretamente, tooltips, acessibilidade, estado preservado localmente sem Firestore e estética premium. W01 implementa, W00 integra, W11 certifica. Detalhes nos dois memoriais especializados.
- **Estética:** identidade premium EMPROVEX Command; azul-marinho `#020817`, superfícies `#071225`, iluminação sutil, Montserrat, legibilidade e microinterações consistentes; Border Beam discreto/monocromático; Thinking Orb não espalhado como decoração; acessibilidade, responsividade e redução de movimento. **Aparência final sujeita a aprovação no protótipo.**
- **Decisão explícita e mais recente do Fundador — Superadministrador:** acesso global a **qualquer workspace** dos clientes com inclusão/edição/correção/exclusão por motores operacionais válidos, **sem aceite individual por entrada e sem limite temporal específico para o recurso**; troca rápida entre workspaces, sem senha do usuário e sem impersonação. Permanecem autenticação, autorização privilegiada no servidor, auditoria atribuída ao verdadeiro ator, transparência e invariantes de segurança/integridade. **Ainda não implementado; Firestore Rules e `workspaceContext` atuais não concedem este acesso.**
- **Escalabilidade e custo:** evitar listeners/consultas globais de todas as contas, cobranças, sessões e históricos; introduzir paginação, resumos, consultas sob demanda, índices e separação das migrações do carregamento de interface. Medir cota Firestore e latência em bases sintéticas crescentes.
- **Contrato comercial preservado:** Plano Completo R$ 70/mês/workspace; VIP legado isento e protegido; trial de 30 dias; billing em modo `observe` por padrão; cobrança externa e sem suspensão operacional automática por inadimplência.
- **Fonte detalhada canônica para continuidade:** [ADMIN_2_0_MEMORIAL_DESENVOLVIMENTO.md](./ADMIN_2_0_MEMORIAL_DESENVOLVIMENTO.md) — benchmarking, arquitetura, fluxos, visão estética, acesso Superadmin, limites técnicos, fases, gates e handoff.
- **Plano de execução por chats workers (2026-10-17):** [ADMIN_2_0_PLANO_MESTRE_WORKERS.md](./ADMIN_2_0_PLANO_MESTRE_WORKERS.md) — 12 workers especializados + W00 Coordenador; contrato inicial G0, PRs DRAFT, 15 capacidades A01–A15, integração/QA independente e release manual condicionada a GO. **Plano documentado, nenhum worker executado por este registro.**
- **Auditoria técnica 01 (2026-10-18):** [ADMIN_2_0_AUDITORIA_TECNICA_01.md](./ADMIN_2_0_AUDITORIA_TECNICA_01.md) — **VIÁVEL COM AJUSTES / NO-GO PARA EXECUÇÃO MASSIVA ATÉ G-1**. Necessária prova de acesso Superadmin nos dois Firestores e UI, limitação Google Drive/OAuth, ownership W13 Bridge, adequação de testes/guards e contratos. Ver detalhes no relatório; nenhum teste dinâmico executado nesta auditoria. A decisão de acesso global sem aceite por sessão permanece vigente.
- **Próximas ações:** validar estética do protótipo; especificar telas e contratos; desenhar delegação Superadmin; medir baseline; implementar isoladamente e certificar em QA antes de qualquer GO de produção.
- **Precedência:** este checkpoint registra decisões **futuras de produto**. Não altera retroativamente o estado operacional certificado em 2026-10-15 nem desautoriza a proteção atual de isolamento entre tenants.

---

## Checkpoint operacional vigente — 2026-10-15 · Release Premium + proteção da cota Vercel

- **Produção:** https://emprovex.com.br — Fundador confirmou a publicação consolidada e a **validação visual das melhorias** após release em `main@63aad90bf80a50cf1cf875024cde21d5e792a3cf` (`chore(release): EMPROVEX Central de Depositos Premium`). Build de produção e prebuild pelo PowerShell aprovados; a confirmação de uso no site foi humana, não uma nova inspeção remota por este agente.
- **PR #314:** integrado em `303ffb7389d0ab5d3559767b7e9c2e3dd735b603` (D-123 a D-126). Central de Depósitos `/central-depositos`, Operador Móvel `/operador-movel`, visual premium e croqui 3D com autoenquadramento/rotação física das vistas Frente, Direita, Trás e Esquerda. Rotas antigas mantidas por redirects/aliases. Cinco gates automatizados PASS no PR. Validação visual humana declarada pelo Fundador como concluída após publicação.
- **Política operacional de custo de deploy (D-127):** `vercel.json → git.deploymentEnabled = false` desativa gatilhos automáticos GitHub → Vercel em **todas** as branches, inclusive `main`; validação por `scripts/vercel-manual-deploy.test.mjs` no Application CI. Cron diário de uso às 09:15 UTC (`/api/cron/usage-snapshot`) preservado. Repositório GitHub e integração continuam utilizáveis para código/CI; a publicação na Vercel é **manual e consolidada**, via `vercel pull --environment=production`, `vercel build --prod`, `vercel deploy --prebuilt --archive=tgz --prod --scope aprov-hgesms-projects` em worktree limpa e com identidade de autoria autorizada. A política não desliga os gates nem impede deploy manual de preview sob demanda.
- **Limite de verificação:** a configuração versionada é fonte de verdade após integração na `main`; não houve confirmação administrativa pelo conector da equipe Vercel (permissão 403). Verificar no painel Vercel se algum outro gatilho externo/deploy hook continua ativo; não assumir que os 100 deployments anteriores vieram exclusivamente do GitHub.
- **Segurança e dados:** não altera Firestore, Rules, estoque, autenticação, cron nem domínio público da versão já publicada. Este checkpoint substitui as notas antigas abaixo que ainda descrevem PR #314 como DRAFT/Preview pendente; essas notas permanecem apenas como rastreabilidade histórica.

---

**Notas históricas do desenvolvimento anterior à publicação de 2026-10-15 (superadas quando conflitarem com o checkpoint acima):**

> **Auditoria adicional de vistas — 2026-10-15 (D-126, PR #314):** corrigida deformação de pallets/locais ao mudar para Direita/Esquerda em depósitos retangulares. A rotação agora preserva medidas reais, troca as dimensões projetadas do cômodo e mantém vínculo das subposições e materiais. Incluídos testes de regressão em quatro vistas e geometrias alongadas; aguarda gates e smoke visual humano.
> **Visão 3D de Meus Depósitos — 2026-10-15 (D-126, PR #314 em validação):** substituição do viewBox fixo por auto-fit centralizado com base na geometria isométrica de piso, paredes, estruturas e etiquetas, recalculado em cada perspectiva. Proporções, estoque e persistência preservados; sem leituras extras no Firestore. CI e smoke visual pendentes, produção não alterada.

> **Visual Operador Móvel — 2026-10-15 (D-125, PR #314 em validação):** redesenho da home do Operador Móvel para superfície institucional premium, com cabeçalho contextual/UG real, painel de acesso autorizado e leitura por etiqueta sob demanda, oito cartões em grupos **Movimentações** e **Consulta e conferência**, estados de foco/toque e movimento reduzido. Sem novas leituras ao Firestore, sem efeito orbital pesado ou alteração da operação. Navegação inferior contextual segue D-124. Aguardando CI e validação humana; produção não alterada.

> **Operador Móvel — 2026-10-15 (PR #314 em validação):** a antiga identificação pública **Central Móvel** passa a ser **Operador Móvel**, integrado visualmente à barra lateral da Central de Depósitos (abaixo dos demais recursos). Endereço canônico `/operador-movel`, redirects dos links antigos `/central-mobile`, mesmo acesso founder-only e contratos de estoque preservados. Referência: D-124. Sem merge/deploy de produção nesta etapa.

> **Roteamento oficial da Central de Depósitos — 2026-10-15 (refatoração em branch):** nome de produto **Central de Depósitos**, rota pública canônica `/central-depositos` e APIs `/api/central-depositos/{status,intake-action}`. A rota `/adm-deposito` recebe redirect permanente, enquanto as APIs legadas preservam aliases diretos sem mudar o método HTTP. Firestore, namespace `warehouse`, regras e IDs persistidos permanecem intactos. Decisão D-123 em `docs/adm-deposito/DECISIONS.md`; aguardando os gates do PR e eventual autorização de merge/deploy.

> **Atualização pontual — 2026-10-15 (Central de Depósitos):** saldo legado de testes do Suco, 5 unidades em `UNASSIGNED`, **regularizado com PASS no Firestore real**. A alteração foi exclusivamente de dados, sem deploy, merge, Rules ou atualização da aplicação. Evidências: [PR #310](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/310), `docs/WAREHOUSE_INTEGRITY_RECONCILE_01.md` e `docs/WAREHOUSE_DATA_REPAIR_EXECUTION_01.md`. **A sincronização global e os demais estados abaixo permanecem no recorte histórico indicado (2026-10-04); esta nota não certifica outros programas nem todos os saldos dos depósitos.**


Sincronização global histórica de referência: **2026-10-04 — SESSION-CAP-01 + RULES-AUDIT-01 encerradas / pré-composição do RC** (estado superado para release e navegação pelo checkpoint de 2026-10-15).

Produção na baseline histórica de 2026-10-04: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330` (não é a release vigente; ver checkpoint de 2026-10-15).

Integradora SaaS R1: `feat/saas-r1-commercializacao@54aba792cb9e7bb195e21401fb50a21ed50add19` — SESSION-CAP-01 integrada; commits posteriores podem ser documentais de Program Control

Integradora Mobile R1: `feat/central-mobile-r1@7b7717b6eebabf911310d2b8ac56ed13c9cb9238` — avanço documental, sem novo delta runtime

Estado global: **Performance R3 em produção; desenvolvimento funcional SaaS R1 e Mobile R1 encerrado; SESSION-CAP-01 em PASS técnico completo e integrada na linha SaaS/RC; RULES-AUDIT-01 em PASS — RULES APTAS PARA RC; TTL produtivo de sessionSlots/sessionRevocations ACTIVE; HARDEN-A1/A2/C/D em PASS; HARDEN-B parcial por dependência temporal; MOBILE-J aguarda Preview HTTPS; composição do RC único SaaS+Mobile é a próxima barreira; Preview HTTPS ainda não publicado.**

---

## 0. Finalidade e regra de leitura

Este é o **documento de entrada canônico do EMPROVEX**.

O objetivo do Memorial é permitir que um novo Coordenador, worker ou sessão de continuidade responda rapidamente:

1. o que está efetivamente em produção;
2. quais programas estão ativos;
3. quais contratos estão congelados;
4. quais riscos e bloqueios permanecem;
5. qual é o próximo gate global;
6. onde encontrar a evidência detalhada.

O Memorial **não apaga histórico** e não substitui os documentos especializados. Ele organiza o conhecimento em camadas.

### Camadas documentais

**Camada 1 — Estado global e contratos vigentes**

Este arquivo: `docs/EMPROVEX_MEMORIAL_OFICIAL.md`.

**Camada 2 — Estado operacional de cada programa**

- **ADMIN-2.0 (estudo/planejamento):** `docs/ADMIN_2_0_MEMORIAL_DESENVOLVIMENTO.md` — Clientes 360°, EMPROVEX Command, acesso Global Superadmin e escalabilidade (2026-10-17; não implementado).
- `docs/SAAS_R1_INTEGRATION_STATUS.md`
- `docs/SAAS_R1_COORDENADOR_HANDOFF.md`
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`
- `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`
- planos mestres e documentos especializados de cada programa.

**Camada 3 — Histórico detalhado integral**

`docs/EMPROVEX_MEMORIAL_HISTORICO_ATE_2026-10-03.md`

Esse arquivo contém **a versão anterior completa do Memorial, preservada integralmente**, incluindo registros de PRs, commits, métricas, fases, incidentes, decisões e checkpoints históricos.

### Regra de precedência canônica

Quando houver divergência aparente entre trechos, aplicar esta precedência:

1. **Snapshot Global + Contratos Permanentes deste Memorial** — estado vigente;
2. **documentos especializados de Integration Status / Coordenador / runbooks** — evidência operacional detalhada;
3. **Cronologia e checkpoints históricos** — explicam como o estado foi alcançado, mas não revogam decisão posterior;
4. **Memorial Histórico Integral / Git history** — arquivo de rastreabilidade, não estado vivo.

Um checkpoint histórico que diga “bloqueado”, “parcial” ou “aguardando” deixa de governar o sistema quando uma seção posterior e vigente registrar explicitamente PASS/encerramento.

Números operacionais devem refletir o **runtime atual**. Se uma especificação antiga divergir do código integrado, o Memorial deve registrar o contrato efetivamente implementado e apontar a divergência como histórica.

### Regra estrutural a partir desta reorganização

Novos estados não devem ser simplesmente anexados ao fim do Memorial.

Sempre atualizar primeiro:

1. **Snapshot Global**;
2. **Programa afetado**;
3. **Riscos/Gates**;
4. **Cronologia**, quando houver marco histórico;
5. documento especializado correspondente.

Quando um estado deixar de ser vigente, ele deve sair do quadro vivo e permanecer na cronologia/documentação histórica.

### Concorrência documental

Como SaaS e Mobile podem atualizar documentação em paralelo, qualquer edição do Memorial deve:

- reler o HEAD vivo imediatamente antes da gravação;
- preservar alterações concorrentes;
- mover novos checkpoints para a seção temática correta;
- nunca sobrescrever uma atualização de outro Coordenador apenas para restaurar uma versão anterior.


---

# PARTE I — ESTADO VIVO

## 1. Snapshot Global

> **Critério temporal:** a linha Produção está reconciliada com o checkpoint 2026-10-15 acima; as demais linhas SaaS/Rules/RC sem atualização datada nesta rodada conservam o recorte histórico do programa e **não** são consideradas re-certificadas por este ajuste de deploy.

| Domínio | Estado vigente | Contrato/observação |
| --- | --- | --- |
| Produção | **EMPROVEX Premium — PUBLICADO / VALIDAÇÃO HUMANA CONFIRMADA (15/10)** | `main@63aad90bf80a50cf1cf875024cde21d5e792a3cf`; PR #314 integrado, prebuild Vercel aplicado |
| ADMIN-2.0 — Clientes e EMPROVEX Command (2026-10-17) | **ESTUDO E DIRETRIZES DE DESENVOLVIMENTO REGISTRADOS — NÃO IMPLEMENTADO** | Ficha 360°, arquitetura escalável/eficiente em Firestore, design premium, acesso Global Superadmin sem aceite por sessão nem prazo próprio; autorização servidor/auditoria obrigatórias. Ver memorial especializado. |
| SaaS R1 | **FUNCIONALMENTE CONCLUÍDO / PRONTO PARA RC** | A1/A2/C/D PASS; B parcial/temporal |
| Mobile R1 | **FUNCIONALMENTE CONCLUÍDO** | A–I integradas; MOBILE-J em certificação final |
| MOBILE-J | **PARCIAL TECNICAMENTE SAUDÁVEL / CERTIFICAÇÃO EM EXECUÇÃO** | aguarda RC em Preview HTTPS para testes físicos reais |
| SESSION-CAP-01 | **PASS TÉCNICO COMPLETO / INTEGRADA** | PR #248 squash-merged; sessões externas dinâmicas sem teto fixo |
| RULES-AUDIT-01 | **PASS — RULES APTAS PARA RC** | Rules vivas sem drift; TTL dos dois grupos ACTIVE |
| RC conjunto | **PRONTO PARA COMPOSIÇÃO / NÃO CONGELADO** | SESSION-CAP + RULES-AUDIT encerradas; próximo trabalho transversal |
| CT-01 | **PENDENTE NO RC** | `camera=(self), microphone=(), geolocation=()` |
| Rules candidatas | **AUDITADAS / APTAS PARA RC** | produção R3 sem drift; principal RC `bc91185...`; Warehouse RC `6e1f105...`; rollout Rules RC → app RC |
| HARDEN-B | **PARCIAL / ESPERA CONTROLADA** | PITR/delete protection/schedule/retention ativos; backup READY/verify/restore pendentes |
| Warehouse — saldo legado Suco (2026-10-15) | **PASS — REPARO DE DADOS CONFIRMADO** | 5 `UNASSIGNED` → 0, saldo agregado 5 → 0; ledger de ajuste preserva a trilha; PR #310 DRAFT; demais materiais não foram auditados neste evento |
| Billing R1 | **IMPLEMENTADO EM MODO OBSERVE** | R$ 70; trial; cobrança externa; confirmação manual; sem suspensão automática |
| Piloto real | **NÃO INICIADO** | vem depois do RC tecnicamente fechado/publicação controlada |
| Abertura comercial ampla | **NÃO AUTORIZADA** | exige piloto, correções, SAAS-J e GO explícito do Fundador |

### Snapshots técnicos relevantes

- SaaS/RC após SESSION-CAP + RULES-AUDIT: `54aba792cb9e7bb195e21401fb50a21ed50add19`;
- Mobile integradora documental: `7b7717b6eebabf911310d2b8ac56ed13c9cb9238`;
- MOBILE-J: `mobile-r1-j-final-certification@90d646372aae3e92318a78b90d71f72c5eb6b00e`;
- HARDEN-B: `saas-harden-b-recovery-restore@910cca1ea9f14e4ef080ee649624042f63206d51`.

A produção só muda por autorização explícita e posterior do Fundador.

## 2. Próxima barreira global

A próxima fase não é nova feature. É **Release Engineering / Certificação**.

Sequência canônica:

```text
SaaS final + Mobile final
→ SESSION-CAP-01 — PASS / integrada
→ RULES-AUDIT-01 — PASS / Rules aptas para RC
→ branch única de composição do RC
→ reconciliação semântica dos contratos compartilhados
→ CT-01
→ Rules/package/lockfile/Application CI consolidados
→ gates no SHA exato
→ RC CANDIDATE
→ RC FROZEN
→ Preview HTTPS
→ testes SaaS + MOBILE-J físicos
→ correções rastreáveis, se houver
→ nova reconciliação/freeze quando necessário
→ GO/NO-GO explícito
→ eventual produção controlada
→ piloto real
→ correções pós-piloto
→ SAAS-J
→ autorização explícita
→ abertura comercial ampla
```

### Condições para declarar RC CANDIDATE

Obrigatório:

- SESSION-CAP-01 concluída e reconciliada, salvo decisão explícita do Fundador de adiar a mudança para release posterior;
- RULES-AUDIT-01 concluída em **PASS** sobre o ruleset final pós-SESSION-CAP-01;
- nenhuma Rule produtiva nova pode ser publicada sem esse PASS;
- nenhum novo conflito SaaS↔Mobile;
- CT-01 materializada;
- Rules candidata principal e warehouse registradas;
- rollback de Rules preparado;
- package/lockfile/CI reconciliados;
- build/TypeScript/diff hygiene verdes;
- Core/Legal/Recovery e segurança multi-tenant verdes;
- contratos de Auth/workspace/UG/sessão/lifecycle/Legal/billing/Central coerentes;
- source of truth logística única.

### Condições para RC FROZEN

Registrar no mínimo:

- `RC_BRANCH`;
- `RC_SHA`;
- `SAAS_SOURCE_SHA`;
- `MOBILE_SOURCE_SHA`;
- resultado HARDEN-A2;
- hashes das Rules de produção e do RC;
- hash de `next.config.ts`;
- hash de `package-lock.json`;
- resultados dos gates.

Após o freeze, só entram correções de blocker, regressão, segurança ou defeito real da certificação. Não entram melhorias oportunistas.

# PARTE II — GOVERNANÇA GLOBAL

## 3. Hierarquia oficial

### Fase funcional — modelo histórico

Durante o desenvolvimento paralelo:

```text
Fundador
→ Coordenador Geral / Program Control
   → Coordenador SaaS R1
   → Coordenador Mobile R1
      → workers especializados
```

### Fase atual — composição do RC

Por decisão do Fundador, o **Coordenador Geral também assume a Coordenação operacional do RC**.

Modelo vigente:

```text
FUNDADOR
   ↓
PROGRAM CONTROL + COORDENAÇÃO DO RC
   ├── Coordenador SaaS — consulta/evidência sob demanda
   ├── Coordenador Mobile — consulta/evidência sob demanda
   ├── HARDEN-B — frente especializada temporal
   └── MOBILE-J — frente especializada de certificação física
```

Os Coordenadores SaaS e Mobile não foram apagados: permanecem como fontes especializadas de contexto e evidência. Porém **não existe nova wave funcional autorizada** em nenhum dos dois programas.

### Separação de autoridade mesmo no mesmo chat

O mesmo chat pode executar dois papéis, mas as decisões continuam separadas por evidência:

- **Coordenação RC**: compõe candidato, reconcilia, executa gates, prepara Preview e consolida evidências;
- **Program Control**: aceita/rejeita checkpoints, declara RC CANDIDATE/FROZEN, classifica risco e prepara GO/NO-GO;
- **Fundador**: autoriza ações produtivas protegidas e lançamento.

O Coordenador Geral não transforma “continue”, “próximo passo”, CI verde ou PASS técnico em autorização de produção.

## 4. Classificação oficial de problemas

- **LOCAL** → worker.
- **PROGRAM** → Coordenador do programa.
- **TRANSVERSAL** → Coordenador Geral.
- **RELEASE/PRODUÇÃO** → Coordenador Geral + Fundador quando aplicável.

## 5. Semáforo global

- **VERDE** — pode prosseguir.
- **AMARELO** — risco/delta conhecido; pode avançar até a próxima barreira.
- **VERMELHO** — bloquear somente a menor unidade necessária.

O objetivo é evitar que um risco localizado paralise programas independentes.

## 6. WIP e desenvolvimento paralelo

O EMPROVEX adota como método oficial:

> **frentes independentes em paralelo + integração semântica + barreiras explícitas de sincronização.**

A capacidade de revisão determina o WIP, não a quantidade possível de chats.

SaaS e Mobile podem evoluir simultaneamente enquanto seus contratos comuns permanecerem compatíveis.

Não fazer sincronização por merge/rebase cego entre integradoras.

---

# PARTE III — PRODUTO E ARQUITETURA

## 7. Stack vigente

- Next.js 15 / App Router;
- Firebase Auth;
- Firestore;
- Cloud Monitoring;
- Vercel;
- Vercel Blob;
- integrações Google usadas pelos fluxos institucionais.

## 8. Núcleo funcional do EMPROVEX

Capacidades consolidadas incluem:

- Empenhos;
- Itens;
- Notas Fiscais;
- Comissão;
- Tesouraria/Liquidação;
- Cronogramas/Entregas;
- Central de Avisos;
- Relatórios/SAG;
- Administração;
- usuários e sessões;
- telemetria/consumo;
- Central de Depósitos;
- Central Móvel R1 em desenvolvimento.

Performance R3 é a baseline de produção atual.

## 9. Contratos de identidade, sessão e multi-tenant

### 9.1 Identidade autenticada

Fonte: Firebase Auth.

Contrato atual:

- fundador: login **Google-only**;
- usuários externos/setores: login **e-mail/senha only**;
- e-mail verificado é obrigatório;
- sessão com provider inesperado falha fechada;
- Mobile e Desktop usam a mesma identidade; não existe Auth Mobile paralelo.

### 9.2 Relação conta ↔ workspace ↔ UG

Na R1:

- 1 cliente operacional externo = 1 workspace;
- 1 workspace = 1 UG;
- 1 workspace externo possui 1 conta operacional primária;
- conta, workspace e sessão precisam concordar em e-mail/UID/workspace/UG;
- inconsistência de UID, e-mail, UG, status ou provider resulta em **fail-closed**;
- o usuário não recebe subscriptions operacionais antes da validação do contexto.

### 9.3 UID e primeiro vínculo

Contas novas já podem chegar pré-vinculadas ao UID Firebase pelo provisionamento.

Para registros legados sem UID, o bootstrap histórico de primeiro acesso pode vincular o UID após validar:

- e-mail;
- provider;
- conta ativa;
- workspace ativo;
- UG coerente.

Após o vínculo, e-mail idêntico não basta: o UID precisa continuar sendo exatamente o mesmo.

### 9.4 Sessões simultâneas — contrato de runtime atual

O runtime atualmente integrado define:

- usuário externo: **sem teto fixo de sessões simultâneas por workspace/UG no candidato integrado**;
- founder: **isento do limite de capacidade**;
- documentos de sessão: IDs dinâmicos por `browserInstanceId`; `slot-1` e `slot-2` permanecem apenas como compatibilidade transitória;
- lease nominal: **30 minutos**;
- heartbeat/renovação nominal: **15 minutos**;
- decisão temporal baseada em relógio confiável do servidor, não no relógio local do Windows;
- revogação administrativa cria tombstone e remove slots conhecidos;
- perda de lease/revogação/mudança de acesso invalida a sessão local.

**Estes números 30/15 são o contrato implementado atual e substituem referências históricas anteriores com valores diferentes.**

### 9.4.1 Mudança autorizada — remoção do teto fixo de duas sessões

Decisão do Fundador em 2026-10-03:

**o limite fixo de 2 sessões simultâneas para usuários externos deve ser removido.**

Motivação operacional:

- a Central Móvel R1 transforma o celular em ferramenta operacional do depósito;
- uma única equipe pode precisar de vários operadores simultâneos;
- alocação, conferência, inventário, transferência e saída podem ocorrer em paralelo;
- limitar o workspace a apenas duas sessões cria gargalo artificial justamente no cenário Mobile;
- Desktop e múltiplos celulares precisam poder coexistir durante a operação.

### Estado atual versus estado alvo

**Estado integrado na linha SaaS/RC:**

- limite externo: **sem teto fixo**;
- documentos: `sessionSlots/{browserInstanceId}`;
- compatibilidade transitória: `slot-1` e `slot-2`;
- lease: 30 minutos;
- heartbeat: 15 minutos;
- revogação administrativa: ativa;
- painel de sessões: ativo;
- telemetria: ativa;
- TTL `expiresAt`: ACTIVE em `sessionSlots` e `sessionRevocations`.

**Estado alvo autorizado e alcançado:**

- **sem teto fixo de duas sessões por workspace/UG**;
- permitir múltiplas sessões externas simultâneas compatíveis com o uso operacional real;
- manter controle individual de identidade de cada sessão;
- manter lease, heartbeat, revogação, auditoria e telemetria;
- manter possibilidade de encerramento remoto de uma sessão específica;
- manter lifecycle fail-closed;
- manter proteção cross-workspace;
- não transformar “sem limite fixo” em “sem controle de sessão”.

### Princípio arquitetural

A mudança deve remover o **limite de capacidade**, não remover a **camada de segurança de sessão**.

Continuam obrigatórios:

- `sessionId`;
- `browserInstanceId`;
- UID;
- e-mail;
- workspaceId;
- UG;
- lease temporal;
- heartbeat;
- tombstone de revogação;
- invalidação por mudança de acesso;
- painel administrativo de sessões;
- auditoria `session.terminate`;
- telemetria de sessões/consumo.

### Implicação técnica conhecida

A implementação atual usa apenas:

- `slot-1`;
- `slot-2`.

Portanto **não basta alterar `DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT`**.

A frente deverá substituir a reserva física fixa por uma coleção de sessões dinâmicas ou mecanismo equivalente, preservando identidade e revogação.

Direção preferida:

```text
workspaces/{workspaceId}/sessionSlots/{sessionIdOuIdDinamico}
```

ou contrato equivalente que:

- aceite N sessões simultâneas;
- permita identificar cada sessão;
- permita revogar uma sessão específica;
- permita listar sessões no painel;
- permita expiração por lease;
- impeça overwrite de sessão alheia;
- preserve isolamento por workspace.

O nome final do documento/coleção pode ser mantido por compatibilidade se isso simplificar a migração, mas o ID não deve continuar restrito a `slot-1`/`slot-2`.

### Momento ideal de execução

Esta alteração deve ser executada:

**ANTES DO RC CANDIDATE / ANTES DO RC FROZEN.**

Motivo:

- a certificação física Mobile deve representar o comportamento real que será lançado;
- testar o RC com limite 2 e removê-lo depois invalidaria parte da certificação;
- a mudança toca Auth/sessão/Rules/telemetria e precisa estar estabilizada antes do Preview final.

Sequência recomendada:

```text
estado atual consolidado
→ frente transversal SESSION-CAP-01
→ regressão de Auth/sessão/Rules/telemetria
→ integração SaaS + Mobile
→ composição do RC
→ freeze
→ Preview HTTPS
→ testes físicos com múltiplos operadores
```

Se a composição do RC já tiver começado quando a frente for ativada, a alteração deve entrar **antes do freeze**, com repetição dos gates afetados.

Não aplicar após `RC FROZEN` como melhoria oportunista; nesse caso, somente reabrir o freeze por decisão explícita do Program Control/Fundador.

### Escopo executado/auditado da SESSION-CAP-01

Arquivos/contratos afetados ou auditados:

- `lib/platformCapacity.ts`;
- `lib/platformSessionLease.ts`;
- `lib/platformSessionControl.ts`;
- `lib/platformAdminSessions.ts`;
- `hooks/useOperationalData.ts`;
- `hooks/usePlatformAdminSessions.ts`;
- painel administrativo de sessões;
- provisionamento/exclusão de setor;
- lifecycle/suspensão;
- `firestore.rules`;
- testes multi-tenant;
- E2E de sessão;
- guards Block 16.0/16.1/16.2;
- guards Block 17.1/17.2;
- telemetria/consumo;
- documentação de capacidade.

### Regras de segurança da alteração

A remoção do teto não pode:

- permitir sessão de outro workspace;
- aceitar UG divergente;
- permitir uma sessão renovar lease de outra;
- permitir recriar sessão revogada;
- permitir que cliente altere identidade do lease;
- remover revogação administrativa;
- remover expiração temporal;
- remover painel de sessões;
- remover auditoria;
- quebrar suspensão/reativação;
- criar acesso anônimo ou bypass de Auth.

### Performance e custo

Mais sessões simultâneas podem aumentar:

- listeners;
- reads;
- writes de heartbeat;
- conexões;
- consumo Firestore;
- telemetria.

Por isso a frente deve medir:

- custo por sessão;
- writes de heartbeat;
- listeners por aba;
- pico de sessões por workspace;
- impacto no Cloud Monitoring;
- comportamento com vários celulares simultâneos.

A ausência de teto fixo não elimina observabilidade de capacidade. O EMPROVEX deve continuar podendo alertar sobre uso anormal ou excessivo.

### Critérios de aceitação utilizados

A frente foi considerada PASS após provar:

1. terceiro, quarto e demais logins externos não são bloqueados apenas por capacidade fixa;
2. cada navegador/celular possui identidade de sessão coerente;
3. múltiplas abas da mesma sessão continuam sem duplicação indevida de lease;
4. revogação de uma sessão não derruba sessões diferentes sem intenção;
5. suspensão do workspace invalida todas as sessões operacionais;
6. reativação não ressuscita tombstones antigos;
7. Rules permanecem fail-closed;
8. cross-workspace continua DENY;
9. painel admin lista/encerra sessões corretamente;
10. telemetria registra aumento de sessões;
11. Android + Desktop + múltiplos celulares podem coexistir;
12. Application CI/Core/Rules/multi-tenant/build/typecheck/diff hygiene passam;
13. MOBILE-J repete os testes afetados no RC.

### Classificação

Esta é uma **mudança funcional explicitamente autorizada pelo Fundador**, apesar do freeze geral de novas features.

Ela é tratada como exceção controlada porque remove uma limitação operacional que conflita diretamente com o uso Mobile do depósito.

A implementação e a certificação técnica da SESSION-CAP-01 foram concluídas em PASS; a mudança está integrada na linha SaaS/RC, ainda sem promoção da aplicação RC à produção.

### 9.5 Lifecycle observado em tempo real

Sessões externas monitoram:

- `workspaces/{workspaceId}`;
- `platformAccounts/{email}`;
- revogação da sessão.

Se workspace/conta deixa de estar `active`, identidade deixa de coincidir ou Rules negam acesso, a sessão é invalidada.

### 9.6 Autoridade da Central

A Central de Depósitos adiciona `warehouseAccess` como autorização específica do banco `emprovex-warehouse`.

Suspensão/reativação coordenada deve preservar coerência entre:

- workspace;
- platformAccount;
- warehouseAccess;
- sessões.

### 9.7 Regra multi-tenant

Nunca criar caminhos alternativos que permitam:

- ler outro workspace;
- trocar workspaceId/UG por input do cliente;
- usar barcode como autorização;
- contornar `warehouseAccess`;
- confiar apenas em estado visual/client-side.

Auth, workspace/UG, Legal Gate, lifecycle, sessão e Rules são contratos compartilhados por SaaS, Desktop e Mobile.

# PARTE IV — CENTRAL DE DEPÓSITOS

## 10. Nome e compatibilidade

Nome vigente de produto: **Central de Depósitos**.

O caminho técnico histórico `adm-deposito` e documentos antigos permanecem por compatibilidade.

## 11. Fontes da verdade logísticas

Não criar fontes paralelas para:

- material;
- posição;
- saldo;
- lote;
- barcode;
- ledger;
- transferência;
- autorização de depósito.

Contratos centrais reutilizados pelo Desktop e pela Mobile:

- materiais canônicos;
- depósitos/localizações/subposições;
- `WarehouseStockPosition`;
- lotes/validade;
- FEFO;
- barcode;
- ledger;
- saldos materializados;
- intake;
- transferência;
- outbound.

### 11.1 Saneamento pontual do saldo legado de testes — Suco (2026-10-15)

**Estado: PASS — dados reais regularizados; não houve alteração de runtime.**

- **Contexto anterior:** `docs/WAREHOUSE_INTEGRITY_RECONCILE_01.md` comprovou um saldo positivo de 5 unidades em `UNASSIGNED`; `docs/WAREHOUSE_DATA_REPAIR_EXECUTION_01.md` corrigiu excessos de lotes, mas deixou expressamente essa pendência fora do reparo anterior.
- **Alvo único:** projeto `gen-lang-client-0982077967`, banco `emprovex-warehouse`, workspace `hgesm-aprov`, material Suco `mat_272f2d996ee65ed3530ad2d7e27b66d7`.
- **Autorização:** Fundador confirmou que as 5 unidades não existem fisicamente e eram apenas saldo antigo de testes; autorizou a regularização para deixar os depósitos limpos.
- **Pré-condições verificadas no Firestore vivo:** saldo agregado 5; soma dos `movements.quantityDelta` = 5; nenhuma posição física positiva; uma posição `UNASSIGNED` positiva de 5; nenhum lote ativo com quantidade positiva. Dry-run **PASS**.
- **Segurança:** backup JSON local pré-commit no PowerShell do Fundador; commit atômico com precondições de versão para exatamente dois saldos (agregado e `UNASSIGNED`) e um movimento novo; sem exclusão de registros.
- **Resultado pós-commit:** executor retornou `PASS — Suco zerado; histórico preservado` após reler saldo agregado = 0, `UNASSIGNED` = 0 e novo movimento persistido; `INVENTORY_ADJUSTMENT` de -5, com nota de regularização de testes. Movimento `mov_d5f92bf0378af1f7c259f258188fac7a5bf39355c0c509f9fcd23af669127834`.
- **Escopo preservado:** nenhuma NF, intake, outros materiais/workspaces, `firestore.rules`, `firestore.warehouse.rules`, aplicação, deploy ou branch `main` foi alterada pela execução de dados.
- **Limite da conclusão:** esta evidência confirma o Suco zerado, **não** comprova que todos os demais saldos do banco estão zerados. A confirmação visual da lista vazia e/ou auditoria read-only global permanece uma verificação distinta, se requerida.
- **Rastreabilidade:** [PR #310 — executor pontual e memorial de execução](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/310), mantido em DRAFT, sem merge. Não promover o script de manutenção pontual ao runtime permanente.

**Contrato permanente:** `UNASSIGNED` é legado/projeção não física, não origem de `TRANSFER` nem `OUTBOUND`; reconciliações requerem causa comprovada, backup e operação auditável sem apagar o ledger.

## 12. Operações canônicas

### Entrada / ALLOCATE

A alocação móvel e desktop deve reutilizar operações oficiais, com:

- idempotência;
- revalidação concorrente;
- associação de barcode;
- lote/validade;
- ausência de escrita client-side paralela de saldo/ledger.

### TRANSFER

Transferência oficial:

- altera distribuição física;
- preserva o total agregado;
- usa operação `TRANSFER`;
- `quantityDelta = 0`;
- não simula transferência por OUTBOUND + nova entrada;
- não escreve diretamente `locationBalance`.

### OUTBOUND

Saída de material deve preservar:

- carrinho/draft;
- idempotência;
- lotes;
- FEFO;
- saldo não negativo;
- ledger oficial.

### Identidade física

Namespace Mobile: **EPX1**.

EPX1 deriva da identidade técnica e sempre é resolvido novamente contra entidades canônicas.

EPX1 não é fonte paralela de posição.

---

# PARTE V — PERFORMANCE R3

## 13. Estado

**PUBLICADA E ENCERRADA.**

Produção:

`main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

A Performance R3 permanece como baseline técnica da produção enquanto SaaS R1/Mobile R1 não forem publicados.

## 14. Resultados consolidados relevantes

Resultados finais registrados durante a rodada:

- Home: First Load caiu aproximadamente de 460 kB para 335 kB;
- principais rotas da Central: aproximadamente 579 kB para 106 kB;
- shared global: aproximadamente 104 kB;
- lazy loading ampliado;
- consultas históricas movidas para demanda;
- invoices quentes separadas semanticamente do histórico;
- cache curto em memória com TTL e isolamento por workspace;
- shell persistente da Central;
- budgets e métricas versionados;
- validação de UX obrigatória.

Detalhes completos de PERF-A...J e PERF-X permanecem no histórico integral e nos documentos `PERFORMANCE_R3_*`.

## 15. Regra permanente herdada da R3

> Ganho técnico que piora significativamente a experiência do operador não é aceito como otimização.

Performance não pode justificar:

- perda de formulário;
- clique aparentemente sem resposta;
- ausência de feedback;
- quebra de foco/teclado/scanner;
- navegação menos previsível;
- informação visual enganosa;
- necessidade nova de refresh manual.

---

# PARTE VI — SAAS R1

## 16. Objetivo

Transformar o EMPROVEX operacional em serviço comercial controlado, sem reconstruir o núcleo do produto.

Princípios:

- vender inicialmente de forma assistida;
- preservar usuários existentes;
- não automatizar finanças antes de haver necessidade real;
- manter billing separado da autorização operacional;
- preservar multi-tenant, segurança, legal, recovery e auditoria;
- só abrir comercialmente após RC, piloto, correções e certificação final.

## 17. Contrato comercial, pagamento, onboarding, legal e lifecycle

### 17.1 Plano comercial congelado

R1 possui um único plano:

**Plano Completo EMPROVEX — R$ 70,00/mês por workspace**

Inclui acesso funcional completo às funcionalidades disponibilizadas para aquele tenant.

Não existem na R1:

- tiers Bronze/Prata/Pro;
- módulos pagos separadamente;
- feature flags comerciais por preço;
- checkout embutido;
- assinatura criada por API;
- webhook de pagamento;
- suspensão automática;
- signup público de organização.

### 17.2 Trial, vencimento e tolerância

Contrato:

- trial padrão: **30 dias**;
- início: provisionamento/concessão administrativa;
- extensão: somente administrativa e auditada;
- vencimento: **5º dia útil**;
- tolerância: **10 dias corridos**;
- feriados adicionais podem ser configurados;
- fim do trial não apaga dados;
- fim do trial não suspende automaticamente;
- competências históricas preservam o valor já materializado.

### 17.3 Fonte de verdade de billing

Coleções/contratos principais:

- configuração: `platformBillingConfig/main`;
- conta comercial: `billingAccounts/{workspaceId}`;
- competências: `billingCycles/{workspaceId}__{referenceMonth}`.

Estados de `BillingAccount`:

- `trial` — teste em andamento;
- `active` — comercialmente regular;
- `pending` — atenção/regularização;
- `suspended` — estado comercial explícito;
- `canceled` — encerramento comercial;
- `exempt` — founder ou VIP/isento.

Estados de competência:

- `open`;
- `pending`;
- `paid`;
- `waived`.

Não criar estados comerciais concorrentes.

### 17.4 Modo de cobrança vigente

Configuração canônica R1:

- `billingMode = observe`;
- `requirePayment = false`;
- `automaticSuspension = false`;
- método administrativo: `pix_manual`.

Consequência essencial:

**billing acompanha e audita a situação comercial, mas billing sozinho não autoriza nem bloqueia o uso operacional.**

Marcar `billingAccounts.status = suspended` não substitui a ação de lifecycle que realmente desabilita workspace/conta/Central.

### 17.5 Pagamento e regularização

O EMPROVEX **não processa cartão/Pix internamente**.

Fluxo canônico:

```text
cliente precisa regularizar
→ abre /regularizacao
→ usa Link de Pagamento HTTPS e/ou copia Pix
→ pagamento ocorre fora do EMPROVEX
→ Fundador/admin confere o recebimento no provedor/banco
→ confirma a competência no painel
→ competência = paid (ou waived quando aplicável)
→ billing account = active
→ evento auditado
```

Configurações administrativas disponíveis:

- `paymentLinkUrl` — URL pública HTTPS;
- `pixKey`;
- `pixKeyType` — CPF/CNPJ/e-mail/telefone/chave aleatória;
- `pixRecipientName`;
- `supportContact`;
- `holidayDates`;
- trial/tolerância dentro dos limites aceitos.

A mensalidade R1 é fixada em R$ 70 pelo domínio; o painel não deve aceitar outro preço como configuração casual.

### 17.6 Provedor de pagamento

O desenho comercial inicial documenta Mercado Pago/Pix como referência operacional.

A implementação, porém, armazena apenas **uma URL pública HTTPS de pagamento**, sem credencial do provedor. Portanto o RC não fica tecnicamente acoplado a um único gateway.

Se outro provedor for adotado:

- deve oferecer URL HTTPS pública apropriada;
- nenhum token/secret deve ir para o cliente;
- Termos/Privacidade devem ser revistos se a mudança alterar materialmente terceiros envolvidos;
- a fonte de verdade da competência continua no EMPROVEX, não no gateway.

API/webhook permanece fora da R1.

### 17.7 Dados financeiros que o EMPROVEX não armazena

Não armazenar:

- número de cartão;
- CVV;
- credencial do gateway;
- Access Token de pagamento no cliente;
- token de cartão;
- comprovante financeiro por padrão.

Podem existir apenas metadados administrativos mínimos e auditáveis, como nota/referência textual da confirmação.

### 17.8 Página pública de regularização

Rota:

`/regularizacao`

Deve apresentar:

- Plano Completo;
- mensalidade;
- vencimento/tolerância;
- Link de Pagamento quando configurado;
- Pix quando configurado;
- contato de suporte.

A página declara que o pagamento ocorre fora do EMPROVEX e não solicita cartão/CVV.

Regularização, Termos, Privacidade e recuperação de credenciais não devem ficar inutilizáveis justamente quando o usuário está suspenso ou precisa recuperar acesso.

### 17.9 Confirmação/reabertura da competência

A confirmação manual é auditada.

- `paid` ou `waived` → competência confirmada; billing account comercial passa para `active`;
- reabertura/não confirmação → billing account passa para `pending`.

**Importante:** se o workspace tiver sido operacionalmente desabilitado pelo lifecycle, confirmar pagamento não equivale automaticamente a reativá-lo. A reativação de acesso é uma ação administrativa separada e explícita.

### 17.10 Suspensão operacional e reativação

A suspensão real da R1 é manual e founder-only.

Para suspender:

1. validar ator/admin;
2. validar coerência workspace/e-mail/UG/conta;
3. desabilitar `warehouseAccess`;
4. alterar `workspaces.status` e `platformAccounts.status` para `disabled`;
5. revogar sessões conhecidas e remover slots;
6. registrar auditoria;
7. compensar/rollback parcial se um banco falhar.

Reativação:

1. retorna workspace/conta principal para `active`;
2. retorna `warehouseAccess` para `active`;
3. se a segunda etapa falhar, o código tenta compensar para impedir estado incoerente;
4. falha parcial não é escondida: pode resultar em `RECOVERY_REQUIRED`.

Suspensão/reativação **não altera dados operacionais**.

### 17.11 Cancelamento e exclusão

`canceled` é estado comercial, não comando de delete.

Cancelamento não:

- apaga workspace;
- apaga documentos;
- apaga histórico;
- apaga estoque/ledger;
- reaproveita UG/e-mail automaticamente.

Retenção, exportação e exclusão são processos separados e sujeitos à política legal/administrativa aplicável.

### 17.12 Onboarding assistido

Não existe auto-cadastro de organização.

Fluxo canônico:

1. Fundador/admin confirma dados mínimos;
2. cria workspace/UG pelo painel;
3. informa e-mail operacional primário;
4. concede trial quando aplicável;
5. provisionamento cria Auth/diretório/billing;
6. credencial inicial é enviada por canal seguro;
7. primeiro acesso valida e-mail/provider/UID/workspace/UG;
8. usuário aceita pacote legal vigente;
9. checklist curto de primeiro acesso é exibido;
10. Google Drive é opcional;
11. usuário começa a operar.

Conta externa: password-only. Founder: Google-only.

### 17.13 Recuperação e troca de senha

R1 inclui:

- “Esqueci minha senha” usando fluxo nativo do Firebase;
- resposta neutra para reduzir enumeração de contas;
- troca da própria senha com reautenticação;
- mensagens humanas para credencial inválida, conta suspensa, workspace inconsistente e limite de sessão.

### 17.14 Legal Gate versionado

Pacote legal atual:

- `legalBundleVersion = saas-r1-2026-10-01`;
- `termsVersion = terms-2026-10-01-r1`;
- `privacyVersion = privacy-2026-10-01-r1`.

Aceite canônico:

`workspaces/{workspaceId}/legalAcceptances/{uid}__{legalBundleVersion}`

Registro contém:

- workspaceId;
- UG;
- UID;
- e-mail;
- versão do bundle;
- versão dos Termos;
- versão da Privacidade;
- timestamp autoritativo.

O runtime verifica especificamente a versão vigente. Novo aceite só é exigido quando o pacote legal configurado muda.

Falha na verificação é **fail-closed**: nenhum aceite é presumido.

Termos e Privacidade permanecem consultáveis no próprio gate.

Aceite contratual não significa que todo tratamento de dados pessoais dependa de “consentimento LGPD”.

### 17.15 Arquitetura de dados SaaS

Não criar terceiro Firestore apenas para billing/legal/onboarding.

Arquitetura R1:

1. banco principal — identidade, workspace, billing, legal, auditoria e núcleo operacional;
2. `emprovex-warehouse` — Central de Depósitos;
3. nenhum terceiro banco SaaS.

Rules são específicas por banco e continuam parte do contrato de release.

## 18. VIP e isenção comercial

### 18.1 Founder

Founder permanece:

- `exempt`;
- preço efetivo R$ 0;
- sem trial;
- sem inadimplência;
- isento do limite padrão de sessões externas.

### 18.2 VIP manual

VIP externo reutiliza a semântica `exempt`.

Contrato:

- mesmo Plano Completo;
- R$ 0 enquanto a isenção estiver ativa;
- nenhuma redução funcional;
- sem cobrança/atraso/suspensão por inadimplência;
- concessão/remoção manual, explícita e auditada;
- histórico preservado.

Não criar status `vip` concorrente.

### 18.3 VIP legado

Coorte histórica materializada:

- `aprovisionamento-2-b-fv`;
- `aprovisionamento-3-gac-ap`;
- `aprovisionamento-teste`.

O código atual protege a isenção `legacy_vip` contra remoção pela operação genérica de isenção.

VIP não cria exceção de segurança, sessão, Legal Gate ou isolamento multi-tenant. Isenção é comercial, não autorização privilegiada.

## 19. Ordem oficial da reta final SaaS

Estado funcional SaaS: **ENCERRADO PARA NOVAS FEATURES**.

Sequência vigente:

```text
HARDEN-A1/A2/C/D PASS
+ HARDEN-B em acompanhamento temporal
→ composição do RC único SaaS+Mobile
→ CT-01 + Rules/package/CI
→ gates combinados
→ RC FROZEN
→ Preview HTTPS
→ certificação real SaaS+Mobile
→ eventual produção controlada autorizada
→ piloto real
→ correções finais
→ SAAS-J
→ GO explícito
→ abertura comercial ampla
```

Nenhuma nova wave funcional SaaS está autorizada sem regressão concreta ou nova decisão de produto.

## 20. HARDEN — estado vivo

| Frente | Estado vigente | Decisão |
| --- | --- | --- |
| HARDEN-A1 — jsPDF | **PASS / ENCERRADA** | jsPDF 4.2.1 + AutoTable 5.0.8; CRITICAL removido; 7/7 regressão PDF; acabamento visual fino = backlog não bloqueante |
| HARDEN-A2 — Firebase/Firestore/gRPC | **PASS — RISCO RESIDUAL ACEITO TECNICAMENTE** | sem alteração de dependência/runtime/Rules; vetores analisados não alcançáveis pelos usos atuais |
| HARDEN-B — Recovery | **PARCIAL / ESPERA CONTROLADA** | controles ativos; backup READY/verify/restore pendentes |
| HARDEN-C — Health/Rules/Release | **PASS / ENCERRADA** | health/release/rollback preparados |
| HARDEN-D — SaaS↔Mobile | **PASS / ENCERRADA** | sem conflito funcional material; CT-01 isolada para o RC |

### A1 — regra pós-fechamento

A inspeção visual fina de PDF não bloqueia RC/piloto/lançamento.

Só reabre gate se surgir defeito funcional real, como:

- PDF vazio;
- geração quebrada;
- conteúdo ausente;
- ilegibilidade operacional;
- paginação funcionalmente destruída.

Margem, espaçamento, alinhamento e refinamento estético ficam em backlog.

### A2 — risco residual

A cadeia Firebase → Firestore → `@grpc/grpc-js` permanece instalada.

Decisão aceita:

- não forçar override fora do range do Firestore;
- não fazer downgrade/major só para reduzir scanner;
- uso browser não carrega o transporte Node gRPC;
- uso Node atual é cliente Firestore, sem servidor gRPC próprio nem primitivas de servidor analisadas;
- não abrir nova frente Firebase/gRPC sem nova evidência técnica ou correção upstream suportada.

Snapshot técnico da A2:

- Firebase declarado: `^10.12.2`;
- Firebase resolvido: `10.14.1`;
- `@firebase/firestore`: `4.7.3`;
- `@grpc/grpc-js`: `1.9.16`;
- pin Firestore: `~1.9.0`.

A aceitação de risco não declara a biblioteca intrinsecamente segura; declara o risco específico como não alcançável pelo uso atual e sem correção suportada melhor no momento.

## 21. HARDEN-B — recovery

Estado:

**PARCIAL — dependência temporal legítima**

Proteções confirmadas nos dois bancos:

- PITR: ativo;
- delete protection: ativa;
- schedule diário de backup: ativo;
- retenção: **14 semanas**;
- tooling `recovery:status` e `recovery:verify` disponível.

Pendências:

1. primeiro backup nativo `READY` no banco principal;
2. primeiro backup nativo `READY` no `emprovex-warehouse`;
3. capturar resource/location/snapshot/expiration;
4. executar `recovery:verify`;
5. preparar restore plan isolado;
6. restore real em banco novo/isolado;
7. validar dados, IAM, Rules, TTL e isolamento.

Não repetir `recovery:apply` enquanto controles permanecerem ativos.

Restore real continua ação protegida e requer autorização explícita quando chegar o momento.

### Relação HARDEN-B ↔ RC

- composição do RC: **não bloqueada**;
- Preview HTTPS sem writes críticos: **não bloqueado por B parcial**;
- produção controlada com writes reais: preferir fortemente `backup READY` nos dois bancos + `recovery:verify`;
- se houver promoção antes disso, o Fundador deve aceitar explicitamente o risco residual;
- abertura comercial final exige prova de recuperação adequada, incluindo restore isolado real conforme plano SaaS.

## 22. Health, Rules, observabilidade e release

### 22.1 Health

Contrato:

- `/api/health` público;
- não expõe dados sensíveis;
- não depende de leitura operacional do Firestore para responder saúde básica.

### 22.2 Observabilidade

Fontes oficiais R1:

- Vercel — deploy/runtime;
- GitHub Actions — certificação/gates;
- Cloud Monitoring — métricas/uptime;
- telemetria Firebase/Firestore já existente;
- logs de sessão/Central quando aplicável.

No ambiente publicado, validar:

- domínio/SSL;
- `/api/health`;
- erros runtime/HTTP;
- erros Firestore/permissão;
- erros de sessão;
- erros da Central;
- crashes do scanner;
- consumo inesperado;
- uptime check/alerta/canal quando materializados.

Uptime/alerta externo não deve ser declarado PASS sem evidência real do ambiente publicado.

### 22.3 Rules candidatas

SaaS e Mobile possuem Rules candidatas reconciliadas entre si.

Blobs auditados:

- candidata `firestore.rules`: `57a1394c921b2ab2c15537fbfc4aaea17515b28a`;
- candidata `firestore.warehouse.rules`: `6e1f1050005314db4e17cb3136409abbddb0ee91`;
- produção atual `firestore.rules`: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- produção atual `firestore.warehouse.rules`: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`.

As candidatas diferem de `main`.

Portanto publicação exige:

1. registrar conteúdo/hash das Rules atuais;
2. registrar conteúdo/hash das Rules RC;
3. executar testes multi-tenant/workspace externo/legal/billing/Central;
4. preparar comando de republicação das Rules anteriores;
5. não confundir rollback Vercel com rollback de Rules.

### 22.4 RULES-AUDIT-01 — auditoria integral de compatibilidade das Firestore Rules

Decisão do Fundador em 2026-10-03:

**as Rules do SaaS R1 + Mobile R1 não serão publicadas em produção por tentativa e erro. Antes de qualquer publicação produtiva, o ruleset final do RC deve passar por uma auditoria integral de compatibilidade.**

Classificação:

**GATE TRANSVERSAL OBRIGATÓRIO PRÉ-RC / PRÉ-PUBLICAÇÃO DE RULES**

Owner:

**Program Control + Coordenação do RC**

#### 22.4.1 Objetivo

Garantir, antes da publicação, que as Rules finais:

1. preservem tudo o que já funciona corretamente na Performance R3;
2. incorporem apenas os novos contratos necessários de SaaS R1, Mobile R1 e SESSION-CAP-01;
3. não introduzam regressões de autorização;
4. não abram acesso indevido;
5. não criem bloqueios sistêmicos de usuários legítimos;
6. mantenham isolamento multi-tenant;
7. mantenham a Central de Depósitos funcional;
8. tenham rollback conhecido e testável;
9. sejam compatíveis com a ordem real de rollout entre aplicação e Rules;
10. possam ser publicadas sem depender de correções improvisadas em produção.

#### 22.4.2 Estado atual das Rules antes da SESSION-CAP-01

Banco principal:

- produção / `main`: `firestore.rules@0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- candidata SaaS: `firestore.rules@57a1394c921b2ab2c15537fbfc4aaea17515b28a`;
- candidata Mobile: **idêntica à candidata SaaS**;
- tamanho aproximado produção: **87,49 KiB / 2.380 linhas**;
- tamanho aproximado candidata: **92,11 KiB / 2.500 linhas**;
- delta observado: aproximadamente **+124 / -4 linhas**.

Banco `emprovex-warehouse`:

- produção / `main`: `firestore.warehouse.rules@b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- candidata SaaS: `firestore.warehouse.rules@6e1f1050005314db4e17cb3136409abbddb0ee91`;
- candidata Mobile: **idêntica à candidata SaaS**;
- tamanho aproximado produção: **151,55 KiB / 3.307 linhas**;
- tamanho aproximado candidata: **152,38 KiB / 3.330 linhas**;
- delta observado: aproximadamente **+24 / -1 linha**.

Conclusão atual:

**não existe conflito SaaS versus Mobile nas Rules candidatas conhecidas. O conflito a auditar é produção R3 versus ruleset final do novo release.**

Os hashes acima são baseline histórica desta auditoria. O PASS final deve usar os hashes do **ruleset pós-SESSION-CAP-01**, que podem ser diferentes.

#### 22.4.3 Dependência obrigatória da SESSION-CAP-01

A auditoria final só pode congelar PASS **depois** da SESSION-CAP-01.

Motivo:

- o runtime atual usa `sessionSlots/slot-1` e `slot-2`;
- as Rules atuais validam esse contrato fixo;
- SESSION-CAP-01 deverá permitir sessões dinâmicas ou mecanismo equivalente;
- portanto o ruleset final ainda sofrerá alteração estrutural.

Regra:

```text
SESSION-CAP-01
→ ruleset final estrutural
→ RULES-AUDIT-01
→ PASS RULES
→ composição/finalização do RC
```

Uma auditoria executada antes da SESSION-CAP-01 pode servir como **baseline**, mas não substitui a auditoria final.

#### 22.4.4 Princípio de compatibilidade

A auditoria não deve perguntar apenas:

> “o App RC funciona com Rules RC?”

Ela deve responder também:

> “as Rules RC preservam o comportamento legítimo já existente na Performance R3?”

Contrato:

**Rules finais = capacidades legítimas já existentes + novos contratos SaaS/Mobile + nenhum acesso indevido novo.**

Não é aceitável resolver uma necessidade nova apagando silenciosamente uma permissão legítima antiga.

#### 22.4.5 Fase A — captura da baseline realmente publicada

Antes de comparar arquivos do Git:

1. consultar o ruleset efetivamente ativo no banco principal;
2. consultar o ruleset efetivamente ativo no `emprovex-warehouse`;
3. registrar Ruleset ID/versão quando disponível;
4. guardar conteúdo/fingerprint/hash;
5. comparar com os blobs esperados de `main`;
6. registrar data/hora da captura;
7. registrar projeto/database alvo.

Se o ruleset realmente publicado divergir do `main` conhecido:

**STOP / DRIFT DE PRODUÇÃO**

Nenhuma publicação nova deve ocorrer antes de explicar e reconciliar a divergência.

#### 22.4.6 Fase B — diff estrutural e semântico

Não limitar a revisão a contagem de linhas.

Para cada arquivo:

- mapear helpers adicionados/removidos/alterados;
- mapear cada `match` adicionado/removido/alterado;
- mapear cada `allow read/get/list/create/update/delete/write`;
- identificar mudanças de provider;
- identificar mudanças de UID/e-mail/workspace/UG;
- identificar mudanças de lifecycle;
- identificar mudanças de billing/legal;
- identificar mudanças de sessão;
- identificar mudanças de `warehouseAccess`;
- identificar mudanças em validação de shape/tamanho/status;
- identificar mudança permissiva;
- identificar mudança restritiva;
- identificar mudança neutra/estrutural.

Cada delta deve possuir:

- origem;
- requisito que o justifica;
- superfície afetada;
- risco de falso ALLOW;
- risco de falso DENY;
- teste correspondente.

#### 22.4.7 Fase C — matriz ALLOW / DENY

Todo domínio modificado deve ter testes positivos e negativos.

Exemplo canônico:

```text
operação legítima do próprio workspace → ALLOW
mesma operação em outro workspace → DENY
sessão sem provider correto → DENY
sessão sem claim/identidade exigida → DENY
usuário não autenticado → DENY
admin onde não existe bypass operacional → DENY
payload válido → ALLOW
payload adulterado → DENY
```

A matriz deve cobrir no mínimo:

**Identidade / multi-tenant**
- founder Google;
- externo password;
- UID correto/incorreto;
- e-mail verificado;
- workspace próprio;
- workspace alheio;
- UG própria;
- UG divergente;
- sessão suspensa/desabilitada.

**Sessões**
- sessão dinâmica válida;
- renovação do próprio lease;
- tentativa de renovar lease de outra sessão;
- sessão revogada;
- tombstone;
- sessão expirada;
- múltiplas sessões legítimas;
- suspensão global do workspace;
- painel administrativo/encerramento remoto.

**Billing**
- configuração administrativa;
- preço R$ 70;
- VIP/`exempt`;
- VIP legado;
- competência;
- usuário externo sem permissão de alteração administrativa.

**Legal**
- GET do próprio aceite esperado;
- criação do próprio aceite vigente;
- versão errada;
- UID errado;
- workspace errado;
- listagem;
- update;
- delete.

**Central de Depósitos**
- founder;
- setor externo autorizado;
- setor externo sem claims;
- setor suspenso;
- `warehouseAccess active`;
- `warehouseAccess disabled`;
- workspace alheio;
- UG divergente.

**Operações logísticas**
- materiais;
- depósitos;
- posições/subposições;
- lotes;
- barcode;
- intake;
- allocation;
- transfer;
- inventory;
- outbound;
- ledger;
- saldos;
- configurações/layouts/destinos aplicáveis.

#### 22.4.8 Fase D — regressão do EMPROVEX legado

O ruleset novo deve rodar também contra as suítes de funcionalidades antigas.

Cobertura mínima:

- Empenhos;
- Itens;
- Notas Fiscais;
- Comissão;
- Liquidação/Tesouraria;
- Cronogramas;
- Fornecedores;
- Alertas;
- Relatórios/SAG;
- Auditoria;
- backup/status quando aplicável;
- Central Desktop;
- operações logísticas já certificadas.

Não é necessário criar teste manual novo para cada linha não alterada se já existir suíte automatizada confiável. Porém **todas as suítes relevantes devem ser executadas com o ruleset final**.

#### 22.4.9 Fase E — Emulator e suíte automatizada

Usar Firestore Emulator/Local Emulator Suite quando aplicável.

Suítes já existentes que devem ser reaproveitadas e ampliadas, entre outras:

- `scripts/firestore-multitenancy-security.test.mjs`;
- `scripts/warehouse-external-access-security.test.mjs`;
- `scripts/legal-acceptance-security.test.mjs`;
- `scripts/verify-saas-r1-security-enforcement.mjs`;
- `scripts/verify-sector-lifecycle.mjs`;
- `scripts/verify-saas-r1-integration.mjs`;
- guards Block 16.0/16.1/16.2;
- guards Block 17.1/17.2;
- testes da Central de Depósitos;
- segurança externa da Central.

Criar, quando a frente for executada, um orquestrador único ou comando equivalente:

`npm run verify:rc-rules-audit`

Objetivo:

**um comando deve reproduzir o gate das Rules do RC sem depender de uma sequência manual esquecível.**

#### 22.4.10 Fase F — matriz de compatibilidade de rollout

Avaliar explicitamente:

| Aplicação | Rules | Objetivo |
| --- | --- | --- |
| Performance R3 | Rules R3 | baseline conhecida |
| Performance R3 | Rules RC | provar compatibilidade durante publicação/rollback |
| App RC | Rules RC | produto final esperado |
| App RC | Rules R3 | identificar operações novas que exigem Rules novas e definir ordem segura de rollout |

A quarta combinação não precisa ser totalmente funcional; ela deve ser **conhecida**.

Se App RC depender obrigatoriamente de uma permissão inexistente nas Rules R3, documentar:

- qual fluxo falha;
- tipo de falha;
- ordem correta de rollout;
- impacto de rollback;
- janela aceitável.

Nenhuma ordem de deploy deve ser escolhida por suposição.

#### 22.4.11 Fase G — compatibilidade da migração de sessões

SESSION-CAP-01 merece análise explícita.

Se tecnicamente viável e seguro, preferir uma janela transitória em que as Rules reconheçam:

- slots legados `slot-1`/`slot-2`;
- IDs dinâmicos novos.

Objetivo:

- permitir rollout/rollback sem quebrar imediatamente clientes/versões anteriores;
- não obrigar migração destrutiva;
- manter segurança durante coexistência.

A compatibilidade legada só permanece enquanto necessária.

Não manter código/Rules legados indefinidamente sem motivo.

Se coexistência segura não for possível, documentar claramente:

- por que não;
- ordem obrigatória de rollout;
- procedimento de rollback;
- efeito sobre sessões já abertas.

#### 22.4.12 Fase H — análise de performance e custo das Rules

A auditoria deve verificar também:

- número de `get()`/`exists()` por avaliação;
- risco de exceder limites de document access calls;
- impacto de `warehouseLifecycleAllowsAccess`;
- impacto de sessões dinâmicas;
- tamanho do ruleset fonte;
- tamanho compilado quando disponível;
- tempo do Emulator;
- crescimento desnecessário de helpers duplicados.

Não resolver segurança aumentando de forma cega o número de leituras das Rules.

#### 22.4.13 Fase I — rollback de Rules

Antes da publicação, manter disponíveis:

**Banco principal**
- hash/blob da Rule anterior;
- arquivo exato anterior;
- comando/procedimento de republicação.

**Warehouse**
- hash/blob da Rule anterior;
- arquivo exato anterior;
- comando/procedimento de republicação.

Rollback de Rules deve ser independente do rollback da aplicação.

Regra:

```text
rollback Vercel != rollback Rules != rollback dados
```

Se uma Rule permissiva indevida tiver permitido escrita/leitura inadequada, republicar a Rule anterior **não desfaz dados já gravados**.

Nesse caso:

1. fechar acesso;
2. identificar janela;
3. auditar documentos/movimentos;
4. reconciliar dados;
5. só depois encerrar incidente.

#### 22.4.14 Fase J — evidência obrigatória

O handoff da RULES-AUDIT-01 deve entregar:

- RULES_MAIN_HASH;
- RULES_RC_HASH;
- WAREHOUSE_RULES_MAIN_HASH;
- WAREHOUSE_RULES_RC_HASH;
- ruleset IDs ativos quando capturáveis;
- diff estrutural;
- diff semântico;
- matriz ALLOW/DENY;
- testes executados;
- contagem PASS/FAIL;
- regressão do legado;
- regressão SaaS;
- regressão Mobile;
- regressão SESSION-CAP-01;
- compatibilidade de rollout;
- tamanho fonte/compilado quando disponível;
- rollback principal;
- rollback warehouse;
- riscos residuais;
- recomendação final.

Classificações permitidas:

- **PASS — RULES APTAS PARA RC**;
- **PARCIAL — CORREÇÃO NECESSÁRIA**;
- **FAIL — BLOQUEAR RC**.

Não existe “PASS por inferência”.

#### 22.4.15 Critérios mínimos de PASS

RULES-AUDIT-01 só pode ser PASS se:

1. Rules ativas atuais forem conhecidas e reconciliadas;
2. não existir drift produtivo inexplicado;
3. SESSION-CAP-01 já estiver refletida no ruleset final;
4. SaaS e Mobile apontarem para o mesmo ruleset final;
5. ALLOW legítimos críticos passarem;
6. DENY de segurança críticos passarem;
7. cross-workspace continuar DENY;
8. founder continuar funcional;
9. externos legítimos continuarem funcionais;
10. Legal Gate funcionar;
11. billing administrativo funcionar sem virar autorização operacional;
12. lifecycle/suspensão/reativação funcionar;
13. Central Desktop funcionar;
14. Central Mobile funcionar;
15. sessões dinâmicas funcionarem;
16. regressão R3 relevante passar;
17. nenhum acesso permissivo novo inexplicado existir;
18. nenhum bloqueio sistêmico novo existir;
19. rollback de ambos os bancos estiver preparado;
20. ordem de rollout estiver definida;
21. tamanho/complexidade do ruleset estiver dentro dos limites aplicáveis;
22. gates automatizados estiverem reproduzíveis.

#### 22.4.16 Regra de publicação

**Nenhuma Firestore Rule produtiva nova do SaaS R1/Mobile R1 poderá ser publicada sem RULES-AUDIT-01 = PASS.**

Exceção:

somente correção emergencial de segurança/incidente real, com autorização explícita do Fundador e Program Control, evidência mínima, rollback pronto e auditoria retrospectiva obrigatória.

CI verde isolado não substitui RULES-AUDIT-01.

PR mergeable não substitui RULES-AUDIT-01.

Preview aprovado não substitui RULES-AUDIT-01.

#### 22.4.17 Relação com o RC

A sequência oficial passa a ser:

```text
SESSION-CAP-01
→ ruleset final
→ RULES-AUDIT-01
→ PASS RULES
→ composição/finalização RC
→ CT-01/package/CI
→ gates combinados
→ RC CANDIDATE
→ RC FROZEN
→ Preview HTTPS
```

Se qualquer mudança posterior ao PASS alterar:

- `firestore.rules`;
- `firestore.warehouse.rules`;
- Auth/provider;
- UID/workspace/UG;
- lifecycle;
- Legal;
- billing enforcement;
- sessão;
- `warehouseAccess`;

o PASS de Rules deve ser considerado **afetado** e os blocos correspondentes da auditoria precisam ser repetidos antes do freeze.

### 22.5 Runbook de incidente

Sequência mínima:

1. confirmar domínio/deployment;
2. verificar health/runtime;
3. verificar Firestore/Monitoring;
4. classificar impacto;
5. interromper writes se houver dúvida de integridade;
6. corrigir ou rollback;
7. reconciliar dados antes de qualquer correção manual;
8. registrar incidente material.

Problema visual isolado não é automaticamente incidente de rollback.

## 23. CT-01 — contrato transversal obrigatório do RC

Estado atual:

- SaaS/main: `camera=(), microphone=(), geolocation=()`;
- Mobile: `camera=(self), microphone=(), geolocation=()`.

Contrato global do RC:

`camera=(self), microphone=(), geolocation=()`

Interpretação:

- câmera same-origin permitida;
- microfone continua bloqueado;
- geolocalização continua bloqueada;
- `getUserMedia` ainda depende de HTTPS/contexto seguro e permissão do navegador.

Ownership:

**Coordenação do RC.**

MOBILE-J não altera globalmente `next.config.ts` por conta própria.

Antes do PASS final:

- materializar CT-01 na branch RC;
- executar gates afetados;
- publicar Preview HTTPS;
- validar o header HTTP realmente servido;
- provar câmera real em dispositivo físico.

# PARTE VII — MOBILE R1

## 24. Objetivo e contrato Mobile R1

Levar operações físicas da Central de Depósitos ao navegador móvel sem criar segunda fonte da verdade.

Contrato:

- web mobile;
- online-first;
- mesma Auth/workspace/UG;
- mesmo Legal Gate/lifecycle/sessão;
- scanner compartilhado;
- EPX1 apenas como identidade física;
- resolver sempre contra entidades canônicas;
- repositories/ledger/saldo/lote/posição oficiais;
- fallback manual;
- sem banco Mobile paralelo;
- sem operação offline integral na R1.

## 25. Estado funcional consolidado

Concluído e integrado:

- MOBILE-A — plataforma/scanner;
- MOBILE-B — etiquetas/resolver;
- Integração 1;
- MOBILE-C — alocação;
- MOBILE-D — transferência;
- MOBILE-E — consulta;
- Integração 2;
- MOBILE-F — inventário;
- MOBILE-G — saída;
- MOBILE-H — conferência;
- Integração 3;
- MOBILE-I — integração controlada A–H.

MOBILE-I:

- worker certificado: `ea5ad10054e2aea608e270a970fde723cde41d93`;
- PR #245: merged;
- squash: `3a5689e0e613adfb7dbf48ef8d44085ec6c951b3`;
- gates principais: PASS;
- novo delta funcional SaaS↔Mobile: nenhum.

Não reabrir F/G/H/I sem regressão concreta.

## 26. MOBILE-J — certificação final

Branch:

`mobile-r1-j-final-certification@90d646372aae3e92318a78b90d71f72c5eb6b00e`

PR #246:

**OPEN / DRAFT / MERGEABLE**

Classificação:

**PARCIAL TECNICAMENTE SAUDÁVEL / CERTIFICAÇÃO EM EXECUÇÃO**

Escopo permitido:

- certificação;
- evidência;
- regressão concreta mínima;
- nenhuma feature nova.

Próximo marco real:

**RC em Preview HTTPS → testes físicos → reconciliação SaaS final → avaliação de PASS FINAL.**

Runbook especializado:

`mobile-r1-j-final-certification:docs/CENTRAL_MOBILE_R1_MOBILE_J_PHYSICAL_TEST_RUNBOOK.md`

## 27. Certificação física obrigatória

### Android / Chrome

Validar:

- Home Mobile;
- câmera permitida;
- câmera negada;
- câmera indisponível;
- fallback manual;
- abrir/fechar câmera;
- troca/retorno de rota;
- scan válido;
- double scan;
- cooldown;
- scans consecutivos;
- luz baixa/reflexo;
- perda/retorno de rede.

### iPhone / Safari

Executar os mesmos cenários quando houver aparelho disponível.

Se não houver aparelho:

**PENDENTE — APARELHO NÃO DISPONÍVEL**

Não inferir PASS de iPhone a partir de Android.

### Code128 físico

Imprimir e testar:

- COMPACT;
- MEDIUM;
- LARGE.

Validar no mínimo:

- LOCAL;
- SUBPOSITION;
- material/produto;
- distância/enquadramento/contraste;
- repetição;
- ausência de confusão entre etiquetas próximas.

Geração digital isolada não é certificação física.

### Feedback físico

Validar:

- som de sucesso;
- som de erro;
- vibração;
- feedback visual;
- ausência de duplo feedback enganoso;
- erro de persistência sem falso sucesso.

### UX real

Validar:

- uso com uma mão;
- legibilidade;
- botões;
- orientação/scroll;
- loading/empty states;
- foco/teclado;
- Enter quando aplicável;
- scanner ↔ formulário;
- recuperação após erro;
- mensagens de confirmação.

Classificar defeitos:

- BLOQUEANTE;
- IMPORTANTE;
- COSMÉTICO;
- BACKLOG.

Só regressão funcional concreta reabre desenvolvimento.

## 28. Jornada física, invariantes, performance e PASS final

Jornada mínima:

```text
LOGIN
→ CENTRAL MOBILE
→ LER MATERIAL/POSIÇÃO
→ ALLOCATE
→ CONSULTAR
→ TRANSFERIR
→ CONFERIR
→ INVENTARIAR
→ OUTBOUND
→ CONSULTAR ESTADO FINAL
→ CENTRAL DESKTOP
→ CONFIRMAR COERÊNCIA
```

Registrar IDs relevantes: workspace/UG/material/barcode/depósito/posições/lote/movementIds/inventoryId/outboundId.

Invariantes:

- ALLOCATE usa posição/barcode/material canônicos;
- TRANSFER preserva total agregado e não gera saldo negativo;
- inventário salvo não altera saldo antes da revisão/confirm;
- OUTBOUND respeita posição/lote/FEFO/idempotência;
- conferência é read-only e usa transferência como correção oficial;
- Desktop e Mobile mostram o mesmo material/saldo/posição/lote/histórico/ledger.

Rede:

- perda antes de operação crítica deve falhar fechada;
- nenhum falso sucesso;
- retorno permite retomada/reconciliação segura;
- idempotência deve impedir duplicação.

Performance de referência pós-Integração 3/MOBILE-I:

- `/central-mobile`: 257 kB;
- `/central-mobile/alocar`: 275 kB;
- `/central-mobile/transferir`: 261 kB;
- `/central-mobile/inventario`: 271 kB;
- `/central-mobile/saida`: 265 kB;
- `/central-mobile/conferir`: 260 kB;
- Shared First Load: 104 kB.

PASS FINAL Mobile exige:

- testes físicos reais;
- CT-01 observada no Preview;
- jornada ponta a ponta;
- coerência Desktop↔Mobile;
- gates técnicos verdes;
- reconciliação final contra o HEAD/RC SaaS;
- nenhum conflito transversal aberto.

O Coordenador Mobile recomenda; Program Control decide a barreira global.

# PARTE VIII — TESTES, CI E RELEASE

## 29. Política de testes e evidência

Browser E2E não é gate universal.

Prioridade:

- instalação reproduzível;
- TypeScript;
- production build;
- testes de domínio;
- guards estruturais;
- multi-tenant;
- Firestore Emulator quando aplicável;
- Core Protection;
- Recovery;
- Legal Validation;
- diff hygiene;
- testes específicos do RC.

Validação manual é legítima e obrigatória para câmera/scanner/barcode/UX física.

**Não inferir PASS sem execução real quando o requisito depende de hardware/navegador/ambiente publicado.**

## 30. Vercel e Preview HTTPS

Durante desenvolvimento, `build-rate-limit` isolado não é regressão de código.

Para RC:

- Preview HTTPS deve apontar para o **mesmo SHA congelado** que poderá ser promovido;
- não testar um build e reconstruir outro para produção;
- validar header CT-01 no HTTP efetivo;
- usar Preview para fechar MOBILE-J e smoke SaaS antes de tocar domínio produtivo.

## 31. Produção, main e autorizações

`main` é baseline conhecida/recuperável, não branch de experimentação.

Problema encontrado em teste:

```text
bug
→ branch curta/hotfix rastreável
→ teste
→ integração no RC
→ gates afetados
→ novo freeze quando necessário
```

Não “corrigir direto na main”.

Ações protegidas dependem de autorização explícita do Fundador:

- merge/release final para `main`;
- Vercel production/promotion;
- Rules produtivas;
- restore real quando aplicável;
- migração destrutiva;
- ação disruptiva em usuário/workspace real;
- GO/NO-GO de produção e lançamento.

### 31.1 Três planos de rollback

Rollback de aplicação não é rollback total do sistema.

Separar:

1. **Aplicação/Vercel** — voltar ao deployment conhecido;
2. **Rules** — republicar Rules anteriores;
3. **Dados** — reconciliar movimentos/writes; não existe “desfazer automático” por rollback Vercel.

Rollback de Vercel não apaga:

- movimentos;
- ledger;
- billing/legal/lifecycle persistido;
- documentos criados;
- alterações de estoque já gravadas.

### 31.2 Estratégia de teste com menor risco

Na certificação publicada:

- usar workspace/material controlado;
- evitar estoque institucional crítico;
- evitar deletes;
- evitar migração destrutiva;
- registrar IDs das operações;
- interromper writes diante de dúvida de integridade;
- auditar ledger/saldos antes de correção manual.

### 31.3 Gatilhos de NO-GO/rollback

Escalar imediatamente se houver:

- falha sistêmica de login;
- founder ou usuário legítimo bloqueado de forma generalizada;
- cross-workspace;
- Rules permitindo acesso indevido;
- Rules negando operação essencial de forma sistêmica;
- saldo negativo/divergente;
- ledger duplicado;
- idempotência quebrada;
- perda de material/lote/posição;
- billing/lifecycle incorreto;
- Legal Gate impedindo uso legítimo de forma sistêmica;
- scanner indisponível por CT-01;
- erro runtime grave;
- regressão grave do Desktop.

Problema exclusivamente visual não exige rollback automático.

# PARTE IX — RISCOS E GATES ABERTOS

## 32. Gates técnicos ainda abertos

### 32.1 Antes do RC CANDIDATE

Já concluído nesta barreira:

- SESSION-CAP-01: **PASS TÉCNICO COMPLETO / INTEGRADA**;
- RULES-AUDIT-01: **PASS — RULES APTAS PARA RC**;
- Rules produtivas principal e Warehouse capturadas: **SEM DRIFT**;
- TTL `sessionSlots.expiresAt` e `sessionRevocations.expiresAt`: **ACTIVE**;
- compatibilidade de rollout/rollback de Rules documentada;
- guards de sessão/Rules/lifecycle/telemetria e Browser E2E: PASS.

Ainda obrigatório antes de declarar RC CANDIDATE:

- criar/fixar branch única de composição;
- fixar fontes SaaS e Mobile;
- incorporar semanticamente os deltas;
- aplicar CT-01;
- reconciliar Auth/workspace/UG/sessão/Legal/billing/lifecycle;
- reconciliar Rules principal e Warehouse;
- reconciliar package/lockfile/Application CI;
- reconciliar repositories/shell/scanner/Central;
- registrar hashes do candidato;
- executar gates combinados no SHA exato;
- obter todos os gates obrigatórios verdes.

A validação física com múltiplos operadores Desktop/Mobile pertence à etapa de Preview HTTPS/MOBILE-J após o candidato congelado.

### 32.2 Antes do RC FROZEN

- nenhum conflito material;
- SHA único;
- manifesto de release;
- rollback de aplicação preparado;
- rollback de Rules preparado;
- baseline Performance R3 registrada;
- nenhuma mudança oportunista aberta.

### 32.3 Antes de produção controlada

- RULES-AUDIT-01 permanece válida para os hashes exatos do RC;
- nenhuma alteração de Rules posterior ao PASS ficou sem reauditoria;
- Preview aprovado;
- smoke crítico SaaS+Mobile;
- CT-01 comprovada;
- Rules comprovadas;
- integridade de dados sem dúvida;
- rollback pronto;
- risco HARDEN-B avaliado;
- autorização explícita do Fundador.

Preferência: backup READY nos dois bancos + `recovery:verify`.

### 32.4 Antes de PASS FINAL Mobile

- runbook físico executado;
- Android;
- iPhone ou pendência explicitamente classificada;
- Code128;
- som/vibração;
- rede;
- jornada ponta a ponta;
- Desktop↔Mobile;
- reconciliação final SaaS.

### 32.5 Antes da abertura comercial ampla

- piloto real;
- cliente pago real;
- trial→regularização;
- suspensão→bloqueio→reativação controlada;
- recovery/restore comprovado;
- uptime/alerta;
- custo/capacidade;
- SAAS-J;
- pendências classificadas;
- GO explícito.

## 33. Riscos que não podem ser esquecidos

- confundir billing comercial com autorização operacional;
- assumir que “pago” reativa automaticamente lifecycle desabilitado;
- apagar dados por inadimplência/cancelamento;
- deixar usuário suspenso sem regularização/recuperação acessível;
- duplicar Auth/sessão/legal na Mobile;
- confundir a remoção autorizada do teto de sessões com remoção do controle de sessão;
- manter por engano os IDs fixos `slot-1`/`slot-2` após declarar sessões sem teto;
- remover revogação/lease/telemetria junto com o limite;
- usar números históricos de lease/heartbeat em vez do runtime atual 30/15;
- sobrescrever CT-01;
- publicar Rules sem RULES-AUDIT-01 PASS;
- presumir que Rules do Git são idênticas às realmente ativas em produção;
- testar apenas ALLOW e esquecer DENY;
- validar apenas App RC + Rules RC e ignorar a janela de rollout/rollback;
- alterar Rules após auditoria sem invalidar/repetir o gate;
- publicar Rules sem rollback;
- confundir rollback Vercel com rollback de dados;
- merge/rebase cego entre SaaS e Mobile;
- criar fonte paralela logística;
- reabrir A1/A2 sem nova evidência;
- declarar uptime/backup/restore sem evidência real;
- declarar iPhone PASS por inferência;
- corrigir diretamente em `main`;
- tratar acabamento visual de PDF como blocker sem defeito funcional;
- considerar CI verde como autorização produtiva.

# PARTE X — CRONOLOGIA CANÔNICA

## 34. Marcos históricos principais

### 2026-09 — Central de Depósitos

Consolidados materiais, depósitos/posições, lotes/FEFO, intake, saída, consumo imediato, barcode, ledger, segurança externa e telemetria.

### 2026-10-01 — Performance R3

Rodada encerrada e publicada.

Baseline produtiva atual:

`main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

### 2026-10-01 a 2026-10-02 — SaaS R1 funcional

Integrados billing, onboarding, legal, recovery tooling, lifecycle/security e integração SaaS.

Contrato comercial consolidado em R$ 70 / Plano Completo.

### 2026-10-02 — Program Control

Instituída governança global acima dos programas, com barreiras transversais e autoridade global de RC.

### 2026-10-02 a 2026-10-03 — Mobile R1 funcional

A–H, Integrações 1–3 e MOBILE-I concluídas/integradas.

Desenvolvimento funcional Mobile encerrado.

### 2026-10-03 — Hardening final

- HARDEN-A1: PASS;
- HARDEN-A2: PASS com risco residual aceito;
- HARDEN-C/D: PASS;
- HARDEN-B: parcial/temporal;
- MOBILE-J: certificação final;
- RC conjunto: composição liberada;
- produção: inalterada.

### 2026-10-03 — Remoção do teto fixo de sessões autorizada

Decisão do Fundador:

- remover o limite fixo de 2 sessões externas por workspace/UG;
- motivação principal: permitir múltiplos operadores simultâneos na Central Móvel;
- preservar lease, heartbeat, revogação, painel administrativo, auditoria, lifecycle e telemetria;
- implementar em frente transversal controlada `SESSION-CAP-01`;
- executar antes do RC CANDIDATE/RC FROZEN;
- até a execução, o runtime permanece em 2 sessões externas.

### 2026-10-03 — Auditoria integral de Rules torna-se gate obrigatório

Decisão do Fundador:

- não publicar as novas Firestore Rules por tentativa e erro;
- instituir `RULES-AUDIT-01`;
- auditar banco principal e `emprovex-warehouse`;
- comparar produção real versus ruleset final;
- exigir matriz ALLOW/DENY;
- exigir regressão das funcionalidades antigas e novas;
- exigir compatibilidade de rollout/rollback;
- executar auditoria final depois da SESSION-CAP-01;
- bloquear publicação produtiva de Rules sem PASS formal.

### 2026-10-03 — SESSION-CAP-01 + RULES-AUDIT-01 ativadas

Program Control criou a frente transversal única:

- branch: `rc-session-cap-rules-audit`;
- base congelada: `c6c164c70a1be3e2e7e4e57b0bbf4866d61a71ce`;
- fase 1: SESSION-CAP-01 — remover o teto fixo de 2 sessões preservando segurança, revogação, lifecycle, painel, auditoria e telemetria;
- fase 2: RULES-AUDIT-01 — auditar o ruleset final pós-SESSION-CAP-01 contra a produção/R3, SaaS, Mobile e rollback;
- integração cruzada/merge/rebase da integradora durante a execução: proibidos;
- publicação de Rules, deploy produtivo, merge em `main` e restore: não autorizados;
- handoff final obrigatório ao Program Control.

A frente deve permanecer sequencial: RULES-AUDIT-01 só pode declarar PASS final depois que SESSION-CAP-01 estabilizar o ruleset estrutural.

### 2026-10-04 — SESSION-CAP-01 concluída tecnicamente

Worker `rc-session-cap-rules-audit` encerrou desenvolvimento técnico em:

`a97c1a94799cbbc240994d76fefc6f85925bffe1`

PR:

**#248 — DRAFT / MERGEABLE / NÃO INTEGRADO**

Resultado aceito pelo Program Control:

- SESSION-CAP-01: **PASS TÉCNICO COMPLETO**;
- teto fixo de 2 sessões removido no candidato;
- lease dinâmico por `browserInstanceId`;
- lease 30 min / heartbeat 15 min / revogação 24 h preservados;
- `slot-1` e `slot-2` preservados somente para compatibilidade transitória;
- 3ª e 4ª sessões legítimas: ALLOW;
- pseudo-slot `slot-3`, ID dinâmico adulterado e takeover de lease ativo: DENY;
- painel administrativo, lifecycle, provisioning, revogação, auditoria e telemetria reconciliados;
- suspensão do workspace permanece fail-closed para N sessões;
- multi-tenant preservado.

Gates confirmados no fechamento:

- Application CI #959 — SUCCESS;
- Core Protection #246 — SUCCESS;
- Recovery #637 — SUCCESS;
- Legal Validation #61 — SUCCESS;
- Production Build — PASS;
- TypeScript final — PASS;
- Diff Hygiene — PASS;
- Browser E2E #49 / run 37171327188 — SUCCESS no SHA certificado `44372599fe0526313d3650a55c649615a1ff14d4`;
- Bloco 16.8 — 8/8 PASS;
- quatro sessões independentes + multitab compartilhado — 1/1 PASS.

Vercel permaneceu vermelho apenas por `build-rate-limit`, sem evidência de regressão funcional.

Produção, `main`, Vercel Production e Rules produtivas permaneceram inalterados.

### 2026-10-04 — Baseline produtiva das Rules confirmada sem drift

Leitura somente de produção concluída nos dois bancos.

Ruleset ativo — banco principal:

- release: `cloud.firestore/ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`;
- ruleset ID: `06094fa5-0b5b-4dc0-a0b5-7ca032864860`;
- fingerprint Git normalizado: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- baseline esperada de `main`: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- drift: **NENHUM**.

Ruleset ativo — Warehouse:

- release: `cloud.firestore/emprovex-warehouse`;
- ruleset ID: `d246184a-350f-40a0-8241-f2b0fa631768`;
- fingerprint Git normalizado: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- baseline esperada de `main`: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- drift: **NENHUM**.

Primeiro gate externo da RULES-AUDIT-01: **PASS**.

### 2026-10-04 — RULES-AUDIT-01 encerrada em PASS

Verificação final confirmou:

- `sessionSlots.expiresAt`: `ACTIVE`;
- `sessionRevocations.expiresAt`: `ACTIVE`.

Com as Rules vivas previamente confirmadas sem drift e o inventário pré-TTL validado, o Program Control declara:

**RULES-AUDIT-01 = PASS — RULES APTAS PARA RC**

SESSION-CAP-01 permanece:

**PASS TÉCNICO COMPLETO**

Integração:

- PR #248 marcado ready;
- PR #248 squash-merged na integradora SaaS/RC;
- commit de integração: `54aba792cb9e7bb195e21401fb50a21ed50add19`;
- `main`: inalterado;
- aplicação RC: não publicada;
- Rules RC: não publicadas.

Próxima barreira global:

**composição do RC único SaaS R1 + Mobile R1**, seguida de CT-01, reconciliação package/lockfile/CI e gates no SHA exato.

### 2026-10-04 — TTL produtivo autorizado e em criação

Após autorização explícita do Fundador, foram iniciadas exclusivamente as políticas TTL em:

- `sessionSlots.expiresAt`;
- `sessionRevocations.expiresAt`;

no banco principal:

`ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`.

Operações retornadas:

- sessionSlots: `AyBjNGNiYzA2Zjk5ZWQtOTU0YS01ZjY0LTQ3OGEtODg4OTM2ZGMkGnNlbmlsZXBpcAkKMxI`;
- sessionRevocations: `AyBiZjE1ZWYwMTMxMjgtMGU3OC03Yjc0LWQxZjUtZWYxNTNjY2EkGnNlbmlsZXBpcAkKMxI`.

Leitura imediata pós-ativação:

- sessionSlots.expiresAt → `ttlConfig.state = CREATING`;
- sessionRevocations.expiresAt → `ttlConfig.state = CREATING`.

Conclusão:

- comando de ativação aceito nos dois campos;
- nenhuma outra configuração produtiva foi alterada;
- RULES-AUDIT-01 permanece aberta somente até os dois TTLs atingirem `ACTIVE`;
- nenhuma nova escrita/configuração deve ser feita durante essa espera.

### 2026-10-04 — Inventário pré-TTL validado

Leitura somente de produção executada antes de qualquer ativação de TTL.

`sessionSlots`:

- total: **5**;
- sem `expiresAt`: **0**;
- expirados: **5**;
- não expirados: **0**.

`sessionRevocations`:

- total: **0**;
- sem `expiresAt`: **0**;
- expirados: **0**;
- não expirados: **0**.

Conclusão operacional:

- não existe sessão ativa que seria atingida imediatamente pela ativação de TTL;
- os 5 documentos existentes em `sessionSlots` já estão expirados e são resíduos de lease;
- não existem tombstones de revogação pendentes;
- ativar TTL nos dois collection groups é tecnicamente coerente com o contrato da SESSION-CAP-01;
- a ativação continua sendo mudança produtiva de retenção e exige autorização explícita do Fundador.

### 2026-10-04 — TTL produtivo ausente

Consulta somente leitura de:

- `sessionSlots.expiresAt`;
- `sessionRevocations.expiresAt`;

retornou somente `indexConfig`, sem `ttlConfig`.

Conclusão:

**TTL NÃO CONFIGURADO** nos dois collection groups.

Impacto:

- RULES-AUDIT-01 ainda não recebe PASS FINAL;
- SESSION-CAP-01 continua PASS técnico;
- ativar TTL é mudança produtiva de retenção e pode excluir documentos já expirados;
- ativação exige decisão/autorização explícita do Fundador;
- antes da ativação, Program Control deve preferencialmente inspecionar os documentos existentes e confirmar que `expiresAt` está coerente.

### 2026-10-04 — RULES-AUDIT-01 em fechamento externo

Classificação:

**PRONTA PARA FECHAMENTO EXTERNO / AINDA NÃO PASS FINAL**

Rules candidatas pós-SESSION-CAP:

- principal RC: `bc91185f34bcdcb4437a4de1078d1089a09292ba`;
- Warehouse RC: `6e1f1050005314db4e17cb3136409abbddb0ee91`.

Faltam apenas dois gates vivos:

1. capturar em modo somente leitura os rulesets realmente ativos nos dois bancos e comparar drift;
2. confirmar TTL realmente configurado para:
   - `sessionSlots.expiresAt`;
   - `sessionRevocations.expiresAt`.

Se houver drift inexplicado:

**STOP PRODUCTION RULES DRIFT — NÃO PUBLICAR.**

Se baseline vivo e TTL forem coerentes, Program Control poderá fechar RULES-AUDIT-01 e seguir para integração/RC conforme governança.

Ordem de rollout candidata, se mantida após os gates vivos:

```text
Rules RC
→ aplicação RC
```

Compatibilidade comprovada:

- app antiga + Rules RC: compatível via `slot-1`/`slot-2`;
- app RC + Rules RC: alvo;
- app RC + Rules antigas: incompatível.

Rollback:

- aplicação pode voltar primeiro mantendo Rules RC;
- rollback das Rules exige rollback prévio da aplicação.

### 2026-10-03 — Transição para Release Engineering

Por decisão do Fundador:

- Coordenador Geral assume também Coordenação do RC;
- Coordenadores SaaS/Mobile entram em modo consulta/evidência;
- nenhuma nova wave funcional autorizada;
- próximo produto a ser construído é um único SHA de RC SaaS+Mobile.

### 2026-10-15 — Regularização controlada do Suco (Warehouse)

Após retirada dos estoques de teste e remoção das NFs da fila pelo Fundador, permaneceu um saldo legado de 5 unidades do Suco sem localização. A ocorrência `POSITIVE_UNASSIGNED=5` já constava do memorial de integridade e fora excluída expressamente do reparo anterior dos lotes.

A manutenção pontual foi preparada no [PR #310](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/310) e executada pelo Fundador no PowerShell com autenticação gcloud. Dry-run PASS, backup local pré-write e correção atômica PASS: `balances` 5→0, `locationBalances.UNASSIGNED` 5→0, movimento `INVENTORY_ADJUSTMENT` -5 preservando ledger/histórico. Nenhum deploy, merge, alteração de Rules ou exclusão de NFs. Outros materiais não foram abrangidos por essa conferência.

---

# PARTE XI — DECISÕES PERMANENTES

## 35. Decisões que só podem mudar por decisão explícita

### Produto

- experiência operacional prevalece sobre otimização marginal;
- SaaS e Mobile são interfaces do mesmo produto;
- Central Mobile não cria backend/fonte de verdade paralelos;
- uma única autoridade por material/saldo/lote/posição/ledger.

### Comercial

- Plano Completo R$ 70/mês por workspace;
- trial padrão 30 dias;
- vencimento 5º dia útil;
- tolerância 10 dias;
- cobrança externa;
- confirmação manual;
- modo observe;
- sem suspensão automática;
- sem delete por inadimplência;
- API/webhook fora da R1;
- founder/VIP usam `exempt`;
- VIP não perde funcionalidades.

### Billing versus lifecycle

- `billingAccounts` é fonte comercial;
- `workspaces.status` + `platformAccounts.status` + `warehouseAccess` governam acesso;
- status comercial sozinho não deve virar autorização;
- suspensão/reativação real é ação administrativa explícita;
- pagamento confirmado não reativa automaticamente lifecycle desabilitado.

### Identidade e sessão

- founder Google-only;
- externo password-only;
- workspace/UG/UID/e-mail precisam ser coerentes;
- founder isento de capacidade;
- runtime atual dos externos: 2 sessões, **com remoção do teto fixo já autorizada pelo Fundador**;
- estado alvo: sessões externas sem limite fixo por workspace, preservando identidade/lease/revogação/auditoria/telemetria;
- a migração deve ocorrer antes do RC freeze;
- lease atual permanece 30 min;
- heartbeat atual permanece 15 min;
- revogação administrativa encerra sessões conhecidas;
- fail-closed em inconsistência.

### Legal

- pacote legal versionado;
- versão atual `saas-r1-2026-10-01`;
- aceite por UID + bundle;
- nenhum aceite é presumido em erro;
- VIP não possui exceção legal;
- regularização/Termos/Privacidade/recuperação não devem ser bloqueadas indevidamente.

### Dados

- cancelamento comercial não apaga dados;
- suspensão não altera estoque/documentos;
- exportação/retenção/exclusão são processos separados;
- nenhum rollback improvisado de estoque/ledger.

### Segurança e dependências

- RULES-AUDIT-01 é gate obrigatório antes de publicar Rules do novo release;
- Rules realmente ativas devem ser capturadas e comparadas ao Git antes de rollout;
- todo delta de Rule precisa de justificativa + teste ALLOW/DENY;
- regressão da Performance R3 é obrigatória com o ruleset final;
- rollback de Rules é separado de rollback Vercel;
- alteração de Rules após PASS invalida os blocos afetados da auditoria;
- Rules não são afrouxadas para facilitar teste;
- CT-01 permite somente câmera same-origin;
- microfone/geolocalização permanecem bloqueados;
- A2 não reabre sem nova evidência/upstream relevante;
- não usar `npm audit fix --force` como estratégia.

### PDFs

- jsPDF 4.2.1 / AutoTable 5.0.8;
- defeito funcional em PDF bloqueia;
- acabamento visual fino isolado não bloqueia e pode ir para backlog.

### Release

- `main` não é branch de experimentação;
- Preview testa o SHA que poderá ser promovido;
- aplicação, Rules e dados possuem rollback/reconciliação distintos;
- CI verde não autoriza produção;
- Fundador mantém GO/NO-GO produtivo final.

### Desenvolvimento

- novas features SaaS/Mobile estão congeladas durante a composição/certificação do RC;
- corrigir apenas regressão concreta;
- conflitos são resolvidos semanticamente;
- workers/frentes especializadas não integram cruzado por conveniência.

# PARTE XII — ÍNDICE OPERACIONAL

## 36. Documentos globais

- `docs/EMPROVEX_MEMORIAL_OFICIAL.md` — estado/contratos/governança;
- `docs/EMPROVEX_PROGRAM_CONTROL.md` — protocolo do Coordenador Geral;
- `docs/EMPROVEX_MEMORIAL_HISTORICO_ATE_2026-10-03.md` — histórico integral preservado.

## 37. SaaS R1

Documentos canônicos:

- `docs/SAAS_R1_PLANO_MESTRE.md`;
- `docs/SAAS_R1_EXECUCAO_PARALELA.md`;
- `docs/SAAS_R1_INTEGRATION_STATUS.md`;
- `docs/SAAS_R1_COORDENADOR_HANDOFF.md`;
- `docs/SAAS_R1_PRE_PILOTO_HARDENING.md`;
- `docs/SAAS_R1_HARDEN_A2_FIREBASE_FIRESTORE_GRPC.md`;
- documentação HARDEN-B/recovery.

Para contrato comercial/operacional vigente, este Memorial tem precedência sobre checkpoints históricos antigos.

## 38. Mobile R1

Documentos canônicos:

- `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md`;
- `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`;
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`;
- `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`;
- `docs/CENTRAL_MOBILE_R1_FINAL_CERTIFICATION.md` — MOBILE-J;
- `docs/CENTRAL_MOBILE_R1_MOBILE_J_PHYSICAL_TEST_RUNBOOK.md` — atualmente na branch `mobile-r1-j-final-certification`.

O runbook físico é procedural. Este Memorial registra os critérios canônicos; o runbook registra casos/evidências.

## 39. Central de Depósitos

- `docs/adm-deposito/README.md`;
- `docs/adm-deposito/STATUS.md`;
- `docs/adm-deposito/DECISIONS.md`;
- `docs/adm-deposito/ROADMAP.md`.
- `docs/WAREHOUSE_INTEGRITY_RECONCILE_01.md` — auditoria que identificou `POSITIVE_UNASSIGNED=5`.
- `docs/WAREHOUSE_DATA_REPAIR_EXECUTION_01.md` — reparo anterior dos lotes, sem baixa das cinco unidades.
- [PR #310](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/310) — executor de correção pontual e evidência pós-commit do Suco (2026-10-15).

## 40. Performance R3

- `docs/PERFORMANCE_R3_COMERCIALIZACAO.md`;
- `docs/PERFORMANCE_R3_EXECUCAO_PARALELA.md`;
- `docs/PERFORMANCE_R3_INTEGRATION_STATUS.md`;
- `docs/PERFORMANCE_R3_COORDENADOR_HANDOFF.md`.

## 41. Testes e CI

- `docs/TESTING_POLICY.md`;
- `docs/DEVELOPMENT_CI_WORKFLOW.md`.

---

# PARTE XIII — PROTOCOLO DE ATUALIZAÇÃO DO MEMORIAL

## 42. O que deve ser atualizado imediatamente

Atualizar o Memorial quando houver:

- mudança de `main`;
- nova integradora relevante;
- conclusão de wave;
- mudança de semáforo global;
- conflito transversal;
- decisão arquitetural;
- mudança de contrato comercial;
- mudança de política de segurança;
- freeze de RC;
- produção/release;
- novo blocker global.

## 43. O que não deve inflar novamente o Memorial

Detalhes como:

- todos os runs;
- logs de terminal;
- cada tentativa de CI;
- cada commit intermediário;
- cada comentário de PR;
- cada prompt de worker;

devem continuar preservados nos documentos especializados/Git, mas não duplicados integralmente no corpo principal.

## 44. Regra de preservação histórica

Nenhuma reorganização documental pode apagar evidência histórica.

Quando uma seção crescer a ponto de prejudicar leitura:

1. consolidar o estado vigente neste Memorial;
2. preservar a versão detalhada em documento histórico/especializado;
3. registrar link explícito;
4. manter Git como trilha definitiva.

O arquivo:

`docs/EMPROVEX_MEMORIAL_HISTORICO_ATE_2026-10-03.md`

é a primeira aplicação formal dessa regra e contém o Memorial legado integral.

---

# 45. Estado para retomada imediata

```text
PRODUÇÃO
main@e90f92acae1514ee5cbc6ce95fed354bc1454330
Performance R3
aplicação RC: NÃO PUBLICADA
Rules RC: NÃO PUBLICADAS

GOVERNANÇA
Program Control + Coordenação do RC: ATIVO
Coordenadores SaaS/Mobile: consulta/evidência sob demanda
Fundador: autoridade final de produção/GO

SAAS R1
funcional: ENCERRADO
integrador com SESSION-CAP: feat/saas-r1-commercializacao
commit de integração runtime SESSION-CAP/RULES-AUDIT: 54aba792cb9e7bb195e21401fb50a21ed50add19
HARDEN-A1: PASS
HARDEN-A2: PASS — risco residual aceito
HARDEN-B: PARCIAL / temporal
HARDEN-C: PASS
HARDEN-D: PASS
nova feature SaaS: NÃO AUTORIZADA

BILLING R1
Plano Completo: R$ 70/mês
trial: 30 dias
vencimento: 5º dia útil
tolerância: 10 dias
modo: observe
requirePayment: false
automaticSuspension: false
pagamento: externo via Link HTTPS/Pix
confirmação: manual/auditada
suspensão operacional: manual via lifecycle
delete por inadimplência: NÃO

IDENTIDADE / SESSÕES
founder: Google-only / capacidade isenta
externo: e-mail+senha / e-mail verificado
workspace↔UG↔conta primária: obrigatório
produção R3 atual: teto histórico de 2 sessões externas
candidato SaaS/RC: múltiplas sessões externas sem teto fixo, com controle individual
SESSION-CAP-01: PASS TÉCNICO COMPLETO / INTEGRADA
lease: 30 min
heartbeat: 15 min
TTL sessionSlots.expiresAt: ACTIVE
TTL sessionRevocations.expiresAt: ACTIVE
fail-closed: SIM

LEGAL
bundle: saas-r1-2026-10-01
terms: terms-2026-10-01-r1
privacy: privacy-2026-10-01-r1
aceite: versionado por UID/workspace
erro de verificação: fail-closed

MOBILE R1
integrador: feat/central-mobile-r1@7b7717b6eebabf911310d2b8ac56ed13c9cb9238
funcional A–I: ENCERRADO
MOBILE-J: CERTIFICAÇÃO FINAL EM EXECUÇÃO
HEAD J: 90d646372aae3e92318a78b90d71f72c5eb6b00e
blocker funcional: NENHUM
próximo trabalho: RC Preview HTTPS + runbook físico

RULES
PR #248: MERGED
squash SESSION-CAP/RULES-AUDIT: 54aba792cb9e7bb195e21401fb50a21ed50add19
RULES-AUDIT-01: PASS — RULES APTAS PARA RC
produção principal viva: 0d990b7de0b2e85ed55fe14ec0d2ce29b3635299
produção warehouse viva: b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2
drift produtivo: NENHUM
principal RC: bc91185f34bcdcb4437a4de1078d1089a09292ba
warehouse RC: 6e1f1050005314db4e17cb3136409abbddb0ee91
ordem futura autorizável de rollout: Rules RC → aplicação RC
publicação produtiva RC: NÃO AUTORIZADA
rollback Rules: obrigatório e independente do Vercel

RECOVERY
PITR: ATIVO em ambos
delete protection: ATIVA
backup diário: ATIVO
retenção: 14 semanas
backup READY: PENDENTE
recovery:verify: PENDENTE
restore isolado real: PENDENTE / protegido

RELEASE
RC único SaaS+Mobile: PRONTO PARA COMPOSIÇÃO
RC Candidate: AINDA NÃO DECLARADO
RC Frozen: NÃO
CT-01: PENDENTE NO RC
Preview HTTPS: AINDA NÃO PUBLICADO
produção controlada: NÃO AUTORIZADA
piloto real: NÃO INICIADO
abertura comercial: NÃO AUTORIZADA

PRÓXIMA SEQUÊNCIA
criar/fixar branch única do RC
→ compor SaaS + Mobile semanticamente
→ aplicar CT-01
→ reconciliar Rules/package/lockfile/CI/contratos
→ executar gates no SHA exato
→ declarar RC CANDIDATE se PASS
→ RC FROZEN
→ Preview HTTPS
→ testes SaaS + MOBILE-J físicos
→ corrigir somente regressões/blockers reais
→ nova reconciliação/freeze se necessário
→ GO/NO-GO explícito para produção controlada
```

## Regra final de continuidade

Antes de qualquer decisão futura:

1. ler este bloco;
2. conferir HEADs vivos;
3. conferir se o evento é funcional, transversal ou produtivo;
4. nunca promover estado histórico a estado vigente;
5. nunca considerar uma pendência “resolvida” sem evidência;
6. nunca tratar PASS técnico como autorização de produção.

## COST-FIRESTORE-R1 — estimativa financeira global do Firestore em BRL (19/10/2026)

Solicitação do Fundador executada **somente na branch feat/admin-visual-organizacao-base-emprovex / PR #341 (DRAFT)**. Não houve merge, deploy, alteração de regras ativas, escrita de dados produtivos ou mudança na cobrança.

### O que foi entregue
- Aba **Consumo & Cotas → Estimativa de custos · R$** na Administração original, sem substituir as demais abas.
- Motor puro \`lib/firestoreCostEstimate.mjs\`, com contrato \`.d.mts\`, calcula separadamente **Read Units, Write Units, Realtime Read Units** a partir dos snapshots do Cloud Monitoring e do histórico diário existente; preço em USD por milhão e câmbio USD/BRL fornecidos pelo fundador.
- Cartões: **Hoje (parcial), últimos 7 dias, mês até agora, projeção do mês**. Períodos sem medição são explicitamente incompletos, não tratados como zero. Projeção requer pelo menos três dias passados observados, cobertura histórica de 80% e informação do dia atual; dia atual não é extrapolado como completo.
- Preços editáveis e referenciados à tabela pública **Enterprise, Iowa/us-central1, preços padrão em USD**, consulta em 19/10/2026: Read Units USD 0,05/milhão; Write Units USD 0,26/milhão; atualizações em tempo real USD 0,30/milhão. **Valores são referência, não regionais/contratuais confirmados**. Fonte: https://cloud.google.com/firestore/enterprise/pricing.
- Câmbio é **obrigatoriamente manual** para apresentar números em reais; sem câmbio confirmado a interface mostra “R$ —” e custo parcial em USD. Não há dependência de API de câmbio externa, cotação fictícia ou valor escondido.
- Franquia grátis **desligada por padrão**; usuário opta manualmente só após confirmar elegibilidade do banco. Quando ligada, descontos por limite diário específico de RU, WU e realtime, **não por mês**. Para dia sem limite confiável, custo fica indisponível.
- Somente reutiliza \`loadGlobalUsageHistory\` via consulta limitada aos registros diários entre o início do mês e os últimos sete dias. A aba executa a consulta **apenas ao entrar** e ao clicar em Atualizar; **não** cria listeners, polling, gravações, endpoints nem leitura por UG. O snapshot ao vivo reutiliza as props do painel. Campo opcional \`metricsComplete\` marca o histórico legado sem unidade faturável completa como não calculável.
- **Não é fatura Google Cloud.** Exclusões gerenciadas, eventos, storage, PITR, backup, restauração, rede, impostos, descontos, créditos e serviços externos não entram no valor. Cobrança oficial: https://console.cloud.google.com/billing. Não atribuir valor financeiro a UGs (somente métricas/proxy R3).
- Testes de unidade: \`scripts/firestore-cost-estimate.test.mjs\` integrado ao Application CI para cobrar cálculo por dia, lacunas, tarifas, franquia e condição de projeção.

### Gates, segurança e estado
Application CI, TypeScript/build, Core Protection, Firestore Rules/Emulator e aceite humano precisam ser verificados sobre o **HEAD final**. O código de custo **não depende da migração de Firestore Rules**. Não anunciar PASS de checks até constarem concluídos na GitHub Actions. Não publicar sem comando separado do Fundador. Para QA local: \`http://localhost:3001/admin?tab=consumo\`; usar conta fundadora e modo somente leitura.

### Handoff
**Onde estamos:** PR #341 aberto em DRAFT, módulo de custo R1 implementado no código, sem produção. **O que fazemos:** certificação de testes e conferência visual/financeira. **Quem faz:** executor GitHub/CI. **Próximos passos:** confirmar região, edição, elegibilidade do free tier, taxa cambial aplicada e SKUs efetivos em Cloud Billing; se necessário evoluir integração server-side somente sob autorização adicional. **Quem fará:** Fundador valida parâmetros e aparência; executor corrige problemas apontados e mantém memorial.


## ADMIN-WORLD-HOME-R1 — Bairro digital 3D (19/10/2026)

**Solicitação expressa do Fundador:** criar nova aba **Início** na Administração original, com um bairro digital em perspectiva isométrica 3D: cada conta = uma casa; janelas quentes iluminadas para sessões válidas; ruas, lotes, árvores, jardins, postes de iluminação, telhados e caixas de correio; grande caixa d'água transparente ao fundo representando a ocupação da referência diária de consumo Firestore.

**Implementado exclusivamente no PR #341 (branch \`feat/admin-visual-organizacao-base-emprovex\`; DRAFT; sem merge e sem deploy):**
- \`components/admin/AdminWorldHomePanel.tsx\` e \`.module.css\`: HUD noturno com indicadores, cena responsiva, controles de rotação limitada, zoom, seleção de conta e navegação por quarteirões de 9 residências. Em telas pequenas a maquete admite rolagem horizontal em vez de distorcer ou suprimir casas.
- \`components/admin/AdminWorldScene.tsx\`: composição programática de geometria com coordenadas x/z/altura projetadas em SVG isométrico; casas 3D estilizadas com variação discreta de paleta e iluminação, ruas/faixas, vegetação, postes, caixas de correio, caminhos, reservatório translúcido com nível proporcional. Não usa dependência adicional de Three/WebGL e não carrega assets remotos.
- \`lib/adminNeighborhoodModel.mjs\` + \`.d.mts\`: mapeamento determinístico de uma casa por **conta real única** de \`adminDirectory.directory.accounts\`, incluindo administrador e usuários de setor, sem criar usuários demonstrativos. Para registrar **presença**, cruza sessões existentes por UID vinculado (email apenas como alternativa quando UID da conta não está disponível), exige \`expiresAt > now\`, deduplica múltiplas sessões e deixa contas suspensas sem luz. Falha/ausência dos dados de sessões = \`unknown\`, **não falso offline**. A luz significa **sessão válida**, e não atividade humana em tempo real.
- Caixa d'água: \`billableReadUnits / billingReference.readUnitsDailyLimit\` no snapshot global já carregado; indicador textual preserva valor >100% e altura da água fica limitada ao reservatório. Sem métrica válida, aparece “Sem dados”. Trata-se de referência diária, não limite de interrupção, custo por UG ou fatura.
- Integração: \`app/admin/page.tsx\` transmite \`adminDirectory.directory.accounts\` como prop à \`PlatformAdminView\`; \`PlatformAdminView\` insere \`inicio\` como aba inicial. As oito abas originais (inclusive \`overview\`/Visão Geral) permanecem acessíveis e os handlers operacionais não foram alterados. \`/admin\` abre a nova Início; \`/admin?tab=overview\` mantém a Visão Geral.
- Eficiência: **nenhuma consulta/leitura nova, nenhuma gravação, nenhum listener adicional, nenhum polling de Firestore, nenhuma nova Rules ou endpoint**. Clock local de 60 s apenas revalida a expiração de leases visualmente; renderiza no máximo nove casas por quarteirão.
- Acessibilidade: seleção por teclado, legenda textual, status desconhecido distinto de offline, CSS prefers-reduced-motion e texto acessível para dados do reservatório.
- Testes: \`scripts/admin-world-neighborhood.test.mjs\` (uniqueness, identidade, expiração, fail-closed, paginação, referência sem dados, proibição de consultas), \`scripts/admin-visual-only.test.mjs\` atualizado para preservar as oito abas. Comando \`npm run test:admin-world-neighborhood\` registrado no Application CI.

**Gates:** verificar conclusão **do último HEAD de código**, TypeScript, testes de unidade, build, Core Protection, Recovery, Legal e Application CI. Nunca afirmar PASS de CI ainda em progresso. Não houve QA visual humano, nem merge/deploy/publicação. A validação local não pode acionar botões mutacionais. Sem ajuste de Firestore Rules ativas.

**Como inspecionar sem deploy:** no PowerShell Windows, no checkout da branch do PR #341, \`git pull --ff-only\`, \`npm.cmd ci\` (quando preciso), \`npm.cmd run dev -- --port 3001\` e abrir \`http://localhost:3001/admin\` com a conta fundadora. Para o painel prévio, \`http://localhost:3001/admin?tab=overview\`. Se \`localhost:3001\` já estiver executando uma versão antiga, reiniciar o servidor no checkout atualizado.

**Handoff:** onde estamos — 3D bairro integrado no PR #341 DRAFT; o que fazemos — certificar o HEAD e validar estética no navegador; quem faz — executor GitHub (código e CI), Fundador (aceite visual); a seguir — inspeção visual local, refinamento de detalhes de maquete e confirmação de leitura de sessões/cota; quem fará — Fundador no navegador e executor nas correções, SEM alterar produção.


## ADMIN-WORLD-R1.1 — Nova maquete isométrica fiel à referência (19/10/2026)

**Solicitação:** substituir a aparência esparsa do bairro anterior pela composição da referência visual enviada pelo Fundador: malha de ruas convergente, grande edifício central, vários prédios de fachada branca/vidro azul, coberturas verdes, jardins e árvores densas, passagem de pedestres, postes e caixa-d'água translúcida à esquerda com leitura do consumo Firestore. Tema escuro EMPROVEX permanece no restante da UI.

**Executado apenas na branch do PR #341, sem merge ou deploy:**
- Novo \`components/admin/AdminWorldArchitecture.tsx\` contém geometria projetada 3D de edifícios, fachadas com janelas por pavimento, telhados verdes, hall simbólico da plataforma, árvores detalhadas, luminárias, caixas de correio e reservatório cilíndrico com água interna recortada por clipPath. Sem novas dependências, imagens externas nem WebGL.
- \`AdminWorldScene.tsx\` redesenhado: maquete simétrica de 15 lotes cenográficos, 4 braços viários principais até a praça central, vias secundárias, faixas, calçadas, jardineiras e pedestal com espessura. O edifício central é **marco simbólico EMPROVEX**, não representa conta adicional nem sessão falsa.
- Atribuição a usuários: apenas **até nove prédios identificados** por quarteirão representam contas reais. O restante é cenário urbano **não clicável** e não entra nas contagens; não há nomes/usuários fictícios. Fachadas dos usuários só recebem janelas amarelas iluminadas quando a sessão existente foi validada. Sem sessão ou sem telemetria de presença, respeitar os estados originais.
- Caixa d'água recebe as props existentes \`waterKnown/waterLevel/waterExceeded\`: líquido visível proporcional à referência diária de billableReadUnits, status sem medição e indicação de extrapolação sem cortar a porcentagem textual.
- Textos da nova Início explicam explicitamente a diferença entre prédio identificado e construção de cenário; mantêm legenda, painel de conta, navegação por quarteirões, zoom, rotação suave e acessibilidade por teclado.
- Testes do bairro atualizados para separar a geometria \`AdminWorldArchitecture.tsx\` da cena e garantir continuação da ausência de consultas/alterações Firestore. O CI e guardrails devem ser certificados sobre o último HEAD.
- Edição estética foi feita exclusivamente na nova Início (sem alterar as oito abas originais, stores, Rules, billing, workspaces ou produção).

**Aceite pendente:** abrir \`http://localhost:3001/admin\` com a conta fundadora depois de atualizar o checkout do PR #341; validar estética/densidade, leitura das janelas por conta, proporção do reservatório, zoom e navegação. Não anunciar inspeção de navegador realizada sem evidência do Fundador. Evitar merge/deploy até solicitação expressa.

**Handoff:** onde estamos — R1.1 implementada no PR #341 DRAFT; o que fazemos — certificação de CI e validação estética humana; quem faz — executor GitHub (código, checks, memorial), Fundador (navegador); a seguir — revisar screenshot real da nova Início e ajustar a geometria conforme feedback; responsável — executor somente após aceite/correções solicitadas.


## ADMIN-WORLD-R1.2 — Lotes vazios, conta fundadora central e legendas nos telhados (19/10/2026)

**Pedido do Fundador:** manter os lotes urbanos visualmente vazios enquanto não houver conta associada; reservar o prédio central exclusivamente à conta fundadora APROV HGeSM; mover as etiquetas das contas para **acima dos edifícios**.

**Alterações implementadas no PR #341, branch \`feat/admin-visual-organizacao-base-emprovex\`, ainda em DRAFT:**
- Identidade fundadora comprovada no contrato existente: \`HGESM_SECTOR_EMAIL = aprov1hgesm@gmail.com\`, workspace \`hgesm-aprov\`. O cadastro fundador usa \`accountType='sector'\` com privilégio administrativo resolvido em seu contexto, **não cria segunda conta de administrador**. \`partitionNeighborhoodResidents\` usa esse e-mail normalizado, retira a conta dos lotes laterais e a associa exclusivamente à construção central.
- \`components/admin/AdminWorldHomePanel.tsx\`: a contagem mantém todas as contas reais (incluindo fundadora), mas a paginação de nove casas é restrita às demais contas. O edifício central é selecionável como os demais e usa presença baseada exclusivamente na sessão de identidade real. Se a conta ainda não estiver carregada, o prédio central mantém identificação de lugar reservado, sem acender nem criar sessão fictícia.
- \`AdminWorldScene.tsx\`: edifícios laterais só são instanciados **quando existe usuário real correspondente**. Lotes sem usuário mostram somente piso e marca de parcela disponível, sem prédio nem caixa de correio. Os slots se preenchem automaticamente quando o diretório existente enviar novas contas, respeitando os quarteirões. Nenhuma conta é representada duas vezes.
- \`AdminWorldArchitecture.tsx\`: \`CityBuildingLabel\` renderiza as legendas **no último passe SVG, sobre os telhados**, evitando sua ocultação por fachadas, jardins e construções. Prédio fundador rotulado **APROV HGeSM** acima do edifício. Indicadores de status respeitam online, offline, suspenso e desconhecido. A porta/identidade do edifício central continua refletindo a conta fundadora, não apenas um marco cenográfico.
- UI atualizada para falar em prédios ocupados, prédio selecionado e lotes vazios. Os oito módulos históricos continuam preservados.
- \`scripts/admin-world-neighborhood.test.mjs\`: acrescentados testes de identidade fundadora, não duplicação, paginação lateral e guards estáticos contra prédios cenográficos, com verificação de etiquetas e slots.
- **Sem Firestore reads/writes adicionais, sem novos listeners, sem deploy, sem merge e sem modificação em produção.** Tests/CI/Legal/Recovery/Core devem ser certificados **no HEAD final**, e a aparência permanece sujeita a aceite humano.

**Handoff:** Onde estamos — R1.2 com slots vazios, torre fundadora e legendas acima das construções no PR #341 DRAFT. O que estamos fazendo — certificação de CI e atualização da prévia local. Quem faz — executor no GitHub; Fundador na inspeção visual. Próximo passo — usar \`git pull --ff-only\` na branch do PR #341, reiniciar \`npm.cmd run dev -- --port 3001\` e abrir \`http://localhost:3001/admin\`. Quem fará — Fundador valida; executor corrige refinamentos apontados.


## ADM DEPÓSITO — COLD-3D-R1 · Geladeira e freezer em 3D premium (19/10/2026)

PR #342 em DRAFT · \`feat/warehouse-cold-appliances-3d-premium\` · base \`main@30f292c8\`. Alterações exclusivas na prévia isométrica de depósitos:
- Geladeira industrial com portas duplas inox escovado, profundidade real, juntas térmicas, puxadores, painel técnico, acabamento lateral e painel traseiro do compressor.
- Frente física da geladeira definida sempre pelo **lado maior horizontal** do equipamento e preservada sob as quatro câmeras: Frente, Direita, Trás e Esquerda. Detalhes frontais só na face fisicamente correta; nas vistas traseira/laterais existem acabamentos próprios.
- Freezer baú com tampas superiores duplas translúcidas, moldura isolante, puxador real, dobradiças e ventilação; geometria criada em coordenadas físicas antes da projeção, sem desenhar acessórios no ar.
- Novo \`lib/warehouse/applianceOrientation.ts\`, novo \`features/warehouse/components/WarehouseColdAppliance3D.tsx\`, integração em \`WarehouseIsometricPreview.tsx\`. Testes físicos e guards adicionais em \`scripts/warehouse-isometric-camera.test.mjs\`.
- Não altera layout persistido, schema, dados, Firestore, Rules, autorização, movimentações, saldo ou interfaces operacionais. Nenhuma dependência 3D nem leitura extra. Sem merge ou deploy.
- Documento detalhado: \`docs/adm-deposito/COLD_3D_R1_20261019.md\`. CI e validação gráfica pendentes de conclusão e aceite humano no navegador.

Handoff: onde estamos — PR #342 DRAFT; o que fazemos — aguardar CI e validar estética multi-perspectiva; quem faz — executor de GitHub e Fundador; o que fazer a seguir — abrir a prévia 3D na branch e comparar as quatro vistas; quem o fará — Fundador confirma e executor aplica ajustes.


## NAV-R1 — Barra lateral organizada e Central de Depósitos para setores externos (19/10/2026)

**Situação:** branch \`feat/sidebar-navigation-external-warehouse-r1\`, derivada do PR #342 com geladeira/freezer 3D previamente aprovados. Trabalho isolado de produção, sem merge.

- Barra lateral do EMPROVEX organizada por fluxo de trabalho: Visão geral (Início/Painel), Gestão de empenhos (Empenhos/Notas Fiscais/Consulta de Itens/Fornecedores), Acompanhamento (Cronogramas/Relatórios/Central de Avisos) e módulo destacado Gestão de depósitos.
- Atalho \`Central de Depósitos\` voltou a ser exibido para **setores externos operacionais autorizados**. Corrigido o bloqueio de interface por workspace \`HGESM_WORKSPACE_ID\` em \`app/page.tsx\`, mantendo \`canAccessWarehouseModule(workspaceContext)\`.
- **Segurança inalterada:** o gate \`WarehouseAccessBoundary\` e \`/api/central-depositos/status\` validam token, setor, workspace, UG, permissões e, para externos, vínculo de conta ativa; a correção não libera setor não autorizado.
- Mantidos botões, rotas, animação, acessibilidade, contador de avisos, responsividade e sem novas leituras Firestore; reforço de testes em \`scripts/visual-r1-w4-sidebar-border-beam.test.mjs\`.
- Memorial técnico e critérios de aceite: \`docs/NAV_R1_SIDEBAR_EXTERNAL_WAREHOUSE_20261019.md\`. CI/smoke humano necessários antes de publicar.

**Handoff:** onde — branch NAV-R1, baseada em 3D R1; fazendo — validar sidebar e botão externo; responsáveis — executor de código/CI, Fundador no navegador; próximo passo — checkout em \`localhost:3001\` e aceite dos dois perfis; executor/coordenação não deve publicar sem confirmação.

## WAREHOUSE-STOCK-3D-R1 — Ocupação física e validade de 14 dias (19/10/2026)

**Estado:** PR #344 DRAFT, branch `feat/warehouse-3d-occupancy-stacking-expiry-14d`; ainda sem merge e sem deploy de produção.

- Auditoria: as geladeiras/freezers tinham apenas `occupied` sem brilho dependente de conteúdo; caixas em paletes/mesas/estantes eram posicionadas de modo figurativo e a validade dos lotes não afetava o 3D.
- Implementados reflexos brancos discretos em geladeiras/freezers com saldo real, caixas projetadas em superfícies físicas e empilhadas em níveis, inclusive por subposição de estante, e indicação por caixa da validade (amarela quando vence em 14 dias inclusive; vermelha quando já venceu).
- Estados dependem de **lote ativo com quantidade positiva e saldo físico positivo na mesma posição e material**, respeitando depósito, local e subposição. Sem estoque ou sem lote identificado, não há alerta inventado.
- Aplicado nas **duas telas de visão 3D**: prévia do editor de croquis e vista operacional `Meus Depósitos`, em todas as quatro perspectivas.
- Economia de Firestore: nova leitura de lotes por intervalo indexado no `expiresOn` limitada a 500 e somente ao abrir a visão; sem listeners, sem novas escrituras. Consultas detalhadas/FEFO de material seguem intactas.
- Nenhuma alteração no schema de dados, Firestore Rules ou cadastros. A regra geral de 30 dias continua no domínio; o corte de 14 dias é **apenas visual**.
- Regressões e CI: `scripts/warehouse-3d-stock-visual.test.mjs` integrada ao Application CI. Documento técnico: `docs/adm-deposito/STOCK_3D_VISUAL_R1_20261019.md`.

**Handoff:** onde — PR #344 isolado; fazendo — validação CI e visual; responsáveis — executor de código e Fundador; próximo passo — smoke em localhost:3001 nas 4 câmeras, validar dia+14/+15 e posição; quem fará — Fundador aprova, executor ajusta; não há publicação automática.

## EMPROVEX R4 — Reconciliação Warehouse R2/R3 com 3D premium (19/10/2026)

**Registro histórico da fase DRAFT (hoje PR #345 MERGED e R4 publicada):** branch `feat/warehouse-r3-restoration-consolidated`, base `main@2c30a354`. Esta onda foi solicitada para **recuperar e publicar, numa única release**, o que foi aprovado na linha R2/R3 mas não foi integrado à `main`, além das melhorias 3D do PR #344.

- Causa: a R3 antiga foi publicada diretamente via CLI Vercel de uma branch `07cab044`/hotfix `eb1935a`, sem merge. A publicação posterior da `main` substituiu esses recursos. Código original preservado nos PRs #331–#338 e suas branches, recuperado seletivamente.
- Recuperado: inspeção por hover/teclado/clique, local sem saldo, painel ancorado abaixo da cena, modal e PDF por local, pesquisa global entre depósitos, botão para local/subposição em depósito existente, formulário de cadastro dimensional e guardas de inativação.
- Preservado: geladeira/freezer premium atual e sua frente física; caixa sobre palete/mesa/prateleira com empilhamento; branco quando frigorífico ocupado; caixa amarela entre 0–14 dias e vermelha se vencida, halo amarelo suave no local. Acesso externo autorizado e menu da `main` inalterados.
- Firestore: Regras/coleções/autenticação/dados intactos; leitura por índice de `expiresOn` para alertas, lote integral apenas ao inspecionar, sem listener por hover ou query por tecla. Limite de 500 exibe aviso de incompletude. Política FEFO geral preservada.
- NF: entrada de alocação detalhada restaurada como escolha dentro do painel de ações de NF, preservando as ações em lote atuais. Não trocar o sistema de empenhos atual por snapshot antigo.
- Testes históricos de busca, inspeção/PDF, cadastro e segurança reintegrados ao Application CI. Documento detalhado: `docs/releases/EMPROVEX_WAREHOUSE_R4_RECONCILIACAO_20261019.md`.
- **Release gate:** não mergear/publicar até Application CI, Core Protection, Recovery, Legal, QA Visual e smoke humano. Vercel administrativa requer execução PowerShell autenticada do Fundador; usar `git archive` sem .git, deploy --prod --skip-domain, saúde, promote, inspect. Evitar duas publicações.

**Handoff:** onde — PR #345; fazendo — certificação da união R2/R3 + premium; responsáveis — executor GitHub e Fundador; próximo — CI + smoke, squash único na `main` e publicação; quem fará — executor integra, Fundador promove pelo CLI da Vercel.


## WAREHOUSE-READ-R1 — Migração da consulta de Alocação de Material (21/10/2026)

**Estado ATUAL: PR #350 MERGED — CI 6/6 PASS; Warehouse Read R1 PUBLICADO em produção; usuário confirmou melhoria de velocidade.** Base `main@76d78f90`, deployment de produção `dpl_A1WA8xC478i5UNdAuRqaSumr1nFN`; GitHub branch `feat/warehouse-read-r1-server-queue`. Nenhuma alteração aplicada às Firestore Rules, banco produtivo ou deploy da Vercel.

**Causa técnica confirmada:** acompanhamento de NFs reutiliza dados da sessão e histórico sob demanda; alocação usa o caminho `loadWarehouseInvoiceIntakeQueue`, que sincroniza índice e cruza `invoices`, `intakes`, `queueExclusions`, `movements` e `empenhos` via SDK cliente, com consultas sequenciais. Um acesso visual pode escrever estado derivado do índice, mas nunca deve alterar saldo.

**Mudança no candidato R1:**
- `GET /api/central-depositos/queue`: uma chamada autenticada, usando `verifyWarehouseRequest`, com `workspaceId` e UG determinados no servidor, nunca escolhidos pelo navegador.
- `warehouseQueueReadStore.ts`: leituras server-only Firestore REST de bancos principal e `emprovex-warehouse`, com coleções permitidas, escopo exato, decodificação, lotes e teto de paginação; nunca expõe endpoint arbitrário.
- `warehouseQueueReadServer.ts`: sincroniza índice PERF-D com bootstrap inicial quando necessário, preserva o `intake` ausente como PENDING; busca apenas candidatos, NFs, empenhos, estados e movimentos relacionados; mantém reconciliação com projeções legadas e desativa candidatos tratados.
- `queueReadClient.ts`: transporte autenticado; `WarehouseItemRegistrationOperational` usa a API para fila operacional, preservando o histórico e a consulta pontual de intakes sob demanda no caminho anterior.
- Telemetria mínima por abertura registra duração, NFs descobertas, intakes, índice e linhas retornadas, sem dados fiscais nem tokens.
- Teste de contrato no Firestore Emulator com bootstrap, replay, alocação parcial, divergência canônica e isolamento entre workspaces, incluído no workflow Warehouse Server R2 Smoke.

**Certificação do código:** PR #350 squash-merged em `main@7e4697e483e73fb7910e61f9d71519fc8d2ddad1`, com Application CI, Fast CI, Core Protection, Warehouse Server R2 Smoke, Browser E2E e Visual QA PASS. O Emulator do Read R1 confirmou bootstrap/replay, quantidade parcial, divergência canônica e isolamento. Cenário de 1 NF: bootstrap 275 ms e repetição 103 ms, sem nova escrita de índice; esses números NÃO são benchmark de produção nem comparação com a versão anterior. Não presumir economia de Firestore. Histórico/reconciliação continuam no SDK cliente sob demanda; em caso de cobertura incompleta o servidor falha explicitamente. Após a publicação, o fundador confirmou que o carregamento da alocação ficou bem mais rápido; não há percentual auditado de redução.

**Governança GOV-SIMP-01:** PR separado, sem deploy automático, sem atualização de Rules produtivas. Somente integrar à `main` após CI e teste de equivalência. Após merge, publicação única com PowerShell proprietário, pré-validação e smoke humano; a publicação não faz parte desta missão.

**Handoff final:** onde — `main@7e4697e4` com READ-R1 certificado em CI, deploy oficial anterior R2 mantido; fazendo — aguardando apenas deploy de validação e smoke humano; quem fez — executor GitHub, PR #350; a seguir — publicação manual única pela sessão proprietária, conferir a fila e suas NFs antes do `promote`; quem fará — Fundador pelo PowerShell. Firestore Rules produtivas inalteradas.

### Fechamento de publicação — Warehouse Read R1 (21/10/2026)

- Código: PR #350 merged (7e4697e4); release fonte e693abe23b69597f4c2878f856f19008c3dd272f.
- Vercel: https://emprovex.com.br validado via inspect apontando para dpl_J5aHD6V1kCHDvmCGSJHDQYzftPD3; status Ready; /api/health retornou status ok. Repetir promote resultou 409 porque já era o deployment atual.
- Smoke humano relatado: a aba Alocação de Material ficou bem mais rápida. PASS qualitativo de velocidade percebida; não houve medição comparativa nem confirmação explícita dos detalhes de todas as NFs e quantidades. Não inferir ganho percentual ou redução de custo Firestore.
- Rules produtivas não foram alteradas pela publicação; não houve confirmação de teste real de operações de estoque após a publicação.
- Handoff: onde — Read R1 publicado no domínio oficial; fazendo — operação normal/observação de eventuais erros; quem fez — executor GitHub e Fundador pelo PowerShell/navegador; próxima ação — nenhuma publicação adicional necessária, medir objetivamente apenas quando houver demanda; responsável — equipe de desenvolvimento conforme necessário.


## WAREHOUSE BULK STOCK R1 — Carga inicial de depósito por planilha (21/10/2026)

**Estado final: PR #351 MERGED, CI 6/6 PASS e publicação Vercel confirmada em `emprovex.com.br` (21/10/2026).** Desenvolvimento originado da necessidade de lançar contagens físicas extensas por planilha em Entrada Avulsa, sem cadastro manual de cada item. Uma planilha de referência ODS com 121 linhas guiou as colunas e cenários, mas seus dados reais NÃO foram enviados ao repositório nem importados ao Firestore.

- Novo painel em `features/warehouse/components/WarehouseBulkManualEntryOperational.tsx`, integrado à Entrada Avulsa. Gera modelo Excel, seleciona depósito, faz upload autenticado e prévia sem gravação, apresenta locais não correspondentes, reconhece material existente pela descrição/unidade e agrupa materiais novos repetidos.
- Endpoint `GET/POST /api/central-depositos/bulk-stock`: gera `.xlsx` e analisa até 1500 linhas / 5 MB com parser ZIP/OpenXML limitado, bloqueio de fórmulas e limites anti-zip-bomb. Nenhum dado sensível do workspace integra o modelo; POST não grava estoque.
- Após conferência e anuência explícita, grava cada linha pela transação já existente `registerWarehouseManualEntryServer`, que deriva escopo da identidade e valida saldo, posição, lote, barcode e movimento. Não cria motor de estoque paralelo. Cada linha utiliza `operationId` estável ligado ao hash do arquivo + número da linha; progresso e ID de material novo ficam em checkpoint local para retomada no mesmo navegador/arquivo.
- Nova opção `lotCode` no contrato de entrada avulsa, persistida atomicamente como código do lote físico; compatibilidade retroativa quando ausente. O cadastro da estrutura física (depósito/local/subposição) deve preceder a importação; erros de localização bloqueiam a confirmação.
- **Proteção operacional:** IMPORTAÇÃO É ADITIVA (aumenta saldo); não executa ajuste de inventário, não sobrescreve estoque existente nem corrige o SISCOFIS. Importações parciais já confirmadas mantêm seus movimentos; operador deve retomar com o MESMO arquivo e confirmar situação antes de nova tentativa.
- **Limites explícitos:** até 1500 linhas por arquivo e 5 MB; leitura dos primeiros 500 materiais canônicos. Quando atinge o teto, bloqueia para não duplicar material pela falta de cobertura. Suporta upload `.xlsx`; a fonte `.ods` precisa ser convertida antes. Correspondência por nomes/códigos de locais não é automática se houver ambiguidade.
- **Certificação e governança:** PR #351 integrado por squash na `main` (`38a8f86fc2c07604d6a36bdb36cc98792994546a`); 6/6 workflows PASS: Application CI, Browser E2E, Fast CI, Core Protection, Visual QA, Warehouse Server R2 Smoke (incluindo XLSX/Emulator). A publicação manual ocorreu via PowerShell proprietário na equipe `aprov-hgesms-projects`; nenhuma Firestore Rule foi alterada.

**Handoff de publicação:** onde estamos — `emprovex.com.br` apontando para `dpl_AuJ4yHDLrjk8wDuihCZMgcp7j6r5` (status Ready, `/api/health` status ok); o que foi feito — modelo XLSX, prévia, motor de importação aditivo, CI 6/6, merge e deploy Vercel únicos; quem fez — executor GitHub e Fundador via PowerShell; o que fazer a seguir — smoke humano de baixar, subir e conferir prévia sem gravar saldos, mais primeira carga real apenas após conferência/autorizações cabíveis; quem fará — Fundador e operadores autorizados. **A validação de saúde não comprova, sozinha, a operação de upload ou a equivalência de todos os saldos em produção.**


## HOTFIX BULK STOCK XLSX R1 — Correção de células vazias (21/10/2026)

**Status: Publicado em produção no domínio oficial.** PR #352 squash-merged em `main@5c129bbb8416e85075162bfb62c0b940bf6fdc48`; Vercel deployment `dpl_8Xx2xrnss1Se6pDobYWr2GhJha3i` (`controles-de-empenhos-aprov-qiclgd4wp-aprov-hgesms-projects.vercel.app`), confirmado `Ready` em `emprovex.com.br` pelo PowerShell do Fundador; `/api/health` retornou status `ok` (2026-10-21T19:32:53.188Z).

- **Defeito real:** ao enviar planilha Excel com código de barras vazio na coluna E e Tipo de local na coluna F, o parser regex consumia incorretamente a célula seguinte após célula autoconclusiva `<c .../>`, retornando `STOCK_IMPORT_INVALID_ROW_2`, apesar de a linha estar preenchida.
- **Correção mínima:** `lib/server/warehouseBulkStockWorkbook.ts` distingue célula XML autoconclusiva, preservando colunas seguintes; teste de regressão no `scripts/warehouse-bulk-stock-r1.test.ts` confere E2 vazia, F2 Estante, G2 9, H2 1. Não alterou motor financeiro/estoque, movimentos, índices, Firestore Rules ou autenticação.
- **Evidências GitHub:** Application CI, Browser E2E, Core Protection, Fast CI e Warehouse Server R2 Smoke = **5/5 PASS**. `WAREHOUSE BULK STOCK XLSX R1 PASS` no Emulator.
- **Dados reais:** a planilha de 121 linhas foi examinada fora do repositório; não foi importada ao Firestore. A correção de parsing não garante que todas as posições estejam cadastradas corretamente, nem que não haja divergências no estoque.
- **Handoff:** onde — produção oficial no hotfix; o que falta — fundador reenviar a mesma planilha e conferir prévia, linhas e correspondência de depósitos/posições, sem confirmar gravação até validar; quem — fundador. Gravação inicial deve ser deliberada, auditada e respeitar que a carga é **aditiva**; não ajusta SISCOFIS.


## WAREHOUSE BULK STOCK — Correspondência com locais existentes (21/10/2026)

**Código integrado e CI 6/6 PASS; Vercel de produção publicada e verificada.** PR #353 (squash-merged na main, commit de código `b5de4c4b5f5bea5c3b2c2166d4b51ae861c1cf6b`). A análise da planilha de contagem e do screenshot do Controle de Depósitos revelou que o depósito DEP-001 já possui 20 locais e as subposições necessárias, mas o importador não reconhecia a diferença de formato entre `Estante 9 / 1` e `Estante 09 / Prateleira 01` (código `EST-09 / PRT-01`).

- Implementado `lib/warehouse/bulkStockLocationMatcher.ts` para correspondência **estrita** por tipo e número (sem zero à esquerda), depotId, parentLocationId e status ativo; tipos Estante/Freezer/Geladeira/Palete/Prateleira com equivalentes EST/FRZ/GEL/PAL/PRT/PRAT. Sem fuzzy matching, sem criar ou reativar estrutura e sem gravar saldo.
- Preservada a correspondência literal de nomes/códigos personalizados já suportados anteriormente (exemplo Armário 12 / A1), evitando regressão em outros depósitos. Correspondências duplicadas continuam ambíguas e bloqueadas.
- A prévia `WarehouseBulkManualEntryOperational` passa a mostrar a localização **efetivamente cadastrada** ao lado da referência informada na planilha. Teste de regressão novo confirma 20 locais representativos, EST-09/PRT-01, subposição pai, escopo de depósito, inativos, ambiguidades e códigos livres; Warehouse Smoke / Fast CI / Core Protection / Browser E2E / QA Visual / Application CI: **6/6 PASS**.
- Distribuição do arquivo examinado: 121 linhas (100 estantes 1–10, 18 paletes 1–7, 3 freezers 1–2). A correspondência efetiva depende do catálogo carregado e da validação humana em produção; não afirmar importação/saldo concluído.
- **Deploy concluído em 21/10/2026:** fundador executou `git pull --ff-only` para `main@005c3520686ad5343575ab9885751e6acfe64c8c`, seguido de `vercel.cmd deploy --prod --archive=tgz --scope aprov-hgesms-projects`. Vercel confirmou deployment `dpl_FVY5SXGvnbyYGEXtQms6mmaPURLw` (`controles-de-empenhos-aprov-djq8jbniw-aprov-hgesms-projects.vercel.app`), status Ready e alias `https://emprovex.com.br`; `/api/health` retornou `status=ok` em 2026-10-21T19:59:59.551Z. Não ocorreu atualização de Firestore Rules ou alteração direta do estoque.
- **Handoff:** onde — hotfix PR #353 efetivamente publicado no domínio oficial; fazendo — validação humana da prévia; quem fez — executor GitHub (código) e Fundador (PowerShell); próximo — recarregar a página, reenviar a mesma planilha de 121 linhas e conferir que os destinos correspondem aos locais cadastrados antes de clicar em Confirmar carga; quem fará — Fundador. O health PASS não confirma, por si só, que todas as posições reais estejam corretamente resolvidas. A importação é aditiva e não altera SISCOFIS.


## R356–R359 — Consulta de locais, foco 3D e leitura móvel de códigos de barras (21/10/2026)

- **R356:** PR #356 integrado por squash em `main@2234b41ba9431922e641929bcadf901b30c42af6`, promovido manualmente na Vercel (`dpl_CP6umLRd5iPfoFxHfK1KmhSfpwdP`); a janela de inspeção de locais passa a apresentar descrição, saldo físico, validades e código de barras, edição controlada de cadastro/validade e PDF organizado. Quantidade não é editável; alterações de descrição, código e lote usam comandos de servidor existentes.
- **R357:** PR #357 integrado em `main@1ca65e96c300df44e2ad875c96c86403b5fd5b46`, promoção manual do deployment `dpl_EEVA8rBpZ3MnhQHcpubTtNM2CdrV` confirmada por `vercel inspect https://emprovex.com.br` e health ok. Retirou consultas de lotes em hover: diálogo aparece primeiro, dados são buscados ao abrir, com redução de reads.
- **R358:** PR #358 integrado em `main@97eb9908d7dd0e1fcd8908c111d8067ad5d55a93`. Correção direcionada do retângulo preto de foco nativo no SVG 3D por mouse-down, preservando Tab/Enter/Espaço e focus-visible. Staged `dpl_ENTzZUzRcboGH4ca5aShAQtkL8uZ` confirmado Ready pelo fundador; **não afirmar promoção ao domínio sem o inspect correspondente**.
- **R359 — desenvolvimento mobile em branch `feat/warehouse-mobile-barcode-locations-r359`, PR #359 DRAFT.** `Meus Depósitos` ganha abaixo de 1024 px uma alternância **Locais** (lista padrão com busca por código, nome e descrição do material) / **Mapa 3D** (preservado no celular), acesso ao diálogo do local e ação **Ler código** por material; visão 3D desktop permanece intacta. Editor reutiliza `WarehouseMobileScanner` + decoder ZXing existente, com câmera traseira ativada somente sob ação do usuário, entrada manual e encerramento após uma captura. Código lido apenas preenche o formulário: **nenhuma gravação automática**. O operador confere a identidade do item/local e toca **Salvar alterações**. Rejeitar códigos de localização válidos, preservar barcodes de apresentações convertidas, editar apenas o código da unidade-base por `BARCODE_SAVE`/`BARCODE_REPLACE` no servidor. Sem writes diretos no Firestore, alterações em Rules, saldos, lotes, históricos ou nova dependência de scanner.
- **Economia Firestore:** pesquisa/lista mobile computada sobre materiais, localizações e saldos físicos previamente consultados em `WarehouseHomeOperational`; lote consultado apenas na abertura de local, barcode consultado apenas para materiais daquele local. Scanner processa vídeo localmente e não o envia/guarda. Limites de leitura incompleta bloqueiam edição e PDF, evitando substituições com dados parciais.
- **QA/segurança:** tipos, auditoria de writes, scanner móvel, contrato de inspeção e proteção Core são gates do PR. Teste real no celular, com permissão de câmera (HTTPS), scanner EAN/UPC/Code128, ação de salvar, bloqueio de código repetido e permissão de operador deve ser realizado no staged **somente com workspace QA** antes de promover em produção. Não digitar `PUBLICAR` sem esse GO humano.
- **Entrega:** GitHub gera branch/PR, revisão e CI; fundador continua responsável pelo fluxo manual PowerShell `vercel.cmd pull/build --prod/deploy --prebuilt --prod --skip-domain` e promoção do MESMO deployment, após smoke em dispositivo real. Evitar deploy automático e não alterar Firestore Rules.


## R360 — Legibilidade e acesso imediato a detalhes em Controle de Materiais (22/10/2026)

- **Demanda do fundador:** na subaba **Estoque**, ao clicar no material, sua ficha ficava no fim da lista (ex.: 108 itens) e parecia não abrir; cards exibiam IDs internos, cinco grupos de métricas e avisos simultâneos. **Relatórios** tinha navegação extensa e tabela técnica sem detalhamento acessível.
- **Correção proposta em PR #360 DRAFT — `feat/warehouse-stock-reports-clarity-r360`:** o clique em uma linha de estoque abre a ficha existente em janela modal imediata, através de `createPortal(document.body)`, por cima do shell, com rolagem interna, botão Fechar, tecla Esc e travamento temporário de rolagem do fundo. Preserva as ações oficiais existentes de localização, código de barras, validade, movimentações e transferência; o próprio saldo continua sendo obtido do ledger, sem regravação.
- **UX Estoque:** lista reduzida a descrição, quantidade disponível, principal localização e validade, exibindo chips somente para problemas materiais (pendência física/lote vencido ou próximo). ID técnico permanece na ficha; filtro, busca e ordem FEFO existentes preservados. Mostrar inicialmente 25 registros e botão **Mostrar mais** com paginação exclusivamente em memória (não refaz leituras).
- **UX Relatórios:** título e categorias em linguagem cotidiana; histórico de movimentações abandona tabela horizontal em favor de cartões `<details>` expansíveis contendo origem, documento/referência, fornecedor de NF e ID sob demanda, 30 registros inicialmente com **Mostrar mais** em memória. Rótulos internos de tipos foram traduzidos somente para a apresentação; código/identidade persistidos permanecem inalterados. Filtros, download CSV, limites de 500 movimentos, demais relatórios, cadastros e regras preservados.
- **Segurança/custo:** alteração exclusivamente de apresentação; nenhuma alteração em Firestore Rules, permissões, repositorios de escrita, lotes, saldo, ledger ou histórico. Abrir detalhe de movimentação não realiza consulta remota; abertura da ficha de material mantém consulta de histórico sob demanda já existente.
- **QA e publicação:** novo teste `scripts/warehouse-stock-report-ux.test.mjs` conectado ao Fast CI; aguardar TypeScript, auditoria de gravações, Core e QA Visual antes de integrar PR. Para versão em Vercel, utilizar fluxo manual PowerShell: prebuild `main` consolidado, deployment imutável `--skip-domain`, health, smoke visual com seleção de primeiro e último material + relatório, promoção apenas após aprovação humana. Não houve mudança automática em produção.


## R361 — Recuperação seletiva de melhorias NE/Recebimento 3D (22/10/2026)

**Decisão do fundador:** recuperar exclusivamente os comportamentos dos PRs históricos #326, #327 e #328 na `main` atual; preservar R345–R360 e demais melhorias posteriores, não importar a release antiga #330 em bloco.

1. **Empenhos → Cadastrar Empenho:** apenas `Cadastro Manual` e `Importar PDF da NE`. Removida a alternativa JSON, com campo, parser, prompts externos e ações de colagem. O PDF continua sendo interpretado pela API autenticada `/api/empenhos/parse-ne`, com revisão editável; a gravação da revisão requer `importSource === 'pdf'`. Modelos de dados anteriores e fluxos JSON de outros domínios, como SAG, não são removidos.
2. **Central de Depósitos → Início → Recebimento 3D:** painel informativo da NF renderizado em uma camada SVG final (acima de estruturas e textos) com fundo opaco e limite vertical para prevenir sobreposições/recorte. Sem mudar os layouts ou os motores de estoque.
3. **Clique em palete de NF:** abrir diretamente `/central-depositos/cadastro-de-itens?aba=pendentes&nf=<invoiceRecordKey>`; a fila já existente localiza a mesma identidade canônica, expande os itens e destaca/foca a nota sem consulta adicional nem ações automáticas. Não abrir o modal de alocação em massa a partir do palete da Landing. A funcionalidade em massa continua nos seus outros locais. Notas sem chave canônica não são agrupadas por número/identidade ambígua.
4. **Testes proporcionais ao risco:** novo `scripts/warehouse-r361-ne-nf-ux.test.mjs`, guard histórico `verify:empenho-pdf-direct-import`, e seleção na suíte Fast CI. Garantir TypeScript, proteção Core e builds no GitHub antes de qualquer integração; manter todos os fluxos de alocação e banco inalterados.
5. **Publicação:** sem deploy na Vercel nesta tarefa, sem modificação de Firestore Rules ou dados reais. Integração em GitHub somente após CI; publicação manual futura pelo fundador em PowerShell, após prebuild isolado e smoke humano. PR R361 traz a documentação vigente.

**Nota:** a conclusão dos checks deve ser registrada no PR R361; este parágrafo documenta a implementação, não atesta QA manual ou disponibilização na produção.


## R363 — EMPROVEX instalável no celular e computador (22/10/2026)

**Pedido do fundador:** instalar o mesmo endereço `emprovex.com.br` como aplicativo Android/iPhone e como janela independente no Windows (Chrome/Edge), usando a logomarca institucional que já aparece no EMPROVEX. Não criar novo aplicativo nativo nem assinatura de app store. R362 estética permanece isolada e NÃO compõe esta release.

**Arquitetura enxuta de PWA instalável:**
- `app/manifest.ts` inclui nome EMPROVEX, `start_url: '/'`, `scope: '/'`, `display: 'standalone'`, `pt-BR`, tema azul institucional e ícones PNG 192/512 (512 apto a máscara);
- `app/layout.tsx` conecta manifesto e ícones 32 e Apple 180 para navegação/instalação;
- `app/api/install-icon/[size]/route.tsx` serve PNG 32/180/192/512. **Não inventa um símbolo**: utiliza prioritariamente `NEXT_PUBLIC_EMPROVEX_LOGO_URL` ou lê exclusivamente o campo `logo` de `settings/global` no banco institucional padrão, a mesma fonte de `usePlatformBranding`; a imagem é incorporada sem alterar seu desenho, centralizada em fundo institucional. Se logo/credenciais não estiverem disponíveis (ex.: localhost), utiliza temporariamente o fallback `EMP`, igual ao fallback visível no site.
- A rota não expõe credenciais ou documento Firestore, só devolve PNG; valida formatos e hosts externos, restringe tamanho e tempo das imagens e cacheia fonte na instância por 6h e PNG no CDN por 24h. Essa leitura extra é feita para construir ícones, **não a cada abertura do aplicativo**; imagens instaladas são controladas por cache do dispositivo/navegador.
- **Sem service worker, sem cache offline de NF, lotes ou dados de usuários**. Instalação depende de navegador compatível e contexto seguro (HTTPS/localhost), permanece online e usa a autenticação existente. Não acrescenta endpoints administrativos de escrita nem dependências npm.
- Teste `test:pwa-installability` entra no Fast CI; antes de publicar, realizar smoke no staging: `/manifest.webmanifest`, ícones PNG 192/512/180, confirmar que o ícone é a logo institucional real (não `EMP`), instalação Android/Edge e retorno do login Google. A validação visual e instalação humana são necessárias.
- Vercel Production sem mudanças durante esta implementação; versão final requer publicação manual via PowerShell depois de revisão e commit certificado.

**Limite de configuração:** a URL/origem real de `settings/global.logo` não está versionada no repositório. A certificação do código não comprova que a imagem externa está acessível no runtime; confirmar em staging antes de promover.


### R363.1 — Logo oficial versionada para instalacao (22/10/2026)

O fundador fez upload de `emprovex-logo.png` diretamente na raiz da `main` (commit `e8985741`). Para que Next.js/Vercel sirvam a imagem em URL pública, a mesma **blob original** foi movida para `public/emprovex-logo.png`, sem reprocessamento nem alteração gráfica.

A rota `/api/install-icon/[size]` agora usa exclusivamente essa imagem local versionada como origem do PNG instalado em 32, 180, 192 e 512 px, com versão maskable do ícone de 512 reservando margem de segurança. O `next.config.ts` emprega `outputFileTracingIncludes` apenas em `/api/install-icon/*` para empacotar `./public/emprovex-logo.png` na função Vercel, além de disponibilizá-lo diretamente em `/emprovex-logo.png`. Removida a antiga consulta de `settings/global.logo` e toda dependência de credencial Firebase da **rota de ícones**. O restante da identidade visual da aplicação permanece intacto, inclusive o `usePlatformBranding` do cabeçalho/login.

O endpoint devolve apenas imagens, indicador de imagem institucional/fallback, cache controlado; não há leitura ou gravação de dados do usuário. A publicação é independente da R362 estética. Novo teste valida presença, cabeçalho PNG, tamanho mínimo, tipos de ícone e inexistência de Firestore no caminho de instalação.

**Gate de homologação:** depois do prebuild/deploy manual, acessar `/emprovex-logo.png`, `/manifest.webmanifest`, `/api/install-icon/192` e `/api/install-icon/512?maskable=1`. Confirmar HTTP 200, PNG real, cabeçalho `X-Emprovex-Icon-Source: institutional`, ícone visual correto e login instalado no smartphone/desktop antes do promote. Não publicar automaticamente na Vercel.


## R16 INSTITUCIONAL — Publicação confirmada em 25/10/2026 (22h29 BRT)

**PUBLICADO EM PRODUÇÃO (promoção Vercel comprovada pelo Fundador).** A página institucional R16 passou a responder em `https://emprovex.com.br/`, mantendo `/login` para autenticação operacional. A publicação preservou as Firestore Rules e usou somente o CLI PowerShell proprietário, conforme `docs/EMPROVEX_RELEASE_POWERSHELL.md`, sem promoção automática pelo GitHub.

### Identidade imutável da publicação

- **Deployment promovido:** `dpl_35c7tma5Ft1aCkSojztJYNjVRkM2` — `https://controles-de-empenhos-aprov-kgygwbklw-aprov-hgesms-projects.vercel.app`.
- **Comprovação:** `vercel.cmd promote <URL> --yes --scope aprov-hgesms-projects` retornou `Success!` e o `vercel.cmd inspect https://emprovex.com.br --scope aprov-hgesms-projects` confirmou `target=production`, `status=Ready` e o **mesmo ID** do staged; não houve novo build na promoção.
- **Commit exato da fonte implantada:** `7744e064bf7ac77be18a821cab008a5e496d4039`, branch `fix/institucional-r16-root-beforefiles`, baseada no R16 original `54607877d992a977db659c60aa0c1b4246890f24`.
- **Importante — main versus produção:** o PR #386 R16 foi squash-merged em `main@54607877`; posteriormente o PR #385 de cobrança/InfinitePay foi integrado em `main@cb751fc1`; o hotfix R16 PR #387 passou CI 5/5 e foi squash-merged em `main@87cbc83076e449c28ff66f21d622600c2527274e`. **A versão implantada é deliberadamente a fonte isolada `7744e064`, SEM as alterações InfinitePay do PR #385. Não presumir que o HEAD da main corresponda aos artefatos da produção.** O merge na main não provocou deploy automático (`vercel.json` desativa a integração).
- **Deployment anterior do domínio:** `dpl_8auoDLRb6nxz9QZwZdWBXfiwJ5Qc` (referência para eventual rollback Vercel; dados e Rules são independentes).

### Incidente de roteamento encontrado e corrigido antes da promoção

O primeiro staged `dpl_GaTzU9GH9FoRyiF5iqaZDN8obH2X` apresentou `/` com HTTP 200, porém sem conteúdo institucional. A causa foi a precedência do `app/page.tsx` sobre um `rewrites()` padrão. PR #387 alterou `next.config.ts` para `beforeFiles: [{source:'/', destination:'/institucional'}]`, preservou a autenticação em `/login`, corrigiu a abertura do PWA (`start_url:'/login'`) e o botão de retorno da Administração HGeSM. O primeiro staged **NÃO foi promovido**.

### Evidências observadas e pendências reais

- Cinco workflows do hotfix `7744e064` PASS: Application CI (inclusive build de produção), Fast CI, Core Protection, Domain CI R2 e W4.
- No staged corrigido `dpl_35c7...`: `GET /api/health` retornou `status=ok`; `GET /` continha o elemento `hero-title`, formulário `Solicitar acesso para testar`, classe `brand-seal` e palavra `APROVISIONAMENTO`; `GET /login` retornou HTTP 200; `/manifest.webmanifest` retornou `start_url:'/login'`; acesso anônimo ao endpoint de administração do staged anterior retornou HTTP 401.
- **Por decisão explícita do Fundador, a promoção foi realizada sem os testes funcionais autenticados.** Permanecem **NÃO HOMOLOGADOS**: envio real do `POST /api/public/access-requests` ao Firestore; leitura/atualização pelo fundador na aba Interessados (`GET/PATCH /api/admin/access-requests`); login real do usuário na versão publicada; equivalência das operações do Warehouse e Central 3D após troca da home. Não registrar tais provas como PASS até executá-las.
- **Próxima ação:** testes de produção controlados com dados de teste, sem compartilhar credenciais, validando o formulário e a aba Interessados da Administração HGeSM e acesso operacional por `/login`. Registrar falhas antes de realizar novo deploy. Não reconstruir nem repetir promoção se o ID do domínio já estiver correto.


## EMPROVEX — ESCALONAMENTO COMERCIAL TRIMESTRAL PARA NOVOS CLIENTES (26/10/2026)

**DECISÃO COMERCIAL EXPRESSA DO FUNDADOR.** Todo **novo cliente/assinante** EMPROVEX elegível deve ingressar pela mensalidade promocional de **R$ 29,90** e seguir uma progressão de **R$ 10,00 por trimestre pago**, até o teto permanente de **R$ 69,90/mês**. Cada novo workspace inicia seu próprio relógio de preços: a adesão posterior de outra OM/setor não muda o trimestre dos clientes existentes. O plano é associado à assinatura do cliente/workspace e não equivale a uma tarifa cobrada individualmente de cada integrante do setor.

| Competência após o teste gratuito | Mensalidade do novo cliente | Regra |
|---|---:|---|
| 1º ao 3º mês pago | **R$ 29,90** | Valor de entrada |
| 4º ao 6º mês pago | **R$ 39,90** | Primeiro aumento trimestral |
| 7º ao 9º mês pago | **R$ 49,90** | Segundo aumento trimestral |
| 10º ao 12º mês pago | **R$ 59,90** | Terceiro aumento trimestral |
| Do 13º mês pago em diante | **R$ 69,90** | Teto da política; não aumentar automaticamente além dele |

### Cômputo, elegibilidade e aceitação obrigatória

1. **Teste de 30 dias:** gratuito e acompanhado; não conta como trimestre nem como competência paga. O **mês 1** é a primeira competência de faturamento **após** o teste, não a data de cadastro ou do formulário.
2. **Individualização do cliente:** `firstPaidReferenceMonth` é fixado no primeiro mês cobrável de cada nova assinatura elegível; o escalonamento decorre da diferença entre competências mensais, não de reajuste global sincronizado a todos os clientes.
3. **Aceitação prévia:** apresentar ao novo cliente os **cinco patamares, seus marcos temporais e o teto** antes da contratação; registrar o aceite inequívoco e a política atribuída. A vitrine pública pode destacar o valor inicial, mas **não deve levar o consumidor a interpretar R$ 29,90 como preço fixo para sempre**. Não ocultar a progressão durante a contratação.
4. **Legado protegido:** assinantes atuais com preço/contrato previamente pactuado não migram automaticamente; fundador e VIPs isentos conservam `exempt` e valor R$ 0 enquanto vigente a isenção. Não reescrever competências históricas já materializadas nem cobrar retrospectivamente.
5. **Segurança e governança:** movimentos de preço de um ciclo precisam de persistência **atômica no servidor**, idempotência e rastreabilidade; evitar reprecificação por concorrência ou mudança casual no navegador; nenhuma alteração de Firestore Rules, cobrança produtiva, status de workspace ou privilégios operacionais apenas por esta anotação.
6. **Não confundir usuários e assinaturas:** esta política é para **novo cliente contratante**, não para cada login adicional na equipe. O limite de usuários autorizados por workspace deve ser confirmado no contrato e no motor de identidades; este escalonamento não define por si só um número de assentos.

### Contrato técnico atual versus ativação real

O contrato de **cálculo e proposta offline** já está versionado em `lib/server/payments/emprovexRampPricing.mjs` como `emprovex_individual_ramp_v1`, com `RAMP_TIERS` de **2990 → 3990 → 4990 → 5990 → 6990 centavos** nos mesmos períodos acima. As funções `quoteIndividualRamp`, `proposeNewCustomerEnrollment` e `evaluateBillableCyclePrice` calculam e validam a política, mas **não integram automaticamente o fluxo produtivo de inscrição/faturamento**.

**Divergência conhecida e intencionalmente não encoberta:** `lib/billing.ts` mantém `EMPROVEX_FULL_PLAN_PRICE_CENTS=7000`, ou **R$ 70,00/mês**, para o domínio legado. Essa constante não autoriza cobrar R$ 70 dos novos clientes que contrataram a política progressiva, nem autoriza reprecificar clientes antigos. A integração futura deve atribuir a política no provisionamento elegível após aceite e materializar cada competência pelo valor individual correto, sem afetar o billing histórico. Não declarar a automação como já ativa em produção.

**Comunicação comercial:** na seção institucional, o valor inicial é **R$ 29,90/mês**, e o período de 30 dias é de teste acompanhado gratuito. Ao fornecer proposta/checkout/termos comerciais ao novo contratante, explicitar a progressão trimestral completa até **R$ 69,90**. Preservar contratos/isenções anteriores e assegurar que o valor final apresentado no checkout corresponda ao ciclo daquele workspace.

**Responsáveis e próximos passos:** Fundador define e aprova a política (decisão acima); executor de engenharia integra o motor de preço individual a onboarding e billing, sob testes e autorização próprios; o fundador aprova os termos e o rollout antes de qualquer cobrança. **Esta atualização é apenas documental: sem deploy, sem atualização do Firestore e sem modificação de faturamento vigente.**


---

## HANDOFF DEFINITIVO — PUBLICAÇÃO FINANCEIRA R1 + INCIDENTE ADMINISTRATIVO + ESCALONAMENTO 29,90→69,90 (25/10/2026 BRT / 26/10/2026 UTC)

> **Esta seção SUPERA o estado de produção descrito em "R16 INSTITUCIONAL — Publicação confirmada" acima.** Preservar os registros anteriores como histórico, mas NÃO confundir a publicação R16 isolada com a versão financeira que está servindo o domínio agora. Fonte: resultados literais dos comandos do proprietário no PowerShell, inspeção do GitHub e contratos do código. GOV-SIMP-01: máximo possível, segurança suficiente, sem burocracia repetitiva.

### 1. Onde estamos e quem fez o quê

- **Projeto:** EMPROVEX; GitHub \`aprov-hgesm/Controles-de-Empenhos---Aprov\`; plataforma \`https://emprovex.com.br/\`; projeto Vercel \`aprov-hgesms-projects/controles-de-empenhos-aprov\`, ID \`prj_DZ2y10DUaXrcHoRMaZ58FkTCvOHB\`.
- **Versão funcional da main publicada:** \`f0245298fc5cc90c6352d21ecfef70534df6318f\` — squash do PR #389 \`perf(billing): otimizar portal de assinaturas sem alterar indices ou regras\`. Integra a vitrine institucional R16, hotfix de rewrite/PWA/login, o portal InfinitePay R1 do PR #385 e otimizações seguras do PR #389. A consulta cronológica dependente de índice do PR #388 **NÃO** foi integrada; PR #388 continua em DRAFT.
- **Certificação pré-release:** 8/8 workflows PASS no HEAD da PR #389: Application CI, Core Protection, Fast CI, Domain CI R2, InfinitePay Portal Integration, InfinitePay Payment UI Preview, Billing Portal Efficiency Safe Release e W4 Evidence. Isso não substitui homologação autenticada em produção.
- **Responsável pelo código/CI e diagnóstico:** ChatGPT com conector GitHub. **Responsável pelo deployment:** o fundador em sessão PowerShell Windows autenticada na equipe Vercel correta. A integração Vercel do chat não possui acesso a essa equipe; **NÃO** repetir tentativas de Vercel por connector, não pedir chaves, não usar WSL.
- **Contrato do método:** \`docs/EMPROVEX_RELEASE_POWERSHELL.md\`; apenas release de código novo recebe um deploy remoto único \`vercel.cmd deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects\`, depois \`inspect\`, smoke, \`promote\` do mesmo ID. Git push **não** publica: \`vercel.json\` define \`git.deploymentEnabled=false\`. Não usar scripts antigos, \`--prebuilt\`, build duplo ou \`--no-color\` em \`vercel curl\`.

### 2. Publicação COMPLETA E CONFIRMADA no domínio — NÃO repetir build/deploy/promote

O fundador executou \`C:\Users\marco\Downloads\publicar_emprovex_main_f024529.ps1\` com \`-Action Stage\`, SHA imutável \`f0245298fc5cc90c6352d21ecfef70534df6318f\`, clone/export limpo em \`D:\EMPROVEX-RELEASE-f0245298fc5c\`, \`vercel link\` no projeto correto e listagem de NOMES de 3 variáveis Production (incluindo \`FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON\`); sem divulgar valores. Digitou \`AMBIENTE-OK\`.

- **Deployment real:** \`dpl_81EG7fDPfrajZ8HFZ1ZGaGPAGvM2\`.
- **URL imutável:** \`https://controles-de-empenhos-aprov-1wvvq76yz-aprov-hgesms-projects.vercel.app\`.
- **Inspect:** \`target production\`, \`status Ready\`, Node.js 24.x. Um único build remoto; duração build 1m21s, post-build 57s, 6 CPU-minutos cobrados (2 vCPU × 3 minutos).
- **Health PASS** via \`vercel.cmd curl /api/health --deployment <URL> --scope aprov-hgesms-projects\`: JSON \`{"status":"ok",...}\`.
- **Smoke público staged:** \`/\` conteúdo "Quanto custa" PASS; \`/login\` HTML PASS; \`/regularizacao\` texto "Minha assinatura" PASS; \`/privacy\` retornou ~36 KB mas procura literal com acentuação indicou "REVISAR" (pode ser codificação/HTML — **não** homologado, nem falha de renderização comprovada); \`/api/admin/access-requests\` sem autenticação devolveu \`{"ok":false,"error":"Acesso administrativo não autorizado."}\`, como esperado.
- **Promoção:** \`-Action Promote\` inspecionou o mesmo deployment, health novamente PASS e recebeu \`GO-PROMOVER\`; \`vercel promote\` respondeu HTTP 409 \`The provided deploymentId (dpl_81EG7fDPfrajZ8HFZ1ZGaGPAGvM2) is already the current production deployment.\` **Não** interpretar 409 como falha da aplicação ou motivo para novo deploy; o alias já apontava para essa versão.
- **PROVA FINAL:** o fundador executou \`vercel.cmd inspect https://emprovex.com.br --scope aprov-hgesms-projects\`, que retornou **exatamente** \`id dpl_81EG7fDPfrajZ8HFZ1ZGaGPAGvM2\`, \`target production\`, \`status Ready\`. Assim, **DOMÍNIO OFICIAL ESTÁ PUBLICADO** na versão \`f024529\`. Não repetir \`Stage\`, \`Verify\` nem \`Promote\` por causa do 409. Para versão futura, aplicar método com novo SHA apenas após correção/testes.
- **Ainda não homologado:** formulários públicos persistindo leads no Firestore, leitura/PATCH administrativa real, login fundador externo real, pagamentos reais, IAM de escrita, Warehouse com fluxos autenticados e Central 3D após a publicação. Não marcar como PASS o que não foi executado.

### 3. Incidente aberto APÓS a publicação — Firestore recusou operação administrativa de cobrança

**Mensagem exata na interface:** \`O Firestore recusou a operação de cobrança. Verifique as Rules publicadas e a sessão administrativa.\`

**Rastreamento confirmado no código da main, sem acesso às Rules efetivamente implantadas:**

1. \`hooks/usePlatformAdminBilling.ts\` apresenta essa mensagem quando um erro Firebase contém \`permission-denied\`. O hook abre \`onSnapshot\` para \`platformBillingConfig\`, \`billingAccounts\`, \`billingCycles\` e chama \`ensurePlatformBillingFoundation(workspaces, adminEmail)\` quando o diretório administrativo está pronto. Logo, o aviso pode ser originado na assinatura de leitura **ou** em uma transação de escrita; a tela pode mostrar erro genérico para ambos.
2. \`lib/platformBillingStore.ts\`, em \`ensurePlatformBillingFoundation\`, migra configuração/contas legadas para o contrato de R$70 e, quando o preço muda, inclui no mesmo \`runTransaction\` um registro auditável \`billing.price_migration\` em \`platformAuditEvents\` (além da alteração principal). O evento é gerado com \`appendPlatformAuditEvent\` de \`lib/auditTrail.ts\`. Se o evento for negado, a transação inteira falha — **não** remover auditoria, não escrever sem trilha.
3. \`firestore.rules\` VERSIONADO na \`main\` possui whitelist \`isValidAuditOperation\` (por volta da linha 1738) e \`validPlatformAuditEvent\` (por volta da linha 1900): ambas aceitam outras operações \`billing.*\`, **mas NÃO incluem \`billing.price_migration\`**. Essa inconsistência código/Rules é uma **causa plausível CONCRETA** para recusa na migração, sobretudo se existir preço legado a ajustar. Não foi provado que é o único motivo do erro em produção. Ajustar qualquer uma isoladamente é insuficiente: precisam concordar e passar testes de emulador.
4. \`firestore.rules\` autoriza \`platformBillingConfig\`, listagem/escrita de \`billingAccounts\`, \`billingCycles\` somente para \`isPlatformAdmin()\` (conta fundadora autenticada por Google, e-mail Firebase verificado, \`firebase.sign_in_provider = google.com\`; email fundador coincide com perfil oficial). Uma sessão por senha, anônima, com provedor errado, expirada ou sem e-mail validado falha corretamente. Não relaxar para \`allow write: if true\` nem dar acesso financeiro a usuários do setor.
5. O banco operacional é **Firestore nomeado** \`firebaseConfig.firestoreDatabaseId\` no projeto \`gen-lang-client-0982077967\`; \`lib/firebase.ts\` chama \`getFirestore(app, firebaseConfig.firestoreDatabaseId)\`. Não comparar nem publicar Rules na instância \`(default)\` ou \`emprovex-warehouse\` por engano. O nome do banco consta em \`firebase-applet-config.json\`; a implantação efetiva das Rules **NÃO** foi inspecionada nesta conversa.
6. As regras versionadas \`validPlatformBillingConfig\`/contas têm contrato **legado estrito R$70 (7000 centavos)**. O plano novo progressivo R$29,90–69,90 tem motor de cálculo offline e requer projeto de integração de Schema, Rules, persistência e Termos sem interferir nos VIPs. **Não** resolver a recusa da cobrança criando writes de 2990 centavos sob as Rules antigas nem mudando preços reais às cegas.
7. Há um risco adicional de dependência externa: \`FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON\` foi confirmado presente no projeto Vercel, **mas isso não demonstra permissões do usuário Firebase no cliente**, nem comprova que as Rules do database nomeado estejam atualizadas. O backend do portal usa outros contratos de autenticação; não misturar tokens administrativos OAuth do servidor com permissões do SDK cliente.

**Status preciso:** BUG/REGRESSÃO DE BILLING ADMIN **ABERTO**; causa raiz definitiva da operação específica ainda não provada. Nenhuma Rule foi implantada, nenhum dado de produção foi alterado e nenhum hotfix publicado durante a auditoria.

### 4. Plano executivo sem burocracia para o próximo chat — incidente de cobrança

**Quem executa:** próximo ChatGPT/Worker diagnóstico via GitHub; fundador só quando precisar verificar console Firebase ou realizar etapa de publicação explicitamente autorizada.

1. Identificar a ação real que disparou o erro (abrir aba Assinaturas, salvar configuração, alterar conta, confirmar competência) por inspeção de UI/logs **sem solicitar segredos**; distinguir \`onSnapshot\` de \`runTransaction\` e identificar a coleção/caminho recusado.
2. Comparar Rules REALMENTE PUBLICADAS do database **nomeado correto** no projeto Firebase com \`firestore.rules\` da main. Usar acesso de leitura autenticado do fundador no console Firebase/Cloud ou CLI apropriada, nunca inferir do arquivo Git. Não fazer deploy.
3. Reproduzir no Firestore Emulator, incluindo **sessão Google fundadora** simulada e cenário de preço legado que dispara \`billing.price_migration\` mais evento de auditoria. Adicionar guard de regressão: evento permitido pelo administrador válido, negado a cliente externo; persistência da conta e auditoria atômicas, VIP/isentos preservados.
4. Se confirmado, elaborar hotfix **mínimo** das duas whitelists para \`billing.price_migration\` e quaisquer outras diferenças comprovadas; manter validadores estritos, logs, idempotência e prevenção de escrita cruzada. Não criar permissões gerais nem desativar auditoria. Rodar suites Firestore e CI.
5. Somente com prova e aprovação do fundador: publicar **Rules** no database certo por procedimento separado; se houver alteração de código, fazer novo release por SHA e Vercel staged+promoção UMA vez. Não republicar \`f024529\` só por conta do 409 de promoção.
6. Se Rules já corretas, rever autenticação Google fundadora, \`email_verified\`, claims, campo \`ug\`/workspace e contratos rígidos de cobrança sem supor falha de Rules. Validar escrita administrativa com alteração controlada e reversível **somente quando autorizada**.

### 5. Plano comercial APROVADO — escalonamento mensal individual de R$29,90 até R$69,90

**A decisão comercial é DEFINITIVA como especificação; a ativação de cobrança REAL NÃO ESTÁ IMPLEMENTADA/COMPROVADA no ambiente de produção.** O cálculo já existe em \`lib/server/payments/emprovexRampPricing.mjs\`, export \`RAMP_POLICY_ID = emprovex_individual_ramp_v1\`; testes \`scripts/infinitepay-ramp-pricing.test.mjs\`. O código explicitamente se declara \`offline and not connected to production onboarding/Firestore\`.

| Mês da assinatura PAGA do cliente, após o trial | Valor mensal por workspace |
| --- | ---: |
| Meses 1–3 | **R$ 29,90** |
| Meses 4–6 | **R$ 39,90** |
| Meses 7–9 | **R$ 49,90** |
| Meses 10–12 | **R$ 59,90** |
| Mês 13 em diante | **R$ 69,90** |

**Regras comerciais obrigatórias:**
- Escalonamento **POR CLIENTE/WORKSPACE**, nunca por usuário individual, por usuário conectado ou calendário global. Um setor/workspace pode ter diversos integrantes; não afirmar um limite de usuários sem validar contrato. Cliente A e cliente B começam no mês 1 após **suas próprias** datas de início pago.
- Trial padrão **30 dias**; não contar dias nem meses do teste no índice de escalonamento. O primeiro mês de cobrança após o trial é mês 1 (R$29,90), desde que a elegibilidade/aceite seja comprovada.
- Clientes já existentes de R$70/mês, contas antigas e competências já materializadas **não são migrados ou reprecificados automaticamente**. Valores históricos são imutáveis, nenhum pagamento confirmado pode ser refeito silenciosamente.
- Workspaces VIP legados e fundador **R$0**, isentos permanentemente segundo seus contratos; não colocá-los no escalonamento nem interromper isenção. Dados operacionais e contas antigas preservados.
- Antes da contratação, **Termos/condições e aceite** devem apresentar todas as faixas de valor, calendário da progressão e unidade de cobrança de forma transparente; a comunicação inicial do site deve destacar **R$29,90 como PREÇO INICIAL**, **sem publicar tabela/simulador/caminho promocional do escalonamento na vitrine ou expor previsão futura em abas para usuários já existentes**. Ocultar marketing público NÃO significa esconder termos materiais do cliente na contratação. A política já foi solicitada nos Termos.
- O motor só pode inscrever novos clientes com \`pricingTermsAcceptedAt\` e sem ciclos antigos; campo \`firstPaidReferenceMonth\` determina os valores por competência, \`pricingPolicyId\` registra a regra, e o montante \`billingCycles.amountCents\` da competência é fonte congelada para checkout e conciliação.
- Integração futura deve verificar identidade/workspace, preço exato da competência, consentimento, status, referência, pagamentos verificados, idempotência e auditoria em transação no servidor. Não criar liquidação pelo simples retorno do checkout.
- **Situação R1 publicada:** \`lib/billing.ts\` usa \`EMPROVEX_FULL_PLAN_PRICE_CENTS=7000\` e \`firestore.rules\` exige 7000 em contas não isentas. \`app/api/billing/portal/route.ts\` é portal de **consulta**; piloto Pix R$1 requer \`INFINITEPAY_PILOT_ENABLED=1\` e allowlist por email/workspace, não concede assinatura nem marca competências pagas. Nenhuma ativação automática, suspensão por atraso ou liquidação automática de mensalidades está autorizada.

### 6. Handoff curto, o que fazer e o que NÃO fazer

**Onde estamos:** release publicado e confirmado \`dpl_81EG7fDPfrajZ8HFZ1ZGaGPAGvM2\` em \`emprovex.com.br\`; incidente administrativo de cobrança com \`permission-denied\` aberto; contrato de preços escalonados registrado e motor offline testado, mas não ativado. Rules efetivamente implantadas **não verificadas**.

**O que estamos fazendo:** diagnosticar causa do erro financeiro com foco na divergência \`billing.price_migration\`, validar Rules reais e sessão fundadora, criar correção estrita e teste antes de autorização para qualquer mudança produtiva. Preservar a exigência de privacidade, confiança, baixa leitura Firestore e GOV-SIMP-01.

**Quem está fazendo:** ChatGPT assume investigação, documentação, código, testes e PR; fundador verifica sessão/Console Firebase ou executa deploy manual quando necessário/autorizado.

**A seguir:** confirmar Rules efetivas do banco nomeado; reproduzir e consertar whitelists com testes, sem desativar proteções; separadamente planejar ativação comercial segura do escalonamento e Termos. **NÃO** recriar deployment, **NÃO** repetir \`promote\`, **NÃO** expor segredos, **NÃO** mudar base financeira sem comprovação e autorização. Para o próximo chat, ler primeiramente ESTA seção, \`docs/EMPROVEX_RELEASE_POWERSHELL.md\`, \`hooks/usePlatformAdminBilling.ts\`, \`lib/platformBillingStore.ts\`, \`lib/auditTrail.ts\`, \`firestore.rules\`, \`lib/server/payments/emprovexRampPricing.mjs\`, \`scripts/infinitepay-ramp-pricing.test.mjs\` e \`firebase-applet-config.json\`.

**Data do registro:** 25/10/2026 BRT; cronologia de comandos e commits pode aparecer como 26/10/2026 UTC.


## R16.1 — clareza comercial e retornos ao ambiente operacional (26/10/2026)

**Código aprovado e integrado em GitHub; NÃO CONFUNDIR COM PUBLICAÇÃO VERCEL.**
- PR #391: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/391, **squash merge** na main `5324b88d2c6e880b27553626c0e10502caf00da1`. O merge não altera automaticamente `emprovex.com.br` (`vercel.json` desativa deploy GitHub).
- Vitrine: bloco de **30 dias de teste acompanhado** e configuração assistida de depósitos em 3D; FAQ explicando cobrança por setor/workspace (não por usuário), teste sem pagamento/cartão, fim do teste e acessos autorizados; preços públicos progressivos **R$ 29,90 / 39,90 / 49,90 / 59,90 / 69,90**, por trimestres **pagos** sucessivos até o mês 13 (conforme política aprovada no memorial). Não afirmar quantidade ilimitada de assentos; confirmar no atendimento.
- Retornos operacionais: Administração HGeSM, Central de Depósitos, Operador Móvel e redirecionamentos de sessão apontam a `/login`, não à vitrine `/`; adicionada CTA de retorno no home do Operador Móvel. Para o Portal de Assinaturas mais recente, a correção está na main, mas ver isolamento da publicação abaixo.
- Testes de regressão em `scripts/pwa-installability.test.mjs`, `scripts/warehouse-walking-skeleton.test.mjs` e `scripts/verify-adm-deposito-phase-3.mjs`. 7 workflows completos PASS no HEAD de PR `0a8e9d4caf4243656e077239de149cc87985e4cd` (Application CI, Fast CI, Core Protection, Domain CI R2, W4, visual, InfinitePay); Browser E2E on-demand ainda em andamento no momento da integração, logo não afirmar 8/8 PASS.
- **Fonte isolada para a próxima publicação R16.1:** branch `release/r16-1-institucional-retornos-isolado`, SHA `7169a5b3bde0cddd8e5056c1c1a5dcd0de58d62c`, derivada diretamente do R16 implantado `7744e064bf7ac77be18a821cab008a5e496d4039` e com 11 arquivos pontuais de navegação, HTML/CSS e guards. **A release isolada exclui PR #385/InfinitePay**, mantendo a composição comprovadamente em produção até aqui. Os testes do PR de main cobrem os mesmos ajustes funcionais, mas essa snapshot isolada ainda precisa passar por build remoto staged.
- Publicação correta: Windows PowerShell no clone `D:\EMPROVEX-RELEASE-54607877d992\repositorio`, exportar o SHA imutável da branch de release via `git archive`, `vercel.cmd deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects`, `inspect` e smoke da rota `/` institucional + `/login`, promoção manual da **mesma** URL apenas quando o Fundador executar `vercel.cmd promote ...`. Não repetir builds.
- **Produção inalterada pela PR:** último deployment confirmado é `dpl_35c7tma5Ft1aCkSojztJYNjVRkM2` (R16), até que `inspect https://emprovex.com.br` prove novo ID.
- **Billing progressivo:** exibição e documentação corrigidas; cálculo offline está em `lib/server/payments/emprovexRampPricing.mjs` na main mas **integração do escalonamento à cobrança produtiva ainda não foi feita**. Não declarar o reajuste automático como ativo nem reprecificar usuários legados/VIP.
- Handoff: onde estamos = código GitHub pronto, release isolada congelada, não publicada; o que estamos fazendo = preparar único staged remoto; quem = Fundador executa PowerShell no time Vercel proprietário; próximo passo = executar script R16.1 e capturar URL/ID, então verificar e promover o mesmo deployment.


### R16.1 — Promocao real confirmada em 26/10/2026 (BRT)

**PRODUÇÃO = PASS (deploy/promoção, não homologação funcional).** O Fundador executou o método homologado do memorial, utilizando Windows PowerShell e Vercel CLI 64.0.2 no time externo `aprov-hgesms-projects`, projeto `controles-de-empenhos-aprov`. Um único build remoto a partir da fonte isolada R16.1 `7169a5b3bde0cddd8e5056c1c1a5dcd0de58d62c` foi concluído `Ready`, sem incluir o PR #385/InfinitePay; em seguida, o mesmo deployment foi promovido **sem rebuild**.

- **Domínio oficial:** `https://emprovex.com.br`.
- **Deployment imutável promovido:** `dpl_5dKvjdh1QkhxjEszX53U5QBx8AHw`; URL `https://controles-de-empenhos-aprov-da1060ujo-aprov-hgesms-projects.vercel.app`.
- **Prova de publicação:** CLI `vercel.cmd promote <URL> --yes --scope aprov-hgesms-projects` retornou `Success!`; `vercel.cmd inspect https://emprovex.com.br --scope aprov-hgesms-projects` confirmou exatamente `id=dpl_5dKvjdh1QkhxjEszX53U5QBx8AHw`, `target=production`, `status=Ready`.
- **Snapshot anterior:** R16 `dpl_35c7tma5Ft1aCkSojztJYNjVRkM2`, referência de eventual rollback caso necessário.
- **Conteúdo implantado:** seção de investimento com 30 dias de teste acompanhado, apoio 3D, FAQ (workspace/setor, gratuidade, cartão, fim do teste, integrantes) e progressão transparente R$ 29,90 / 39,90 / 49,90 / 59,90 / 69,90 por trimestres pagos; retornos de administração, Central de Depósitos e Operador Móvel para `/login` (não mais `/` institucional).
- **Certificação do PR #391:** Application CI e seis outros workflows PASS no HEAD principal `0a8e9d4caf4243656e077239de149cc87985e4cd`, squash merge na main `5324b88d2c6e880b27553626c0e10502caf00da1`. Publicação utilizou a variante isolada `7169a5b3...`; não confundir `main` atual com fonte implantada.
- **Não alegar testes funcionais autenticados pós-publicação:** Fundador optou por publicar primeiro. Validar depois em produção login do fundador/setor, retornos da Administração/Central/Operador Móvel, formulário de interesse `/api/public/access-requests`, aba Interessados e apresentação mobile do bloco comercial. Não enviar solicitações fictícias sem consentimento e governança de dados.
- **Billing:** a tabela comercial foi divulgada e o algoritmo offline existe; ativação automática do escalonamento por cliente no faturamento produtivo ainda não foi certificada/implantada. Preservar contratos antigos e VIPs, não alegar que o escalonamento de cobrança está operante.
- **Regras:** não executar outro build/deploy/promote por causa deste registro; `409` ou identificação idêntica no inspect significa publicação já atual; não confundir deploy imutável com alias.


### R16.1-HOTFIX — progressao comercial restrita ao uso interno (26/10/2026)

**CORREÇÃO DE CONFIDENCIALIDADE COMERCIAL DETERMINADA PELO FUNDADOR.** A política de escalonamento progressivo aprovada é **informação interna**, não devendo figurar na página institucional pública, nos scripts de marketing, tabelas, FAQs ou bundles HTML/CSS destinados a visitantes anônimos. A vitrine permanece com o preço inicial, teste gratuito e acompanhamento, sem publicar valores futuros, calendário ou explicação da progressão. Tratar essa decisão como fonte de verdade para futuras alterações no marketing. As condições contratuais efetivas precisam ser informadas de maneira adequada ao cliente antes de seu aceite, sem expor o cronograma na landing.

- Código de correção: PR #393, https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/393, squash na main `7345aad4d1d1d8f8b1ab9d45af76c4d2ee0fa53b`.
- Release de produção **isolada** do R16.1 anteriormente implantado: `release/r16-1-ocultar-escalonamento-publico`, SHA `107b493cca78e1c5fd8c50f81ac4c9ecd97214c0`, 3 arquivos alterados: `public/institucional/content.html`, `public/institucional/site.css`, `scripts/pwa-installability.test.mjs`.
- Preserva por inteiro a política registrada neste memorial, motor offline, clientes legados, privilégios VIP, a rota de login e as funcionalidades de estoque. **Não reverter os retornos operacionais introduzidos no R16.1.**
- **Certificação confirmada:** Application CI completo (incluindo build de produção e seis gates), Fast CI, Core Protection e W4 PASS na branch `9da7535ef9d526c24d76ccb581dedc6f3bbb0b84`. O primeiro Application CI falhou por linha vazia ao final do CSS; corrigido. Domain CI R2 teve seis domínios PASS e um FAIL no **emulador W1 Warehouse v3** (`scripts/warehouse-w1-v3-emulator.ts:202`, contagem concorrente esperada 1, obtida 0), sem relação causal conhecida com os três arquivos estáticos alterados neste hotfix. O teste W4 v3 do mesmo workflow PASS. Não tratar Domain CI como aprovado ou alterar o Warehouse para este hotfix sem investigação independente.
- **Produção permanece no deployment R16.1 `dpl_5dKvjdh1QkhxjEszX53U5QBx8AHw` até inspeção Vercel provar outra promoção.** Não declarar hotfix publicado antecipadamente.
- Publicação externa: script PowerShell `EMPROVEX-R16-1-OCULTAR-PRECOS.ps1` em ZIP entregue ao Fundador. Recupera SHA imutável, exporta fonte limpa, verifica identidade Vercel do deployment anterior, faz um build staged `--prod --skip-domain --archive=tgz`, confere no HTML que informações futuras não estão expostas e promove o mesmo deployment automaticamente se os gates simples PASS. Capturar novo ID `dpl_...` e atualizar este registro após o êxito. Não repetir o script se o stage ou arquivo já existir.


### Incidente PowerShell/Vercel — false negative no preflight do hotfix de preços (26/10/2026)

- Na retomada do hotfix R16.1 que remove o escalonamento da vitrine, o primeiro script `EMPROVEX-R16-1-OCULTAR-PRECOS.ps1` parou antes do build com a mensagem errônea de que o domínio tinha mudado. A inspeção exibiu o ID esperado `dpl_5dKvjdh1QkhxjEszX53U5QBx8AHw`, portanto **não havia divergência real do deployment**.
- **Causa:** Vercel CLI 64 imprime a tabela do `inspect` em stderr; `$out = (& vercel.cmd inspect <URL> --scope <scope>) -join "`n"` capturava stdout apenas, enquanto a tabela aparecia no console. `[regex]::Match($out, '\bid\s+(dpl_[A-Za-z0-9]+)')` falhava falsamente. No PowerShell 5.1, preferir `$out = (& cmd.exe /d /c "vercel.cmd inspect <URL> --scope <scope> 2>&1") -join "`n"`, checar `$LASTEXITCODE`, extrair o ID e comparar. Não relaxar conferência de identidade; corrigir captura.
- No primeiro erro, já haviam sido gerados e validados o ZIP da fonte e a pasta `D:\EMPROVEX-RELEASE-54607877d992\deploy-r16-1-hide-ramp-107b493cca78`, com `.vercel/project.json`. **Não executar de novo o script original:** a guarda de reexecução intencionalmente impede quando há stage. Prosseguir por script de retomada `EMPROVEX-R16-1-CONTINUAR-PUBLICACAO.ps1`, que reaproveita esses diretórios, corrige captura do `inspect`, confirma ID anterior, faz um único build remoto staged, lê URL/ID, verifica se os preços futuros foram omitidos, promove a mesma URL e comprova o ID final.
- O primeiro erro ocorreu **antes de qualquer build ou promote**, logo o domínio continua na versão anterior até nova comprovação via Vercel. Na retomada, se `r16-1-hide-ramp-deploy.log` já existir, **parar e inspecionar** em vez de repetir build.


### R16.1-HOTFIX — remoção dos preços futuros promovida ao domínio em 26/10/2026

**PRODUÇÃO CONFIRMADA PELO FUNDADOR: PASS.** A política comercial progressiva permanece interna (memorial e motor de cálculo), mas o site público foi corrigido para **não apresentar o calendário trimestral nem preços futuros**. A vitrine mantém apenas o anúncio inicial de R$ 29,90/mês, trial e acompanhamento. O hotfix partiu do release R16.1 anterior, sem alterar faturamento ou Firestore.

- **Deployment promovido:** `dpl_3f2FjVLwix9XAeoVGpvrx6sTZXhv`, URL imutável `https://controles-de-empenhos-aprov-9e7njv1hr-aprov-hgesms-projects.vercel.app`.
- **Fonte exata:** `107b493cca78e1c5fd8c50f81ac4c9ecd97214c0`, branch `release/r16-1-ocultar-escalonamento-publico`. PR #393 integrado à `main` no squash `7345aad4d1d1d8f8b1ab9d45af76c4d2ee0fa53b`. O release isolado modifica somente HTML, CSS e teste da exposição de preços.
- **Evidência antes de promover:** `vercel.cmd curl / --deployment <URL> --scope aprov-hgesms-projects`, sucesso do `hero-title` e busca negativa por `value-ramp|R\$\s*(39|49|59|69),90`. Os dois controles passaram no PowerShell do Fundador.
- **Evidência de promoção:** `vercel.cmd promote <URL> --yes --scope aprov-hgesms-projects` retornou `Success!` com ID `dpl_3f2FjVLwix9XAeoVGpvrx6sTZXhv`; `vercel.cmd inspect https://emprovex.com.br --scope aprov-hgesms-projects` confirmou o **mesmo ID**, `target=production`, `status=Ready`.
- **Deployment anterior:** `dpl_5dKvjdh1QkhxjEszX53U5QBx8AHw` (R16.1 com informação comercial indevidamente exposta; não restaurar por engano).
- **Incidente de publicação resolvido:** o script original interpretava erroneamente o resultado do `inspect` porque a CLI imprimia a tabela no stderr; na retomada, um segundo script falhou ao declarar `$home` (variável reservada/readonly no PowerShell). A falha ocorreu depois do build staged, mas **antes da promoção**. O Fundador concluiu o processo com PowerShell manual, verificando o HTML e promovendo o **mesmo deployment**, sem rebuild adicional.
- **Regra daqui em diante:** escalonamento e preços futuros não devem ser exibidos na landing ou em conteúdo público. Em momento de contratação, comunicar os termos comerciais legalmente necessários e obter aceite de forma privada. O hotfix não certifica ativação automática da cobrança progressiva.
- **Não repetir publicação:** domínio já aponta para o deployment correto. Testes funcionais autenticados e recebimento de interessados continuam independentes e não foram comprovados neste hotfix.

---

## COMERCIAL R4 — LIBERAÇÃO E DIRETRIZ DE PROPRIEDADE/PORTABILIDADE DOS DADOS (27/10/2026, BRT)

### 1. Decisão executiva, estado de produção e alcance

**DECISÃO DO FUNDADOR: EMPROVEX LIBERADO PARA OPERAÇÃO COMERCIAL.** Comercialização das funcionalidades da plataforma para Setores de Aprovisionamento/Organizações Militares, com cobrança por setor/workspace e fluxo de trial, regularização e pagamento real. Não acrescentar gates burocráticos sem risco material; princípio **GOV-SIMP-01**. A aceitação de risco comercial moderado inclui atendimento e eventual restituição de Pix ou concessão administrativa de período gratuito em caso de falha concreta — **isso é uma contingência aprovada, não uma restituição executada nem autorização para enfraquecer o isolamento de dados**.

**Estado comprovado em 27/10/2026 pelo fundador (PowerShell + captura do Admin):**

| Item | Estado confirmado |
| --- | --- |
| Domínio | `https://emprovex.com.br`, produção |
| Equipe / projeto Vercel | `aprov-hgesms-projects` / `controles-de-empenhos-aprov` |
| PR de comercialização geral | [#401](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/401), squash na `main` `a34bec2d86af23b45b8f31eff40ebc449ec8925d` |
| Deployment promovido e identificado pelo `inspect` | `dpl_7f1s17cuDKevJYA5DLHd2EhqW7G8` |
| URL individual imutável | `https://controles-de-empenhos-aprov-fa2kg1jn0-aprov-hgesms-projects.vercel.app` |
| Status Vercel | `production`, `Ready`; criação exibida como 27/10/2026 20:24:16 BRT |
| Estado de cobrança no Admin → Assinaturas | **`ENFORCE`**; texto **`EXIGINDO PAGAMENTO`**; **`Entitlements preparados`** |
| Números exibidos no painel no instante da evidência | 6 setores ativos, 2 em dia, 0 em trial, 0 em atenção financeira; são **snapshot visual**, não contagem contratual permanente |
| Conexão Google Cloud | Painel exibiu `Conectado` |
| Firestore Rules | **Nenhuma publicação/alteração de Rules nesta operação comercial R4** |

**Fórmula de habilitação geral no código:** `EMPROVEX_BILLING_ENFORCEMENT_ENABLED=1` + `INFINITEPAY_BILLING_ENABLED=1` + `platformBillingConfig/main.billingMode=enforce` + `requirePayment=true`. A configuração `INFINITEPAY_BILLING_SCOPE=all` permite checkout dos workspaces elegíveis. `EMPROVEX_BILLING_RULES_CERTIFIED` **NÃO é exigido** no motor de cobrança do servidor; sua utilização posterior é restrita a sincronizações opcionais com Warehouse quando Rules financeiras separadas estiverem efetivamente certificadas. Não configurar esse indicador como `1` sem certificação real. Preservar segredos da InfinitePay e do Google Cloud; nunca registrá-los no memorial.

**Observação de governança:** a captura do painel comprova o `ENFORCE` e a configuração preparada; não constitui teste adversarial de todos os caminhos de leitura e escrita. Não afirmar homologação de segurança de SDK/Rules em função dessa captura. A apresentação de valores/trial depende da política comercial individual aceita e dos registros do workspace; não reprecificar contratos existentes.

### 2. Cronologia factual — piloto #400, pagamentos reais e corte #401

**Piloto funcional isolado — PR [#400](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/400), squash `3ba0c4ecaf95b91153f7d587548db8513d1a30e5`:**

- Inclusão de `lib/server/payments/billingAccessQaPilot.mjs`, gate funcional de um único workspace `aprovisionamento-teste-3` para `readSectorBillingAccess`, somente quando `EMPROVEX_BILLING_QA_WORKSPACE_ID`, `INFINITEPAY_BILLING_PILOT_WORKSPACE_ID`, `INFINITEPAY_BILLING_SCOPE=pilot` e `INFINITEPAY_BILLING_ENABLED=1` coincidiam.
- A política global permanecia `observe` / `requirePayment=false`, sem bloquear VIPs e outros setores. Testes automatizados exercitaram motor TypeScript real (inadimplente negado, pago liberado, VIP inalterado) e Fast CI/segurança na branch.
- Primeiro deployment imutável `dpl_3EfUFmvRJZT5QUio3QdvpcrPXyEf` / `75wprnk48` foi promovido **antes** de assegurar as variáveis QA no novo ambiente. O fundador entrou no Teste 3 sem bloqueio; não era prova de falha do motor.
- O fundador definiu corretamente as quatro variáveis da Vercel Production, todas confirmadas pela CLI como `Overrode`; valores armazenados como `Secret`, sem exposição posterior do conteúdo. Feito novo deploy `acn1rdkh5` (`Ready`). Houve **segunda falha de verificação** porque `emprovex.com.br` ainda apontava para `75wprnk48`; `vercel.cmd inspect` identificou a origem, e a promoção da URL nova corrigiu o problema. **Regra permanente:** sempre confirmar com `inspect https://emprovex.com.br` o deployment ID efetivamente ativo antes de diagnosticar lógica/variáveis ou repetir deploy.
- **Teste manual real reportado pelo fundador no Teste 3:** login sem pagamento → redirecionamento a Minha Assinatura/regularização; tentativa de retorno → aviso para pagar ou solicitar 48 horas; Pix real efetuado → plataforma liberada automaticamente; Central de Depósitos testada antes e depois, com bloqueio no estado inadimplente e acesso funcional depois do pagamento nos dois modos de uso. **PASS funcional por observação humana**. A opção de solicitar 48h foi exibida; **não confundir exibição do botão com concessão das 48h efetivamente ensaiada**.
- O Teste 2 já tinha pagamento real InfinitePay validado anteriormente; não duplicar Pix nem tomar os dois testes como prova de inexistência de bypass no Firestore.

**Corte comercial geral — PR [#401](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/401), squash `a34bec2d86af23b45b8f31eff40ebc449ec8925d`:**

- `lib/server/platformBillingAdminStore.ts`: decisão financeira global no servidor sem depender de `EMPROVEX_BILLING_RULES_CERTIFIED` para login, painel/configuração administrativa e concessão de 48h; sincronização de `warehouseAccess` com billing desligada por padrão quando essa certificação separada não existe, evitando round-trips/escritas desnecessárias.
- `components/admin/AdminBillingPanel.tsx`: clareza sobre controle financeiro server-side e preservação das contas isentas e legadas.
- `scripts/billing-server-migration.test.mjs`: cenário de cobrança global com flag de Rules `0`; inadimplente negado, pagante liberado e preservação de VIP/contrato antigo; Billing Server Migration Assurance **PASS** incluindo typecheck; Core Protection, Fast CI e W4 **PASS** no HEAD da branch. Não alegar que Application CI integral ou Domain CI R2 ficaram todos aprovados sem evidência adicional específica.
- Publicação pelo fundador: fonte isolada exportada do SHA imutável via `git archive` em `D:\EMPROVEX-COMERCIAL-R4\deploy`, `vercel.cmd link` no time correto, atualização de Production `INFINITEPAY_BILLING_SCOPE=all` e `EMPROVEX_BILLING_ENFORCEMENT_ENABLED=1`, `vercel.cmd deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects`; deployment `fa2kg1jn0` `Ready`. Em seguida, `vercel.cmd promote` e `vercel.cmd inspect https://emprovex.com.br` confirmaram **`dpl_7f1s17cuDKevJYA5DLHd2EhqW7G8` no domínio**. Finalmente, fundador acionou **Ativar controle financeiro** e forneceu captura de `ENFORCE` / `EXIGINDO PAGAMENTO`.
- **NÃO** recriar clone, build, deploy nem promoção para registrar a conclusão. O site já estava no release correto; mudanças só documentais não geram deploy (`vercel.json`, `git.deploymentEnabled=false`).

### 3. Contrato financeiro operacional, compatibilidade e rollback

1. **Unidade contratada:** workspace/Setor de Aprovisionamento, não cobrança separada por sessão/operador. Os usuários autorizados compartilham o estado de assinatura do setor.
2. **Novos clientes elegíveis:** trial padrão de **30 dias** quando concedido; após o período, pagamento da competência individual, confirmação por servidor/InfinitePay e liberação. Nunca marcar `paid` só pelo retorno da URL de checkout; preservar conciliação/idempotência.
3. **Preço inicial:** **R$ 29,90/mês** após trial, com progressão individual aprovada por meses **pagos**: meses 1–3 R$29,90; 4–6 R$39,90; 7–9 R$49,90; 10–12 R$59,90; 13+ R$69,90. Conservar `firstPaidReferenceMonth`, `pricingTermsAcceptedAt` e valor congelado do ciclo como fonte de verdade. A vitrine pública divulga o valor inicial; **termos privados antes do aceite** apresentam todas as condições materiais. Não afirmar que meses futuros foram pagos/testados em produção.
4. **VIPs e clientes antigos:** fundador e VIPs isentos (3 contas no teste histórico) preservados; contratos antigos não migram silenciosamente ao escalonamento. Não retirar histórico, acesso ou dados por alteração automática de preços.
5. **Carência de 48 horas:** fluxo administrável pelo servidor, próprio da política de assinatura e sem marcar Pix como pago; o botão foi verificado visualmente, não o exercício integral de concessão/expiração no teste descrito.
6. **Operação/rollback:** para suspender exigência financeira imediatamente, Administração → Assinaturas → **Voltar para observação** (`billingMode=observe`, `requirePayment=false`), sem novo deploy ou mudança das Rules. Rollback comercial é diferente de rollback de código. Em eventual problema de cobrança, atendimento poderá avaliar reembolso ou concessão administrativa gratuita sem ocultar histórico financeiro/auditoria.

### 4. DIRETRIZ PERMANENTE — o cliente paga pelos recursos, não pela propriedade dos seus dados

**Diretriz expressamente aprovada pelo fundador (27/10/2026):**

> **“A assinatura remunera o acesso às funcionalidades e aos serviços do EMPROVEX, não a propriedade dos dados cadastrados pelo cliente. A inadimplência pode suspender a operação da plataforma, mas não deve impedir a recuperação legítima das informações do próprio setor por seus responsáveis autorizados.”**

**Fundamentos e interpretação obrigatória para próximos chats, Workers, PRs e auditorias:**

- O valor vendido é a **plataforma de gestão do Setor de Aprovisionamento** — interface, organização de empenhos, NFs e cronogramas, Central de Depósitos 2D/3D, operações móveis, automações, geração de documentos, relatórios, pesquisa e suporte. A mera leitura de documentos brutos no Firestore não concede automaticamente essas funcionalidades, embora consultas/escritas diretas possam permitir que um usuário técnico reproduza parte de rotinas por meios próprios; não prometer inviolabilidade comercial inexistente.
- Os dados alimentados pelo cliente **não são patrimônio comercial apropriado pelo EMPROVEX**. O titular/gestor legitimado deve poder obter seus registros sem nova cobrança, inclusive após encerramento/atraso, por exportação, backup autorizado ou atendimento; o fundador declara que os forneceria gratuitamente. Existem backups/integrações com o **Google Drive do usuário**, sob o controle e permissões desse usuário; **não presumir que todos os documentos e versões estejam integralmente cobertos por esses backups**.
- **Contexto institucional:** nos Setores de Aprovisionamento das OMs, o responsável legal pelos registros e pelas autorizações pode ser a **Organização Militar/Administração Pública**, e não necessariamente a pessoa física que efetuou o cadastro. Respeitar sigilo, guarda documental, legislação aplicável, dados pessoais e cadeia administrativa. “Seus próprios dados” significa dados do setor **a que a identidade tem legítima autorização**, jamais de outra OM.
- **Decisão de escopo GOV-SIMP-01:** **NÃO implantar novos bloqueios financeiros nas Firestore Rules apenas para impedir que inadimplentes leiam/exportem seus próprios registros**, porque isso não agrega valor comercial proporcional e contraria a política de recuperação gratuita. **NÃO realizar migração em massa de SDK para APIs motivada somente por esse cenário de inadimplência.** A ausência de tal bloqueio **não equivale a falha comercial prioritária** segundo a política de produto vigente. Uma eventual funcionalidade “Exportar meus dados” acessível mesmo com assinatura vencida é melhoria **opcional**, não condição de lançamento; não afirmar que já existe.
- **Limites inegociáveis:** manter autenticação, autorização por workspace e UG, isolamento entre clientes, proteção contra cross-tenant, restrição a administradores, verificação de integridade de operações críticas (incluindo estoque e movimentações), antifraude, confidencialidade, auditoria e defesa contra abuso/custos. A diretriz de portabilidade **não autoriza** escrita arbitrária, alteração de documentos oficiais, acesso entre workspaces, uso de credenciais alheias, desativar Rules protetivas ou abrir acesso público.
- **Diferença técnica:** `readSectorBillingAccess` no servidor governa o acesso às telas e APIs que o invocam; o navegador ainda pode ter leituras diretas por Firebase SDK (`onSnapshot` etc.), cuja permissão é determinada pelas Rules efetivamente publicadas. O repositório contém checks financeiros em `firestore.rules` e `firestore.warehouse.rules`, mas **não assumir que as Rules publicadas correspondem aos arquivos do repositório**. Não foi comprovado bypass efetivo da produção nem acesso entre workspaces, e **o teste comercial por Pix não certifica esse plano de dados**.
- **Política de segurança continua independente de faturamento:** se for encontrada falha real de isolamento entre clientes, escrita indevida, vazamento, acesso sem autenticação ou abuso de operações, **corrigir prontamente no servidor e/ou nas Rules**, conforme o caminho de acesso. A decisão de não endurecer Rules **somente para cobrança** não proíbe atualizações de segurança necessárias.
- Se uma regra financeira já publicada bloquear exportação legítima, **não desabilitar proteções cegamente**; preferir um caminho autenticado e auditável de recuperação/entrega de dados do próprio setor, sem acesso operacional às funcionalidades pagas. Negar pagamento ≠ apagar dados ou bloquear a portabilidade.

### 5. Referências técnicas e handoff sem burocracia

**Fontes de código principais:** `app/login/page.tsx`, `lib/sectorBillingGate.ts`, `lib/server/platformBillingAdminStore.ts`, `lib/server/payments/billingAccessQaPilot.mjs`, `lib/server/warehouseAccess.ts`, `lib/server/warehouseBillingMirror.ts`, `hooks/useOperationalRealtimeCollections.ts`, `firestore.rules`, `firestore.warehouse.rules`, `scripts/billing-server-migration.test.mjs`, `components/admin/AdminBillingPanel.tsx`, `docs/EMPROVEX_RELEASE_POWERSHELL.md`.

**Estado:** R4 comercial publicado, promovido e cobrança ativada no painel; testes reais de login, regularização, Pix e Central de Depósitos aprovados no piloto; código `main` inclui #400/#401. Operação comercial autorizada. **NÃO há tarefa pendente obrigatória de Rules ou migração de SDK apenas por inadimplência.**

**Próximos trabalhos, somente quando fizerem diferença prática:** acompanhar clientes reais, atendimento, conciliação Pix e concessão/expiração de 48h; investigar erro concreto antes de novo deploy; criar exportação self-service dos dados próprios quando desejável; manter segurança de isolamento/integridade. Não gerar trabalho recorrente ou auditoria abstrata sem nova necessidade do fundador.

**Quem faz o quê:** ChatGPT/GitHub registra decisões, corrige código e executa CI quando solicitado; fundador executa publicações na equipe Vercel proprietária via PowerShell e atua no Admin. **Não solicitar chaves secretas, não publicar Rules por inércia e não repetir deploy/promote da R4.**



## BIL-ANV-R2 — Aniversário mensal confirmado (29/10/2026)

**Decisão aprovada:** o EMPROVEX usa o modelo de aniversário mensal para novas contratações. A primeira mensalidade começa com a confirmação integral do pagamento (pagamento único ou última cota compartilhada), não com a data provisória do cadastro ou do término do teste. As renovações ocorrem na mesma data de aniversário, com tolerância de **10 dias corridos**, exclusivamente quando a mensalidade anterior foi quitada. O pagamento de renovação realizado durante a tolerância **não desloca** o aniversário. A mensalidade equivale a um mês de calendário, não a 30 dias fixos. Datas visíveis em Brasília.

**Contratos históricos:** datas já registradas, isenções, VIPs e fundador são preservados, sem migração retroativa. A política nova é identificada por `billingPeriodPolicy='payment_anniversary_v2'`. Conciliação idempotente na InfinitePay; faturas e rateios pendentes são fixados na competência original mesmo se cruzarem meses. Nada muda na conta de login ou permissões do workspace.

**Fonte de verdade:** `lib/billing.ts`, `lib/billingAccess.ts`, `lib/server/platformBillingAdminStore.ts`, `lib/server/platformBillingSharedStore.ts`; interface `components/billing/BillingAnniversaryCard.tsx`; Termos §4.2; testes `scripts/billing-payment-anniversary.test.mjs`. Memorial operacional detalhado em `docs/commerce/billing-shared-monthly-r1.md`.

**Implementação em revisão:** branch `feat/billing-shared-monthly-r1-20261029`, PR #415. **Sem merge/deploy/ativação de cobrança compartilhada automática** até homologação financeira completa e conclusão do CI. `EMPROVEX_SHARED_BILLING_ENABLED` permanece desativado por padrão.
