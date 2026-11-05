# EMPROVEX EMPRESAS — MEMORIAL OFICIAL

> **PRECEDÊNCIA DE INFRAESTRUTURA (31/10/2026):** os workspaces empresariais continuam sujeitos ao seu próprio ciclo de desenvolvimento/integração; **não** confundir migração da hospedagem web com publicação das funcionalidades empresariais. O domínio operacional principal está em Google Cloud Run por Firebase Hosting, e o procedimento canônico de publicação é [EMPROVEX_RELEASE_CLOUD_RUN.md](./EMPROVEX_RELEASE_CLOUD_RUN.md). Registros Vercel abaixo são históricos.

## PROMPTS OFICIAIS DOS WORKERS — EXECUÇÃO R2/R3 (05/11/2026)

**Status:** prompts registrados e prontos para utilização; nenhum Worker foi acionado por este registro. Este bloco integra o memorial oficial. O [relatório de auditoria R1-M](./empresas/AUDITORIA_R1M_PLANO_WORKERS_2026-11-05.md) contém achados P0–P2, matriz de 20 testes e arquitetura de execução; seus critérios prevalecem sobre o planejamento histórico quando houver divergência operacional.

**Sequência executiva:** W0 (sequencial) → W1, W2, W3, W4, W5 (paralelos do mesmo SHA W0) → W6, W7, W8 (paralelos após contratos) → W9 (sequencial) → W10 (integração, homologação, piloto). W9 aqui é de Empresas, não o W9 de Almoxarifado.

**Instruções obrigatórias, aplicáveis integralmente a todo prompt abaixo:** você é um Worker implementador no repositório `aprov-hgesm/Controles-de-Empenhos---Aprov`. Verifique primeiro branch, SHA, arquivos atuais e o [memorial](./EMPROVEX_EMPRESAS_MEMORIAL_OFICIAL.md) e a [auditoria](./empresas/AUDITORIA_R1M_PLANO_WORKERS_2026-11-05.md); faça **código real**, não somente propostas ou mockups. Trabalhe em **branch isolada**, abra PR **Draft**, não faça merge, não publique, não promova tráfego, não altere billing/IAM/Rules de produção nem dados reais sem autorização. Preserve a conta fundadora, todos os workspaces militares, o Almoxarifado, a Central de Depósitos, o Cloud Run e o histórico. Toda API empresarial deve validar identidade/workspace e papel no **servidor**; CNPJ, UG, slug ou parâmetro do cliente nunca bastam para autorizar. Não criar segunda fonte de verdade, nem reutilizar ledger militar. Senhas, tokens e documentos nunca em logs. Sem mudanças fora do escopo sem handoff ao integrador. Quando solicitar novo campo ou contrato comum, abra patch/handoff pequeno; não edite em paralelo `lib/platformIdentity.ts`, `app/login/page.tsx`, `lib/server/companySession.ts`, `firestore.rules`, `components/admin/PlatformAdminView.tsx`, CI global ou `package-lock.json`. Resultados devem incluir arquivos alterados, SHA, PR, testes executados de fato, riscos residuais, bloqueios e proposta GO/NO-GO; nunca afirmar testes não realizados.

