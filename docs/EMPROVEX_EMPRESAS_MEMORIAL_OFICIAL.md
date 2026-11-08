# EMPROVEX EMPRESAS — MEMORIAL OFICIAL

> **PRECEDÊNCIA DE INFRAESTRUTURA (31/10/2026):** os workspaces empresariais continuam sujeitos ao seu próprio ciclo de desenvolvimento/integração; **não** confundir migração da hospedagem web com publicação das funcionalidades empresariais. O domínio operacional principal está em Google Cloud Run por Firebase Hosting, e o procedimento canônico de publicação é [EMPROVEX_RELEASE_CLOUD_RUN.md](./EMPROVEX_RELEASE_CLOUD_RUN.md). Registros Vercel abaixo são históricos.

## CHECKPOINT OFICIAL — W10 ETAPA V: WORKER ÚNICO DE ESTABILIZAÇÃO PRÉ-HOMOLOGAÇÃO (08/11/2026)

**Situação documental:** pronto para ativação, **NÃO executado** por esta atualização do Memorial. Missão única de correção dos achados P0/P1/P2 da auditoria pré-homologação do W10-IV. Deve partir do HEAD real da **PR Draft #530** (referência `f84db403a295a4d590dfd246fcc8ba52d06f2c61`) e gerar **uma PR Draft nova de código**, sem merge/deploy/emissão fiscal real. Não executar em main, não alterar áreas militares, não duplicar os W0–W15. Nenhum teste novo foi executado por este registro documental.

**Documento independente:** [W10_ETAPA_V_PROMPT_UNICO_ESTABILIZACAO_PRE_HOMOLOGACAO_2026-11-08.md](./empresas/W10_ETAPA_V_PROMPT_UNICO_ESTABILIZACAO_PRE_HOMOLOGACAO_2026-11-08.md).

### PROMPT COMPLETO W10-V — COPIAR E ATIVAR

~~~text
/goal Você é o WORKER ÚNICO W10 — ETAPA V: ESTABILIZAÇÃO PRÉ-HOMOLOGAÇÃO do EMPROVEX Empresas.

MISSÃO
Execute efetivamente UMA RODADA CONSOLIDADA de correções de segurança, integridade operacional, bugs de integração, usabilidade e refinamento visual do EMPROVEX Empresas, a partir da versão W10 Etapa IV. Trabalhe em branch exclusiva, faça alterações reais com testes reais, abra UMA PR Draft e entregue handoff com evidências e GO/NO-GO. NÃO basta apresentar diagnóstico ou plano. Não faça merge, deploy, habilitação de piloto, emissão fiscal real, alterações produtivas nem modificações militares. Minimizar burocracia; priorizar correções comprováveis e reversíveis.

REPOSITÓRIO E BASE OBRIGATÓRIA
- Repositório: aprov-hgesm/Controles-de-Empenhos---Aprov.
- Fonte de verdade de integração: PR #530, branch integration/emprovex-empresas-w10-stage4-w15-fiscal-20261106, HEAD de referência f84db403a295a4d590dfd246fcc8ba52d06f2c61.
- Bases/handoffs ancestrais: W10 Etapa III #527 (d9aa77a5e0c27b77582ecf6742a3358a509e8abb); W10 Etapa II #525 (49c8670a66ad858724454eff0683696dcb7efcd3); W15 #529 (65faaefacfb182e36111197fa578a6418caff068); W12 #521, W13 #522, W14 #526, W9 #523, W11 #524 e W0–W8.
- Leia o Memorial Oficial na PR #510, o handoff da #530 docs/empresas/W10_ETAPA_IV_HANDOFF_2026-11-06.md e os handoffs W10-III, W15, W9, W11 e W1.
- Consulte o HEAD ATUAL, os checks, a base, os diffs, os PRs abertos e o estado de main ANTES de começar. SHAs acima são referências históricas, nunca autorização para ignorar mudanças posteriores.
- Crie branch por exemplo integration/emprovex-empresas-w10-stage5-hardening-prehomol-20261108 a partir do HEAD mais recente de #530. Abra UMA PR Draft baseada na branch W10-IV, preservando a #530 e o trabalho dos demais workers. NÃO criar implementação paralela ou cherry-pick dos módulos já herdados.
- Esta tarefa não inclui publicação, contratação/autorização WLG, migração de produção ou habilitar endpoints fiscais de emissão.

CRITÉRIO DE VERDADE
Há achados identificados por leitura estática de código e lacunas de QA. Distinga em seu relatório: (A) defeito confirmado por reprodução/teste, (B) inconsistência confirmada pela implementação, (C) hipótese/risco a investigar, (D) dívida técnica/visual. NÃO alegue incidente real, exfiltração ou regressão em produção sem prova. Comece reproduzindo os problemas, escreva regressões antes ou com cada correção e registre a evidência por arquivo/linha e teste. Se um achado não se confirmar, explique e não altere código desnecessariamente.

P0-01 — SELEÇÃO MULTI-CNPJ E EXPIRAÇÃO DO COOKIE / TROCA DE TENANT
Arquivos: lib/company/profiles/selection.mjs; lib/server/companyProfiles/integration.ts; lib/server/companyAuthz/index.ts; lib/server/companySession.ts; app/api/company/session/route.ts; app/api/company/profiles/**; lib/company/companySessionClient.ts; components/company/CompanySessionGate.tsx; features/company/profiles/CompanyProfileSwitcher.tsx.
Problema: cookie __Host-emprovex-company-profile expira em 600 s; quando ele deixa de ser enviado, verifySelectedCompanySession utiliza base.workspaceId sem indicação ao cliente, embora a UI possa continuar exibindo um CNPJ diferente. Validar risco com Auth/Firestore Emulator e navegador, incluindo aba B aberta por >10 min, reload, aba concorrente, revogação, 401/403/503, rascunho pendente e perda/expiração do cookie.
Corrigir SEM ampliar permissões: impedir troca silenciosa de tenant; amarrar sessão de UI, seleção e toda leitura/mutação ao mesmo workspace validado server-side; checar explicitamente o workspace esperado quando aplicável, nunca aceitar workspace/CNPJ do navegador como autorização. Escolher estratégia segura e prática (revalidação/renovação controlada ou exigência de nova seleção e bloqueio de requests na mudança); manter compatibilidade com conta empresarial legada de um único workspace. Não permitir que um cookie ausente, expirado, adulterado, CNPJ de outra empresa ou profile revogado abra acesso à empresa errada. Invalide estado assíncrono/cache entre A e B e proteja requisições em voo. Reavalie possível estado ambíguo entre abas compartilhando cookie.
GATE: após expiração/switch, nenhuma operação vai ao workspace diferente do exibido/confirmado e nenhum dado de A aparece na UI de B.

P1-02 — REVALIDAÇÃO DE SESSÃO NÃO DESTRUTIVA E CONSISTÊNCIA DO ESTADO CLIENTE
O listener de focus de CompanySessionGate muda gate para checking e desmonta o portal a cada retorno, potencialmente apagando formulários W1–W15. Revalidar sem desmontagem arbitrária, preservando rascunhos SOMENTE enquanto o UID, o workspace e a permissão permanecem os mesmos; bloquear/limpar imediatamente após revogação, logout ou troca de CNPJ. Não persistir rascunhos fiscais/dados pessoais em localStorage para contornar o problema. Usar controle de geração e AbortController, evitando race conditions e respostas tardias. Testar troca de aba, minimizar/retornar celular, foco, login expirado e atualização concorrente.

P1-03 — COERÊNCIA ENTRE ENTREGA W9 E PEDIDO W1
Inspecionar lib/company/delivery/service.ts, domain.mjs, store.ts, integrações W1 customerOrders/commitments, W7 allocations/stockEvents e W8 Finance. Descobrir fonte canônica de fulfilledQuantity, dispatched e deliveredQuantity. Reproduzir o caso de entrega parcial, total, recusa, devolução e concorrência; distinguir comprovante logístico de atesto/baixa financeira. Se confirmado gap W1↔W9, implementar reconciliação transacional idempotente ou projeção consistente que reflita corretamente o total atendido, com CAS e guardas por linha/pedido. Sem segundo ledger nem atualização cega; evitar contagem dupla, sobreentrega, estorno indevido, duplicação por replays e leitura cruzada entre empresas. Caso domínio exija separação entre entregue fisicamente e contabilizado, tornar os indicadores e estados explícitos e documentar, sem falsificar fulfilledQuantity. Testes Auth/Firestore Emulator reais A/B e eventos repetidos.

P1-04 — CNPJ NUMÉRICO / ALFANUMÉRICO SEM PERDA OU AUTORIZAÇÃO INDEVIDA
Investigar compatibilidade entre lib/company/profiles/core.mjs (suporte alfanumérico), lib/company/fiscal/wlg/index.mjs (apenas dígitos), features/company/fiscal/flow.mjs, FiscalIssuanceWorkspace.tsx e formatações/contratos. Verificar padrão oficial vigente da Receita Federal, algoritmo de dígito verificador, regras de representação, validação da WLG e compatibilidade com SEFAZ, SEM presumir suporte WLG a CNPJ alfanumérico. Centralizar normalização/validação segura para identidade e exibição, nunca descartar letras, nunca inventar conversão para 14 dígitos. Onde o provedor fiscal não comprovar suporte, manter bloqueio claro e amigável de emissão, sem impedir acesso legítimo à plataforma. Testar numérico válido/inválido, alfanumérico válido/inválido, mudança de CNPJ, binding WLG e tenant A/B.

P1-05 — CONTRATO UI W15 ↔ MOTOR W14 E GATES FISCAIS
Examinar componentes/company/fiscal/FiscalIssuanceWorkspace.tsx, features/company/fiscal/{api,flow}.mjs, lib/company/fiscal/issuance/index.mjs, app/api/company/fiscal/nfe/route.ts, app/api/company/fiscal/connections/route.ts e W5 armazenamento privado.
Reconciliar contrato simplificado de create_draft com o motor W14 (payload fiscal validado, pedido W1, campos tributários, revisão e aprovação em etapas), inclusive incompatibilidade série 0 no frontend versus série >=1 no motor. O formulário precisa permitir revisar informações reais sem sugerir que campos insuficientes são NF-e válida. Não habilitar POST real, não desbloquear /api/company/fiscal/nfe (503 deve permanecer enquanto faltarem dependências), não usar 202 como autorização, não afirmar XML/DANFE verificados sem assinatura/protocolo/armazenamento. Se UX permitir preparação local de intenção, deixar status 'não enviado/não salvo' inequívoco. Normalizar mensagens de HTTP 503 e 409 e nunca permitir retry automático de envio desconhecido.
Fortalecer store fiscal: firestoreStore.mjs deve reconstruir e conferir chave de reserva (companyId+issuerCnpj+environment+series+number) a partir dos dados imutáveis do registro, não aceitar apenas prefixo livre, com testes de chave divergente, reuso, CAS e cross-tenant.

P1-06 — SELETOR GLOBAL DE EMPRESA MOBILE E ACESSIBILIDADE
Hoje CompanySessionGate.tsx renderiza CompanyProfileSwitcher apenas em lg; existe outro na tela fiscal, inclusive no desktop com o mesmo id='emprovex-company-profile'. Disponibilizar seleção da empresa ativa em todas as páginas tanto desktop quanto mobile; escolher uma montagem global única e eliminar duplicação de IDs/labels. Caso a tela fiscal precise de indicação adicional, mostrar identidade ativa em modo somente leitura, não segunda seleção. Cumprir WCAG: label, aria, foco, teclado, anúncio de mudança, contraste, botões de toque confortáveis e drawer responsivo. Não fazer switch otimista antes da autorização do servidor.

P2-07 — MODO ESSENCIAL, MAPAS E ABAS
O toggle no cabeçalho não chega ao RoutingWorkspace e MapLibreView recebe essential=false por padrão, contrariando a preferência. Passar modo por estado/contexto explícito (sem duplicar toggle) e impedir carregamento de assets/tiles no Essencial. Verificar limpeza ao alternar modos, manter lista textual acessível e planejamento manual funcionando. Respeitar prefers-reduced-motion; sem CDN não auditado, tiles OSM públicos abusivos ou chave de terceiros. Testar desktop/mobile, volta de sessão, mapa indisponível, modo normal e Essencial.

P2-08 — EXPERIÊNCIA VISUAL/UX PREMIUM SEM REDESENHO DESNECESSÁRIO
Inspecionar app/empresa/**, components/company/**, features/company/**, CompanyNavigation, CompanyFeedback, W15 FiscalIssuanceWorkspace, W8 FinanceWorkspace, W11 RoutingWorkspace, W9 DeliveryWorkspace. Comparar tokens, espaçamentos, tipografia, semântica, responsividade, vazios/loading/error, disabled, contrastes, feedback de ações e estados.
- Remover/desambiguar cabeçalhos repetidos em Notas Fiscais; manter separados Fiscal W15 e registros financeiros manuais W8, sem confusão 'NF emitida' versus 'NF lançada'.
- Simplificar a longa jornada fiscal mobile com seções/etapas progressivas (identidade → dados → revisão → status) e feedback contextual, sem esconder dados nem aceitar clique de emissão indevido.
- Padronizar raios, botões, inputs, tabelas, banners de aviso, textos e acessibilidade pelos padrões existentes; estilo contemporâneo e profissional sem dependências pesadas, efeitos excessivos, animações invasivas ou alteração na marca.
- Remover nomenclaturas internas W10/W14/W15, flags e IDs técnicos das mensagens voltadas ao cliente quando não são úteis; manter detalhe técnico disponível em diagnóstico e logs sanitizados.
- Atualizar copy defasada da homepage e rotas: não informar que candidatos/W9/W11 estão ausentes quando já integrados; tampouco prometer emissão fiscal real, relatório completo ou função ainda desligada.
- Avaliar carregamento dinâmico/lazy de módulos custosos, recorte por seção e responsividade horizontal onde realmente comprovado problema. Medir ou comparar build/client bundle antes/depois quando possível.
- Capturar telas REAIS de navegador com viewport desktop, tablet e smartphone, modo claro/escuro quando existente, e registrar evidências acessíveis. Não gerar mockups/screencaps artificiais para simular teste.

P2-09 — DATAS, QUANTIDADES, FUSOS E FORMULÁRIOS
Fazer revisão dirigida de formatadores, inputs datetime-local, parse de ISO UTC, conversões decimais, centavos de BRL, janelas de recebimento, virada de dia, rejeição de NaN e fuso brasileiro. Não reescrever todos os domínios; corrigir apenas defeitos reproduzidos e proteger com regressão. Validar mensagens úteis de erro. Verificar formulários com requisições concorrentes e ausência de cancelamento nas páginas W8/W11, sem alargar a missão para serviços externos.

P0 DE SEGURANÇA INEGOCIÁVEL
- Preservar separação empresa↔setor militar e empresa A↔empresa B, validações live UID, email verificado, perfil ativo, role/capability e recurso; nunca confiar no body/localStorage/CNPJ para grants.
- Manter EMPROVEX_COMPANY_PILOT_ENABLED OFF por padrão; manter emissão WLG/SEFAZ, cadastro comercial de 2º CNPJ, XML/DANFE e cancelamentos desligados. Não alterar IAM, Firestore Rules, Secret Manager, Cloud Run, Firebase Hosting, permissões reais, banco produtivo ou dados reais.
- Não tocar Almoxarifado, Warehouse, Aprovisionamento, Eleonor, billing nem interfaces militares. Sem migração de produção e sem novo ledger.
- Sem criar credenciais, tokens ou material fiscal real. Qualquer requisição à WLG/SEFAZ deve ser proibida por padrão e substituída por fixtures/mocks de QA. Legal e comercial WLG são trabalho externo para momento posterior.
- Evitar regressões por transformação ampla: alterações mínimas em componentes compartilhados; toda mudança transversal requer demonstração de que sessões militares permanecem isoladas.
- Não declarar 'sem vulnerabilidades' por CI verde. Se algum risco não puder ser resolvido com segurança, preservar bloqueio e registrar NO-GO localizado.

CERTIFICAÇÃO REAL OBRIGATÓRIA
1. Levantar baseline no HEAD da #530 e rodar testes relevantes antes de mudanças, sem tomar relatórios antigos como prova do novo HEAD.
2. Testes de regressão para cada correção: expiração de perfil (600s), restauração/negação de sessão, A/B, duas abas, revogação, ação pós-foco, isolamento de formulário, member A/owner B, cookies adulterados, fluxo API real em Emulator.
3. Auth+Firestore Emulator REAL projeto demo-* em loopback para multi-CNPJ, W1/W9/W7, CAS, replay, reservas fiscais e suspensão/revogação; não substituir por puro mock JS nem enviar token demo a serviços reais.
4. Suítes W0–W15 aplicáveis, W10-II/III/IV, W15 22/22, W14 38/38 e novos testes deste Worker; npm ci, npm run typecheck, npm run build e proteções Core/Fast/Visual-R2/R1 Sync aplicáveis. Reexecutar no SHA FINAL.
5. Criar/rodar Playwright E2E empresarial autenticado com Firebase Auth/Firestore Emulator para desktop e mobile, ao menos: login, identidade, switching 2 CNPJs, 10min cookie, foco, revogação, navegação, formulário W15 bloqueado, W8, W9/W11, modo Essencial e acesso por teclado. Caso não haja harness de navegador viável, sinalizar explicitamente 'PENDENTE' e NO-GO para homologação visual concluída; NÃO marcar PASS ou inventar prints.
6. Auditoria de dependências e build apenas local/CI; sem atualizações indiscriminadas de versões maiores de Next/React/Tailwind e sem novas bibliotecas ou componentes pesados sem necessidade e prova de compatibilidade.
7. Registrar matriz PASS/FAIL/SKIPPED/PENDING por teste e link do workflow do HEAD exato. SKIPPED ≠ PASS. Registrar evidência/linha do código para bugs reais e screenshots apenas se capturados de execução legítima.

ENTREGA
- Abrir UMA PR Draft com título sugerido "fix(empresas W10-V): estabilização pré-homologação, multi-CNPJ, fluxo e UX".
- Nova branch exclusivamente a partir da #530; NÃO empurrar mudanças diretamente para a #530, #510 nem main; não mesclar PRs.
- Criar docs/empresas/W10_ETAPA_V_HANDOFF_PRE_HOMOLOGACAO_2026-11-08.md na branch da nova PR com: baseline, arquivos modificados, antes/depois de cada item P0/P1/P2, bug reproduzido ou hipótese descartada, contratos protegidos, testes e links, dados QA usados (sem segredos), capturas reais quando disponíveis, pendências, SHA final, plano simples de rollback.
- Parecer separado e inequívoco: GO/NO-GO para (i) revisão técnica isolada; (ii) iniciar homologação controlada no Emulator/navegador; (iii) produção/comercial WLG/SEFAZ (deve continuar NO-GO até autorizações independentes).
- Documente achados remanescentes sem criar novas rodadas de burocracia. Se tudo puder ser resolvido em uma PR, resolva e teste nesta PR.
- Execute agora o código e os testes. Não faça somente um relatório. SEM MERGE E SEM DEPLOY.

VALOR FINAL: uma única PR Draft de correções efetivas, com isolamento empresarial preservado, UX profissional e regressões reais, pronta para revisão antes da homologação.
~~~

---

## PROMPTS OFICIAIS DOS WORKERS — EXECUÇÃO R2/R3 (05/11/2026)

**Status documental:** prompts registrados e prontos para implementação, sem acionamento automático por este arquivo. W0 entregou a PR #511; W1–W5 entregaram PRs Draft #513, #516, #514, #512, #515. W6–W8 estão trabalhando em branches próprias conforme coordenação do projeto; consultar seus SHAs e resultados antes de integrar. Este bloco integra o memorial oficial. O [relatório de auditoria R1-M](./empresas/AUDITORIA_R1M_PLANO_WORKERS_2026-11-05.md) contém achados P0–P2, matriz de 20 testes e arquitetura de execução; seus critérios prevalecem sobre o planejamento histórico quando houver divergência operacional.

**Sequência executiva atualizada:** W0 → W1–W5 → **W6–W8 + W11 em paralelo** → W10 ETAPA I (integração/contratos) → W9 (cronogramas e entregas) → W10 ETAPA II (integração W9/W11, E2E, piloto). W11 desenvolve mapas/rotas, W9 executa entregas, W10 integra e homologa. W9 é de Empresas, não de Almoxarifado.

**Instruções obrigatórias, aplicáveis integralmente a todo prompt abaixo:** você é um Worker implementador no repositório `aprov-hgesm/Controles-de-Empenhos---Aprov`. Verifique primeiro branch, SHA, arquivos atuais e o [memorial](./EMPROVEX_EMPRESAS_MEMORIAL_OFICIAL.md) e a [auditoria](./empresas/AUDITORIA_R1M_PLANO_WORKERS_2026-11-05.md); faça **código real**, não somente propostas ou mockups. Trabalhe em **branch isolada**, abra PR **Draft**, não faça merge, não publique, não promova tráfego, não altere billing/IAM/Rules de produção nem dados reais sem autorização. Preserve a conta fundadora, todos os workspaces militares, o Almoxarifado, a Central de Depósitos, o Cloud Run e o histórico. Toda API empresarial deve validar identidade/workspace e papel no **servidor**; CNPJ, UG, slug ou parâmetro do cliente nunca bastam para autorizar. Não criar segunda fonte de verdade, nem reutilizar ledger militar. Senhas, tokens e documentos nunca em logs. Sem mudanças fora do escopo sem handoff ao integrador. Quando solicitar novo campo ou contrato comum, abra patch/handoff pequeno; não edite em paralelo `lib/platformIdentity.ts`, `app/login/page.tsx`, `lib/server/companySession.ts`, `firestore.rules`, `components/admin/PlatformAdminView.tsx`, CI global ou `package-lock.json`. Resultados devem incluir arquivos alterados, SHA, PR, testes executados de fato, riscos residuais, bloqueios e proposta GO/NO-GO; nunca afirmar testes não realizados.

**Regra de origem:** fundação na PR #511, SHA `16b763e929342b6ea1f5858470cc670c9ea5a3f4`; W1–W5 têm handoffs nas PRs #513, #516, #514, #512 e #515. W6–W8 consultam esses contratos e trabalham em branches isoladas. **W11 pode iniciar agora, partindo da fundação W0**, consultando os handoffs W1/W3/W4, mas sem importar código de branches não integradas ou alterar contratos globais. W9 depende da consolidação técnica W6/W7 e dos eventos W8. W10 fará integração técnica antes do W9 e homologação final após W9/W11. Nenhuma ação deve partir de #419/#447 como base.

### Prompts individuais completos (copiar integralmente o bloco correspondente)
#### PROMPT W0 — Fundação, identidade e segurança (sequencial obrigatório)

~~~text
Você é o Worker W0 da extensão EMPROVEX Empresas. Execute efetivamente o trabalho descrito a seguir, em branch isolada e PR Draft; não se limite a planejar.

BASE E DEPENDÊNCIAS: PR #510, no SHA vigente, em branch isolada de fundação; não partir de #419/#447.
ESCOPO E ARQUIVOS RESERVADOS: app/login/page.tsx, app/login/OperationalEntry.tsx, lib/server/companySession.ts, lib/server/companyProvisioningAdmin.ts, lib/company/contracts/**, lib/server/companyAuthz/**, scripts e testes E2E empresariais. Alterações em arquivos globais somente por este Worker/integrador.

MISSÃO: Consolidar a base empresarial R1-M antes de permitir desenvolvimento operacional. Resolver P0-01 (erro de sessão empresarial não pode indisponibilizar um setor legítimo; jamais fazer fallback de empresa para setor), P0-02 (flag positiva de habilitação do piloto, desativada por padrão e respeitando kill switch existente), P0-03 (guard obrigatório no servidor com UID, workspace, status e escopo) e P0-04 (homologação E2E no Firebase Auth/Firestore Emulator). Fixar nomes de coleções, tipos, erros, operações, datas, unidades, idempotência, auditoria e política de ownership.

CRITÉRIOS DE ACEITE: Demonstrar: login do fundador por Google e senha; acesso do setor legado; empresa A/B isoladas; conta suspensa ou UID divergente bloqueado; 401/403/503 e timeout tratados sem escalada; dois cadastros concorrentes de mesmo CNPJ/e-mail/workspace não produzem duplicidade nem usuário órfão; flag OFF bloqueia provisionamento; schema e API de autorização documentados.

TESTES OBRIGATÓRIOS: npm run typecheck; npm run build; node --test scripts/emprovex-empresas-sync-r1.test.mjs; Core Protection, navegação crítica, Visual-R2 e E2E Auth/Firestore com fixtures demo. Executar testes empresariais reais somente em ambiente isolado, jamais no banco produtivo.

ENTREGA / HANDOFF: Entregar PR Draft, commit SHA de fundação, contratos congelados, mapa de namespaces e APIs, matriz de identidade, relatório dos cenários e GO/NO-GO para abertura de W1–W5.

REGRAS DE EXECUÇÃO: Leia e obedeça as instruções obrigatórias desta seção do memorial e a auditoria R1-M. Não modificar arquivos compartilhados reservados ao integrador, não usar dados militares como dados empresariais, não conceder permissões pelo cliente e não fazer merge/deploy. Registre somente evidências verificáveis, bloqueios e decisões técnicas mínimas, sem burocracia.
~~~

#### PROMPT W1 — Clientes públicos, notas de empenho e pedidos de OMs (paralelo P1)

~~~text
Você é o Worker W1 da extensão EMPROVEX Empresas. Execute efetivamente o trabalho descrito a seguir, em branch isolada e PR Draft; não se limite a planejar.

BASE E DEPENDÊNCIAS: Exclusivamente do commit de fundação aprovado pelo W0.
ESCOPO E ARQUIVOS RESERVADOS: features/company/customers/**, features/company/commitments/**, features/company/customer-orders/** e lib/company/customers/**. Novas APIs só em app/api/company/customers/**, commitments/** ou customer-orders/**.

MISSÃO: Implementar cadastro de cliente público (OM/órgão), UG/UASG apenas como atributo de cliente, endereços, contatos, referências de NE, itens, preços de venda e pedido efetivo da OM em entidade separada da NE. Uma NE deve aceitar vários pedidos e entregas parciais. Construir componentes, handlers e persistência exclusivamente pelo guard server-side W0, com paginação por workspace e trilha de revisão dos dados extraídos. Disponibilizar eventos e contratos para W6/W7/W8, sem implementar compras, estoque ou financeiro.

CRITÉRIOS DE ACEITE: Empresa A nunca consulta OM/NE/pedido da B; mesma NE pode originar vários pedidos; quantidade de cada linha, saldo comprometido e estado parcial são coerentes; mudança negociada é rastreável; nenhum preço de venda se torna custo por suposição.

TESTES OBRIGATÓRIOS: Unitários dos modelos e validações, integração de APIs com contas A/B, paginação, idempotência de criação, E2E cadastro→NE→pedido, typecheck/build e regressão de isolamento.

ENTREGA / HANDOFF: PR Draft W1 com contratos de customerOrderLine, commitment e publicCustomer, endpoints, testes e mapa dos eventos consumíveis por W6/W7/W8.

REGRAS DE EXECUÇÃO: Leia e obedeça as instruções obrigatórias desta seção do memorial e a auditoria R1-M. Não modificar arquivos compartilhados reservados ao integrador, não usar dados militares como dados empresariais, não conceder permissões pelo cliente e não fazer merge/deploy. Registre somente evidências verificáveis, bloqueios e decisões técnicas mínimas, sem burocracia.
~~~

#### PROMPT W2 — Fornecedores de origem e catálogo empresarial (paralelo P1)

~~~text
Você é o Worker W2 da extensão EMPROVEX Empresas. Execute efetivamente o trabalho descrito a seguir, em branch isolada e PR Draft; não se limite a planejar.

BASE E DEPENDÊNCIAS: Do SHA W0 aprovado, sem importar tipos de fornecedor militar como fonte de verdade.
ESCOPO E ARQUIVOS RESERVADOS: features/company/suppliers/**, features/company/catalog/**, lib/company/suppliers/**; APIs próprias sob app/api/company/suppliers/** e catalog/**.

MISSÃO: Criar cadastro de sourceSupplier (fornecedor de origem, distinto da empresa licitante), contatos múltiplos, CNPJ quando aplicável, produtos, SKU canônico, embalagem, unidade, conversão, preço e data de referência, lead time estimado, condições comerciais, canais e status ativo/suspenso/inativo. Estruturar consulta e escolha de fornecedor para pedidos de compra sem executar compra neste Worker.

CRITÉRIOS DE ACEITE: Fornecedor suspenso não pode ser escolhido para novo pedido sem exceção autorizada; 1 produto empresarial admite várias referências de fornecedores; a conversão de unidades é explícita, sem arredondamento que crie saldos; preço histórico não é rotulado como preço atual; isolamento A/B comprovado.

TESTES OBRIGATÓRIOS: Validação de dados/CNPJ, duplicidade por tenant, alteração e suspensão de fornecedor, conversões numéricas, busca/paginação, 401/403, typecheck e build.

ENTREGA / HANDOFF: PR Draft W2, dicionário product/SKU/sourceSupplier, endpoints, esquema de preços com vigência e contratos de compra para W6/W7.

REGRAS DE EXECUÇÃO: Leia e obedeça as instruções obrigatórias desta seção do memorial e a auditoria R1-M. Não modificar arquivos compartilhados reservados ao integrador, não usar dados militares como dados empresariais, não conceder permissões pelo cliente e não fazer merge/deploy. Registre somente evidências verificáveis, bloqueios e decisões técnicas mínimas, sem burocracia.
~~~

#### PROMPT W3 — Membros, convites e permissões da empresa (paralelo P1)

~~~text
Você é o Worker W3 da extensão EMPROVEX Empresas. Execute efetivamente o trabalho descrito a seguir, em branch isolada e PR Draft; não se limite a planejar.

BASE E DEPENDÊNCIAS: Do SHA W0; depende do guard e contrato de sessão do W0, não do Admin militar.
ESCOPO E ARQUIVOS RESERVADOS: features/company/members/**, lib/company/roles/**, lib/server/companyMembership/**, app/api/company/members/**. Mudança de guard comum solicita handoff ao integrador.

MISSÃO: Implementar equipe por empresa e papéis Administrador, Operações/Compras, Estoque, Logística, Motorista e Financeiro, com composição de papéis, convites, aceite, revogação e trilha de auditoria. Preservar a conta titular do cadastro como bootstrap sem permitir escalonamento por request. Projetar compartilhamento por pedido com fornecedor externo como contrato futuro, sem criar convite público abrangente nesta fase.

CRITÉRIOS DE ACEITE: Usuário só vê recursos compatíveis com membership e ação; revogação bloqueia novos requests; o último administrador não é removido sem substituto; nenhuma permissão militar é herdada; convidado jamais enumera outros pedidos ou empresas.

TESTES OBRIGATÓRIOS: Matriz de permissões por papel×ação, tentativas de autopromoção, IDOR, membership revogado, empresa A/B, token errado, convites inválidos e expiração, typecheck/build.

ENTREGA / HANDOFF: PR Draft W3, tabela roles/actions, APIs de membros, mecanismos de revogação e testes reprodutíveis.

REGRAS DE EXECUÇÃO: Leia e obedeça as instruções obrigatórias desta seção do memorial e a auditoria R1-M. Não modificar arquivos compartilhados reservados ao integrador, não usar dados militares como dados empresariais, não conceder permissões pelo cliente e não fazer merge/deploy. Registre somente evidências verificáveis, bloqueios e decisões técnicas mínimas, sem burocracia.
~~~

#### PROMPT W4 — Experiência do portal, navegação e acessibilidade (paralelo P1)

~~~text
Você é o Worker W4 da extensão EMPROVEX Empresas. Execute efetivamente o trabalho descrito a seguir, em branch isolada e PR Draft; não se limite a planejar.

BASE E DEPENDÊNCIAS: Do SHA W0. Interfaces temporárias podem usar estados vazios, mas não dados falsos confundidos com reais.
ESCOPO E ARQUIVOS RESERVADOS: components/company/**, features/company/shell/** e app/empresa/**, exceto endpoints e componentes pertencentes a outro Worker. Integrador arbitra qualquer modificação em features/company/modules.ts.

MISSÃO: Evoluir o shell R0 para uma experiência comercial profissional, responsiva e acessível com navegação: Início, Pedidos de OM, Empenhos, Compras, Fornecedores, Catálogo, Cronogramas, Estoque, Entregas, Notas Fiscais, Financeiro, Clientes, Relatórios e Configurações. Criar padrões reutilizáveis de busca/filtros, vazio, loading, erro, confirmação, feedback, resumos e modo Essencial sem 3D desnecessário. Animações leves devem respeitar reduced-motion, desempenho e leitores de tela.

CRITÉRIOS DE ACEITE: Fluxos de navegação preservam sessão e identidade; mobile/teclado funcionais; todas as páginas sem backend exibem 'Em preparação' claramente; nenhum SSR/hook operacional militar carrega por acidente; acessibilidade e latência medidas.

TESTES OBRIGATÓRIOS: Typecheck/build, navegação crítica, Playwright desktop/mobile, keyboard/focus, reduced-motion, estado de erro, proteção de rota e isolamento de importações.

ENTREGA / HANDOFF: PR Draft W4 com mapa de telas/rotas, component contracts sem lógica de estoque, capturas QA e matriz de acessibilidade.

REGRAS DE EXECUÇÃO: Leia e obedeça as instruções obrigatórias desta seção do memorial e a auditoria R1-M. Não modificar arquivos compartilhados reservados ao integrador, não usar dados militares como dados empresariais, não conceder permissões pelo cliente e não fazer merge/deploy. Registre somente evidências verificáveis, bloqueios e decisões técnicas mínimas, sem burocracia.
~~~

#### PROMPT W5 — Documentos, NE PDF, anexos e exportações (paralelo P1)

~~~text
Você é o Worker W5 da extensão EMPROVEX Empresas. Execute efetivamente o trabalho descrito a seguir, em branch isolada e PR Draft; não se limite a planejar.

BASE E DEPENDÊNCIAS: Do SHA W0; depende dos tipos documentais compartilhados e utiliza os modelos de W1/W2 por interface acordada.
ESCOPO E ARQUIVOS RESERVADOS: features/company/documents/**, lib/company/documents/** e app/api/company/documents/**. Não editar o endpoint setorial app/api/empenhos/parse-ne/route.ts sem decisão do integrador.

MISSÃO: Construir endpoint empresarial para importação de NE PDF e revisão humana dos campos parseados, reutilizando somente parser puro existente, nunca autorização ou cobrança do setor. Implementar modelo para anexos de NE/compra/comprovante, controles de tipo/tamanho, sanitização, escopo de acesso e exportação PDF de ordem de compra/romaneio. Mensagens para WhatsApp/e-mail devem ser rascunhos/copiar/compartilhar, nunca registradas como enviadas sem evidência.

CRITÉRIOS DE ACEITE: PDF malformado/grande é rejeitado, campos extraídos exigem confirmação antes de persistir, arquivo A não é baixável por B, URLs temporárias não expõem documentos e PDFs gerados reproduzem dados íntegros.

TESTES OBRIGATÓRIOS: PDF textual válido/malformado, MIME/bytes/limites, autorização de anexos, download/expiração, geração sem duplicação, typecheck/build.

ENTREGA / HANDOFF: PR Draft W5, schema de anexos, endpoints, exemplos anonimizados e contratos de geração para W1/W6/W9.

REGRAS DE EXECUÇÃO: Leia e obedeça as instruções obrigatórias desta seção do memorial e a auditoria R1-M. Não modificar arquivos compartilhados reservados ao integrador, não usar dados militares como dados empresariais, não conceder permissões pelo cliente e não fazer merge/deploy. Registre somente evidências verificáveis, bloqueios e decisões técnicas mínimas, sem burocracia.
~~~

#### PROMPT W6 — Compras e abastecimento junto ao fornecedor (paralelo P2)

~~~text
Você é o Worker W6 da extensão EMPROVEX Empresas. Execute efetivamente o trabalho descrito a seguir, em branch isolada e PR Draft; não se limite a planejar.

BASE E DEPENDÊNCIAS: Depois dos contratos estáveis de W1+W2+W3; iniciar somente lógica pura antecipadamente se possível.
ESCOPO E ARQUIVOS RESERVADOS: features/company/purchases/**, features/company/inbound/**, lib/company/purchases/**, app/api/company/purchases/**. Ledger de estoque pertence exclusivamente a W7.

MISSÃO: Gerar necessidade de compra com base no pedido da OM e falta líquida; criar purchaseOrder com itens, preços, fornecedor de origem, quantidade, unidade, prazo desejado/confirmado e revisões. Registrar envio efetivamente confirmado, resposta e contraproposta, recebimento parcial, recusa e cronograma inbound. Publicar eventos imutáveis de recebido/cancelado para W7/W8 e não gravar estoque por fora do ledger.

CRITÉRIOS DE ACEITE: Um pedido OM pode derivar ordens de diversos fornecedores; uma compra pode atender várias OMs por alocação contratual; fornecedor confirma 250 de 400 sem converter tudo em recebido; alteração de data não muda prazo acordado com OM; retry é idempotente.

TESTES OBRIGATÓRIOS: Estados de compra/revisão, validação de fornecedor suspenso, parcialidade, concorrência, idempotência, A/B, rate-limit e typecheck/build.

ENTREGA / HANDOFF: PR Draft W6 com purchaseOrder, inbound event contract, testes e definições para integração W7/W8/W9.

REGRAS DE EXECUÇÃO: Leia e obedeça as instruções obrigatórias desta seção do memorial e a auditoria R1-M. Não modificar arquivos compartilhados reservados ao integrador, não usar dados militares como dados empresariais, não conceder permissões pelo cliente e não fazer merge/deploy. Registre somente evidências verificáveis, bloqueios e decisões técnicas mínimas, sem burocracia.
~~~

#### PROMPT W7 — Estoque leve, reservas e alocações N:M (paralelo P2)

~~~text
Você é o Worker W7 da extensão EMPROVEX Empresas. Execute efetivamente o trabalho descrito a seguir, em branch isolada e PR Draft; não se limite a planejar.

BASE E DEPENDÊNCIAS: Depois dos contratos W0/W1/W2/W3 e evento de W6 congelado.
ESCOPO E ARQUIVOS RESERVADOS: features/company/inventory/**, features/company/allocation/**, lib/company/inventory/**, app/api/company/inventory/**. Não acessar features/warehouse/** ou o ledger de depósitos militares.

MISSÃO: Construir ledger empresarial por evento com unidade canônica, entradas, saídas, reservas, expedições, estornos, ajustes auditáveis e material em trânsito separado de saldo disponível. Alocar quantidades de compras e estoque para pedidos OM com cardinalidade N:M; garantir transações idempotentes, concorrência segura e ausência de estoque negativo ou dupla reserva. Suportar remessa parcial e entrega direta origem→OM com natureza própria (sem simular entrada/saída física).

CRITÉRIOS DE ACEITE: Pedido 500 = 100 estoque + 300 fornecedor A + 100 B; compra 500 distribui 200/300 em duas OMs; duas reservas simultâneas do último saldo não podem ambas concluir; estorno mantém trilha; A/B isoladas.

TESTES OBRIGATÓRIOS: Testes transacionais no Firestore Emulator, falhas concorrentes/retry, idempotência, conversão, parcialidade, saldo e retorno, typecheck/build.

ENTREGA / HANDOFF: PR Draft W7 com esquema de ledger, invariantes quantitativos, testes de corrida e contratos de reserva/expedição para W9.

REGRAS DE EXECUÇÃO: Leia e obedeça as instruções obrigatórias desta seção do memorial e a auditoria R1-M. Não modificar arquivos compartilhados reservados ao integrador, não usar dados militares como dados empresariais, não conceder permissões pelo cliente e não fazer merge/deploy. Registre somente evidências verificáveis, bloqueios e decisões técnicas mínimas, sem burocracia.
~~~

#### PROMPT W8 — Financeiro manual, NFs e margens (paralelo P2)

~~~text
Você é o Worker W8 da extensão EMPROVEX Empresas. Execute efetivamente o trabalho descrito a seguir, em branch isolada e PR Draft; não se limite a planejar.

BASE E DEPENDÊNCIAS: Após contratos de W1/W2/W3; consumir eventos de W6/W7 quando disponíveis, nunca reimplementar compra ou estoque.
ESCOPO E ARQUIVOS RESERVADOS: features/company/finance/**, lib/company/finance/**, app/api/company/finance/**, sem alterar lib/billing.ts do SaaS militar.

MISSÃO: Separar NF de entrada/compra e NF de venda/entrega; criar obrigações a pagar, contas a receber, vencimentos, parcelas, registros manuais de pagamento e recebimento e cálculo de margem/fluxo de caixa. Utilizar centavos ou aritmética decimal segura, marcar valores estimados e despesas ausentes, e não inferir recebimento bancário ou liquidação da OM a partir de entrega. Controles por papel financeiro.

CRITÉRIOS DE ACEITE: NF de fornecedor não vira receita; NF de venda não vira despesa; pagamentos parciais somam ao saldo; frete/tributo desconhecidos aparecem como lacuna; multas e ajustes exigem auditoria; A/B e papéis isolados.

TESTES OBRIGATÓRIOS: Aritmética/precisão, parcialidade e estorno, autorização por role, concorrência, conciliação manual sem baixa automática, typecheck/build.

ENTREGA / HANDOFF: PR Draft W8 com ledger financeiro próprio, funções puras de cálculo, endpoints e painéis, limites conhecidos e pontos de integração W9.

REGRAS DE EXECUÇÃO: Leia e obedeça as instruções obrigatórias desta seção do memorial e a auditoria R1-M. Não modificar arquivos compartilhados reservados ao integrador, não usar dados militares como dados empresariais, não conceder permissões pelo cliente e não fazer merge/deploy. Registre somente evidências verificáveis, bloqueios e decisões técnicas mínimas, sem burocracia.
~~~

#### PROMPT W9 — Cronogramas integrados, entregas e provas (sequencial)

~~~text
Você é o Worker W9 da extensão EMPROVEX Empresas. Leia o Memorial Oficial, auditoria R1-M, contratos W0 (PR #511), handoffs W1–W8 e interface W11 quando existente. Execute implementação real, testes e PR Draft em branch isolada. Não faça merge nem deploy.

BASE E DEPENDÊNCIAS: iniciar após W10 concluir uma consolidação técnica verificável dos contratos e dados W1–W3/W6–W8. O W9 de Empresas não é o W9 de Almoxarifado. O W11 pode continuar paralelo; W9 NÃO depende do mapa para oferecer cronograma e romaneio manual.

OWNERSHIP: features/company/schedule/**, features/company/delivery/**, lib/company/schedule/**, lib/company/delivery/** e app/api/company/schedule/** e app/api/company/deliveries/**, após confirmar convenções existentes. W11 detém features/company/routing/**, lib/company/routing/**, lib/company/geo/** e app/api/company/routing/**. W4/W10 detêm app/empresa/** e manifestos de menus. Não modificar Warehouse, W7 ledger, W8 financeiro, login nem contratos W0.

MISSÃO: ligar cronograma inbound de compra/fornecedor/recebimento ao outbound de pedido OM/expedição/entrega por linha e quantidade; distinguir datas solicitadas, prometidas, estimadas, confirmadas e realizadas, com fonte e hora. Calcular viabilidade considerando saldo do W7, separação, lead time fornecedor, descarga, janela da OM e eventual ETA do W11. Exibir risco de prazo e pedidos impactados por atraso inbound, exigir aprovação humana para renegociar. Criar ordens de expedição e romaneios com quantidades efetivamente disponíveis, parcialidade, motorista responsável e sequência confirmada. Registrar coleta, saída, entrega, entrega parcial, recusa, avaria, devolução e evidência anexada com auditoria, idempotência e revisões; permitir fornecedor→OM diretamente sem inventar estoque na empresa. Declaração de entrega jamais equivale a atesto, liquidação ou pagamento.

CONTRATO COM W11: fornecer DeliveryCandidate (entrega/pedido/linha, destino confirmado, janelas de recepção, duração, peso/volume se conhecidos); consumir RouteProposal/RoutePlan aprovado (ordem de paradas, veículo, duração/distância estimadas, paradas sem alocação e justificativa). O W9 NÃO recalcula rota, NÃO cria outro cadastro de veículos e NÃO escreve routeStops como origem independente. Uma rota sugerida nunca confirma despacho; conferir reserva/estoque no W7, janela/quantidade e permissão logística antes da emissão do romaneio. Quando W11 indisponível, permitir sequência/rota manual sem inventar ETA ou distância. Navegação aberta no Waze/Google Maps não muda status de entrega.

TESTES E ACEITE: 2 fornecedores + 5 OMs com prazos distintos; pedido parcial, entrega direta, atraso do fornecedor e alerta downstream, alteração de promessa só com operador, recusa/retorno/avaria, alocação e conservação de saldos, duas empresas A/B, papel motorista restrito e sem atesto implícito. E2E Auth/Firestore em projeto demo, contratos de interface com W11 e teste do modo manual sob falha de roteirização. npm run typecheck, npm run build e testes específicos/segurança, sem simular execução.

HANDOFF: PR Draft com SHA, contratos/eventos, endpoints, romaneio, evidências reais e parecer GO/NO-GO. Sem merge/deploy/alteração militar; respeitar guard W0 e papéis do W3.
~~~

#### PROMPT W10 — Integração técnica, E2E e piloto controlado (duas etapas)

~~~text
Você é o Worker W10 integrador EMPROVEX Empresas. Acesse repositório, Memorial Oficial, auditoria R1-M, PR #510, fundação W0 #511 e handoffs de todos os Workers W1–W9 e W11. Implemente integrações reais, testes e documentação em branch própria; sem merge nem deploy sem autorização.

ETAPA I — ANTES DO W9: consolidar W1–W5 e W6–W8 com contratos, dependências e testes, preservando cada SHA de origem. Resolver no integrador o bloqueio W3: membro convidado deve ter sessão válida somente após vínculo persistido, Auth/UID/email e verificação LIVE de role/capacidade a cada request no guard W0. Impedir IDOR, autopromoção e acesso após revogação; nenhum setor/fundador vira membro implicitamente. Harmonizar quantidades W1/W2/W7 sem perdas, estados W6/W7/W8, eventos e idempotência. Integrar telas reais na navegação W4. Congelar os contratos DeliveryCandidate/RouteProposal para W9↔W11. Só W10 pode acrescentar, com revisão e teste, coleções empresariais deliveryRoutes e vehicles e ações granulares deliveryRoutes:read/write e vehicles:read/write ao contrato/guard W0; não conceder company:write como substituto. Publicar o SHA-base de integração técnica para W9 em PR Draft, SEM merge na main.

ETAPA II — DEPOIS W9/W11: integrar cronogramas, expedição, comprovantes e propostas de rotas sem duplicar ledger nem mudar despachos automaticamente. Permitir navegação via links externos, nunca registrar visita/entrega por abrir Waze/Maps. Validar operação manual mesmo sem geocodificador, tiles ou otimizador. Garantir isolamento multiempresa, atribuição de motoristas e sem rastreamento contínuo por padrão. Prover QA demonstrável do caminho pedido OM→compra fornecedor→recebimento→reserva→cronograma→rota proposta/aprovada→entrega parcial→documento→financeiro e regressão integral do sistema militar.

OWNERSHIP: único Worker que integra arquivos compartilhados, lib/company/contracts/**, lib/server/companyAuthz/**, lib/server/companySession.ts, app/empresa/**, features/company/modules.ts, CI/E2E empresarial, memorial e scripts globais. Não migrar Rules/IAM, cobrar mapa pago nem habilitar piloto/deploy automaticamente. Reconciliação mínima com main recente e W9 do Almoxarifado independente.

TESTES E GATES: matriz de 20 cenários da auditoria R1-M e adicionais W11 (5 OMs, 2 veículos, parada inviável explícita, janelas, dupla reserva, rota manual, links e confidencialidade); Auth/Firestore Emulator A/B, membership/revogação, concorrência/idempotência; testes específicos de TODOS os Workers executados de fato, inclusive W2/W3/W4/W5 e W11, não apenas sintaxe ou CI herdada. Playwright empresarial desktop/mobile, acessibilidade, Modo Essencial, Core/Fast/Visual-R2 e build. Registrar PASS/FAIL/SKIPPED sem falsificar provas. Caso W11 não alcance gate, manter roteirização desativada e parecer separado; não impedir escopo manual homologado por dependência opcional, salvo decisão expressa de exigir mapa no piloto.

ENTREGA: PR Draft integrada com checkpoints I/II, SHAs, conflitos e contratos, avaliação custo/licenças/privacidade de mapas, plano de rollback, feature flag piloto OFF por padrão e parecer GO/NO-GO detalhado. Somente autorização explícita posterior libera merge/Cloud Run/Hosting ou APIs comerciais.
~~~

#### PROMPT W11 — Mapas, geocodificação e roteirização (paralelo à segunda onda)

~~~text
Você é o Worker W11 da extensão EMPROVEX Empresas. Acesse o repositório aprov-hgesm/Controles-de-Empenhos---Aprov, leia Memorial Oficial, auditoria R1-M, W0 PR #511 SHA 16b763e929342b6ea1f5858470cc670c9ea5a3f4, os handoffs W1 #513, W3 #514, W4 #512 e os contratos W6/W7 quando disponíveis. Execute código funcional e testes em branch isolada e PR Draft, sem merge nem deploy.

BASE E PARALELISMO: pode iniciar AGORA, em paralelo a W6–W8, partindo do SHA W0. PRs dos demais Workers ainda não estão integradas: não importar código ausente na base como dependência implícita; criar interfaces de integração tipadas e fixtures reais de QA. Motor geográfico e componentes de mapa podem ser implementados sem W9. A persistência de novos domínios depende de aprovação do patch W0 pelo integrador W10.

OWNERSHIP EXCLUSIVO: features/company/routing/**, lib/company/routing/**, lib/company/geo/**, app/api/company/routing/**, seus testes e documentação. UI do mapa isolada, a ser montada por W4/W10 no shell. NÃO editar app/empresa/**, components/company/**, features/company/shell/**, features/company/modules.ts, lib/company/contracts/**, lib/server/companyAuthz/**, login, Firestore Rules, APIs/ledger W1–W9, CI compartilhada, billing, IAM, package-lock ou infraestrutura sem handoff/aceite do integrador. Nenhuma alteração nas áreas militares ou no W9 de Almoxarifado.

MISSÃO FUNCIONAL: criar mapa interativo das entregas por empresa com localização de OM/órgão comprador, filtros por período, situação, motorista, região, número de destinos e rota. Oferecer configuração de origem/depot, veículos, capacidade (peso/volume/unidade), motorista, turno, intervalos, destinos, janelas de recebimento e duração da descarga, sequência manual por arrastar/reordenar, prévia e aprovação explícita. Mostrar mapa e lista acessível com estados vazios/de erro, cores consistentes, pinos somente de destino autorizado, paradas inviáveis e motivos (sem esconder pedido). Não presumir capacidade, coordenada, tempo de trânsito ou custo se ausente.

ARQUITETURA DE PROVEDORES: MapLibre GL JS para renderizar mapas com atribuição e tiles configuráveis de provedor com licença adequada a serviço comercial; ter fallback em lista quando WebGL/tiles indisponíveis e modo Essencial com carregamento sob demanda. NÃO depender de tile.openstreetmap.org para uso comercial intenso, scraping ou cache offline. Adaptador server-side OSRM para matrizes de distância/tempo, substituível por GraphHopper/Valhalla, e VROOM para roteirização multi-veículo, múltiplas paradas, janelas/pausas/capacidade; não inserir binários/imagens de serviços externos no aplicativo. Timeout, limites de payload/rotas, quotas e circuit breaker, sem travar operação manual. Adaptação futura à Google Maps Route Optimization API somente opcional e DESLIGADA por padrão; não consumir API paga, criar credenciais, configurar Cloud Run ou divulgar custos não verificados sem autorização.

DADOS, CONTRATOS E GUARDA: trabalhar sob supplierCompanyWorkspaces/{companyId} com CompanyOwnedRecord e requireCompanyContext W0; jamais usar CNPJ/UG fornecido pelo cliente para autoridade. Propor ao W10 (não escrever em W0 por conta própria) novas subcoleções deliveryRoutes e vehicles e ações específicas deliveryRoutes:read/write e vehicles:read/write; exigir checkLiveMemberCapability do W3 e papel adequado para motorista/logística. Sem contrato e permissão aprovados, APIs mutáveis falham fechadas; não recorrer à ação genérica company:write. Todo RoutePlan/RouteStop inclui companyId/workspaceId, revisão, source, createdByUid, timestamps, idempotencyKey e hash validado, destino, latitude/longitude com fonte/confiança e confirmação humana, janela, duração, veículo, sequência, ETA com provedor/data/base, distanceEstimate e lista unassigned. RoutePlan diferencia draft, optimizedSuggestion, approved, dispatched e closed; aprovação não equivale a despacho. Alterações têm CAS, auditoria e confirmação humana. Só W7/W9 movimentam estoque e registram entrega; W11 nunca faz ledger, romaneio nem atesto.

PRIVACIDADE: usar somente endereço de entrega necessário e verificado; não enviar NF, NE, contato privado, informação financeira, token ou ID interno ao provedor de mapas. Dados de localização de motorista em tempo real, GPS em segundo plano e histórico de deslocamento estão FORA do escopo; somente implementar em versão futura com consentimento específico e política de retenção. Geocodificação pode ser manual ou por provedor contratado; endereços ambíguos ficam sem coordenada até confirmação, nunca geocodificar pelo centro da cidade por suposição. Mostrar atribuição de dados e cumprir licenças de mapa e serviços.

NAVEGAÇÃO EXTERNA: abrir a próxima parada autorizada no Waze via https://waze.com/ul ou Google Maps via Maps URLs documentadas, com coordenadas/destino mínimos validados e URL encoding; não revelar dados internos nem presumir Waze instalado. Tocar em navegação não marca parada como visitada, não registra GPS nem confirma entrega.

HANDOFF W9: publicar interface DeliveryCandidate (pedido/linha/entrega real, endereço/janela/carga informada) → RouteProposal (sequência, veículo, duração/distância estimadas, razão de unassigned, riscos) → RoutePlan aprovado. W9 continua responsável por despacho, romaneio, cronograma e prova. Suportar operador montando rota manual sem provedor, e replanejamento auditado sem mudar prazo prometido à OM automaticamente.

TESTES/ACEITE: fixtures para 5 OMs e 2 veículos, origem, 1 endereço ambíguo, restrição de horário, 1 veículo sem capacidade, parada inviável, alteração de destino, reordenação manual, conversão sem perda, erro do provedor, timeout e fallback, tenant A/B e motorista não autorizado, revisão concorrente, aprovação humana, navegação Waze/Google e nenhum dado sigiloso em URLs. Executar testes puros e de adaptadores mockados, Auth/Firestore Emulator apenas após integração de autorização real, testes de acesso/IDOR, typecheck/build na branch. QA mobile/desktop/acessibilidade e Modo Essencial, com evidências e distinção entre mocks e motor real.

ENTREGA: PR Draft W11 com SHA, UI mapa/lista, domínio/algoritmos/adapters, testes realizados de verdade, matriz de licenças e riscos de custo, proposta mínima de patch W0 ao W10 e handoff claro para W9. Sem merge/deploy, aquisição de serviço ou alteração de IAM/Rules.

REFERÊNCIAS: https://maplibre.org/maplibre-gl-js/docs/ ; https://github.com/VROOM-Project/vroom ; https://github.com/Project-OSRM/osrm-backend ; https://developers.google.com/waze/deeplinks ; https://developers.google.com/maps/documentation/urls/get-started ; https://developers.google.com/maps/documentation/route-optimization/overview ; https://operations.osmfoundation.org/policies/tiles/ .
~~~

**Controle de execução atualizado:** W11 pode começar em paralelo a W6–W8, restrito a seu namespace e à fundação W0; contratos novos de collections/actions pertencem a W10. W10 faz primeiro a integração técnica necessária a W9, que conserva o domínio de entregas. W10 conclui depois de W9/W11, preservando isolamento, segurança e rollback. W11 não cria estoque nem entrega; W9 não implementa mapa/otimizador. O mapa é opcional até o gate de piloto e a indisponibilidade de fornecedor externo não bloqueia roteiro manual; não confundir módulo em preparação com funcional. Nenhum Worker faz merge/deploy. Evidenciar resultados sem simular testes.


## EXPANSÃO R4 — PERFIS MULTI-CNPJ E INTEGRAÇÃO FISCAL WLG (06/11/2026)

**Decisão de produto:** a mesma pessoa autenticada pode gerenciar dois ou mais CNPJs em perfis empresariais separados. Cada perfil tem seu próprio workspace `supplierCompanyWorkspaces/{companyId}`, membros e autorização, clientes, catálogo, estoque, compras, financeiro, documentos e **conexão WLG por CNPJ**. Trocar o perfil altera somente o contexto autorizado e a interface; nunca mistura dados nem cria uma segunda identidade Firebase Auth.

**Pesquisa e restrição:** a WLG anuncia API gratuita REST, NF-e 55/NFC-e 65 e multiempresas (por `empresaId`), com autenticação `clientId/clientSecret` e emissão assíncrona. **Não há comprovação pública de que as credenciais WLG sejam individualmente limitadas a um único CNPJ.** Seus Termos (versão 01/11/2026) vedam revenda/disponibilização da plataforma a terceiros sem autorização; **uso comercial no EMPROVEX exige confirmação escrita da WLG**, embora exista publicidade de integração ERP. A gratuidade pode mudar com aviso. Nada disso autoriza emissão fiscal de produção agora.

**Plano de arquitetura, fontes legais, contratos, riscos e gates:** [PLANO_MULTI_CNPJ_WLG_W12_W15_2026-11-06.md](./empresas/PLANO_MULTI_CNPJ_WLG_W12_W15_2026-11-06.md).

**Execução:** W10 está integrando W1–W8 na PR #520. W12 e W13 podem construir em paralelo apenas em escopos isolados e com mocks; o W10 integra mudanças compartilhadas de `companySession`, `companyAuthz`, diretórios/índices e módulos. W14 depende dos contratos W12/W13, W15 da entrega W14, e o W10 continua único integrador final. Não interferir em W9/W11 ou no lançamento atual. **Nunca publicar NF-e, registrar conta na WLG, instalar segredo, contratar API ou alterar infraestrutura sem autorização específica.**

#### PROMPT W12 — Multi-CNPJ, segundo workspace e troca segura de perfil (paralelo com W13)

~~~text
/goal Você é o Worker W12 de Perfis Multi-CNPJ do EMPROVEX Empresas. Acesse aprov-hgesm/Controles-de-Empenhos---Aprov, leia o Memorial Oficial, a auditoria R1-M, o plano docs/empresas/PLANO_MULTI_CNPJ_WLG_W12_W15_2026-11-06.md, W0 PR #511, W3 PR #514, W4 PR #512 e W10 PR #520 no SHA vigente. Execute código real e testes no seu escopo, em branch isolada e PR Draft, sem merge/deploy.

MISSÃO: permitir que o MESMO UID Firebase Auth de usuário empresarial autorizado seja titular/membro de dois workspaces independentes (CNPJ A e CNPJ B), com escolha de perfil ativo, alternância sem novo login e listagem apenas dos perfis efetivamente autorizados. Cada CNPJ mantém seus próprios registros, credenciais WLG, estado fiscal, usuários, papéis, pedidos, estoque e financeiro. Não compartilhar dados entre CNPJs nem criar segunda conta Auth do mesmo usuário. Não tratar o CNPJ como autoridade para acesso: antes de retornar qualquer dado, conferir token, UID, e-mail verificado, tenant ativo, status do workspace, ownership/membership W3 ativa e capacidade por ação NO SERVIDOR.

BLOQUEIO DE FUNDAÇÃO: no W0 a estrutura platformAccounts/{email}.workspaceId e platformAuthUidIndex/{uid}.workspaceId e verifyCompanySession são SINGULARES. Não sobrescrever o workspace legível no índice nem criar conta duplicada para 'resolver' multi-CNPJ. O W12 cria modelos, validação, serviço isolado e handoff de migração ADITIVA para o W10: índice de vínculos empresa-UID para descoberta, vínculo canônico por tenant, autorização live a cada request, cadastro do segundo CNPJ com consentimento/titularidade verificável e índice CNPJ único transacional. O índice de descoberta NUNCA outorga acesso sozinho. O W10 é o único autorizado a alterar W0, login, platformIdentity, provisioning, companySession, companyAuthz, Rules e manifestos compartilhados. Antes do patch W10, rotas com mutação que dependam desse contrato devem falhar fechadas com 403/503, não simular funcionamento.

OWNERSHIP EXCLUSIVO: features/company/profiles/**, lib/company/profiles/**, app/api/company/profiles/**, testes e docs dentro desses diretórios. O W12 pode criar componentes de seletor de perfil autocontidos, mas NÃO editar app/empresa/**, components/company/**, features/company/modules.ts ou sessão W0. Não tocar login de fundador Google/setores militares, dados reais, billing, Cloud Run ou IAM.

CASOS FUNCIONAIS: criar/propor cadastro adicional de CNPJ mediante ação do titular validada por servidor e idempotency-key; mesmo e-mail/UID entra em A e B com papéis distintos, inclusive convite W3 por empresa; listar apenas perfis A/B autorizados e ativos; selecionar B a partir de A após revalidação e exibir identidade CNPJ/nome claramente; ao trocar, invalidar queries, cache e estados do workspace anterior, revalidar todas as APIs; empresa suspensa/revogação imediata bloqueia acesso. Usuário com um único perfil mantém UX do W0 compatível. Jamais ocorrer fallback empresa→setor nem setor→empresa por erro de sessão.

SELEÇÃO SEGURA: companyId solicitado é somente seletor, não autorização; exigir membership/owner real no tenant, refresh do contexto e escopo em cada request. Para sessão de perfil usar token/cookie autenticado ao UID com expiração, proteção contra CSRF se aplicável e atributos Secure/HttpOnly/SameSite; token JWT Firebase e seleção não dispensam validação live. Convite para B não promove automaticamente a owner de B. Nenhuma identidade de B pode usar credenciais WLG de A.

TESTES MÍNIMOS REAIS: um UID titular de A e B, um UID só de A, terceiro UID sem vínculos, A e B com CNPJs distintos, aceitação/negação de convites, mudança de papéis, revogação em sessão aberta, suspensão, registro concorrente do mesmo CNPJ, pedido repetido com mesma idempotency-key, alternância sob duas abas, requisições A em trânsito durante mudança para B, URLs forjadas para companyId de outro tenant, perfil inexistente, conta de setor/fundador intacta. Testes puros e Auth/Firestore Emulator demo se o patch W10 estiver integrado em base de QA; caso contrário declarar os testes dependentes SKIPPED e não inventar resultado. npm run typecheck, npm run build e testes de contrato no head.

ENTREGA: PR Draft W12 com SHA, modelos, componentes e testes, matriz de incompatibilidade W0/W3, patch pequeno proposto ao W10 para índices/guard/novos fluxos, contrato ProfileSelection e parecer GO/NO-GO. Não alterar arquivos reservados do integrador, não fazer merge ou deploy.
~~~

#### PROMPT W13 — Conexão WLG isolada por CNPJ e cliente de API fiscal (paralelo com W12)

~~~text
/goal Você é o Worker W13 — Conector WLG de emissão fiscal do EMPROVEX Empresas. Leia o repositório aprov-hgesm/Controles-de-Empenhos---Aprov, o Memorial Oficial, a auditoria R1-M, o plano Multi-CNPJ/WLG, W0 PR #511, W3 PR #514, W5 PR #515 e W10 PR #520. Consulte as fontes oficiais WLG e Swagger no momento da implementação. Implemente adapter, contratos e testes reais de mocks em branch isolada, PR Draft. Sem merge/deploy e sem credenciais produtivas.

ESCopo/OWNERSHIP EXCLUSIVO: lib/company/fiscal/wlg/**, app/api/company/fiscal/connections/**, testes/handoff próprios. Propor interfaces de credenciais e guarda segura para W10 em vez de editar contratos W0, IAM/Rules, Secret Manager, package-lock, scripts CI globais, app/empresa ou código de outro Worker. Toda API fica server-only e exige requireCompanyContext e role fiscal/admin autorizada. Nenhum endpoint mutável fica operacional sem os novos contratos/flags aprovados por W10.

MISSÃO: criar WLGConnection segregada por workspace/CNPJ com provider='wlg', empresaId do provedor validado, ambiente homologacao/producao, estado de conexão, referência à credencial, dados de verificação de emitente, versão/rotação e auditoria. O mesmo usuário que administra CNPJ A e B enxerga somente a conexão do perfil selecionado. Preferir um par clientId/clientSecret diferente PARA CADA CNPJ se a WLG permitir; se a WLG oferecer apenas credencial da conta multiempresa, documentar escopo real e implementar um binding inviolável servidor↔workspace↔WLG empresaId↔CNPJ. Nunca aceitar empresaId, CNPJ, segredo ou ambiente escolhidos pelo navegador como autoridade para emissão. Integração comercial depende de permissão escrita do fornecedor.

CONTRATO PROVEDOR: confirmar Swagger oficial https://fiscal.wlgsistemas.com.br/swagger ; autenticação pública documentada POST /api/v1/auth/token com clientId/clientSecret, Bearer temporário (site informa 1 hora), POST /api/v1/nfe com empresaId/tipoAmbiente, processamento assíncrono operationId, GET /api/v1/operacoes/{id}, download XML e DANFE após autorização. Validar no Swagger os campos e códigos exatos, endpoints de CC-e/cancelamento, idempotência, quotas, eventuais webhooks e prova emitente/empresaId, sem inventar contratos ausentes. Criar interface FiscalProvider pluggable e mocks fiéis para POST 202, token expirado, 401/403, timeout, 429, erro/rejeição, status prolongado e arquivo divergente; usar fetch com allowlist fixa de host WLG, timeout, backoff controlado, rate limiting e nenhuma URL externa enviada pelo usuário.

SEGREDOS: clientSecret e token de acesso somente servidor, guardados em Secret Manager/armazenamento criptografado aprovado, separados por companyId e ambiente, sem mostrar depois do cadastro e sem persistir em Firestore puro, repositório, cookies, frontend, logs ou traces. WLG gerencia o certificado A1 conforme seus próprios termos; não copiar PFX/senha para EMPROVEX. Não solicitar segredo real nem criar contas durante desenvolvimento. Rotação/revogação e estados 'desconectada' devem suspender emissões sem bloquear demais módulos.

LIMITAÇÃO CONTRATUAL P0: os Termos WLG 2026-11-01 vedam disponibilizar/revender a Plataforma a terceiros sem autorização. Obter como pendência formal a resposta escrita que habilite SaaS multi-cliente, escopo de credenciais/empresaId, modelos/UFs, retenção e custos. Não marcar GO de produção por anúncio 'grátis'. Em caso de dúvida de escopo, manter somente mocks e homologação explicitamente autorizada.

TESTES OBRIGATÓRIOS: duas conexões A/B com empresaId diferentes, credenciais separadas ou isolamento lógico conforme contrato de provedor, troca de perfil, tentativa de client mandar empresaId de B, resposta de WLG identificando CNPJ divergente, secrets não serializados/logados, token vencido, revalidação do emitente, timeout, dados inválidos, retirada de credencial, concorrência e retry sem efeitos fiscais reais. Executar TypeScript e build; teste de WLG real SOMENTE em homologação, com conta de teste autorizada e evidência separada. Não afirmar uso real se só mock foi exercitado.

ENTREGA: PR Draft W13 com código, suíte executada, contrato FiscalProvider/WLGConnection, handoff para W14 e W10, matriz segurança/termos e parecer GO/NO-GO. Não publicar, emitir notas, contratar API nem modificar dados fiscais reais.
~~~

#### PROMPT W14 — Motor de NF-e, autorização assíncrona, XML e DANFE (depois dos contratos W12/W13)

~~~text
/goal Você é o Worker W14 — Emissão de NF-e EMPROVEX Empresas. Leia o Memorial Oficial, plano Multi-CNPJ/WLG, auditoria R1-M, W1 #513, W5 #515, W8 #517, W10 #520 e handoffs W12/W13. Inicie somente após receber contratos W12/W13 verificáveis (não exige merge na main). Execute código/testes e PR Draft em branch isolada. Sem merge/deploy nem emissão fiscal real.

OWNERSHIP: lib/company/fiscal/issuance/**, app/api/company/fiscal/nfe/**, testes/documentos próprios. W13 é dono do cliente WLG, W12 dos perfis e W10 dos contratos compartilhados/guard/shell. Não editar W1/W5/W8, app/empresa/**, CI global, IAM/Rules ou faturamento do EMPROVEX. Se faltar contrato W10, construir domain service, adapter e testes sem endpoint produtivo; operações não autorizadas falham fechadas.

MISSÃO: implementar entidade FiscalIssue/NFeIntent com companyId/workspaceId, CNPJ do emitente obtido do workspace AUTORIZADO, WLG connectionId vinculada ao mesmo tenant, ambiente, série/número por emitente/ambiente, referências verificadas a pedido OM/cliente, itens e tributação fornecidos e conferidos pelo responsável fiscal, revisão e aprovação humana explícita, autorizações por ação/role, trilha de auditoria e idempotência. Não converter automaticamente preço de venda W1 em tributação, não usar preço histórico W2 como custo; NCM, CFOP, CST/CSOSN, ICMS, PIS, COFINS, impostos, destinatário e natureza da operação exigem validação e conferência responsável. Faturas não devem ser atribuídas a outro CNPJ por alternância de perfil.

MÁQUINA DE ESTADOS: draft→ready_for_review→approved→submitted/processing→authorized|rejected|uncertain e eventos de cancelamento/CC-e somente quando Swagger confirmar suporte, prazo, condições e status. HTTP 202 da WLG significa PROCESSANDO, jamais nota autorizada. Somente guardar chave NF-e, protocolo e data de autorização quando resposta confirmada; conferir emitente/CNPJ, chave, ambiente e consistência do XML/protocolo antes de mudar para authorized. XML autorizado e DANFE são documentos distintos e devem ser arquivados privadamente com hash e acesso do tenant. O DANFE sozinho não é evidência suficiente.

SEGURANÇA CONTRA DUPLICAÇÃO: reservar série/número/intenção por CNPJ+ambiente em commit CAS/índice idempotente; pedido repetido mesma chave retorna status existente. Se houver timeout depois do POST e antes do operationId, não reemitir cegamente; marcar 'uncertain', consultar API ou solicitar reconciliação humana conforme contrato real. Não prometer entrega exatamente uma vez pela API remota sem prova de idempotência do provedor. Polling com backoff, limites, orçamento e respostas negativas; não bloquear request indefinidamente. Credencial da WLG nunca acessível por navegador.

INTEGRAÇÕES: aproveitar dados de pedido/cliente W1 apenas após validar ownership; arquivo XML/DANFE via W5 storage privado após integração formal, com fallback de exportação privada sem public URL; W8 permanece único dono de contas a receber/pagar, sem criar ou liquidar automaticamente título financeiro após autorizar NF-e. A nota não confirma entrega W9 nem atesto da OM. Não sincronizar com sistema fiscal em tempo real se WLG ou SEFAZ indisponíveis; mostrar estado honesto.

TESTES: 2 CNPJs A/B do mesmo UID, papéis distintos, CNPJ de emitente divergente, empresa suspensa, conexão ausente, nota rejeitada, processamento longo, timeout ambíguo, retry concorrente, número/série duplicados, XML/DANFE e hash, cancelamento autorizado vs rejeitado, troca de perfil durante emissão, NF parcial vs pedido e falha WLG. Usar mock WLG e Auth/Firestore Emulator demo onde endpoints completos existirem; provas de homologação WLG real só se habilitadas por permissão e conta de teste. Executar testes unitários/integração, typecheck e build; registrar PASS/FAIL/SKIPPED.

ENTREGA: PR Draft W14 com SHA, FSM, handlers, modelos, testes, referência de armazenamento e handoff W15/W10. Parecer GO técnico só para desenvolvimento/homologação, NO-GO para emissão em produção até autorização WLG, revisão fiscal e E2E.
~~~

#### PROMPT W15 — Portal de emissão por CNPJ e QA de isolamento (após W14)

~~~text
/goal Você é o Worker W15 — Experiência de Emissão Fiscal e QA Multi-CNPJ do EMPROVEX Empresas. Leia o repositório, Memorial Oficial, plano Multi-CNPJ/WLG, handoffs W12/W13/W14, W4 #512, W5 #515 e W10 #520. Inicie após os contratos W14 estarem definidos. Execute componentes e testes reais, PR Draft isolada; sem merge/deploy.

OWNERSHIP: features/company/fiscal/**, components/company/fiscal/** e testes em tests/company/fiscal/**, além de handoff próprio. NÃO editar app/empresa/**, features/company/modules.ts, lib/server/companySession.ts, W0, W12–W14, regras, IAM ou CI global. W10 integra menu, guards, rotas e teste completo. Se faltar backend ativo, usar adapter com estado 'indisponível/em preparação', sem fingir emissão executada.

MISSÃO: criar tela fiscal legível no desktop/mobile: nome empresarial + CNPJ ativo sempre visíveis, troca de perfil explícita reaproveitando seletor seguro W12; conexão WLG isolada por perfil com status da credencial/certificado e ambiente (sem revelar secrets); formulário de prévia/revisão da NF-e, dados fiscais editáveis por usuário autorizado, confirmação de emissor e destinatário, botões de envio apenas quando conta autorizada, status assíncrono com reconsulta, rejeição com causa, opção de retomar consulta, XML e DANFE privados, histórico de eventos, cancelamento/CC-e apenas se suportados. Indicar claramente HOMOLOGAÇÃO (sem valor fiscal) vs PRODUÇÃO, e 'em processamento' vs 'autorizada'. Evitar envio automático ao abrir tela, ao trocar CNPJ ou ao confirmar pedido OM.

CONDIÇÕES UX: ao alternar A→B, cancelar requisições e limpar estado/cache de A; o novo perfil não herda a conexão WLG, produto, cliente, rascunho fiscal ou notas abertas de A. Impedir submissão de formulário com empresa diferente da confirmada; exigir confirmação repetida se perfil alterado. Garantir Modo Essencial, acessibilidade, teclado, leitores de tela, mensagens de erro humano compreensíveis, paginação e estados loading/partial/unavailable. Sem dados fiscais sensíveis em localStorage, captura pública ou logs de console.

QA EXECUTÁVEL: criar testes com fixture de um UID autorizado a dois CNPJs, outro UID só para A, membros W3 com papéis diferentes, troca A↔B, A tentado na API B, leitura/download de XML B por A, usuário sem permissão fiscal, revogação live, suspensão, WLG conta/empresaId trocados, credencial inválida, WLG fora do ar, HTTP 202 processando, rejeição, autorização e dois cliques no botão emitir, retry após timeout ambíguo, numeração e revogação. Verificar regressão fundador/portal setorial, upload privado W5 e integração financeira W8 sem baixa automática. Executar testes de componente, Playwright em demo se possível e build/typecheck; registrar honestamente testes que dependem da integração W10.

HANDOFF: PR Draft W15 com capturas de QA quando reais, SHA, lista de testes PASS/FAIL/SKIPPED e matriz de fluxo, patch proposto de montagem ao W10 e parecer GO/NO-GO. A configuração WLG de produção deve permanecer bloqueada até confirmação escrita do fornecedor e autorização do piloto; nunca usar contas de clientes reais em QA.
~~~

#### PROMPT W10 — ETAPA III: integração conjunta W12 + W13 + W14 (após W10-II certificado)

**Status:** prompt final de execução registrado em 06/11/2026, ainda **não executado**. Nova PR Draft de código baseada no HEAD atual de #525, não na main. Importar W12 #521, W13 #522 e W14 #526 sem duplicar W13 (W14 já deriva de W13). **W15 integra depois, em checkpoint separado.** Nenhuma emissão real, merge, deploy ou credencial WLG.

**Cópia autônoma do prompt:** [W10_ETAPA_III_PROMPT_INTEGRACAO_MULTI_CNPJ_WLG_2026-11-06.md](./empresas/W10_ETAPA_III_PROMPT_INTEGRACAO_MULTI_CNPJ_WLG_2026-11-06.md).

~~~text
/goal Você é o Worker W10 — Etapa III (Integração Multi-CNPJ + Fiscal WLG) do EMPROVEX Empresas.

MISSÃO EXECUTIVA
Execute efetivamente, em código e testes, o checkpoint de integração dos módulos W12, W13 e W14 com o W10 — Etapa II. Não crie implementação paralela dos Workers, não altere a main e não se limite a um plano. Abra uma nova PR Draft de integração, sem merge, deploy, emissão de NF-e real, criação de credenciais/contas WLG ou liberação de piloto. Este checkpoint é técnico, não autorização de uso comercial.

REPOSITÓRIO E LEITURAS OBRIGATÓRIAS
Repo: aprov-hgesm/Controles-de-Empenhos---Aprov.
- PR #510 — docs/EMPROVEX_EMPRESAS_MEMORIAL_OFICIAL.md, Auditoria R1-M e docs/empresas/PLANO_MULTI_CNPJ_WLG_W12_W15_2026-11-06.md.
- W0 #511 e W3 #514: diretórios de identidade, sessões, cadastro, memberships e RBAC.
- W10 Etapa I #520, HEAD de referência 46af306ea67e2c5d45f8a2af922ef2781e154212.
- W10 Etapa II #525, HEAD de referência 49c8670a66ad858724454eff0683696dcb7efcd3; docs/empresas/W10_ETAPA_II_HANDOFF_2026-11-06.md; workflows W10/W11/Core/Fast/Visual-R2.
- W12 Perfis #521, HEAD de referência f6fe0743df07d34c5161de58e985e30857d2060e; lib/company/profiles/HANDOFF_W12_2026-11-06.md.
- W13 WLG #522, HEAD de referência d17c45d9e809332a9a396a20f12391ed5322bed6; lib/company/fiscal/wlg/W13_HANDOFF.md.
- W14 NF-e #526, HEAD de referência 9f188001741d8ecc6eae9b98162f0f8c6cc15003; lib/company/fiscal/issuance/W14_HANDOFF.md.
- W1 #513 (pedidos/NE), W4 #512 (shell), W5 #515 (arquivos privados), W8 #517 (financeiro) e contratos W9/W11 já integrados em #525.
Antes de qualquer escrita consulte HEADs atuais, base, mudanças pendentes, PRs e escopos; os SHAs acima são marcos, não ordens para sobrescrever atualizações posteriores.

BASE / BRANCH / DEDUPLICAÇÃO
1. CRIE branch isolada de integração a partir do HEAD VIGENTE de #525, por exemplo integration/emprovex-empresas-w10-stage3-fiscal-multicnpj-20261106. Não partir da main nem do W10-I.
2. Importe por blobs/commits seletivos os arquivos exclusivos W12 (#521), W13 (#522) e W14 (#526), preservando SHA e árvore original de cada módulo; documente matriz de proveniência. Atenção: a branch W14 deriva da W13, logo o conector W13 já está no histórico de W14 — NÃO duplicar arquivos nem motores. Resolver incompatibilidades como integrador, sem reescrever os módulos indiscriminadamente.
3. Só o W10-III altera arquivos transversais: lib/server/companySession.ts, lib/server/companyAuthz/**, lib/server/companyMembership/**, lib/company/contracts/**, provisioning/índices de identidade, endpoints comuns, app/empresa/**, componentes de navegação/conta e pipelines de integração. Compatibilize patches com W0–W11 sem enfraquecer segurança. Não tocar áreas militares, Almoxarifado, Warehouse, Eleonor, billing, Firestore Rules/IAM/Cloud Run produtivos, senhas ou produção.
4. Se W15 já tiver PR, leia seu handoff para compatibilidade e NÃO absorva antecipadamente se sua integração ainda não estiver certificada. W15 terá checkpoint próprio de UX/QA.

ETAPA III-A — MULTI-CNPJ REAL NO SERVIDOR (P0)
- Manter um único Firebase Auth UID para o mesmo usuário em dois ou mais workspaces empresariais/CNPJs independentes. A mesma conta pode ser owner em A e member em B; nunca herdar owner ao trocar.
- Corrigir o modelo singular de W0: platformAccounts/{email}.workspaceId e platformAuthUidIndex/{uid}.workspaceId e a seleção singular companyMemberAuthIndex/{uid}. NÃO sobrescrever esses vínculos para alternar empresa nem criar outra conta Auth para a mesma pessoa.
- Implementar extensão ADITIVA: índice de descoberta limitado por UID e vínculos canônicos verificáveis por companyId (ownerBinding e/ou membership W3), incluindo unicidade transacional via platformCnpjIndex, aprovação de representação do segundo CNPJ por fonte confiável do servidor/administrador, CAS, idempotência e auditoria. Índice de descoberta NUNCA concede autorização sozinho.
- Provisionamento do segundo CNPJ em Auth/Firestore Emulator real (projeto demo-* e loopback), com transação atômica, conflito e rollback; não autorizar cadastros reais ou usar simples declaração/checkbox do usuário para comprovar representação.
- Integre GET/POST/select de /api/company/profiles e CompanyProfileSwitcher no portal. Cookie __Host- com HMAC e expiração curta, ligado a UID/auth_time, Secure/HttpOnly/SameSite; decisão de CSRF para qualquer mutação com cookie. O cookie é apenas SELEÇÃO; cada request valida ID token, UID, e-mail verificado, status ativo, empresa selecionada, papel/capability live e ownership do recurso.
- Em duas abas, mudança A→B invalida estado/requests/caches anteriores; respostas tardias de A não aparecem em B. Rotas sem perfil ou de clientes legados com apenas um workspace mantêm compatibilidade segura. Tenant A jamais acessa entidade ou conexão WLG B. Revogação/suspensão são reconhecidas imediatamente. Sem fallback empresa↔setor/fundador.
- Não usar companyId, CNPJ, empresaId WLG, claims ou papel vindos de query/body/localStorage como prova de acesso. A fonte canônica é autorização live em servidor para a empresa ativa e o recurso.

ETAPA III-B — WLG SEGREGADA POR CNPJ (P0)
- Integre FiscalProvider W13 server-only com WlgConnection por workspace/CNPJ/ambiente; bindings de companyId↔empresaId WLG↔CNPJ/verificação de emitente auditáveis. Confirmar o escopo de credenciais efetivo no fornecedor; não presumir clientId/clientSecret exclusivo por CNPJ. Bloquear configuração com prova insuficiente.
- Persistir apenas metadados não secretos no Firestore empresarial (fiscalConnections e coleções necessárias por contrato), com revisões CAS, auditoria e ACL. Credenciais e tokens EXCLUSIVAMENTE no servidor, via abstração de Secret Manager/serviço seguro aprovado; não criar segredo real, não alterar IAM, não colocar segredo em Firestore, repo, HTML, resposta, rastreio nem logs. Se SecretResolver real ou permissão IAM não estiver pronta, manter 503/flag OFF e fornecer teste com falso cofre em Emulator.
- Ações próprias fiscal:read, fiscal:configure, fiscal:approve, fiscal:issue e fiscal:download, ou equivalentes tipados/menor privilégio definidos de forma central, com matriz W3 e revogação live. Ações transitórias accountsReceivable:read/members:write não podem, por si só, liberar emissão.
- Rotas /api/company/fiscal/connections devem listar apenas estado público do perfil ativo, guardar configurações somente se o backend realmente suportar persistência/ACL e rejeitar empresaId/CNPJ divergentes. Desconexão/rotação invalida cache e bloqueia emissão sem afetar finanças logísticas.
- Verificar contrato oficial WLG/Swagger atualizado, segurança HTTPS, rate limit e política de custos, sem inventar API de eventos. WLG anuncia POST assíncrono; HTTP 202 significa processamento, nunca autorização. Uma falha/timeout após POST não autoriza novo POST automático.

ETAPA III-C — MOTOR W14 COM PERSISTÊNCIA E INTEGRIDADE FISCAL (P0)
- Integrar FSM W14 com W13 e W12 em servidor; rascunho→revisão→aprovação humana explícita→submissão/consulta→autorizada|rejeitada|incerta. Campos fiscais NCM/CFOP/CST/CSOSN/tributos e destinatário exigem conferência humana; o EMPROVEX não inventa tributação.
- Implementar FiscalStore transacional com idempotência e reserva de número/série por tenant/CNPJ/ambiente, CAS e auditEvents; revalidar pedido/linhas/quantidades parciais W1 e revisão antes de enviar. Retry com mesma chave consulta resultado; timeout ambíguo permanece uncertain e exige reconciliação, nunca reenvio cego.
- Criar adaptadores server-only para verificação de XML autorizado (assinatura XMLDSig, cadeia e protocolo SEFAZ, chave/emitente/ambiente, cStat adequado, integridade) e DANFE com proveniência e vínculo comprovados; armazenar ambos de forma tenant-private via mecanismo W5 e hashes. Se não existir implementação confiável do verificador/arquivo, a autorização e disponibilização fiscal FALHAM FECHADAS; não substituir por regex, mock ou PDF arbitrário.
- APIs fiscais GET/POST só devem sair do status 503 quando todas as dependências críticas estiverem ligadas e testadas. Caso a homologação externa ou segredos não estejam autorizados, manter operações reais desabilitadas e testar pipeline integral com provedor simulado no Firestore Emulator — não anunciar NF-e autorizada real.
- NF-e não confirma despacho/entrega/atesto, não cria baixa financeira no W8, não emite automaticamente ao trocar CNPJ/abrir tela. Cancelamento/CC-e ficam bloqueados enquanto contrato WLG não comprovado. Preservar W1–W11 e não criar ledger fiscal-financeiro duplicado.

TESTES OBRIGATÓRIOS (EVIDÊNCIAS REAIS)
A. Unitários de W12/W13/W14 e regressão W0–W11 no HEAD; W13 deve executar realmente node --test lib/company/fiscal/wlg/w13.test.mjs (não aceitar só execução isolada de V8). Separar unitários dos testes que exigem Emulator, como feito em W10-II.
B. Auth + Firestore Emulator REAL com 1 UID em CNPJ A e B, outro UID só A, owner A/member B, suspenso/revogado, duas abas alternando, convite W3 multiempresa, index CNPJ concorrente, falha de transação, idempotência e acesso cruzado negado; índices legados W0 permanecem íntegros.
C. CNPJ A/B com WLGConnection diferentes; requests forjados com empresaId de outro perfil, segredo exposto, perda de permissão, rotação/revogação, 401/403, 429/5xx, HTTP 202, rejeição, timeout antes/depois do POST, reconciliação, confirmação de XML/emitente incompatível, XML inválido, DANFE não autenticado; tudo em MOCk WLG declarado.
D. Persistência Firestore REAL de número/série/reserva/CAS, mesmo idempotencyKey replay, outra chave não duplica emissão, crash após reserva antes de resposta, duas abas e mudança de perfil durante fluxo, pedido W1 alterado/quantidade parcial inválida; sem enviar nota real.
E. Fluxo de navegador empresarial desktop/mobile/teclado quando UI W12 disponível: login empresarial, seleção A/B, cache invalidado, perfis e conexões corretos; não confundir Visual-R2 geral com E2E empresarial. W15 ainda pode estar pendente e deve ter cenário SKIPPED legítimo documentado.
F. npm ci, npm run typecheck, npm run build, Core Protection, Fast CI, W10, R1 Sync e Visual-R2. Inspecionar CI no SHA FINAL da nova PR. Relatar separadamente PASS/FAIL/SKIPPED/PENDING; não declarar CI verde de heads anteriores como certificação do novo SHA. Testes real WLG/SEFAZ só se explicitamente autorizados e com ambiente/cadastro de QA legítimo, fora do escopo padrão.

GATES NÃO NEGOCIÁVEIS
- EMPROVEX_COMPANY_PILOT_ENABLED permanece OFF fora do Emulator; flags de emissão e homologação ficam OFF por padrão. Nenhuma requisição fiscal real, cadastro de empresa, contrato comercial, mudança de IAM/Rules/Cloud Run, cobrança ou publicação sem autorização EXPRESSA posterior.
- Antes de emissão real, obter permissão ESCRITA WLG para integração no SaaS EMPROVEX e para uso por clientes terceiros, confirmar escopo seguro por CNPJ/empresaId, certificado A1 e requisitos fiscais/privacidade. A disponibilidade de API gratuita não é licença de comercialização. Consulta Swagger deve ser fonte atual; se indisponível, bloquear capacidades desconhecidas.
- Nunca deixar uma falha de acesso de empresa derrubar login militar legítimo. Não permitir bypass por UID compartilhado com membro, revalidação de perfil ou segredo global.
- Se integração fiscal depender de Secret Manager sem IAM, assinatura fiscal confiável, emissão remota e armazenamento ainda ausentes, pode dar GO ao modelo/testes isolados, mas a API de emissão permanece 503 e o parecer de operacionalização é NO-GO.

ARQUIVOS E DESTINO
Crie somente uma nova branch de integração e nova PR Draft W10-III baseada em #525, sem alterar a #525 ou PRs originárias. Como integrador, você pode tocar arquivos compartilhados empresariais estritamente necessários, registrando cada alteração. Não mesclar as PRs originais; importar código seletivo com origem comprovada. Se encontrar conflito com W15, não sobrepor trabalho alheio, registrar handoff.
Crie docs/empresas/W10_ETAPA_III_HANDOFF_2026-11-06.md na branch de código, com proveniência de cada blob/commit, arquitetura e contratos alterados, testes reais e matriz de bloqueios, operações desativadas, rollback e SHA final. Atualize a descrição da PR com links de CI.

RESULTADO ESPERADO
Entregar perfis empresariais A/B efetivamente isolados em QA, vinculação WLG por CNPJ e motor de NF-e integrado em modo simulado com persistência durável e proteções verificáveis; se houver dependências externas sem autorização, entregar o máximo seguro e manter funções bloqueadas. Pareceres separados: (1) GO/NO-GO técnico da branch W10-III; (2) GO/NO-GO multi-CNPJ com teste Auth/Firestore; (3) GO/NO-GO para interface W15; (4) NO-GO comercial/WLG real até evidências. Nenhum merge/deploy ou emissão produtiva.

EXECUTE EFETIVAMENTE. Sem burocracia desnecessária, sem inventar testes, sem afrouxar autorização, sem fornecer credenciais reais ao repositório.
~~~

**Gate fiscal:** W12/W13 podem iniciar o núcleo isolado em paralelo. W14 inicia após contratos; W15 após W14. W10 continua responsável por integração global e patches de identidade/guard. **Sem autorização escrita WLG para SaaS, sem verificação do escopo de cada credencial/CNPJ e sem E2E, o parecer será NO-GO para emitir comercialmente**, independentemente de CI verde. Preservar o memorial histórico e os fluxos de Aprovisionamento, Almoxarifado, NF militar, Eleonor e Cloud Run.

---
## CHECKPOINT R1-M — Retomada e sincronização com main (05/11/2026)

**Estado: desenvolvimento reativado em branch isolada, PR para revisão; ainda NÃO integrado nem publicado.** 
Base auditada: `main@80a2f3a3e30cfc31521be6ce05324da3cc952477`. Origem de código empresarial: PR #447 (`83a9d7d2eb3b3863c25a385a6339c9c24fd854cb`), com referência adicional de #419.

**Diferenças e decisões de reconciliação:**
- #419 estava 390 commits atrás da main e #447, 301. Não fazer merge direto das PRs legadas; portar seletivamente componentes empresariais.
- Identidade `company`, CNPJ, índices, endpoints Admin e sessão autenticada pertencem ao módulo empresarial, sem UG, sem Warehouse, sem herança de billing setorial.
- Manter integralmente o shell operacional recente ao extraí-lo para `app/login/OperationalEntry.tsx`; o novo gateway deve resolver empresa no servidor antes de montar listeners/setores. Preservar acesso Google do fundador existente na main.
- Admin mostra Empresa e Setor sob `Cadastrar cliente`. Não habilitar seletor de Almoxarifado enquanto a fundação setorial correspondente não estiver incorporada à main; a evolução W9 segue independente.
- Filtrar registros `company` no diretório de setores, preservar os componentes 3D, sessões e a experiência Normal/Essencial da main.
- `getGoogleAccessToken` do backend vigente continua compatível com Cloud Run (identidade gerenciada). Nenhuma cópia de service-account JSON.
- Rules atuais exigem `accountType == 'sector'` para autorização operacional. Empresa usa somente API própria com verificação UID/workspace. **Não publicar Rules novas.**
- Ajustar testes de regressão que localizavam o shell antigo em `app/login/page.tsx` para o novo `OperationalEntry.tsx`, sem enfraquecer verificações.
- O portal /empresa permanece shell R0: sem criar falsos dados de pedidos, estoque, financeiro, cobrança ou integrações com OMs.

**Gates antes de integração/publicação:** typecheck, build, testes de núcleo/rotas, verificação de autorização por Auth/Firestore Emulator (fundador, setor legado, empresa, UID/CNPJ, isolamento), depois QA real e aprovação de publicação. Nenhuma conta real ou deploy nesta etapa.

---

## CHECKPOINT R0 — Decisão de integração e estratégia de branches (30/10/2026)

> **GO/NO-GO do integrador: NO-GO para merge da PR #419 e para produção até resolver regressão E2E de login setorial, reconciliar os contratos de verificação legados e demonstrar cadastro/login empresarial QA.** É autorizado continuar desenvolvimento em branches isoladas.

**Situação comprovada da PR #419**, commit `2281ac7deddc5271354e1f1faef441bc17246472`:
- Fast CI **PASS** — run [40996011454](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40996011454).
- Core Protection **PASS** — run [40996011604](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40996011604).
- W4 Five-Worker Integration Evidence **PASS** — run [40996011446](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40996011446).
- VISUAL-R2 Integrity Audit **FAIL** — run [40996011641](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40996011641): testes estáticos antigos referenciam o shell que foi extraído de `app/login/page.tsx` para `app/login/OperationalEntry.tsx` (documentos, Drive, avisos, auth híbrida, SaaS, rotas); o Browser E2E também **falhou funcionalmente**, com resposta `401` de `/api/company/session` para sessão setorial no emulador e falta de renderização da navegação principal. Não presumir falso positivo sem validar a transição de login.
- O ambiente `/empresa` R0 ainda não foi validado em ponta a ponta com conta empresarial real de QA.

**Decisão de versionamento:** integrar na `main` por marcos `R0`, `R1`, `R2` após homologação de cada um, **sem manter toda a expansão em uma branch longa**. Usar branches de Worker e PRs por onda; não mesclar PR #419 enquanto os bloqueios de R0 persistirem. Permanecem desativados os deploys automáticos por Git (`vercel.json: git.deploymentEnabled=false` no estado inspecionado), mas merge não constitui aprovação de deploy nem ativação comercial. Publicação na Vercel depende de autorização separada e smoke test prévio.

---

## CHECKPOINT R0 — W1/W2/W3 em integração (30/10/2026 UTC)

> **PRECEDÊNCIA DE STATUS:** este checkpoint reflete a execução inicial da R0; prevalece sobre a indicação histórica "NÃO IMPLEMENTADO" do plano mestre abaixo. **Código em PR de integração, não homologado, não mesclado à main e não publicado em produção.**

- **W1 (identidade, CNPJ, provisionamento e APIs):** [PR #417](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/417), branch `feat/empresas-r0-w1-identity`, SHA `352a7f4af92f2d55c20b08beb2b4289afbfbe1f6`.
- **W2 (cadastro e diretório no Admin):** [PR #416](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/416), branch `feat/empresas-r0-w2-admin`, SHA `6e09759a380d737c757d2a72a006b328f8c0ed42`.
- **W3 (login, resolução de sessão e portal `/empresa`):** [PR #418](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/418), branch `feat/empresas-r0-w3-portal`, SHA `202cab0e0e8ac00918709f4fc44d418a5e6377b0`.
- **Integração:** [PR #419](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/419), branch `integration/empresas-r0-wave-20261029`, Draft. Reúne os 24 arquivos entregues pelos três Workers e correções de contratos.
- **Correções já introduzidas na integração:** persistência de `companyEmail`, `postalCode`, `addressNumber`, `addressComplement`; validação única de CNPJ entre formulário e servidor; filtragem de workspaces `company` do diretório militar legado; navegação empresarial por transição de documento, em respeito ao incidente P0 de rotas; adaptação dos testes de núcleo para examinar o shell militar extraído, sem remover os gates de assinatura.
- **Gates:** revisão e CI em andamento. A primeira execução da PR #419 identificou falhas no Core Protection e na navegação P0 devido à extração do shell e ao uso de links RSC; alterações corretivas já foram feitas na PR de integração. Uma execução posterior do Core Protection registrou sucesso, mas isto não certifica o conjunto, e o estado final dos demais testes precisa ser observado.
- **Sem mudanças de infraestrutura:** nenhum deploy/promote Vercel, nenhuma Firestore Rules publicada, nenhuma migração ou escrita de dados empresariais reais, nenhuma alteração de política de cobrança.
- **GO/NO-GO de produção:** **NO-GO** até CI, regressão do Aprovisionamento, teste de provisionamento e login real em workspace QA, verificação de isolamento e autorização explícita de publicação. O ambiente `/empresa` desta R0 contém shell/navegação e módulos vazios, ainda não funcionalidades logísticas/financeiras.

---


> **Documento canônico do produto EMPROVEX Empresas — Planejamento V2 (29/10/2026).**
> **STATUS: PLANEJADO / NÃO IMPLEMENTADO.** Este documento define a direção do produto e o backlog, não autoriza deploy, ativação comercial, alterações de regras ou migrações.
> O EMPROVEX Aprovisionamento continua independente. Todos os futuros recursos de fornecedores exigem isolamento de workspaces, revisão de permissões e testes proporcionais ao risco.

**Escopo prioritário:** pós-licitação; cadeia **OM → empresa licitante → fornecedor de origem**, compras, pedidos, dois cronogramas interligados, estoque leve, rotas, motorista, entregas, contas a pagar e contas a receber.

**Manutenção:** acrescentar adendos datados de decisões, fases e evidências de implantação, diferenciando explicitamente **PLANEJADO, EM PR, HOMOLOGADO e PUBLICADO**. Não alterar retroativamente o histórico. O memorial geral do EMPROVEX permanece a referência superior dos contratos legados e da publicação Vercel.

**Integridade documental:** conteúdo original do Plano Mestre V2 reproduzido abaixo, com apenas a ressalva final ajustada para registrar este commit documental.

---

# EMPROVEX EMPRESAS — PLANO MESTRE V2
## Gestão do pós-licitação, cadeia de abastecimento, compras, entregas e financeiro

**Data-base:** 29/10/2026  
**Status:** especificação e planejamento; não implementado  
**Substitui em escopo e prioridades:** `EMPROVEX_FORNECEDORES_PLANO_MESTRE_V1_2026-10-29.md`  
**Repositório a auditar e usar como base:** `aprov-hgesm/Controles-de-Empenhos---Aprov`  
**Princípio:** desenvolver em frentes/PRs isoladas sem migrar dados, alterar Rules, cobrança ou produção sem aprovação.

---

## 1. Decisão estratégica e público-alvo

**Produto:** EMPROVEX Empresas (ambiente operacional exclusivo para empresas que já conquistaram licitações e administram o atendimento de empenhos e pedidos de órgãos públicos).  
**Proposta de valor:** "Recebeu o pedido da OM? Compre do fornecedor certo, acompanhe prazos, organize entregas e controle os dois lados do financeiro."  
**Centro de gravidade:** empresa licitante/contratada, que compra de fornecedores a montante e vende/entrega à OM a jusante.

**Público primário:** distribuidores, revendedores e fabricantes contratados por OMs ou outros órgãos, particularmente gêneros alimentícios, materiais de limpeza, expediente e outros itens com entrega recorrente, parcial e multi-destino.

**Fora do núcleo inicial:** radar de editais, propostas de pregão, robôs de lances, inteligência para conquistar licitações, SICAF, BPO contábil e substituição de sistemas fiscais. Registros de licitação/ata/contrato podem existir **somente como referência do empenho** (número, processo, vigência e arquivos); uma futura aba de oportunidades será opcional e de baixa prioridade.

### Participantes e nomenclatura inequívoca
1. **OM / cliente público (comprador final):** solicita os materiais da empresa licitante e os recebe.
2. **Empresa licitante / empresa contratada (tenant pagante):** recebe a solicitação da OM, compra/obtém itens, organiza a operação, entrega à OM e faz gestão financeira.
3. **Fornecedor de origem / parceiro de abastecimento (upstream):** vende mercadorias à empresa licitante; pode ser indústria, atacadista, distribuidor ou produtor. Não confundir com a empresa licitante, também chamada de "fornecedor" pela OM.
4. **Motorista / transportador:** executa uma rota de entrega da empresa e presta contas das ocorrências.

### Princípio comercial
A empresa licitante é **o cliente que contrata o EMPROVEX**. Os fornecedores de origem podem ser gerenciados inicialmente como cadastros internos, sem exigir que assinem o SaaS. Quando houver colaboração externa, oferecer resposta a pedidos por link seguro ou acesso gratuito e restrito, sem necessidade de adquirir um plano.

---

## 2. Fluxo operacional E2E (produto-alvo)

```text
OM solicita materiais à EMPRESA LICITANTE
    ↓
Pedido da OM (vinculado a NE + itens + data desejada + condições)
    ↓
Conferência de estoque disponível e capacidade operacional
    ├─ Há saldo livre? → reserva para pedido
    └─ Não há saldo suficiente? → necessidade de compra
                                     ↓
                            Escolha de fornecedor(es)
                                     ↓
                            Pedido(s) de compra ao(s) fornecedor(es)
                                     ↓
                          Confirmação de preço, quantidade e prazo
                                     ↓
                   Previsão de chegada + alerta de risco da OM
                                     ↓
                     Recebimento parcial/total e conferência
                                     ↓
                       Reserva, separação e programação
                                     ↓
                         Rota, veículo e motorista
                                     ↓
                       Entrega à OM + evidência
                                     ↓
                Faturamento/NF + contas a receber + resultado

Em paralelo: compra → NF de entrada/documentos → contas a pagar fornecedor.
```

**Exemplo:** OM pede 500 kg de arroz para 10/11; empresa tem 100 kg livres; gera pedido a fornecedor de origem para 400 kg; fornecedor promete 06/11; conferência/separação prevista 07–08/11; programação de entrega em 09/11. Se a previsão de chegada mudar para 11/11, o pedido da OM entra em risco; não alterar unilateralmente o prazo prometido à OM.

**Relacionamentos N:M obrigatórios:** um pedido da OM pode ser atendido por estoque existente e compras em vários fornecedores; uma compra ao fornecedor pode abastecer pedidos de várias OMs; uma rota pode conter pedidos de várias OMs; entrega e nota fiscal podem ser parciais. Traçar quantidade e custo alocados por item/linha sem dupla contagem.

---

## 3. Dois cronogramas interligados

### Cronograma A — Abastecimento da empresa (inbound)
- Lista de pedidos de compra por fornecedor, produto, quantidade, data solicitada e data confirmada.
- Previsão de chegada atualizada, janela de recebimento e conferência.
- Status: rascunho → enviado → recebido pelo fornecedor → confirmado / contraproposta → em preparação → despachado → recebido parcial/total → concluído; alternativas: rejeitado, atrasado, cancelado, devolvido.
- Aceite humano de mudanças relevantes de preço, quantidades ou prazos; respostas dos fornecedores ficam registradas.
- Possibilidade de entregar diretamente à OM, quando juridicamente/operacionalmente cabível, sem simular entrada física no estoque da empresa.

### Cronograma B — Compromissos com OMs (outbound)
- Pedidos por OM, NE, item, quantidade, data solicitada pela OM e data efetivamente acordada.
- Status: novo → em análise → suprimento em andamento → disponível → separação → agendado → em rota → entregue parcial/total → conferência pendente → encerrado.
- Não confundir "motorista declarou entregue" com atesto formal da OM, liquidação ou pagamento.

### Motor de viabilidade e risco
- O prazo interno factível é calculado a partir da **última mercadoria necessária que ainda não está disponível** + recebimento/conferência + preparação + transporte + margem de segurança.
- Exibir sempre: data solicitada pela OM, prazo interno estimado, data prometida pelo fornecedor, data negociada com a OM e confiança da estimativa.
- Sinalizar risco se a data estimada de disponibilidade ultrapassar o limite para expedição; usar estados **No prazo / Atenção / Em risco / Atrasado**, distinguindo informações confirmadas de estimativas.
- Alertar sobre atraso de um fornecedor e listar as OMs, pedidos e linhas afetados, com quantidade em risco; não remarcar automaticamente promessas externas.
- Permitir reorganizar remessas, usar outro fornecedor, expedir parcialmente e notificar contatos com aprovação humana.
- Evitar o termo genérico "atrasado" se só a estimativa interna piorou e a obrigação formal ainda está no prazo.

---

## 4. Módulo Cadastro de fornecedores de origem (P0)

### Dados cadastrais
- Razão social, nome fantasia, CNPJ quando aplicável, tipo de parceiro, endereço, região, contatos (nome, função, telefone, e-mail, WhatsApp), horários e canais preferenciais, observações.
- Produtos/categorias fornecidos, descrições e códigos próprios, marca, unidade de compra, embalagem, fator de conversão, preço de referência e data da cotação, pedido mínimo, disponibilidade usual, lead time usual, condições de frete e pagamento.
- Contatos múltiplos, com responsabilidade e prioridade; histórico de pedidos, ocorrências, devoluções e documentos essenciais.
- Situação: ativo, em avaliação, suspenso, inativo; impedir uso de suspenso em novas compras sem exceção autorizada.

### Inteligência operacional baseada no histórico real
- Último preço negociado (por SKU/embalagem, com data e moeda); não tratar como cotação vigente automaticamente.
- Prazo médio e dispersão de entrega; percentagem de pedidos entregues no prazo e completos (OTIF) quando houver evidências suficientes.
- Ranking contextual por categoria, localização, capacidade e condições, **sem recomendações baseadas em informação confidencial de OMs**.
- Alertas de concentração: item crítico depende de um único fornecedor.
- Registro de cotações opcionais e comparação manual de fornecedores; não construir um marketplace de licitações nesta fase.

### UX sugerida
Uma aba **"Meus Fornecedores"** com busca por material, região, prazo e nome; ficha do parceiro com catálogo de produtos, contatos, condições, pedidos em andamento, faturas a pagar e desempenho; botão **"Fazer pedido"** abre um cronograma/ordem de compra pré-preenchida.

---

## 5. Módulo Pedido de compra ao fornecedor (P0, principal novidade)

### Criação
- Manual ou a partir de **necessidade de compra** derivada de pedido de OM + estoque disponível/reservado.
- Um pedido de compra pode agregar necessidades de várias OMs, preservando a alocação de cada linha e impedindo dupla reserva.
- Campos: fornecedor, contatos, itens, produto/código, unidade de compra e fator de conversão, quantidade, preço negociado, descontos, frete, impostos conhecidos, data necessária, local de entrega, instruções e observações.
- Alterações posteriores ao envio geram **revisão da ordem de compra**, não edição silenciosa.
- PDF de ordem de compra/romaneio de recebimento gerados automaticamente; anexos por item/pedido.

### Envio e retorno
**Fase inicial:** botão "Gerar pedido" → PDF e texto estruturado para e-mail ou WhatsApp (compartilhamento assistido; sem fingir que enviamos mensagens que o sistema não enviou). Registrar data, canal e responsável.

**Fase posterior (P1):** página externa restrita por convite autenticado ou link assinado expiráveis e escopo de um único pedido, com ações: visualizar itens; confirmar disponibilidade, preço e prazo; contrapropor data/quantidade; enviar observação/anexo; marcar expedição; informar rastreio. O fornecedor de origem não acessa clientes, margens, NEs ou dados financeiros da licitante.

**Regra de compromisso:** data sugerida pela empresa ≠ data confirmada pelo fornecedor; contraproposta exige aceite humano. Solicitação de compra não é confirmação de fornecimento.

### Recebimento e divergências
- Conferir quantidades, qualidade, validade/lote quando pertinente; aceitar recebimento parcial ou recusar linha com justificativa.
- Vincular NF de compra; apurar custo efetivo por item; devoluções e estornos com rastreabilidade.
- Atualizar estoque livre e reservas explicitamente. Para mercadoria de entrega direta à OM, registrar recebimento/aceite por prova documental e tratar como modalidade distinta de operação.

---

## 6. Pedidos de OMs e empenhos (P0)

- Cadastro de OM com UG/UASG, nome, CNPJ, endereço, contato, horário de recebimento e orientações de acesso; preservar privacidade e conferir endereço operacional.
- Cadastro/importação de NE em PDF, vínculo opcional com contrato/ata/processo, itens, quantidade, unidade, valor, prazo e documento original; revisão obrigatória dos dados extraídos.
- **Pedido da OM** separado da NE, pois uma NE pode gerar muitas solicitações e entregas.
- Linha de pedido tem quantidade solicitada, disponibilidade no estoque, quantidade em compra, reservada, separada, expedida, entregue, confirmada e saldo.
- Permitir entrega parcial, requisição cancelada e alteração negociada; impedir dedução duplicada de saldo por operações repetidas.
- Relacionar compras específicas do fornecedor ao item da OM por alocações explícitas (quantidade de origem → destino).
- Manter número de processo/edital apenas como dados de referência documental; não implementar busca de licitações no MVP.

---

## 7. Estoque leve, alocação e preparação de cargas (P0/P1)

**MVP recomendado:** controle básico de quantidade disponível, reservada, encomendada e em trânsito, por produto e unidade, sem 3D, complexidade WMS ou sincronização direta com depósitos das OMs.

- Cadastro de produtos da empresa com SKU canônico e referências aos códigos dos fornecedores; mapeamento de unidades (caixa, fardo, kg, unidade), conversões auditadas.
- Lançamentos de entrada/saída/ajuste/estorno, com origem (pedido, recebimento, rota) e ledger idempotente.
- Reservar quantidades para OM sem permitir dupla alocação do mesmo saldo.
- Separação por entrega, checklist e aviso de item faltante.
- Validar itens perecíveis/temperatura quando for exigência operacional, sem implementar FEFO obrigatório.

**Fase futura:** múltiplos armazéns, locais físicos, inventário avançado, lotes, validação e 3D opcional se houver demanda real. Reaproveitar componentes do Warehouse atual somente após verificar compatibilidade técnica e segurança.

---

## 8. Entregas, rotas e motorista (P1 após MVP operacional)

- Mapa de destinos por dia/região, origem, janelas de recepção, restrição de acesso e tempo de descarga; otimização sob demanda com revisão humana.
- Criar rota por veículo, capacidade, motorista, sequência e carga; romaneio que detalha pedidos/NEs/NFs por parada.
- Motorista visualiza somente suas entregas, contatos necessários e instruções; navega por app externo; registra saída, chegada, entrega parcial, recusa, avaria, fotos e assinatura quando consentida.
- Rastreamento contínuo não é requisito inicial. Distância e tempo são estimativas rotuladas; guardar custo real informado quando disponível.
- Reprogramação de rota não altera automaticamente compromisso acordado com a OM.
- Oferecer modalidade de **entrega direta do fornecedor de origem à OM**, com vínculo do pedido de compra, responsável pelo frete, comprovante e trilha de custódia. Não simular que o motorista da licitante realizou a entrega.

---

## 9. Financeiro enxuto, ligado à operação (P0 manual; P2 automações)

### Contas a pagar (upstream)
- Compra ao fornecedor → NF/obrigação → vencimento → parcialidade → pagamento registrado → saldo.
- Previsão de desembolsos por fornecedor, pedido, período e material; condição de pagamento negociada.
- Ajuste e cancelamento com trilha, nunca apagar silenciosamente.

### Contas a receber (downstream)
- Entrega/NF à OM → valor faturado → condição e previsão de recebimento → registros de recebimento parciais/totais e saldo.
- Estado de nota, entrega, atesto, liquidação e pagamento separados. Não inventar confirmação de liquidação nem de crédito bancário.

### Margem e fluxo de caixa
- Margem estimada por item/pedido/OM = receita prevista − custo dos materiais alocados − frete/despesas conhecidas − tributos parametrizados quando informados.
- Margem realizada somente após os fatos e custos necessários estarem registrados; indicar ausência de impostos/frete/custos e confiança do cálculo.
- Análise do **descasamento de caixa**: fornecedor pode vencer antes do pagamento da OM.
- Calendário mostrando vencimentos do fornecedor, prazo de NF da OM e recebimentos efetivos; alertas úteis, sem assumir inadimplência sem comprovação.

### Automações posteriores
- Importação CSV/OFX para sugerir conciliação; confirmação humana da baixa; lembretes internos; exportação ao contador.
- Não construir ERP fiscal, emissão de NF-e, conta bancária ou integração com escrita bancária no início.

---

## 10. Menu e papéis revisados

**Menu sugerido (empresa licitante):**
1. Visão Geral
2. Pedidos das OMs
3. Empenhos e Saldos
4. Compras / Pedidos aos Fornecedores
5. Meus Fornecedores
6. Cronogramas (Abastecimento | Entregas às OMs)
7. Estoque e Separação
8. Rotas e Motoristas
9. Notas Fiscais
10. Financeiro (A Pagar | A Receber | Margens)
11. Clientes / OMs
12. Relatórios e Documentos
13. Configurações

**Papéis:** Administrador, Operações/Compras, Estoque, Logística, Motorista, Financeiro. Comercial/Licitações deixa de ser papel principal. Uma pessoa pode assumir várias funções. Parceiro externo (quando existir) usa autorização **por pedido**, nunca permissão genérica do workspace.

**Início em linguagem operacional:** "Pedidos da OM que exigem compra", "Compras que chegam nesta semana", "Entregas em risco", "Cargas prontas", "A pagar aos fornecedores", "A receber das OMs".

---

## 11. Entidades e arquitetura (propostas, não implementadas)

```text
supplierCompanyWorkspaces/{companyId}              # tenant da empresa licitante
supplierCompanyWorkspaces/{companyId}/members        # equipe e papéis
supplierCompanyWorkspaces/{companyId}/publicCustomers  # OMs clientes
supplierCompanyWorkspaces/{companyId}/sourceSuppliers  # parceiros de abastecimento
supplierCompanyWorkspaces/{companyId}/supplierContacts
supplierCompanyWorkspaces/{companyId}/catalogProducts
supplierCompanyWorkspaces/{companyId}/sourceSupplierProducts
supplierCompanyWorkspaces/{companyId}/commitments    # NEs recebidas
supplierCompanyWorkspaces/{companyId}/customerOrders # pedidos de OMs
supplierCompanyWorkspaces/{companyId}/purchaseNeeds  # demandas de compra
supplierCompanyWorkspaces/{companyId}/purchaseOrders # pedidos à origem
supplierCompanyWorkspaces/{companyId}/purchaseOrderRevisions
supplierCompanyWorkspaces/{companyId}/orderAllocations # vínculos quantidade/custo entre origens/destinos
supplierCompanyWorkspaces/{companyId}/inboundReceipts
supplierCompanyWorkspaces/{companyId}/inventoryMovements
supplierCompanyWorkspaces/{companyId}/outboundDeliveries
supplierCompanyWorkspaces/{companyId}/routes
supplierCompanyWorkspaces/{companyId}/invoices
supplierCompanyWorkspaces/{companyId}/payables
supplierCompanyWorkspaces/{companyId}/receivables
supplierCompanyWorkspaces/{companyId}/paymentEntries
supplierCompanyWorkspaces/{companyId}/documents
supplierCompanyWorkspaces/{companyId}/auditLog
```

Identificadores, coleções e relações são ilustrativos: avaliar reutilização de abstrações existentes antes de criar coleções. **CNPJ identifica a empresa; UG/UASG identifica o cliente público; nenhum deve ser confundido.**

Regras fundamentais:
- Quantidades e pagamentos com somatórios transacionais ou projeções de ledger, idempotencyKey e estorno auditável; suportar N:M.
- Não permitir reservar estoque indisponível; controlar encomenda em trânsito separadamente.
- Datas separadas: solicitada, estimada, confirmada, acordada com OM, real; registrar autor e origem da atualização.
- Custo não pode ser presumido a partir do preço de venda em NE; custo é próprio da empresa.
- Cada fornecedor externo autorizado acessa somente o pedido compartilhado e campos mínimos; sem enumerar outras empresas, OMs ou compras.
- Não fazer cross-tenant por CNPJ como único verificador de direito; exigir identidade e membership validados server-side.
- Deny by default e testes contra IDOR, vazamento entre empresas e entre empresa/OM; arquivos e URLs temporárias com controle de acesso.
- Serviços cobrados (mapas, mensagens, IA) com limites e métricas por empresa; usar cache onde permitido.

---

## 12. Reaproveitamento do EMPROVEX atual

O código atual já contém infraestrutura de autenticação, workspaces, NE, NF, documentos, relatórios, pagamentos e o conceito de cronogramas. **A existência concreta de elementos não autoriza copiar componentes sem auditoria funcional do fluxo e contrato de dados.**

1. Fazer levantamento da aba Cronogramas do Aprovisionamento: dados, estados, ações, cálculos e dependências.
2. Extrair apenas padrões reutilizáveis (calendário, tabela, filtros, itens e alertas); **não reutilizar automaticamente regras de negócio de OM na empresa**.
3. Criar shell empresarial em rota independente `/fornecedores`, com tenant e RBAC próprios, preservando entitlements e regras das OMs.
4. Reutilizar importação de PDFs/XML, geração de documentos e billing somente mediante proteção por produto.
5. Manter liberação em PRs pequenas com testes de isolamento, saldos, documentos, alterações concorrentes e regressão do Aprovisionamento; staged e promoção somente com GO explícito.

**Pesquisa de código:** a busca textual da integração GitHub não encontrou resultados indexados para `cronograma`; isso **não comprova ausência da funcionalidade**. Antes de implementar, inspecionar diretamente os arquivos relevantes na árvore do projeto para identificar componentes reais.

---

## 13. Backlog de implantação revisto

| Ciclo | Objetivo | Entregas verificáveis | Critério de aceite |
|---|---|---|---|
| 0 | Descoberta/fluxos | 5–8 entrevistas + 3 casos reais anonimizados + protótipo do pedido à origem | Pipeline real validado com empresas sem conflito funcional |
| 1 | Fundação | Workspace empresa, membros, RBAC, cadastro OM e fornecedor, produtos/SKUs | Isolamento empresa A/B/OM comprovado |
| 2 | Núcleo operacional | NE, pedido OM, falta/necessidade, pedido de compra fornecedor, confirmação e cronograma duplo | Pedido de OM rastreado até ordem de compra e data viável |
| 3 | Recebimento | Conferência parcial, estoque leve, alocação por item, separação e documentação | Sem saldo duplo, estoque negativo ou perda de rastreabilidade |
| 4 | Entrega | Agendamento OM, romaneio, status e prova de entrega manual | Entrega parcial correta e responsabilidade identificada |
| 5 | Colaboração externa | Resposta do fornecedor via convite por pedido, nova data, contraproposta e anexo | Acesso escopado, revogável e auditado |
| 6 | Rotas e motorista | Mapa, paradas, sequência e fluxo mobile | Rota de 5 OMs, ocorrências e custos estimados claros |
| 7 | Financeiro e cobrança | A pagar, a receber, custos e margens, assinatura comercial fornecedor | Conciliação manual correta e sem alteração de billing OM |
| 8 | Automação incremental | Alertas de risco e despesa, OCR, relatórios automáticos, importação OFX | Custo/resultado mensurados; aprovação humana em baixa |
| Futuro | Dados de licitações | Consulta simples de referência e fontes oficiais sob demanda | Sem desviar esforço do pós-licitação |

Ciclos são **ordem técnica, não cronograma de datas nem compromisso de duração**. Para vender um piloto pago, completar ao menos a cadeia OM → compra → recebimento → entrega e financeiro básico. A colaboração externa e roteirização podem entrar como diferenciais em versão posterior.

---

## 14. Tela-chave e cenários de aceite

### Tela: Pedido recebido da OM
- Cabeçalho: OM, NE, data solicitada, prazo acordado, valor e prioridade.
- Por item: solicitado, em estoque livre, reservado, falta a comprar, em pedido fornecedor, data de chegada confirmada, separado, entregue.
- Ações: "Comprar faltantes", "Vincular pedido ao fornecedor", "Programar entrega", "Ver rastreio", "Gerar romaneio", "Registrar NF".
- Se faltantes de 3 itens vierem de 2 fornecedores com prazos diferentes, estimar a data viável pela última mercadoria necessária (respeitando possibilidade de entrega parcial).

### Tela: Pedido enviado ao fornecedor de origem
- Status de envio e recebimento, versões, confirmação e contraproposta, previsão de despacho, recebimentos parciais, custo efetivo, NF de entrada.
- Mostrar explicitamente quais pedidos de OMs são abastecidos, **somente para equipe interna**, não no link externo.
- Alertas "prazo de origem compromete pedido OM" com lista do impacto e sugestões de replanejamento.

### Testes indispensáveis
1. Empresa A não consulta registros da B, nem dados de OM sem compartilhamento.
2. Parceiro externo X vê apenas o pedido autorizado, inclusive após atualização de versão e revogação.
3. Um pedido da OM de 500 pode utilizar 100 em estoque + 300 do fornecedor A + 100 do fornecedor B.
4. Compra única de 500 pode atender 200 de OM A e 300 de OM B, sem duplicação de saldo.
5. Fornecedor confirma apenas 250/400 e propõe data diferente; saldo pendente e riscos são recalculados.
6. Recebimento parcial não marca pedido completo e não cria saldo fictício.
7. Alteração de data do fornecedor gera alerta e **não** muda unilateralmente compromisso com OM.
8. Mensagem gerada para WhatsApp não é declarada enviada sem confirmação real.
9. Motorista registra entrega mas não gera atesto ou pagamento governamental.
10. Nota fiscal de entrada é separada de NF de venda; contas a pagar e receber não se misturam.
11. Custos/margens mostram lacunas quando tributos/fretes não cadastrados.
12. Novo produto não muda contrato, VIP, IAM, 3D ou dados do Aprovisionamento existente.

---

## 15. Modelo econômico e aquisição

- Manter **assinatura por empresa licitante**, com usuário(s) e capacidade de operação conforme plano; convidados de fornecedores de origem sem assinatura obrigatória.
- Medir custos variáveis reais: mapas, arquivos, notificações, suporte e usuários ativos. Preferir cobrar por nível de operação, não por cada confirmação de entrega.
- Valores V1 de R$99/R$199/R$399 permanecem **hipóteses comerciais sem validação**, não preços aprovados. Reavaliar após entrevistas e piloto, considerando que o valor está no controle de compras/prazos/entregas e no caixa.
- Indicadores: tempo pedido OM→pedido fornecedor, confirmação dentro do prazo, cumprimento de prazo do fornecedor, entrega OM no prazo, OTIF, atraso prevenido, diferença entre contas a pagar e a receber, custo logístico e margem por pedido.
- Captação de empresas e vendas **sem usar vínculos funcionais, canais ou dados privilegiados da OM**. Antes de vender, consultar formalmente situação jurídica de exploração comercial por militar da ativa e conflitos de interesses (art. 29 da Lei 6.880/1980 e normas aplicáveis).

---

## 16. Perguntas a validar na descoberta, sem travar o desenho

- Em geral, cada empresa possui estoque próprio ou compra apenas após pedido da OM?
- Fornecedor de origem entrega na empresa, diretamente na OM ou ambos?
- Quem costuma negociar/confirmar os prazos: WhatsApp, ligação, e-mail ou ERP?
- As mercadorias são alimentícias/perecíveis e precisam controle de validade/temperatura?
- O fornecedor de origem aceita confirmar data e quantidade por link sem instalar aplicativo?
- A empresa consegue atribuir custos e condições de pagamento aos materiais por item?
- Como empresa registra comprovante de entrega e emissão de NF no fluxo atual?

**Conclusão V2:** EMPROVEX Empresas deve ser, em primeiro lugar, um **sistema de execução de fornecimentos públicos com gestão de compras a fornecedores de origem e dois cronogramas integrados**. Licitações passam a ser dado de referência ou módulo futuro. Segurança, integridade, rastreabilidade e clareza dos prazos são exigências inegociáveis. A publicação deste memorial no GitHub é exclusivamente documental. Nenhuma implementação de fornecedores, mudança em Firestore ou alteração na produção decorre deste plano.