**Regra de origem:** W0 parte da PR [#510](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/510) no SHA vigente no início. Após o W0 certificar seus contratos, todos W1–W5 partem **do mesmo commit W0**. W6–W8 partem de base integradora com contratos W1–W3 consolidados. W9/W10 partem da integração da etapa anterior, não de branches antigas #419/#447.

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

#### PROMPT W9 — Cronogramas interligados, entrega e indicadores (sequencial)

~~~text
Você é o Worker W9 da extensão EMPROVEX Empresas. Execute efetivamente o trabalho descrito a seguir, em branch isolada e PR Draft; não se limite a planejar.

BASE E DEPENDÊNCIAS: Somente depois da integração verificável de W6, W7 e eventos financeiros de W8. Não confundir com o Worker W9 do Almoxarifado.
ESCOPO E ARQUIVOS RESERVADOS: features/company/schedule/**, features/company/delivery/**, lib/company/schedule/**, app/api/company/schedule/** e delivery/**; integração do menu pela branch integradora.

MISSÃO: Ligar cronograma inbound (compra/fornecedor/recebimento) ao outbound (pedido OM/expedição/entrega), calculando viabilidade com última mercadoria necessária, separação, transporte e margem. Exibir datas solicitada, estimada, confirmada e acordada distintamente; alertas Atenção/Em risco/Atrasado e replanejamento humano. Criar romaneio, eventos de entrega, recusa, comprovante, parcialidade e entrega direta origem→OM sem ficção de custódia. Expor indicadores de prazo e pendência, respeitando acesso por papel.

CRITÉRIOS DE ACEITE: Mudança de prazo de fornecedor identifica pedidos/linhas impactados sem alterar promessa OM automaticamente; entrega parcial não é atesto, liquidação ou pagamento; rota/romaneio reflete itens realmente expedidos; performance aceitável em Essencial.

TESTES OBRIGATÓRIOS: Simulação fornecedor A/B, data alterada, parcialidade e atraso, idempotência de entrega, documento, privacidade e E2E ponta a ponta.

ENTREGA / HANDOFF: PR Draft W9 com cenário de pedido OM até evidência de entrega, indicadores calculados e checklist de falhas relevantes para W10.

REGRAS DE EXECUÇÃO: Leia e obedeça as instruções obrigatórias desta seção do memorial e a auditoria R1-M. Não modificar arquivos compartilhados reservados ao integrador, não usar dados militares como dados empresariais, não conceder permissões pelo cliente e não fazer merge/deploy. Registre somente evidências verificáveis, bloqueios e decisões técnicas mínimas, sem burocracia.
~~~

#### PROMPT W10 — Integração final, auditoria e piloto controlado (sequencial)

~~~text
Você é o Worker W10 da extensão EMPROVEX Empresas. Execute efetivamente o trabalho descrito a seguir, em branch isolada e PR Draft; não se limite a planejar.

BASE E DEPENDÊNCIAS: Quando os Workers anteriores entregarem PRs Draft com SHAs e testes; integrar sobre a main mais recente apenas após reconciliação segura.
ESCOPO E ARQUIVOS RESERVADOS: Branch integration/emprovex-empresas-r3-pilot-<data> (nome a definir na execução), memorial/checkpoints, workflows E2E e ajustes cruzados aprovados. W10 é o único Worker que consolida arquivos compartilhados.

MISSÃO: Revisar e integrar W1–W5, depois W6–W8 e W9, respeitando dependências, corrigindo conflitos de forma mínima e preservando login, Eleonor, Aprovisionamento, Almoxarifado, Admin, NF, Cloud Run e faturamento existentes. Executar E2E de empresa A/B, fundador/setor, pedido OM→compra→recebimento→estoque→entrega→financeiro, testes de carga essencial, revogação e auditoria de segurança. Preparar ambiente de QA isolado e plano reversível do primeiro piloto; não publicar automaticamente.

CRITÉRIOS DE ACEITE: Todos os 20 cenários mínimos da auditoria PASS com evidências; sem leitura entre tenants, saldos e custos coerentes; CI typecheck/build/Core/Visual-R2/Fast/E2E aprovado; rollback definido; feature flag piloto OFF até liberação; bloqueio NO-GO se qualquer P0 persistir.

TESTES OBRIGATÓRIOS: Executar todas as suítes relevantes, Auth/Firestore Emulator, Playwright em browsers, perf por workspace, regressão Cloud Run/Hosting e smoke QA antes de solicitar autorização.

ENTREGA / HANDOFF: Parecer assinado GO/NO-GO, matriz de testes e links, lista de PRs e SHAs, pacote de lançamento com rollback. Merge ou promoção 100% do Cloud Run só mediante autorização explícita.

REGRAS DE EXECUÇÃO: Leia e obedeça as instruções obrigatórias desta seção do memorial e a auditoria R1-M. Não modificar arquivos compartilhados reservados ao integrador, não usar dados militares como dados empresariais, não conceder permissões pelo cliente e não fazer merge/deploy. Registre somente evidências verificáveis, bloqueios e decisões técnicas mínimas, sem burocracia.
~~~
**Controle de execução:** os Workers W1–W5 são independentes em código, mas devem aguardar W0 fixar contratos. W6–W8 podem antecipar testes de domínio puros, porém não integrar escrita real antes dos contratos e RBAC. W9/W10 não devem ser executados em paralelo com integrações que modificam os mesmos arquivos. Atualizar este memorial somente com checkpoints de PR e provas de CI/E2E; nunca substituir o histórico.

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
