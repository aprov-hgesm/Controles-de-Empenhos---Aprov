# EMPROVEX ALMOXARIFADO — MEMORIAL OFICIAL

**Produto:** EMPROVEX Almoxarifado — Gestão Logística e Financeira para Setores de Material de Organizações Militares.
**Edição:** Planejamento R0.2 — estratégia executiva híbrida consolidada em 31/10/2026 (inclui R0.1).
**Estado:** PLANEJADO; este documento não comprova implementação, homologação, merge nem publicação.
**Repositório:** aprov-hgesm/Controles-de-Empenhos---Aprov.
**Base de inspeção da main:** c096b53d0bb3dda058cd91915cf7ffffa1d275d6 (31/10/2026).
**Diretriz:** GOV-SIMP-01 — desburocratização com segurança essencial, reaproveitamento de código, economia computacional e testes proporcionais ao risco.
**Memorial próprio:** não substituir, misturar nem reescrever os memoriais do EMPROVEX Aprovisionamento ou EMPROVEX Empresas.

> **DECISÃO DE ESCOPO MAIS RECENTE — PRECEDÊNCIA ABSOLUTA (31/10/2026):** NÃO desenvolver CREM nem TREM no EMPROVEX Almoxarifado nesta expansão. Não criar cadastro de comissão, formulários públicos, geração automática ou fluxo de assinatura de TREM. O usuário considera esse acompanhamento atribuição da Fiscalização Administrativa e não deseja transferir encargos ao Almoxarifado. A exclusão funcional não redefine competências legais nem desobriga os agentes da OM de seus procedimentos oficiais. A comissão de artigos de Quantitativo de Rancho (QR), própria da operação de gêneros alimentícios, também NÃO integra o novo ambiente.

> **DECISÃO OPERACIONAL CENTRAL:** o SISCOFIS permanece o sistema oficial. O EMPROVEX será uma ferramenta auxiliar para receber pedido exportado em PDF/TXT, identificar materiais, determinar depósito/local/subposição, emitir ficha de separação e acompanhar a retirada física, sem se passar por lançamento oficial ou automatizar ações diretas no SISCOFIS.

> **CONTROLE DE MUDANÇA:** nenhuma fase deste plano autoriza, por si só, alterar Firestore Rules, faturamento, identidade de produção, infraestrutura, dados operacionais reais, DNS, Cloud Run ou publicar funcionalidades. Registrar estados PLANEJADO, EM PR, HOMOLOGADO e PUBLICADO com evidências distintas. Revalidar o estado do repositório antes de executar Workers.

---

## 1. Motivação e visão

O EMPROVEX atual, originalmente desenvolvido para Aprovisionamento, controla empenhos, notas fiscais, fornecedores, cronogramas, consulta de itens, relatórios, Central de Depósitos e Operador Móvel. O EMPROVEX Almoxarifado deve aproveitar esses módulos, mas adaptar materiais, linguagem e processos para o Setor de Material/Almoxarifado de uma Organização Militar (OM).

O Almoxarifado trata principalmente de materiais de expediente, escritório, higiene, limpeza, manutenção, mobiliário, equipamentos, materiais permanentes e outros materiais técnicos, conforme o catálogo e as competências de cada OM. Não se deve transportar automaticamente regras específicas de alimentação ou de QR.

**Proposta de valor:** permitir que o chefe do depósito receba pedidos do SISCOFIS e entregue ao militar separador uma orientação clara de onde cada item se encontra fisicamente, reduzindo buscas, deslocamentos, erros de retirada e trabalho repetitivo, mantendo o registro oficial no SISCOFIS.

O novo produto será uma terceira modalidade de EMPROVEX:

1. **EMPROVEX Aprovisionamento:** ambiente militar existente, com seus fluxos alimentares e documentos atuais preservados.
2. **EMPROVEX Almoxarifado:** novo ambiente militar, semelhante em empenhos e depósitos, mas voltado ao Setor de Material e ao apoio operacional dos pedidos do SISCOFIS.
3. **EMPROVEX Empresas:** ambiente próprio para empresas contratadas, com fluxo empresarial e identidade distinta; sua implementação está em PRs separadas.

A plataforma poderá compartilhar infraestrutura, componentes visuais, segurança e núcleo de dados por código; NÃO compartilhar automaticamente documentos, estoque nem permissões entre workspaces.

## 2. Responsabilidades, fronteiras e exclusões

### 2.1. Incluído no planejamento

- Gestão de empenhos, saldos, exercícios e documentos relacionados, respeitando os fluxos já existentes.
- Notas fiscais, cadastro e consulta de itens, fornecedores e cronogramas de entrega.
- Depósitos, croqui 2D, visualização 3D, posições/subposições, etiquetas, códigos de barras e Operador Móvel.
- Entradas e conferências operacionais atribuídas ao setor, sem criar um circuito de CREM/TREM.
- Materiais de consumo e permanentes, com diferenças de tratamento patrimonial.
- Importação determinística de pedidos do SISCOFIS (TXT/PDF) para planejamento da saída física.
- Correspondência segura do pedido com o catálogo EMPROVEX; localização por saldo físico e posição.
- Ficha de separação física em PDF, com eventual versão digital/móvel.
- Rastreamento de separação, retirada, pendências, divergências, atendimento parcial e histórico auditável.
- Conferências e relatórios auxiliares de estoque e movimentação.

### 2.2. Excluído nesta expansão

- CREM, TREM, cadastro e nomeação de comissão, BI para comissão, link público de exame, geração de TREM e assinatura de TREM.
- Comissão de recebimento de artigos QR e regras particulares de gêneros alimentícios.
- Substituir o SISCOFIS como sistema oficial de movimentação/patrimônio, burlar seu fluxo de aprovação ou afirmar integração oficial não existente.
- Automatizar cliques no SISCOFIS, obter credenciais do SISCOFIS ou escriturar suas operações em nome do usuário sem integração autorizada e específica.
- Assumir responsabilidades próprias da Fiscalização Administrativa.
- Transferir automaticamente o patrimônio entre dependências sem autorização/procedimento oficial.
- Inventar obrigação normativa, classificação patrimonial ou dados ausentes do documento exportado.

### 2.3. Critério de desenho institucional

O software é apoio de rotina. A distribuição de materiais deve respeitar o Regulamento de Administração do Exército e normas vigentes na OM. O usuário define o escopo funcional do produto; a identificação exata de agentes competentes e documentos oficiais exigidos requer conferência normativa durante a implantação. O afastamento de CREM/TREM do produto NÃO é um parecer jurídico sobre a obrigação da OM.

Referência normativa principal consultada:
- Regulamento de Administração do Exército (RAE), EB10-R-01.003, aprovado pela Portaria C Ex nº 1.555/2021; particularmente procedimentos relativos a bens patrimoniais e distribuição às frações da OM (arts. 44–47 e 72–75).
- Fonte institucional: https://www2.gabcmt.eb.mil.br/a1/index.php/downloads?download=121%3Aport-n-1-555-de-09-jul-21-rae&start=30
- Como a regulamentação pode ser atualizada, validar a versão aplicável no momento da implementação; usar essa referência como contexto e não como substituta de orientação oficial vigente.

## 3. Produtos, acesso e identidade — reaproveitar EMPROVEX Empresas

### 3.1. Login unificado e direcionamento

**Experiência desejada:** o administrador cadastra um e-mail operacional, sua modalidade e seu workspace. A pessoa autentica-se pelo login único e entra automaticamente no ambiente correto.

Rotas planejadas:
- /login: porta de entrada única.
- /central-empenhos: Aprovisionamento atual (preservar).
- /central-depositos e /operador-movel: módulos existentes, sem regressão.
- /almoxarifado: novo shell/portal do Setor de Material.
- /empresa: ambiente EMPROVEX Empresas (em desenvolvimento separado).
- /admin: administração da plataforma.

**Distinção de segurança essencial:** o e-mail cadastrado é chave de identificação e provisionamento, mas **e-mail isolado, domínio, parâmetro de URL, rota ou escolha visual NÃO são autorização**. O backend deve validar sessão Firebase, UID vinculado, provedor conforme política, conta ativa, workspace ativo, tipo de conta, modalidade, permissões e faturamento aplicável. As APIs e o acesso aos dados usam contexto confiável resolvido no servidor. Alterar a URL não pode alterar o tenant.

Contrato preferencial a ser validado no início do desenvolvimento:
- accountType = platformAdmin: administrador, sem workspace operacional implícito;
- accountType = sector + sectorType = aprovisionamento: ambiente militar atual;
- accountType = sector + sectorType = almoxarifado: novo ambiente militar;
- accountType = company: ambiente empresarial, após integração segura da expansão Empresas.

A nomenclatura sectorType é **proposta**, não campo já implementado na main; preferir adicionar classificação ao setor em vez de um accountType totalmente novo, desde que a auditoria de identidade confirme compatibilidade com os tipos existentes. Ausência de sectorType em contas legadas deve manter comportamento atual do Aprovisionamento, não bloquear ou redirecionar contas existentes.

A mesma UG pode possuir workspaces distintos de Aprovisionamento e Almoxarifado; **UG igual nunca implica compartilhamento de dados**. Em R0, uma conta operacional resolve para um workspace autorizado; contas com necessidade de múltiplos workspaces só terão seletor de contexto quando essa possibilidade for especificada e autorizada.

**Não confundir cadastro por e-mail com autorização baseada apenas em texto de e-mail.** Provisionamento e roteamento precisam usar os contratos de identidade confiável, conservando o vínculo UID/conta/workspace e as Firestore Rules/API server-side.

### 3.2. Reaproveitamento do Empresas

A expansão EMPROVEX Empresas já investigou e desenvolveu em PRs separadas: identidade company, provisionamento, cadastro administrativo, /empresa e redirecionamento após login. Reaproveitar o **padrão arquitetural** de múltiplos ambientes com uma autenticação, cadastro administrativo e isolamento, mas não copiar cegamente código ainda não homologado.

**Checkpoint inspecionado em 31/10/2026:** PR de integração Empresas #419 aberta em DRAFT, sem merge, com registros anteriores de regressão de login setorial e NO-GO para produção no memorial Empresas. A main examinada ainda define PlatformAccountType apenas como platformAdmin | sector; o tipo company está em branch de desenvolvimento. Portanto, não pressupor que o novo roteamento do Empresas já integra a main.

Referências:
- docs/EMPROVEX_EMPRESAS_MEMORIAL_OFICIAL.md
- PR #419: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/419
- PRs de trabalhadores Empresas #416, #417 e #418, conforme o memorial específico.
- lib/platformIdentity.ts, lib/platformAccess.ts, lib/workspaceContext.ts, lib/sectorProvisioning.ts, lib/platformModuleAccess.ts.

**Regra de integração:** revalidar a main e o status do Empresas antes do R0. Se a integração Empresas estiver homologada, reutilizar sua camada comum de sessão, provisionamento e roteamento. Se continuar pendente, implementar o planejamento em branch independente ou extrair componentes seguros sem depender de sua PR bloqueada. Não unir branches incompletas nem reintroduzir regressões de login.

### 3.3. Administração, cobrança e infraestrutura

- Cadastrar modalidade Almoxarifado no Admin, com dados institucionais de OM, sigla, UG, seção, e-mail autorizado e workspace.
- Preservar sessão, limites de concorrência, autorização e isolamento já utilizados em setores militares.
- Utilizar o modo Essencial, componentes visuais e políticas de desempenho existentes quando possível; preservar o 3D.
- Política comercial/preço do novo produto: **a definir**. Não aplicar automaticamente tarifa, cobrança, isenção ou rateio do Aprovisionamento/Empresas sem decisão própria. Não modificar cobrança existente.
- Infraestrutura canônica: Google Cloud Run + Firebase Hosting na arquitetura registrada em docs/EMPROVEX_RELEASE_CLOUD_RUN.md; evitar procedimentos históricos de deploy Vercel. Mudança em produto não implica mudança de infraestrutura.
- Nenhum desenvolvimento na expansão deve mudar o fundador, o login legado do Aprovisionamento ou os workspaces existentes sem migração explícita validada.

## 4. Catálogo de materiais e gestão logística

### 4.1. Tipos de material

**Consumo:** expediente, escritório, limpeza, higiene, descartáveis, itens de manutenção e outros suprimentos. Controlar quantidade, apresentação, conversão, saldo, posição, movimentações e histórico.

**Permanente:** mesas, cadeiras, armários, computadores, impressoras, equipamentos e bens sujeitos a identificação e responsabilidade. Planejar atributos como código patrimonial (quando houver), número de série, estado, documento de origem, local atual e detentor. A transferência patrimonial não deve ser tratada como consumo definitivo.

**Técnico/especializado:** materiais que exigem identificação especial, conferências ou documentação técnica pertinente. Não implementar CREM/TREM; armazenar documentos operacionais cabíveis apenas se fizerem parte da rotina do Almoxarifado.

A classificação consumo/permanente deve seguir os critérios oficialmente aplicáveis, sem inferência automática por preço, nome ou durabilidade.

### 4.2. Localização física

Preservar a hierarquia já existente:
**workspace → depósito → local → subposição**, com possibilidade de armazenamento diretamente no local (sem subposição), além de itens ainda não alocados.

Chave de decisão operacional: **posição física completa + material canônico + saldo positivo disponível**. Posição não é apenas estante; pode incluir depósito, local e prateleira/subposição. Saldo não alocado deve gerar pendência, não destino automático.

Reaproveitar croqui 2D, 3D, pesquisa global, etiquetas, códigos de barras, operações de transferência e auditoria do núcleo existente.

## 5. Fluxo prioritário — Pedidos SISCOFIS e ficha de separação

### 5.1. Objetivo

A dependência/seção da OM solicita material pelo SISCOFIS. O pedido percorre as autorizações oficiais cabíveis e chega ao perfil do Almoxarifado. O chefe do depósito exporta o pedido em PDF ou TXT, importa-o no EMPROVEX e utiliza os saldos/posições já cadastrados para orientar a separação física. O militar encarregado consulta ou imprime a ficha e recolhe itens nos lugares indicados.

O EMPROVEX **não cria, não autoriza e não baixa pedido dentro do SISCOFIS**. Seu estado de atendimento físico e seu saldo auxiliar são distintos dos estados/registros oficiais. Não chamar geração da ficha de "baixa no SISCOFIS".

### 5.2. Fluxo ponta a ponta proposto

1. **SISCOFIS:** a dependência efetua pedido e são observadas autorizações da OM.
2. **Exportação:** o chefe do depósito baixa PDF/TXT do pedido no sistema oficial.
3. **Importação EMPROVEX:** upload no workspace Almoxarifado; parser determinístico identifica versão/formato e extrai campos.
4. **Prévia de conferência:** mostrar número do pedido, solicitante, status/documento de origem, itens, unidade e quantidade; rejeitar arquivo ilegível, formato incompatível ou campos essenciais ausentes.
5. **Conciliação de itens:** relacionar código/ficha SISCOFIS com material EMPROVEX; validar unidade de medida e conversões. Ambiguidade requer confirmação humana.
6. **Planejamento da separação:** localizar posições com saldo e aplicar regras de seleção do item 5.3; exibir faltas, divisões e pendências.
7. **Conferência do chefe:** aprovar as posições/quantidades propostas antes da emissão da ficha; não efetuar baixa física só pelo upload.
8. **Ficha de separação:** gerar PDF com materiais ordenados por depósito, local e subposição; opcionalmente disponibilizar visão digital.
9. **Separação física:** militar percorre as posições indicadas, marca cada linha como separada e registra divergências (falta física, avaria, diferença de posição etc.).
10. **Validação da retirada/entrega:** responsável autorizado confirma quantidades efetivas. A movimentação auxiliar EMPROVEX é aplicada no momento definido no contrato operacional, com deduplicação e validação transacional.
11. **SISCOFIS permanece oficial:** realizar ou conferir os procedimentos formais de processamento/retirada no SISCOFIS. Registrar no EMPROVEX apenas a referência e situação observada, não simular transação no SISCOFIS.
12. **Conclusão:** preservar pedido de origem, hash, ficha, quem separou, conferiu, movimentações, divergências, destino e datas.

**Atenção a ordens e tempo das operações:** dependendo do fluxo SISCOFIS usado pela OM, a saída no sistema oficial pode ocorrer antes da retirada física. A especificação de eventos deve distinguir "autorizado/processado oficialmente", "separado", "retirado" e "entregue", sem presumir equivalência ou sequência universal. O evento exato de baixa auxiliar deve ser aprovado com usuários do Almoxarifado antes da implementação.

### 5.3. Regra de escolha de posição — DECISÃO FUNCIONAL

Calcular para cada item todas as posições válidas com saldo físico positivo no workspace (excluir locais desativados, saldo indisponível e posições inválidas).

| Caso | Comportamento obrigatório |
| --- | --- |
| Exatamente uma posição física válida, e saldo suficiente para a quantidade solicitada | Pré-selecionar automaticamente a posição completa; permitir conferência |
| Duas ou mais posições com o material, mesmo que apenas uma seja suficiente | Exibir opções para o usuário decidir de onde retirar; sugerir, mas não decidir silenciosamente |
| Várias posições e nenhuma suficiente isoladamente, porém saldo total suficiente | Permitir repartir explicitamente a quantidade entre posições, com soma validada |
| Exatamente uma posição, mas saldo menor que o pedido | Mostrar falta e impedir retirada integral automática; permitir atendimento parcial somente se confirmado |
| Saldo total inferior ao pedido | Mostrar indisponibilidade; permitir planejamento parcial quando autorizado, ou marcar pendência |
| Material sem posição alocada | Exigir resolução de localização/pendência; nunca inventar estante |
| Material sem correspondência canônica segura | Exigir vinculação manual antes da ficha final e da saída |
| Unidade ou fator de conversão incompatível | Bloquear linha até correção validada |
| Posição removida, saldo alterado ou reserva conflitante na confirmação | Revalidar no servidor e solicitar replanejamento |

Considerar o mesmo material em prateleiras diferentes como múltiplas posições, inclusive dentro da mesma estante; a regra automática não poderá esconder alternativas.

**Exemplo:** pedido de 20 resmas A4. Se houver somente EST-12 / P-02 com 35 resmas, seleção automática. Se houver também EST-08 / P-04 com 12 resmas, pedir escolha; a posição de 12 isoladamente não satisfaz 20, mas pode integrar uma separação dividida. A ficha deverá explicitar todas as parcelas.

### 5.4. Leitura determinística PDF/TXT

Implementar dois adaptadores de entrada (TXT e PDF com texto selecionável) que produzam **um mesmo contrato normalizado de pedido**. Não usar IA/LLM para interpretar documento como caminho obrigatório. Usar layout e estrutura verificáveis, testes de exemplos reais, validação de totais, limites de arquivo, número de linhas e erros explícitos. PDF escaneado/sem texto: informar impossibilidade de extração determinística e solicitar TXT ou PDF textual; OCR não é compromisso desta fase.

**Campos desejados, condicionais ao conteúdo real exportado:**
- Identificador/número do pedido e, se disponível, exercício, data e status;
- OM/UG, dependência/fração solicitante e destino;
- Código/ficha oficial do material e sua descrição;
- Quantidade solicitada ou autorizada conforme estado do documento;
- Unidade/apresentação de fornecimento;
- Centro de custos e demais referências, **somente quando presentes**;
- Posição da linha no documento de origem, para rastreabilidade.

Nunca preencher campo não existente como se tivesse vindo do SISCOFIS. Não presumir um layout único sem amostras reais; validar ao menos TXT e PDF, preferencialmente múltiplos cenários, para certificar regras e cabeçalhos.

**Correspondência material:**
1. Priorizar identificador oficial explicitamente vinculado a material canônico no workspace.
2. Validar unidade e eventual fator de conversão para unidade-base antes de propor saldo.
3. Utilizar descrição e normalização de texto como ajuda de pesquisa/possível correspondência, nunca como autorização para baixa automática ambígua.
4. Permitir que o chefe aprove mapeamento código SISCOFIS ↔ material EMPROVEX por workspace, com histórico e possibilidade de correção.
5. Se documento repetir item em linhas diferentes, preservar origem de cada linha e consolidar somente quando seguro.

**Idempotência e versão:** calcular hash do conteúdo importado, detectar pedido já existente por número/UG/workspace e impedir que mesmo pedido seja tratado como nova saída por importação repetida; para arquivo revisado, criar revisão controlada com diff e revalidação, sem reexecutar movimentação anterior. Um mesmo número em workspaces distintos não gera acesso cruzado.

### 5.5. Ficha de separação de material

A ficha é **documento operacional auxiliar do EMPROVEX**, distinto do pedido/ordem oficial do SISCOFIS. Deve conter:
- Cabeçalho da OM/setor, número interno, número e data do pedido SISCOFIS, dependência solicitante e situação;
- Item/código/ficha, descrição, unidade, quantidade solicitada, quantidade planejada e parcelas de separação;
- Depósito, local, subposição e quantidades a retirar de cada posição;
- Campo de conferência (checklist), divergências, faltas e observações;
- Responsável pela separação, conferência e data/hora, sem forjar assinaturas;
- Indicação expressa "Documento auxiliar de separação; não substitui os registros do SISCOFIS".

**Ordenação física:** agrupar por depósito → local → subposição para minimizar idas e voltas; ordem estável por código já oferece ganho. Roteirização ótima só com dados geométricos confiáveis e, por isso, não é obrigação R1. Permitir visualizar o pedido na ordem original para comparação.

**Saídas:** PDF A4 pronto para impressão e download; posteriormente, ficha digital no Operador Móvel com leitura de etiquetas/códigos de barras de posições e confirmação por linha. Não exigir smartphone do militar separador.

### 5.6. Estado do atendimento e proteção de saldos

Máquina de estados sugerida (a validar com operação real): IMPORTADO → EM_CONFERENCIA → PLANEJADO → EM_SEPARACAO → SEPARADO → SAIDA_CONFIRMADA/ATENDIDO; ramificações PENDENTE, PARCIAL, CANCELADO e DIVERGENTE. Guardar separadamente referência do status oficial SISCOFIS, se informado, sem inferir que os sistemas estão sincronizados.

**Ponto de segurança:** emitir ficha não é debitar saldo nem comprovar entrega. Movimentação física/auxiliar EMPROVEX deve usar o comando transacional servidor já existente, com idempotency key por atendimento/linha, revalidação de posição/saldo e trilha de auditoria. Confirmar o evento de baixa com operador do setor; não aplicar baixa duas vezes.

**Concorrência:** várias fichas simultâneas podem apontar para o mesmo saldo. A solução deve ao menos revalidar saldos atomicamente na saída; avaliar reserva de estoque em fase de planejamento se for realmente integrada a **todas** as rotas de saída que consomem saldo (desktop, móvel, consumo e outros). Não mostrar "reservado" caso a reserva não tenha cobertura transacional completa. Se perder disponibilidade, sinalizar replanejamento.

**Cancelamentos/ajustes:** cancelamento de ficha sem saída não altera estoque; corrigir uma saída confirmada somente por operação de devolução/estorno autorizada, nunca apagar ledger. Quando o pedido só puder ser atendido parcialmente, registrar quantidade planejada, separada e efetivamente entregue sem inventar atendimento integral.

### 5.7. Casos mínimos de homologação R1

1. TXT real válido; PDF textual real válido; campos iguais produzem contrato equivalente.
2. Arquivo ilegível/sem pedido identificado bloqueado, sem movimentação.
3. Código oficial resolvido e material em uma única posição → escolha automática correta.
4. Mesmo material em 2+ locais/subposições → seleção obrigatória; nenhum local inventado.
5. Quantidade dividida entre duas posições → soma exata e ficha com parcelas.
6. Material desconhecido, unidade inconsistente ou saldo não alocado → intervenção humana.
7. Saldo insuficiente, estoque alterado e concorrência → bloqueio/replanejamento, sem saldo negativo.
8. Reimportação de mesmo pedido → não duplica ficha ativa nem baixa já aplicada.
9. Cancelar plano/gerar PDF → não movimenta estoque.
10. Confirmar saída duas vezes → uma única movimentação idempotente, com evidência.
11. Pedido do workspace A não pode ser lido nem executado por conta do workspace B, mesmo com UG igual.
12. Retorno ao Aprovisionamento existente, login fundador e módulos warehouse atuais continuam sem regressão.

## 6. Reaproveitamento técnico já identificado

Inspeção somente de leitura na main informada; caminhos podem mudar antes do desenvolvimento. O objetivo é estender o núcleo existente, não copiar uma Central de Depósitos paralela.

| Arquivo/componente existente | Uso previsto no Almoxarifado |
| --- | --- |
| lib/platformIdentity.ts | Tipos de conta e proposta de sectorType |
| lib/platformAccess.ts e lib/workspaceContext.ts | Identidade, sessão e resolução de workspace |
| lib/sectorProvisioning.ts e Admin | Provisionamento e cadastro de novos setores |
| lib/platformModuleAccess.ts | Gate de acesso aos módulos por contexto confiável |
| lib/operationalPaths.ts | Isolamento das coleções de empenhos, notas e fornecedores |
| lib/warehouse/material.ts | Identidade do material, apresentações e conversões |
| lib/warehouse/location.ts | Depósitos, locais, subposições e saldos físicos |
| lib/warehouse/locationContents.ts | Conteúdo e saldos por local/subposição |
| lib/warehouse/outbound.ts | Validações de saída e conversão |
| lib/server/warehouseOutboundWrite.ts | Aplicação de saída servidor com autorização |
| app/api/central-depositos/operations/route.ts | Entrada autenticada das operações logísticas |
| lib/warehouse/siscofis.ts | Contratos e experiência de conciliação de estoque (não parser pronto de pedido) |
| lib/warehouse/siscofisPdf.ts | Infraestrutura de leitura determinística de PDF de mapa de existência; adaptar conceito, não assumir layout idêntico |
| features/warehouse/components/WarehouseSiscofisOperational.tsx | Experiência de importação/previsão de resolução manual |
| features/warehouse/pdf/WarehouseOutboundDocuments.ts | Fundação de documentos de retirada em PDF |
| features/warehouse/components/warehouseWithdrawalDraft.ts | Recuperação de rascunho de retirada, se adequada |
| Central 2D/3D, Operador Móvel e Modo Essencial | Experiência de navegação e separação física |
| docs/EMPROVEX_EMPRESAS_MEMORIAL_OFICIAL.md e PRs #416–#419 | Padrões propostos de login único, múltiplos produtos, Admin e roteamento |

**Não reutilizar incorretamente:**
- O Termo de Recebimento do Aprovisionamento não vira TREM do Almoxarifado.
- O parser atual do "Mapa de Existência SISCOFIS" NÃO deve ser tratado como parser de "Pedido de Material"; criar contrato próprio de pedido.
- As coleções atuais de material por workspace não podem ser filtradas apenas por UG.
- Mudança visual /login ou /almoxarifado não substitui proteção nas APIs e Rules.

## 7. Integração com setores e módulos existentes

### 7.1. Empenhos e notas fiscais

Reaproveitar a arquitetura operacional para empenhos, fornecedores, notas, cronogramas, saldos e documentos. Evitar validações e rótulos exclusivamente voltados à alimentação/QR em telas Almoxarifado. A experiência de Aprovisionamento permanece inalterada. Recebimento de NF no Almoxarifado pode registrar chegada e integração operacional, sem atribuir CREM/TREM ao setor.

### 7.2. Depósitos e Operador Móvel

Reutilizar depósitos e posições, operações de entrada, transferência, inventário, consulta global, códigos de barras, impressão e baixa. O novo "Pedido SISCOFIS" será recurso do Almoxarifado, preferencialmente apresentado como aba/subaba de Pedidos e Separação vinculada à Central de Depósitos, evitando telas duplicadas.

A separação por PDF é obrigatória no R1; fluxo móvel com barcode pode evoluir depois, sem retirar a impressão. O aplicativo móvel atual não precisa trazer 3D para realizar a separação.

### 7.3. Materiais permanentes

Constituem evolução própria R2. Ao distribuir bem permanente para dependência, o software não o deve tratar como consumo simples que extingue seu acompanhamento. Os registros oficiais de responsabilidade, patrimônio e transferência prevalecem. Especificar no R2: identificação individual, posição inicial, movimentação física, detentor, destino e documentação oficial conforme competência; não prometer substituição do SISCOFIS.

## 8. Arquitetura de referência e dados propostos (não implementados)

**Contexto de acesso** (ilustrativo):
- accountType: sector;
- sectorType: almoxarifado;
- workspaceId: identidade estável do Almoxarifado;
- ug: referência institucional, não chave de autorização entre setores;
- authorizedEmail e firebaseUid: vínculo seguro de provisionamento.

**Pedido importado**:
- workspaceId, sourceSystem=SISCOFIS, sourceFormat=TXT/PDF, sourceHash;
- externalRequestNumber, referenceDate, requestingUnit, statusFromSource (se houver);
- rows com sourceRowId, sourceItemCode, description, requestedQuantity, unit;
- canonicalMaterialId (resolvido/confirmado), factorToBaseUnit, warnings e revision;
- createdBy, createdAt e updatedAt.

**Plano de separação**:
- requestId, status, plannedBy/At, picker identity opcional, checker;
- linhas separadas em allocations com materialId, depotId, locationId, subpositionId ou posição direta, plannedQuantity, actualQuantity e notas;
- linkage para documentos auxiliares e movimentos aplicados idempotentemente.

**Associações catálogo**:
- par (workspaceId, código SISCOFIS, unidade) → materialId e conversão aprovados;
- quem aprovou e quando; revisão/correção auditáveis.

**Unidades e estoque:** armazenar quantidade na unidade canônica do catálogo e converter apresentações somente com fator explícito válido. Os dados de planejamento não devem alterar saldo físico até o evento de saída. Nenhuma nova coleção ou índice deve ser criado antes de uma revisão de contratos, regras e custo Firestore.

## 9. Plano executivo de desenvolvimento — estratégia híbrida R0.2 (DECISÃO VIGENTE)

**Decisão de 31/10/2026:** executar **sequencialmente as fundações e a integração final**, com **até três Workers de implementação em paralelo** apenas para módulos independentes e com contratos congelados. Não utilizar paralelismo irrestrito, nem redesenhar todo o sistema. O plano R0/R1/R2/R3 do produto permanece; os nomes W0–W5 abaixo representam frentes de execução, não versões comerciais.

### 9.1. Sequência obrigatória e dependências

```text
W0 — AUDITORIA CURTA DE REAPROVEITAMENTO (somente leitura de código + escrita do handoff neste memorial)
 ↓ checkpoint: arquitetura recomendada, dependências reais, contratos e GO/NO-GO fundamentado
W1 — FUNDAÇÃO R0 (identidade de setor, Admin, roteamento, workspace, shell do Almoxarifado)
 ↓ checkpoint: contrato compartilhado de Pedido/Material/Posição/Ficha congelado e testes dirigidos
 ├── W2 — IMPORTADOR SISCOFIS PDF/TXT (R1-A) ────────────────┐
 ├── W3 — LOCALIZAÇÃO E PLANEJAMENTO DE SEPARAÇÃO (R1-B) ────┼→ W5 INTEGRADOR
 └── W4 — FICHA DE SEPARAÇÃO PDF (R1-B) ──────────────────────┘   + SAÍDA R1-C
                                                                      ↓
                                                HOMOLOGAÇÃO → merge autorizado → Cloud Run
```

**W0 e W1 não são paralelos no mesmo contrato de identidade.** W0 identifica oportunidades; W1 implementa com a menor mudança validada. **W2, W3 e W4 podem trabalhar em paralelo** se W1 entregar contratos estáveis e os Workers não alterarem simultaneamente os mesmos arquivos centrais. **W5 começa a integração das três entregas somente após resultados tecnicamente utilizáveis**, resolve conflitos, confere saldo/concorrência e implementa a saída assistida. R2 Patrimônio é onda posterior específica, não pertence ao W2–W5.

| Worker | Papel | Dependência | Entregável e limites |
| --- | --- | --- | --- |
| **W0 — Auditor de reaproveitamento** | Somente leitura no código; registrar achados e handoff no memorial | PR documental #434 / branch do memorial | Estado real da main e do Empresas, mapa mínimo de componentes, riscos, contratos comuns e recomendação GO/NO-GO; **nenhuma alteração de código** |
| **W1 — Fundação Almoxarifado** | Identidade confiável, Admin e rota /almoxarifado, sem comprometer Aprovisionamento/Empresas | W0 concluído e revisado | Nova modalidade de setor, workspace isolado, navegação segura, testes P0; contrato R1 de dados acordado |
| **W2 — Parser pedido SISCOFIS** | Ler PDF textual/TXT e extrair contrato normalizado determinístico | W1 + contrato compartilhado | Parsers e testes independentes; idealmente amostras reais anonimizadas; nenhuma baixa |
| **W3 — Seletor de posições** | Correlacionar material, unidade, saldos e posições; planejar parcelas | W1 + contrato compartilhado | Regras de posição única, múltipla, divisão, falta e inconsistência; sem gravação de baixa |
| **W4 — Ficha PDF** | Gerar documento operacional para separação física | W1 + contrato compartilhado | PDF imprimível com depósito/local/subposição e parcelas; não altera estoque |
| **W5 — Integração e saída assistida** | Unir W2–W4, adicionar fluxos de conferência e execução segura no servidor | W2–W4 prontos e W1 homologado | Fluxo ponta a ponta, idempotência, revalidação, isolamento, regressão e evidência final |

### 9.2. Contrato comum antes do paralelismo

Para evitar divergência entre W2, W3 e W4, W1/integrador publicará um contrato de leitura e transformação que contenha, no mínimo:
- Pedido importado: workspaceId, sourceHash, identificador externo, solicitante e linhas;
- Linha do pedido: código/ficha SISCOFIS, descrição original, quantidade, unidade e vínculo canônico **validado**;
- Plano de separação: alocações por linha e posição completa (depósito/local/subposição ou local direto), quantidades e estados de validação;
- Ficha: mesmo plano imutável de separação, número de pedido, destino e metadados suficientes para impressão;
- Erros tipados (não encontrado, unidade incompatível, múltiplas posições, estoque insuficiente, pedido repetido, saldo alterado);
- Limites de responsabilidade por Worker e nomes dos arquivos centrais que só o integrador pode alterar.

**W2 não escolhe posição; W3 não interpreta o layout do SISCOFIS; W4 não movimenta estoque.** A transformação final e a aplicação transacional são responsabilidades do W5. Não duplicar núcleos de empenhos/warehouse nem criar versão paralela da autenticação.

### 9.3. Regras de colaboração, branches e governança

1. **Até três Workers de implementação simultâneos** (W2/W3/W4), mais um integrador de revisão. O W0 antecede o W1; não ativar a onda paralela sem base e contrato homogêneos.
2. **Um branch por Worker, PR DRAFT por entrega**, usando como base a branch/commit de integração definido no handoff. Evitar commits diretos na main e merge automático.
3. O integrador atua no fim da onda; resolve conflitos de contratos e valida os três fluxos juntos. Não considerar PASS isolado como certificação ponta a ponta.
4. Os testes devem ser **proporcionais ao risco**: testes específicos para parsers, invariantes de localização, geração PDF, permissões, concorrência e regressão de login e warehouse. Não repetir baterias gerais sem mudança pertinente, mas nunca retirar assertions críticas.
5. Tratar a PR Empresas #419 como dependência a **verificar novamente** antes do W1. Não presumir que roteamento empresarial ou tipos de conta já estão na main; W0 indicará o caminho seguro de reaproveitamento.
6. A produção permanece Cloud Run; somente após merge autorizado e homologação, conforme docs/EMPROVEX_RELEASE_CLOUD_RUN.md. Nenhum Worker deste planejamento pode fazer deploy, publicar Firestore Rules, alterar IAM, DNS, segredos ou cobrança por conta própria.
7. **Toda conclusão de Worker precisa deixar handoff auditável neste memorial**, seguindo a seção 13. Comentário de chat sozinho não conta como entrega.
8. O W0 não pode iniciar mudanças no código nem criar PRs funcionais; sua única escrita permitida é o adendo do memorial em branch própria, com PR de documentação.

### 9.4. Marcos GO/NO-GO

- **Após W0:** confirmar que as bases reais foram examinadas e que login único/Empresas, provisionamento e isolamento têm estratégia sem regressão. Parecer **GO para W1**, **GO condicionado** ou **NO-GO**, com fatores objetivos.
- **Após W1:** não liberar onda paralela se houver falha de login, navegação, escopo ou se o contrato R1 estiver instável. A PR Empresas não deve ser mesclada artificialmente para passar o gate.
- **Após W2–W4:** cada Worker entrega testes do módulo, evidência e handoff; W5 só integra itens conhecidos e congela alterações conflitantes.
- **Após W5:** testes integrados/segurança PASS, aprovação explícita para merge e publicação, e smoke test de Cloud Run do SHA correto. Publicação é ato separado de merge.

### 9.5. Etapas do produto (preservadas)

| Etapa de produto | Conteúdo | Prioridade |
| --- | --- | --- |
| R0 — Fundação | identidade, cadastro Admin, workspace, portal e reutilização de módulos | P0 |
| R1-A — Importação | pedido PDF/TXT, prévia e correspondência segura | P0 |
| R1-B — Localização e ficha | localização, seleção/particionamento e ficha de separação | P0 |
| R1-C — Execução física assistida | status, conferência, saída idempotente e histórico | P0 |
| R2 — Materiais permanentes | identificação, localização e detentor sem substituir registro oficial | P1 |
| R3 — Otimização | separação móvel, barcode e relatórios | P2 |

**Nota de desempenho:** as durações não são estimadas nem comprometidas; a ordem depende de evidências técnicas e dos modelos reais de exportação SISCOFIS.

---

## 10. Perguntas pendentes — não bloqueiam planejamento R0

1. Confirmar **amostras reais de PDF e TXT do pedido exportado SISCOFIS**, incluindo pedido com múltiplos itens, unidades diferentes e eventual atendimento parcial; ocultar dados pessoais quando necessário. A semântica e as posições exatas dos campos devem ser validadas com amostras, não inventadas.
2. Identificar o evento operacional preciso para a **baixa auxiliar EMPROVEX** (separação concluída, entrega física ou outra confirmação), em conjunto com o fluxo efetivo do SISCOFIS usado na OM.
3. Definir se o primeiro R1 exige atribuição de um militar separador e uma segunda conferência ou apenas registro de responsável final.
4. Resolver política de atendimento parcial e de pedidos alterados/cancelados após já existir ficha.
5. Determinar necessidade e desenho de reservas de estoque integradas a todas as rotas de saída.
6. Confirmar requisitos de gestão de materiais permanentes por tipo e como representar o detentor sem confundir consumo e transferência.
7. Definir estratégia comercial própria (preço, assinatura, trial, isenções) antes de qualquer habilitação de cobrança.
8. Verificar se a arquitetura de login do Empresas será homologada e integrada antes do início do W1 para evitar trabalho repetido.

Essas decisões devem ser respondidas com observação do fluxo real e menor burocracia possível. Não criar módulos adicionais para satisfazer hipóteses não confirmadas.

## 11. Decisões registradas (log imutável por adendos)

**31/10/2026 — Pré-planejamento inicial:** proposta de EMPROVEX Almoxarifado reaproveitando empenhos, NF, fornecedores, cronogramas, depósitos e Operador Móvel, com materiais de consumo e permanentes. A primeira ideia considerava CREM/TREM.

**31/10/2026 — Revisão R0.1 (PREVALECE):** usuário retira CREM/TREM porque não quer transferir atividade da Fiscalização Administrativa ao Almoxarifado; comissão de QR também fica fora. Introduz-se como prioridade a importação determinística de pedidos exportados do SISCOFIS em PDF/TXT, localização física por depósito/local/subposição, escolha automática com uma única posição e escolha humana com múltiplas, ficha de separação impressa ou digital e execução auxiliar da saída física.

**31/10/2026 — Consolidação do memorial:** manter documento oficial próprio separado do Empresas e do Aprovisionamento; reaproveitar a arquitetura de login/roteamento do Empresas, mas vincular contas por identidade autenticada, tipo, workspace e permissões — jamais e-mail puro. Estado de código: planejamento documental, sem implementação.

**31/10/2026 — Plano de execução R0.2 (PREVALECE):** abordagem híbrida, W0 e W1 sequenciais; W2/W3/W4 paralelos sob contrato estabilizado; W5 integrador e saída; handoff obrigatório no presente memorial, com PR e SHA verificáveis. Nenhum Worker homologado ou publicado nesta decisão.

**Regra de precedência futura:** decisões novas devem ser adicionadas como adendos datados ao topo ou a este log, sem apagar o motivo das decisões anteriores. Somente decisão expressa reabre escopo excluído.

---

## 12. Referências internas canônicas

- Memorial geral: docs/EMPROVEX_MEMORIAL_OFICIAL.md
- Empresas: docs/EMPROVEX_EMPRESAS_MEMORIAL_OFICIAL.md
- Publicação Cloud Run: docs/EMPROVEX_RELEASE_CLOUD_RUN.md
- Identidade: lib/platformIdentity.ts, lib/platformAccess.ts, lib/workspaceContext.ts
- Almoxarifado/warehouse: lib/warehouse/*, lib/server/warehouse*, features/warehouse/*
- PR de integração Empresas em revisão na data-base: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/419

**Caráter deste memorial:** especificação de produto, requisitos funcionais e controles de integração. Não representa implementação ou autorização de publicação.
---

## 13. Protocolo obrigatório de handoff de Workers — registro no memorial

**Objetivo:** ao receber a mensagem curta **"verifique o resultado do worker"**, o coordenador deve conseguir identificar, inspecionar e avaliar o trabalho pelo GitHub, **sem solicitar que o usuário cole longos relatórios, PRs ou SHAs**. O registro canônico é este arquivo na branch de entrega do respectivo Worker; se ainda não estiver mesclado, NÃO afirmar que o memorial da main está atualizado.

### 13.1. Como o Worker deve entregar o handoff

1. Antes do trabalho, ler este memorial integralmente, registrar SHA da main, branch e PRs relevantes que foram efetivamente consultados.
2. Operar em **branch isolada**; para o W0, partir **da branch documental da PR #434** (ou do commit mais recente desta PR), porque este arquivo pode não existir ainda na main. Sugerido W0: audit/emprovex-almox-r0-w0-reuse.
3. Escrever o **handoff no próprio docs/EMPROVEX_ALMOXARIFADO_MEMORIAL_OFICIAL.md** da branch de entrega; preservar o conteúdo existente e somente acrescentar adendo em ordem cronológica à seção 13.3. Não editar memoriais de Empresas/Aprovisionamento como substituição.
4. Abrir **PR DRAFT de documentação do W0** com base na branch da PR #434 (se continuar sem merge); se a #434 já tiver sido integrada, usar main como base. Indicar claramente no título "EMPROVEX Almoxarifado W0 — auditoria de reaproveitamento e handoff". Não publicar nem mesclar automaticamente.
5. No corpo da PR, apontar o **caminho exato do memorial** e o link âncora para a seção de handoff; incluir as evidências essenciais. A mensagem final do Worker deve ser curta: **link da PR + branch + SHA + resultado GO/NO-GO + "handoff registrado no memorial"**.
6. Registrar status com precisão: PLANEJADO, AUDITADO, EM PR, HOMOLOGADO ou PUBLICADO. Nunca usar "implementado" em auditoria somente leitura, nem afirmar que PR aberta está na main.
7. Se não conseguir escrever/abrir PR, informar **explicitamente** a impossibilidade, a razão e o texto exato de adendo para inserção posterior. Não declarar handoff concluído sem commit verificado.

### 13.2. Modelo obrigatório do registro (preencher fatos, não previsões)

O adendo deve conter os seguintes campos com evidências rastreáveis:

- **Identificação:** Worker, data UTC/BRT, objetivo, versão do memorial, branch, commit SHA, PR da entrega, base e estado de merge.
- **Escopo realizado:** arquivos/áreas realmente inspecionados e limites. Diferenciar achado **confirmado**, **hipótese** e **não verificado**.
- **Mapa de reaproveitamento:** componente atual, localização no repositório, estado (main / PR) e ação mínima recomendada (reutilizar, adaptar, aguardar, não tocar).
- **Identidade e Empresas:** situação real da #419, main, /login, setor vs company; riscos de accountType/sectorType, roteamento e regressões.
- **Central de Depósitos/SISCOFIS:** parser de Mapa de Existência vs pedido exportado, posições e saldos, command server, documento de saída e lacunas reais.
- **Riscos/pendências:** classificação P0/P1/P2, impacto e decisão objetiva que desbloqueia; marcar arquivos reais ainda necessários (TXT/PDF) em vez de inventar campos.
- **Provas:** links para arquivos/commits/PRs/checks, comandos somente leitura quando houver e resultados obtidos. Falta de evidência é estado não verificado.
- **Parecer:** GO, GO CONDICIONAL ou NO-GO **para iniciar W1**, com justificativa.
- **Próxima ação:** contratos que W1 deverá congelar, arquivos a preservar, sugestão concreta de branch/PR e plano de testes mínimos.
- **Nenhum efeito colateral:** declarar se houve ou não alterações de código, merge, publicação, Firestore, IAM, cobrança ou dados.

### 13.3. Handoffs registrados — histórico de execução

> **ESTADO EM 31/10/2026, na criação do plano R0.2: NENHUM WORKER DO ALMOXARIFADO CONCLUÍDO.** As linhas a seguir são apenas placeholders de organização e não constituem resultados.
>
> **W0 — AGUARDANDO EXECUÇÃO.** O Worker deve substituir esta linha de status por um **adendo datado abaixo**, com os campos da seção 13.2, sem reescrever seções de produto.


### W0 — 31/10/2026 (BRT) / 01/11/2026 (UTC) — Auditoria de reaproveitamento R0.2 — AUDITADO / EM PR

**Identificação e rastreabilidade.** Worker W0 (somente leitura de código); memorial R0.2; branch `audit/emprovex-almox-r0-w0-reuse`, derivada do head `7e2d2e0395a7b58331466b1a9251672eb878bfe4` da [PR documental #434](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/434), **aberta/DRAFT/não mesclada** na conferência. Main observada: `35825d5ad563361fecd1b3d2a00ca81a4734e532`; PR W0 e commit de entrega: registrados na própria [branch W0](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/tree/audit/emprovex-almox-r0-w0-reuse) e na [PR DRAFT #435](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/435), com base na branch documental da #434. O SHA final é o `head.sha` da PR, que deve ser consultado no GitHub; não é possível inserir o hash de um commit no próprio conteúdo que determina esse hash. **Parecer: GO CONDICIONAL para iniciar W1, sem merge/deploy.**

**Escopo/evidência examinada.** Leitura do memorial R0.2 e seções 1–13; estado da main e das [PRs Empresas #416](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/416), [#417](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/417), [#418](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/418), [#419](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/419) e #434. Consulta direta de arquivos da main e da branch `integration/empresas-r0-wave-20261029`, listagens de módulos e comparação GitHub entre refs. **Não executados** testes, build, emulador, extração de pedidos reais ou experimentos com dados: auditoria estática proporcional à missão. Os caminhos citados abaixo são links verificáveis no GitHub (ref da main observado, exceto quando indicado).

**Identidade, navegação e Empresas — CONFIRMADO.**
- [#419](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/419): **open, DRAFT, sem merge, head `2281ac7deddc5271354e1f1faef441bc17246472`, mergeable=false na consulta** (não equivale a diagnóstico conclusivo de CI). #416 (Admin), #417 (provisionamento) e #418 (gateway `/login`/`/empresa`) também abertas/sem merge. A comparação `integration/empresas-r0-wave-20261029...main` retornou `diverged` (main 89 commits à frente, branch 12 atrás na comparação); não fazer merge direto sem reconciliação.
- Na [main, `lib/platformIdentity.ts`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/lib/platformIdentity.ts), `PlatformAccountType = 'platformAdmin' | 'sector'`; **`sectorType` ainda não existe**. [`lib/sectorProvisioning.ts`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/lib/sectorProvisioning.ts) cria conta `sector` e workspace com Firebase UID, e-mail autorizado e UG. [`lib/platformAccess.ts`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/lib/platformAccess.ts) verifica provedor, conta ativa, UID (bootstrap somente legado), workspace ativo e UG; [`lib/workspaceContext.ts`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/lib/workspaceContext.ts) conserva fundador com dupla modalidade de perfil. [`lib/operationalPaths.ts`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/lib/operationalPaths.ts) mantém dados operacionais sob `workspaces/{workspaceId}/...`.
- [`lib/server/warehouseAccess.ts`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/lib/server/warehouseAccess.ts) verifica token, tipo `sector`, status, UID, provedor, workspace e UG, aplica claims com `emprovexWorkspaceId` e gate de faturamento existente. [`lib/warehouse/namespace.ts`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/lib/warehouse/namespace.ts) usa `warehouse/{workspaceId}/{domain}/{id}`. **UG não é tenant**: suportar workspaces diferentes com a mesma UG sem vazar dados/claims.
- A branch #419 propõe `company`, `workspaceType=company`, `GET /api/company/session`, shell `/empresa` e gateway com `OperationalEntry`; **não estão na main**. [`lib/server/companySession.ts` da #419](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/integration/empresas-r0-wave-20261029/lib/server/companySession.ts) é padrão útil de autorização no servidor, mas não transferir permissões de empresa para setor. **Conflito concreto P0:** o `lib/platformIdentity.ts` da #419 mantém `FOUNDER_AUTH_PROVIDER='google.com'` e o `app/login/page.tsx` da #419 inicia o fundador por popup Google; a main atual define fundador por senha, com Google somente como compatibilidade de backend e visual oculto. Não substituir o login atual pelo gateway antigo nem reverter correções de autenticação/navegação.
- **Contrato a validar no W1 (PROPOSTO, não implementado):** `accountType=sector` + `sectorType=aprovisionamento|almoxarifado`; ausência do discriminador em contas setoriais legadas significa `aprovisionamento`; `company` usa resolvedor independente quando homologado; fundador `platformAdmin` segue `/admin` sem inferir workspace pelo e-mail. Roteamento de conveniência: setor legado `/central-empenhos`, almox `/almoxarifado`, company `/empresa`. A API deve resolver e autorizar por token Firebase **verificado + UID de conta + workspace + status + modalidade + política vigente**; nunca por e-mail ou caminho isolado. Preservar as rotas de depósitos/operador e o perfil fundador atual.

**Mapa mínimo de reaproveitamento — CONFIRMADO NA MAIN (estado / decisão).**

| Núcleo e arquivos realmente examinados ou listados | Classificação | Ação mínima |
| --- | --- | --- |
| `features/empenhos`, `features/notas-fiscais`, `features/fornecedores`, `features/cronogramas`, `features/itens`, `features/relatorios`, `features/operational`; `lib/operationalPaths.ts` | Reutilizar **com adaptação** | Usar mesmas consultas/serviços por workspace; trocar apenas rótulos e condicionais setoriais; retirar fluxos exclusivos de alimentos/QR e CREM/TREM no shell Almox |
| `lib/platformIdentity.ts`, `platformAccess.ts`, `workspaceContext.ts`, `sectorProvisioning.ts`, `platformModuleAccess.ts`, `components/admin/AdminCreateSectorPanel.tsx`, `lib/server/sectorProvisioningAdmin.ts` | Reutilizar **com adaptação W1** | Discriminador opcional de setor, campo Admin, roteamento seguro, fallback legado e regressão do fundador; não criar outro Auth |
| Branch Empresas #419: `app/login/OperationalEntry.tsx`, `app/login/page.tsx`, `lib/server/companySession.ts`, `app/empresa/*` | **Aguardar/reconciliar**, padrão reaproveitável | Não importar branch antiga inteira, nem declarar empresas prontas; evitar arquivos compartilhados alterados em paralelo |
| `lib/warehouse/material.ts`, `location.ts`, `locationContents.ts`, `stockView.ts`, `lib/warehouse/namespace.ts`, `lib/warehouse/bulkStockMaterialMatcher.ts` | **Reutilizar sem duplicar**, com adaptador W3 | Identidade, conversão, saldos por posição e sugestões de correspondência; descrição/unidade é busca, não autorização de baixa |
| `features/warehouse/components/WarehouseDepotCroquis.tsx`, `WarehouseIsometricPreview.tsx`, `WarehouseGlobalMaterialSearch.tsx`, `WarehouseModuleShell.tsx`, `WarehouseTabNavigation.tsx`; `features/warehouse/navigation.ts` | **Reutilizar interfaces**, adaptar acesso | Croqui 2D/3D, busca, tabs e shell existentes; não recriar depósito nem modificar motor 3D |
| `features/warehouse/mobile/*`, `app/operador-movel/*`, `lib/warehouse/mobileOutbound.ts` e `mobilePositionCheckModel.ts` | **Reutilizar posteriormente** | Leitura, localização/barcode/saída móvel já existentes; ficha impressa é o caminho obrigatório R1, móvel opcional R3 |
| `lib/warehouse/outbound.ts`, `withdrawal.ts`, `desktopWithdrawalReplan.mjs`, `lib/server/warehouseOutboundWrite.ts`, `warehouseWithdrawalAtomicWrite.ts`, `warehouseWithdrawalV3Write.ts`, `app/api/central-depositos/operations/route.ts` | **Reutilizar com adaptação somente W5** | Validadores, replanejamento e transação com replay/idempotência, não criar outra escrita de saldo/ledger |
| `features/warehouse/pdf/WarehouseOutboundDocuments.ts`, `WarehouseAllocationSheet.ts`, `lib/pdfToolkit.ts` | **Reutilizar com adaptação W4** | Padrão jsPDF/A4, paginação e impressão; **novo modelo de ficha de separação** antes da baixa, sem reciclar declaração de saída já concluída |
| Leitor de **Pedido de Material SISCOFIS** PDF/TXT | **Desenvolvimento novo W2** | Dois adaptadores determinísticos e mesmo contrato normalizado, sem IA obrigatória e sem tocar parser atual |

**SISCOFIS — distinção obrigatória.** [`lib/warehouse/siscofis.ts`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/lib/warehouse/siscofis.ts) trata importação/inventário e conciliação de **Mapa de Existência**; inclui lógica específica de alimentos, que não pode ser importada como filtro do Almox. [`lib/warehouse/siscofisPdf.ts`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/lib/warehouse/siscofisPdf.ts) exige marcador textual *“mapa de existencia - material de consumo”* e colunas como `Qtde Exist`, rejeita PDF sem estrutura reconhecida e alguns streams comprimidos; **não interpreta pedidos**. [`WarehouseSiscofisOperational.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/features/warehouse/components/WarehouseSiscofisOperational.tsx) fornece padrão de upload, prévia e revisão manual, não parser reutilizável. **Nenhuma amostra real PDF/TXT de pedido examinada**; posições/nomes de campos são desconhecidos. W2 deve rejeitar TXT/PDF ilegível, escaneado, ambíguo ou incompatível, limitar tamanho/páginas/linhas e identificar versão/layout real. No contrato de entrada são obrigatórios `workspaceId` (do servidor), `sourceFormat`, `sourceHash` e rastreabilidade da linha; para liberar plano, **número do pedido, solicitante, descrição/código identificável, quantidade inequívoca positiva e unidade validada** são obrigatórios ou exigem complementação manual. Data, status, UG do documento, centro de custo e código/ficha (se não houver) são opcionais com `null` e aviso. Não confundir quantidade pedida com autorizada sem cabeçalho que prove a semântica.

**Posições, estoque e execução — CONFIRMADO / PROPOSTO.** [`WarehouseStockPosition`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/lib/warehouse/location.ts) tem `UNASSIGNED`, `LOCATION{depotId,locationId,subpositionId:null}`, `SUBPOSITION{depotId,locationId,subpositionId}`; saldo autoritativo é `WarehouseLocationBalance` por material/posição/workspace. [`locationContents.ts`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/lib/warehouse/locationContents.ts) deriva projeção positiva por local, e [`stockView.ts`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/lib/warehouse/stockView.ts) separa saldo localizado de `UNASSIGNED`. W3: uma posição **única e suficiente** => sugerir automaticamente; se 2+ posições positivas, **escolha humana inclusive se uma basta**; dividir quantidade em parcelas e validar soma; faltas/posições inválidas/unassigned/código ambíguo => pendência ou atendimento parcial explícito. `planejamento` e `separação` não mexem no saldo. Revalidar saldo e localização no servidor na **retirada/baixa auxiliar**, preservando estado oficial independente no SISCOFIS. [`warehouseOutboundWrite.ts`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/lib/server/warehouseOutboundWrite.ts) já evita replay conflitante, saldo negativo, posição inativa e conflitos de atribuição de lotes; [`warehouseWithdrawalAtomicWrite.ts`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/lib/server/warehouseWithdrawalAtomicWrite.ts) agrega linhas em transação e audita replay. **Limite existente:** `WAREHOUSE_WITHDRAWAL_MAX_LINES=40` e corte de conjunto transacional acima de 450 documentos; W5 deve respeitar/avaliar pedidos grandes sem fragmentar saída de forma insegura. Evento de baixa auxiliar e eventual reserva dependem de validação do fluxo real, sem prometer reserva não atômica.

**Contrato compartilhado v1 a congelar no W1 — PROPOSTO, não é esquema existente.** Criar **uma única** definição tipada, por exemplo `lib/almoxarifado/contracts.ts` (propriedade exclusiva W1/integrador, não W2–W4), incluindo:
- `ImportedRequestV1 { schemaVersion:'almox_request_v1', requestId, workspaceId, source:{system:'SISCOFIS',format:'PDF'|'TXT',sha256,layoutId|null}, externalRequestNumber:string|null, requestingUnit:string|null, referenceDate:string|null, officialStatus:string|null, revision:number, rows: RequestLineV1[], issues: TypedIssue[] }`.
- `RequestLineV1 { sourceRowId, sourceText, sourceItemCode:string|null, description, sourceQuantity:number|null, quantityMeaning:'REQUESTED'|'AUTHORIZED'|'UNKNOWN', sourceUnit:string|null, canonicalMaterialId:string|null, factorToBaseUnit:number|null, canonicalQuantity:number|null, matchStatus:'UNRESOLVED'|'CONFIRMED'|'INVALID' }`. **Nunca transformar `UNKNOWN` em `AUTHORIZED` automaticamente**. Chave de mapeamento: `(workspaceId,sourceItemCode,sourceUnit)` explicitamente aprovada, versionada e auditável; fallback de descrição somente sugestão.
- `SeparationPlanV1 { planId, requestId, revision, workspaceId, status, rows:[{sourceRowId, materialId, requestedBaseQuantity, plannedBaseQuantity, actualBaseQuantity:null|number, allocations:[{allocationId, position:WarehouseStockPosition, plannedBaseQuantity, actualBaseQuantity:null|number}]}], stockSnapshotRevision?, createdBy, createdAt }`. Em `PLANEJADO` soma de alocações = quantidade planejada, posições reais ativas e `planned <= requested`; `actual` só após conferência; `PARCIAL` explícito.
- `SeparationSheetV1` é **projeção imutável** de pedido + plano (IDs, OM, dependência, número, data, itens/parcelas, posição completa, faltas, responsáveis e aviso de documento auxiliar); W4 renderiza sem gravar saldo. `TypedIssue {code, severity, sourceRowId?, details?}`, com códigos mínimos `UNREADABLE_SOURCE`, `MISSING_REQUEST_ID`, `UNKNOWN_QUANTITY_MEANING`, `MATERIAL_UNRESOLVED`, `UNIT_INCOMPATIBLE`, `MULTIPLE_POSITIONS`, `INSUFFICIENT_STOCK`, `UNASSIGNED_STOCK`, `STOCK_CHANGED`, `DUPLICATE_REQUEST`, `IDEMPOTENCY_CONFLICT`.
- Chaves estáveis: `(workspaceId,sourceHash)` para reimportação idêntica, `(workspaceId,externalRequestNumber,revision)` para versões do pedido (se número existir), `(workspaceId,requestId,sourceRowId,allocationId)` para aplicar **uma** baixa/linha/posição. Definir IDs determinísticos/validados e ledger de aplicação exclusivamente no W5. Hash sozinho não autoriza reaplicar; revisões de pedido não repetem saídas.

**Partição de trabalho após W1 (sem ativar Workers):** W1 altera, sob dono único, `lib/platformIdentity.ts`, provisionamento/Admin, entrada de `/login`, `app/almoxarifado/*` e define `lib/almoxarifado/contracts.ts`; concilia mudanças recentes de main e a #419 sem cherry-pick irrestrito. **W2** edita apenas `lib/almoxarifado/siscofisRequestPdf.ts`, `siscofisRequestTxt.ts`, `siscofisRequestParser.ts` e respectivos testes; **W3** apenas `lib/almoxarifado/materialMatch.ts`, `positionPlanner.ts` e testes; **W4** apenas `features/almoxarifado/pdf/SeparationSheet.ts` e testes. Todos importam contratos congelados; não alteram `platformIdentity.ts`, `app/login/page.tsx`, `lib/warehouse/{location,outbound,siscofis,siscofisPdf}.ts`, `app/api/central-depositos/operations/route.ts` nem `lib/server/warehouse*Write.ts`. **W5** é o único dono da ligação das três peças, do endpoint/saída assistida e da eventual adaptação transacional/limites. Criar branch/PR DRAFT individuais em base homologada de W1 e integrar apenas no checkpoint W5.

**Riscos e pendências classificados.**
- **P0:** #419 não integrada, divergente da main, e branch com login fundador anterior => reconciliar manualmente contrato de identidade, login único e redirects antes de integrar código; testar fundador (senha e Google elegível), setor legado sem `sectorType`, Admin, company não autorizada, troca de URL e mesma UG com workspaces separados. Proibir contextos company no warehouse setorial.
- **P0:** construir nova modalidade só por e-mail/rota/UG pode vazar tenant => validar token/UID/conta/tipo/subtipo/workspace/status no resolvedor e gates server-side, com fail closed. Nenhuma alteração de Rules/IAM neste W0.
- **P0 para W2/W5 (não bloqueia W1):** faltam **amostras reais anonimizadas** de Pedido de Material SISCOFIS em TXT e PDF textual; sem elas não fixar layouts nem homologar importação. Falta decidir evento operacional de baixa auxiliar e estado parcial; não autorizar saída por suposição.
- **P1:** concorrência entre fichas e demais canais, saldos de posição e lotes, limites 40 linhas/450 documentos; revalidar atomicamente e garantir replay sem duplicação. W3 não reservar saldo; W5 define limite/particionamento seguro se amostra exceder.
- **P1:** unidade de fornecimento/conversão e material permanente não devem virar consumo por classificação implícita; bloquear mapeamento impreciso, manter R2 patrimônio fora do R1.
- **P2:** rotas ótimas de coleta, leitor móvel com barcode e reservas integradas só após evidência de necessidade e viabilidade.

**Parecer e próximo checkpoint.** **GO CONDICIONAL para W1** em **branch independente**, pois as fundações setoriais, warehouse e PDF já existem e podem ser estendidas sem reescrita. Condições para considerar W1 concluído e liberar W2/W3/W4: contrato único v1 congelado; identidade `sectorType` com fallback do legado; UID/workspace/claims/gates consistentes; Admin e `/almoxarifado` sem vazamento; rota Empresas não tratada como implementada na main; testes mínimos de regressão de login fundador, setor legado, navegação, duas contas mesma UG/workspaces distintos, negativas de autorização e build/TypeScript apenas nos arquivos afetados. Não há autorização de merge nem produção. Parecer **não** certifica #419 nem parsers ainda inexistentes.

**Efeitos colaterais:** nenhuma funcionalidade, Rules, autenticação efetiva, cobrança, infraestrutura Cloud Run, IAM, dados reais, merge ou deployment foi alterado; **única escrita** é este adendo de documentação na branch W0. Check de execução: [PR #434](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/434), [PR #419](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/419), [main](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/commit/35825d5ad563361fecd1b3d2a00ca81a4734e532), [branch documental base](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/commit/7e2d2e0395a7b58331466b1a9251672eb878bfe4).

---

#### W1 — Fundação, identidade, provisionamento e portal operacional (31/10/2026)

**Entrega no GitHub:** [PR DRAFT #436](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/436); branch `feat/emprovex-almox-r0-w1-foundation`, base `main` `35825d5ad563361fecd1b3d2a00ca81a4734e532`. A PR é a fonte de verdade do **SHA final (`head.sha`)**, atualizado após este próprio adendo. SHA de checkpoint de código/documentação pré-handoff: `675a8ebd153fb3b1035777ac7d32832afd1e2134`. Um commit não pode conter o seu próprio hash final no conteúdo que o determina; consultar o `head.sha` da PR para a referência exata mais recente. Memorial R0.2 e adendo W0 foram copiados integralmente da branch da PR #435; PR documental #434 continua em DRAFT. Nenhum merge/cherry-pick da #419 (Empresas).

**Implementações persistidas na branch W1, NÃO em produção:**
- Modelo `accountType=sector` e `sectorType` (Aprovisionamento ou Almoxarifado), com fallback para Aprovisionamento quando ausente; validação estrutural em conta/workspace e verificação da coincidência de modalidade.
- Provisionamento administrativo de Almoxarifado com UID Firebase, e-mail autorizado, OM, sigla, UG e workspace setorial próprio, reutilizando código de cadastro. A separação de índices/locks por modalidade permite a mesma UG em dois workspaces, sem usá-la como chave de autorização. Nenhum trial/cobrança do Aprovisionamento é criado para Almoxarifado, cuja política comercial permanece indefinida.
- Contexto autenticado com UID, status, workspace e modalidade conferidos; gate da Central de Depósitos preserva verificação server-side e valida modalidade correspondente de conta e workspace. Login existente conserva senha do fundador e compatibilidade Google no backend, sem botão Google novamente exposto. Redirecionamentos: Admin `/admin`, setor legado `/central-empenhos`, Almox `/almoxarifado`; empresas não habilitadas automaticamente.
- Portal `/almoxarifado` protegido, com modo Normal/Essencial, início e acesso ao núcleo compartilhado da Central de Depósitos; nove destinos preparados. Empenhos, NF, cronogramas, fornecedores, consulta de itens, relatórios e pedidos SISCOFIS **ainda não foram homologados como operacionais para Almox** e são apresentados como preparação. O portal não expõe CREM/TREM/comissão QR. Reuso integral das telas financeiras/fluxos sem elementos alimentares **é pendência**, não resultado certificado.
- Contrato tipado único R1 em `lib/almoxarifado/contracts.ts`: `ImportedRequestV1`, `RequestLineV1`, `MaterialCorrespondenceV1`, `PhysicalPositionV1`, `SeparationPlanV1`, `SeparationSheetV1`, `SeparationPdfResultV1`, erros `TypedIssueV1`. Sem importador, planejador, gerador PDF ou baixa/ledger implementados.
- Proposta de `firestore.rules` em **código da PR apenas** para aceitar e conferir `sectorType` e reservar índice auxiliar. **Nenhuma Rule foi aplicada ou publicada**. Requer simulação no Emulator, revisão das invariantes da Rules publicada e aprovação específica antes de provisionamento real.

**Arquivos alterados/criados:** `lib/platformIdentity.ts`, `lib/workspaceContext.ts`, `lib/sectorProvisioning.ts`, `lib/platformAccess.ts`, `lib/server/sectorProvisioningAdmin.ts`, `lib/platformAdminStore.ts`, `components/admin/AdminCreateSectorPanel.tsx`, `lib/sectorBillingGate.ts`, `lib/server/warehouseAccess.ts`, `app/login/page.tsx`, `features/warehouse/components/WarehouseProtectedSurface.tsx`, `app/almoxarifado/page.tsx` (novo), `lib/almoxarifado/contracts.ts` (novo), `firestore.rules` (somente proposta), `scripts/emprovex-almox-w1.test.mjs` (novo), este memorial. Nenhum arquivo dos motores W2–W5 alterado.

**Testes e evidências — distinção obrigatória:** 15/15 verificações **textuais, em leitura de arquivos efetivamente presentes no GitHub**, PASS (fallback, discriminador, UID/status, índices UG por modalidade, ausência de cobrança herdada, proteção de portal, roteamento, contrato, Rules e integridade do W0). Foi adicionado `scripts/emprovex-almox-w1.test.mjs`, porém **sua execução não foi comprovada**. `node --test scripts/emprovex-almox-w1.test.mjs`, `npm run typecheck`, `npm run build`, testes do Firestore Emulator, login do fundador, setor legado, Almox QA, duas modalidades na mesma UG, contas desativadas, trocas de URL, APIs e navegação requerem execução real; **não registrar PASS** para esses cenários. Nenhuma conta QA real foi provisionada ou alterada.

**Riscos bloqueantes P0:** (1) TypeScript/build/CI e emulator/Auth QA não certificados; (2) Rules alteradas na PR mas não homologadas/publicadas — provisionamento ou atualizações de contas com `sectorType` podem falhar contra Rules vigentes; (3) reuso das interfaces financeiras para Almox e eliminação de operações alimentares não concluídos; (4) integrações de navegação direta/warehouse e cobranças futuras precisam homologação por modalidade; (5) PR Empresas #419 permanece isolada e não homologa `company` nem `/empresa`. Verificar em especial o índice de UG separado, a consistência de proteção no servidor e o ramo legável de login ao integrar na main.

**Parecer W1: NO-GO para ativar W2, W3 e W4 neste checkpoint.** O esqueleto foi implementado e o contrato R1 definido, mas **não congelado/homologado** sem TypeScript, build, emulador, regressão e resolução dos bloqueios citados. A sequência é correção/homologação direcionada no **mesmo W1/PR #436**, sem iniciar W2–W5. Reavaliar então GO/GO CONDICIONAL. Não afirmar produção pronta nem expandir escopo.

**Evidência de ausência de publicação e integração:** PR #436 criada em `DRAFT`, alvo `main`, alteração restrita à branch; nenhuma operação de merge, deploy, Cloud Run, IAM, DNS, Firebase Auth real, faturamento ou publicação de Firestore Rules foi executada neste Worker. Consultar PR #436 e diff para confirmação atualizada. Handoff persistido diretamente neste memorial no commit final da PR.

---

#### W1 R0.1 — Correção pontual, homologação dirigida e liberação controlada (31/10/2026)

**PR/branch:** [#436](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/436) — `feat/emprovex-almox-r0-w1-foundation`, DRAFT, base inicial `main` no SHA `35825d5ad563361fecd1b3d2a00ca81a4734e532`. **SHA do código homologado antes deste handoff:** `8b09e33735906dc8805a877a3b40eb08776ce93f`. **SHA final da PR:** consultar o `head_sha` da #436 após este adendo (um commit não consegue conter seu próprio hash em seu conteúdo). Nenhum merge/deploy executado.

**Correções pontuais concluídas:**
1. `lib/sectorProvisioning.ts`: `SectorInstitutionalProfileInput` inclui `sectorType`, preservando perfil institucional de Almoxarifado e fallback do Aprovisionamento; o parser rejeita modalidade desconhecida sem casts artificiais.
2. `lib/server/warehouseAccess.ts`: mantém modalidade obrigatória no `VerifiedWarehouseRequest`, validada na fronteira server-side, compatível com conta/workspace/UID/status; removido cast artificial do subtipo.
3. `lib/server/warehouseMobileTrust.mjs`: preserva `sectorType` no resultado imutável e tipado; adapta somente a **entrada legada** sem o campo para `aprovisionamento`, rejeita subtipo desconhecido, não autoriza workspace adicional e não relaxa claims/UID.
4. `scripts/warehouse-mobile-trust-emulator.ts` e `scripts/warehouse-read-r1-emulator.ts`: fixtures declaram o setor histórico explicitamente, sem alterar motores.
5. `scripts/mobile-server-barcode-read.test.mjs`: expectativa atualizada para o resultado normalizado (`sectorType='aprovisionamento'`); adicionados assert de preservação de `almoxarifado` e negativa de `company`. Testes não removidos.
6. `scripts/emprovex-almox-w1.test.mjs`: cenário determinístico de provisionamento para duas modalidades com mesma UG, em workspaces/UID distintos, além dos testes W1 anteriores.
7. **Novos:** `scripts/emprovex-almox-w1-isolation-emulator.test.mjs` (autenticação real no Auth Emulator e Rules de teste) e `.github/workflows/emprovex-almox-w1-r01.yml` (certificação isolada, sem qualquer deploy ou publicação). As Firestore Rules do código permanecem PROPOSTAS; não aplicadas.

**Evidências realmente executadas (commit de código `8b09e33735906dc8805a877a3b40eb08776ce93f`):**
- GitHub Actions **EMPROVEX Almoxarifado W1 R0.1 — isolated certification**, run **41257796853**, **SUCCESS**: `npm ci`, `npm run typecheck`, `node --test scripts/emprovex-almox-w1.test.mjs`, `npm run build`, Firestore Auth/Rules Emulator (QA Aprovisionamento legado e Almoxarifado, **mesma UG**, workspaces diferentes, login password, UID divergente, modalidade divergente, conta/workspace desativados, acesso cruzado por URL, índice não gravável pelo setor), teste existente `test:central-depositos-external-security` de Warehouse multitenant — **todos PASS**.
- GitHub Actions **EMPROVEX Fast CI**, run **41257796926**, **SUCCESS**: TypeScript estrito, navegação P0, contratos móveis e testes afetados, incluindo a regressão `test:mobile-server-barcode-read` — **PASS**.
- **Core Protection** run **41257796873**, **SUCCESS**; **W4 Five-Worker Integration Evidence** run **41257796863**, **SUCCESS** (checks gerais aproveitados, não substituem os testes W1).
- **SAAS-DL Legal Validation** run **41257796805**, **FAIL** antes de seus testes, exclusivamente em **Diff hygiene** por espaços de fim de linha presentes no memorial W0 histórico (linhas 3–8 e fim). Este adendo também remove esses espaços e normaliza EOF; **a correção só estará certificada quando um novo check registrar PASS**. Não confundir falha de higiene documental com uma falha do TypeScript ou dos emuladores já aprovados.
- **Application CI** foi `skipped` porque PR permanece DRAFT, conforme política existente. Os testes dirigidos citados foram executados por workflow isolado, não por esse gate.
- **Limitações:** não houve login com conta real de produção nem provisionamento real; o login QA foi testado no Auth Emulator. Não publicar Rules ou solicitar merge para suprir essa limitação. Testes de navegador/fundador históricos podem ser aproveitados como evidência de regressão, mas não afirmar novo teste completo do fundador neste R0.1.

**Parecer técnico W1 R0.1: GO CONDICIONAL para iniciar W2, W3 e W4 em branches/PRs DRAFT isoladas**, derivados da fundação W1 corrigida. Os contratos `lib/almoxarifado/contracts.ts` não foram alterados nesta correção, permanecendo estabilizados para leitura e importação pelos três Workers. TypeScript, build, Auth/Rules Emulator e isolamento entre workspaces demonstrados. W2/W3/W4 não devem editar o contrato compartilhado nem executar escrita financeira/logística.

**Condições para integração/produção futura (NÃO bloqueiam desenvolvimento paralelo):** homologar e obter aprovação específica antes de publicar Firestore Rules, completar adaptação dos módulos financeiros e operacionais do Almoxarifado com exclusão de conteúdo alimentar, validar QA com provisionamento real e fluxos de navegação do fundador quando cabível; manter Empresas #419 independente. Nenhuma cobrança foi acrescentada; nenhum merge, Cloud Run deploy, IAM, DNS, Rules publish, Firebase Auth real ou transação em produção foi realizado. Este parecer **não é GO para produção**.

---

#### W2 R1-A — Importação determinística de Pedidos SISCOFIS PDF/TXT (31/10/2026)

**PR/branch:** [#438](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/438) — `feat/emprovex-almox-r1-w2-siscofis-parser`, **DRAFT**, destino `feat/emprovex-almox-r0-w1-foundation`. **Base obrigatória W1 R0.1:** `baa5cde3957cb00b40bec9e1a250621a15cc4e06`. **SHA do código e testes certificados antes deste handoff:** `a6174a8f0b9c43fc113beb715e68e111234e9da8`. O SHA FINAL da branch após este adendo deve ser consultado no `head_sha` da PR #438 (impossível registrar dentro do mesmo commit seu próprio SHA).

**Arquivos criados:** `lib/almoxarifado/siscofisRequestParser.ts`, `lib/almoxarifado/siscofisRequestTxt.ts`, `lib/almoxarifado/siscofisRequestPdf.ts`, `scripts/emprovex-almox-w2-siscofis-parser.test.mjs`, `scripts/fixtures/siscofis-request-synthetic-r1.txt`, `.github/workflows/emprovex-almox-w2-r1.yml`, mais este adendo documental. `lib/almoxarifado/contracts.ts` não foi modificado. Nenhum arquivo de W3/W4, identidade, Rules, Central de Depósitos, parser do Mapa de Existência, estoque ou saída foi alterado.

**Implementação:** os adaptadores independentes TXT (UTF-8 estrito) e PDF textual (estrutura validada com `pdf-lib`, extração delimitada de streams de texto) convergem para o único `ImportedRequestV1` congelado pelo W1. O normalizador preserva código, descrição, quantidade, unidade, estado do documento apenas quando presente, número/solicitante e `sourceRowId` da linha de origem; calcula SHA-256 dos bytes originais e ID de importação determinístico por workspace + hash. Mantém `canonicalMaterialId`, fator e quantidade canônica como `null`, com `matchStatus=UNRESOLVED`. Quantidade solicitada é `REQUESTED` e **nunca é tratada como autorizada**; `AUTHORIZED` exige cabeçalho textual explícito. Não efetua conversão automática nem correspondência de material, reserva, movimentação ou escrita.

**Reimportação e limite de responsabilidade:** a rotina recebe registros anteriores do **mesmo workspace previamente resolvidos no servidor**; bloqueia hash idêntico como `DUPLICATE_REQUEST`, número externo idêntico com hash divergente como `IDEMPOTENCY_CONFLICT` (revisão manual e diff pertencem ao W5) e contexto cruzado como `CROSS_WORKSPACE_ACCESS`. A versão inicial é `revision=1`. Não há persistência, consulta a banco, ledger nem mecanismo de rebaixa no W2.

**Escopo homologado e limitações explícitas:** **NENHUMA amostra real anonimizada de Pedido de Material SISCOFIS está homologada**. A implementação reconhece **somente** o marcador `SISCOFIS|PEDIDO_DE_MATERIAL|EMPROVEX_FIXTURE_R1`, um layout artificial identificado como sintético. Portanto, PDF/TXT reais de layouts desconhecidos são intencionalmente recusados: **NÃO há compatibilidade universal ou aptidão para uso operacional real**. Tabelas, fontes/encodings e paginações reais dependem de amostras, perfis verificados e testes próprios. PDF escaneado/sem texto, arquivo ilegível, layout desconhecido, quantidade ambígua ou inválida, unidade desconhecida, tabelas inconsistentes, campos essenciais ausentes e bytes acima de 2 MiB são rejeitados. Parser PDF suporta apenas subset textual explicitamente testado; OCR não foi implementado.

**Evidência executada:** GitHub Actions **EMPROVEX Almoxarifado W2 R1-A — parser isolated certification**, run **41261446090**, **SUCCESS** no commit `a6174a8f0b9c43fc113beb715e68e111234e9da8`: `npm ci`, **`npm run typecheck` PASS**, **`node --test scripts/emprovex-almox-w2-siscofis-parser.test.mjs` 7/7 PASS**. Cobertura sintética: dois formatos, hash e rastreabilidade de linha, item repetido, solicitação vs. autorização textual, campos opcionais ausentes, arquivo idêntico/revisado, cross-workspace, PDF textual e negação de scan/corrompido/Mapa, dados incompletos, quantidade e unidades ambíguas, limites, isolamento de estoque. **Core Protection** run **41261446053**, **SUCCESS**. Application CI da PR DRAFT **SKIPPED** por desenho; não equivale a teste falho. Demais checks gerais seguem sua própria evidência, sem substituir a certificação isolada. As tentativas intermediárias W2 falharam inicialmente por tipagem TS e depois por fixture de teste inadequada; ambas foram corrigidas e a certificação final citada concluiu com sucesso.

**Parecer W2: GO CONDICIONAL para integração TÉCNICA em W5**, apenas do motor determinístico e contrato sintético, com rastreabilidade e limites de segurança preservados; **NO-GO para importar pedidos reais, executar saída, merge ou produção**. O checkpoint para habilitar layouts reais exige coleta/anonimização de exemplares TXT e PDF textual, homologação específica dos campos/quantidades/estados e cenários negativos reais, mais aprovação do integrador W5. Nenhum merge, deploy, publicação de Firestore Rules, alteração de identidade, estoque ou transação foi realizado.

---

---

#### W3 R1-B — Motor determinístico de posições (31/10/2026)

**Entrega:** [PR DRAFT #439](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/439) → `feat/emprovex-almox-r1-w3-position-planner`, direcionada a `feat/emprovex-almox-r0-w1-foundation`. **Base exata W1 R0.1:** `baa5cde3957cb00b40bec9e1a250621a15cc4e06`. **SHA de código antes deste adendo:** `dcaf8eec653c260af28fba10ccea5b3f922f5b25`. O SHA final com o próprio handoff deve ser conferido no `head.sha` da PR #439 (um commit não pode registrar seu próprio hash em seu conteúdo).

**Arquivos exclusivos alterados/criados:**
- `lib/almoxarifado/materialMatch.ts` — correspondência por `MaterialCorrespondenceV1` aprovada e versionada com chave de workspace, código SISCOFIS e unidade; verificação do fator contra apresentações/conversões cadastradas, quantidade canônica limitada a seis decimais e sugestões textuais **sem confirmação automática**. Material fora do workspace, inativo, desconhecido ou mapeamentos conflitantes resultam em pendência.
- `lib/almoxarifado/positionPlanner.ts` — motor puro baseado em `RequestLineV1`, `SeparationPlanV1` e `WarehouseStockPosition`: elegibilidade somente de depósito/local/subposição ativos, com workspace e UG consistentes, saldos físicos reais e revisões, seleção única automática somente quando há uma posição suficiente, escolha humana se houver várias, parcelas explícitas que fecham o somatório e parcial apenas com `allowPartial`. O mesmo saldo não é contabilizado duas vezes entre linhas no mesmo plano. Exibe `MULTIPLE_POSITIONS`, `UNASSIGNED_STOCK`, `INACTIVE_POSITION`, `INSUFFICIENT_STOCK`, `STOCK_CHANGED` e `CROSS_WORKSPACE_ACCESS` sem inventar local/saldo.
- `scripts/emprovex-almox-w3.test.mjs` — testes determinísticos e regressões negativas para posição única, múltiplas, subposição, split, falta/parcial, inativos, desconhecido, unidade, mapeamento ambíguo, workspace, revisões, concorrência lógica entre linhas e duplicidades.

**Invariantes:** nenhuma gravação Firestore, transação, reserva, baixa, movimento, edição de ledger, alteração de `contracts.ts`, W2, W4, identidade, Rules ou infraestrutura. `SeparationPlanV1` preserva `actualBaseQuantity=null`, `plannedBaseQuantity <= requestedBaseQuantity`, soma das parcelas igual ao planejado, cada alocação com posição completa, revisão e saldo disponível do snapshot. `UNKNOWN` não vira quantidade autorizada. Uma sugestão por descrição nunca vincula `materialId` automaticamente. Snapshots de múltiplos workspaces são bloqueados integralmente, sem exposição de detalhes de terceiro.

**Evidências realmente executadas:** `node --test scripts/emprovex-almox-w3.test.mjs` — **13/13 PASS** em ambiente local isolado, com simuladores dos helpers puros de warehouse; `tsc --noEmit --strict --target ES2022 --module commonjs --moduleResolution node ...` — **PASS para os dois módulos W3** com interfaces locais equivalentes aos contratos W1 e warehouse. Hashes SHA-1 dos blobs de origem conferidos entre arquivos ensaiados e arquivos publicados na PR: `adc01cdb8703e04879244027a5b2d47761d0b53f`, `e8b0d8ae3c4be8aa1003b4cd1670f1f4529d1882`, `335471c0a00fea0a3004c957004e913d5bd85c0f`. **TypeScript/build da aplicação completa e CI GitHub ainda dependem de evidência própria**; não inferir PASS a partir desses testes isolados.

**Riscos e handoff ao W5:** (P0) snapshot de saldo pode ficar obsoleto entre planejamento e saída: W5 deve reconsultar e validar atomicamente sob transação/ledger idempotente; `revalidatePhysicalSeparation()` é apenas pré-conferência, nunca autorização de baixa. (P1) correspondências SISCOFIS exigem cadastro/validação da origem confiável e revisão auditável; não confiar em texto ou na marca `CONFIRMED` isolada do documento importado. (P1) apresentações especiais com rótulo não são convertidas por código genérico para evitar fator falso; homologar unidades reais do SISCOFIS com o catálogo. (P1) testes locais simulam helpers do warehouse e não constituem integração E2E; W5 precisa executar cenários de snapshots reais, isolamento e saldo concorrente. (P2) ordenação por chave estável de posição, sem roteirização geométrica.

**Parecer W3:** **GO CONDICIONAL para revisão/integrador W5**, com motor R1-B implementado e testes dirigidos verdes; **NO-GO para merge, baixa ou produção nesta PR isolada**. Manter DRAFT sem deploy, sem publicação de Rules e sem merge. A homologação final é responsabilidade de W5.

---

---

#### W4 R1-B — Ficha de Separação de Material PDF A4 (31/10/2026 BRT; 01/11/2026 UTC)

**Identificação/PR:** Worker W4; [PR DRAFT #437](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/437), branch 'feat/emprovex-almox-r1-w4-separation-pdf', direcionada à 'feat/emprovex-almox-r0-w1-foundation'. **Base imutável de partida:** W1 R0.1 SHA 'baa5cde3957cb00b40bec9e1a250621a15cc4e06'. **SHA de código certificado antes deste handoff:** '4c1fc73e7effd2a304a229b8cdf67aad48bf1541'. O SHA final do handoff é o head_sha consultável na PR #437 (o conteúdo do commit não pode incluir seu próprio hash). **Estado:** DRAFT; sem merge, deploy ou publicação.

**Arquivos W4:** 'features/almoxarifado/pdf/SeparationSheet.ts' (gerador); 'scripts/emprovex-almox-w4-separation-pdf.test.mjs' (6 testes sintéticos); '.github/workflows/emprovex-almox-w4-r1.yml' (certificação isolada); este adendo documental. Nenhuma alteração em contracts.ts, parsers W2, planejador W3, login, Rules, saldos ou operações de saída.

**Entrega funcional:** gera application/pdf A4 com jsPDF carregado sob demanda via lib/pdfToolkit.ts, resultado compatível com SeparationPdfResultV1, doc para download/impressão pelo consumidor, nome de arquivo sanitizado e total de páginas. Utiliza diretamente SeparationSheetV1 e projeções **somente leitura** de ImportedRequestV1 e das entidades warehouse do mesmo workspace: ficha/OM/Almoxarifado, número e data de pedido SISCOFIS, dependência, código e descrição originais, unidades informadas na origem, quantidades em **unidade-base** solicitada/planejada e parcela por posição, depósito/local/subposição, checklist físico, faltas/pendências/observações, identificação do emissor, responsáveis e datas para preenchimento manual. Ordenação estável por depósito → local → subposição; parcelas sem localização vão ao final como pendência. Cabeçalho e aviso **"Documento auxiliar: NÃO substitui registro ou autorização no SISCOFIS."** repetidos em todas as páginas; rodapé "não é comprovante de entrega ou baixa" e página N de M. Não se confunde com CREM/TREM, pedido oficial ou baixa concluída.

**Proteções:** valida esquema compartilhado, mesmo workspace entre ficha/pedido/plano e catálogos de localização, vínculo de pedido e revisão, referência de local/subposição, linha de origem, quantidades finitas e soma de parcelas igual ao planejado. Rejeita documento cancelado, posição inexistente, soma inconsistente e referências cruzadas; preserva inputs sem mutação. Não importa Firebase nem executa requests, transações, baixa ou alteração de estado.

**Evidência efetivamente executada:** [GitHub Actions W4 R1-B, run #41261306103](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41261306103), head '4c1fc73e7effd2a304a229b8cdf67aad48bf1541', **SUCCESS**: npm ci PASS; npm run typecheck PASS; node --test scripts/emprovex-almox-w4-separation-pdf.test.mjs **6/6 PASS**. Cenários: uma posição, posições e parcelas múltiplas fora de ordem, parcial e sem posição, documento longo multipágina com cabeçalho/aviso por página, falha fechada por tenant/posição/somas/contrato e ausência de operações de escrita. Verificação estrutural de PDFs reais em memória com pdf-lib (assinatura %PDF-, abertura, dimensões A4 e contagem de páginas). O primeiro run detectou ajuste de overload TypeScript do jsPDF; o segundo detectou falso positivo do teste estático em comentário. Ambos corrigidos sem remover cenários ou relaxar guardas; a certificação final acima é PASS. **Sem certificação visual por rasterização ou amostra real de pedido SISCOFIS** nesta fase isolada.

**Pendências/handoff para W5:** conectar o gerador à tela/fluxo autorizado, fornecer ImportedRequestV1 e snapshots legítimos de depósitos/locais do workspace antes de imprimir (o contrato SeparationSheetV1 isoladamente não contém descrição/código legíveis nem nomes físicos); ensaiar impressão visual e documentos reais anonimizados; validar UX e integração com W2/W3. Impressão não autoriza retirada nem altera ledger e não comprova entrega. A homologação ponta a ponta, identidade/autorização na fronteira W5, merge e deploy permanecem decisões separadas.

**Parecer W4:** **GO CONDICIONAL para integração W5 em ambiente isolado**. PDF e contratos dirigidos certificados por CI; **NÃO é GO para merge/produção**.

---

---

#### W5 — Integração R1-C (31/10/2026 BRT; 01/11/2026 UTC)

**Registro de entrega:** [PR DRAFT #441](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/441), branch `feat/emprovex-almox-r1-w5-integration`, destino `feat/emprovex-almox-r0-w1-foundation`, **sem merge, deploy ou publicação**. Base exata W1 R0.1: `baa5cde3957cb00b40bec9e1a250621a15cc4e06`. Commit de código final certificado antes deste adendo: `c164cd8ad35cd8bb306ba9e0f7c5331e119cfe79`. O SHA final com este adendo deve ser consultado no `head_sha` da PR #441, pois um commit não pode registrar seu próprio hash.

**Proveniência integral sem reimplementação:** W2 PR #438 SHA `0373913c5d57111b84619fee9929599d1f20bad6`, W3 PR #439 SHA `e8823a68ff663785f9c6033bd30935ef2c388a47`, W4 PR #437 SHA `73bab34613649c8d13ad8abbb8bde6cc12b45049`. Seus 12 arquivos exclusivos de código, testes, fixtures e workflows foram incorporados pelos **blobs Git originais**, mantendo contratos e motores W1–W4 intactos; só o memorial compartilhado exigiu resolução documental. Os adendos W0, W1, W1 R0.1, W2, W3 e W4 foram preservados integralmente, na seção 13.3, antes deste registro.

**Arquivos novos W5:** `lib/almoxarifado/integration.ts` (orquestração somente leitura), `lib/almoxarifado/humanChoices.ts` (validação de escolhas humanas), `lib/server/almoxarifadoPreview.ts` (consultas IAM e validações do snapshot), `app/api/almoxarifado/preview/route.ts` (API autenticada), `app/api/almoxarifado/confirm/route.ts` (negação explícita de saída), `features/almoxarifado/components/AlmoxSiscofisWorkbench.tsx` (conferência e escolha de posições), `scripts/emprovex-almox-w5.test.mjs` (11 testes dirigidos), `.github/workflows/emprovex-almox-w5-r1.yml` (certificação isolada). **Modificados W5:** `app/almoxarifado/page.tsx` (aba Pedidos SISCOFIS somente sintética), este memorial. W1 `lib/almoxarifado/contracts.ts`, login, módulos financeiros, Warehouse/Operador Móvel, Firestore Rules, cobrança e infraestrutura não foram alterados.

**Fluxo implementado somente para desenvolvimento:** seleção de TXT/PDF sintético no portal protegido → autenticação Firebase e modalidade `almoxarifado` conferidas pelo servidor → snapshots materiais, depósitos, locais e saldos obtidos com IAM e isolados pelo `workspaceId`/UG → parser W2 preserva origem/bytes/hash e rejeita layout desconhecido → vínculo por correspondência previamente aprovada **lida no servidor** e fator validado pelo W3 → posição única suficiente pré-selecionada; múltiplas posições e parcela/atendimento parcial exigem escolha explícita e replanejamento → projeção imutável `SeparationSheetV1` para PDF A4 W4 → checklist local de separação. Geração e impressão da ficha **não movimentam estoque**. Quantidade solicitada não se torna autorização oficial SISCOFIS.

**Controle de identidade, reimportação e confiança:** nenhum material, saldo, UG, UID, `workspaceId`, correspondência `CONFIRMED` ou lote é aceito como prova vinda do cliente; o servidor usa o acesso W1 e os documentos warehouse validados do workspace. O motor de duplicidade W2 recebe históricos do próprio workspace de `almoxRequestImports` caso existam; hash repetido e mesmo número com conteúdo diferente são bloqueados nos testes sintéticos. **Não foi criada persistência de importações ou fluxo de aprovação das correspondências** (`almoxMaterialCorrespondences` é somente leitura), portanto reimportação não está certificada para operação entre sessões reais. Fonte de aprovação e modelo de revisão/auditoria precisam ser homologados antes de ativação.

**Estado da saída transacional: DESABILITADA.** `ALMOX_OUTBOUND_ENABLED=false`; função de confirmação sempre nega (`ALMOX_OUTBOUND_DISABLED_PENDING_OPERATIONAL_APPROVAL`) e rota `/api/almoxarifado/confirm` devolve HTTP 423, sem encaminhamento ao ledger. Nenhuma reserva fictícia, segundo ledger, saldo negativo, movimento, emissão oficial ou baixa foram efetuados. O mecanismo `revalidatePhysicalSeparation` de W3 é somente prévia e **não prova revalidação atômica**. Ainda falta confirmar evento exato de baixa auxiliar versus status SISCOFIS, autoria/permissões, contrato de quantidade efetiva, atendimento parcial, idempotência **persistente**, tratamento de concorrência com outros canais, limite de transação e auditoria sobre serviços transacionais existentes. O teste de replay/concorrência verifica somente a negação fail-closed, **não** concorrência real com múltiplas transações.

**Certificação executada e evidências:** GitHub Actions [W5 isolated integration — run 41262700742](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41262700742), no commit de código `c164cd8ad35cd8bb306ba9e0f7c5331e119cfe79`, **SUCCESS**: `npm ci` PASS; `npm run typecheck` PASS; W1 `node --test scripts/emprovex-almox-w1.test.mjs` **8/8 PASS**; W2 **7/7 PASS** (TXT/PDF sintéticos); W3 **13/13 PASS**; W4 **6/6 PASS**; W5 **11/11 PASS**, total **45 testes dirigidos PASS**; `npm run build` **PASS**. Testes W5 cobrem TXT/PDF sintético→plano→PDF A4, posição única, múltiplas/divisão, parcial, conflito de hash/número, saldo revisado, isolamento de workspace com UG igual, mapeamento confiável ausente, layout/quantidade inválidos, negação repetida de saída e ausência de escrita documental. Testes W3/W4 usam fakes controlados para os helpers puros; **não** significam Auth Emulator ou estoque concorrente real no W5. Regressões W1 mais completas, incluindo Auth/Firestore Emulator, já estavam certificadas no run histórico 41257796853 e não foram repetidas integralmente neste workflow W5. Checks independentes da PR também verificaram Core Protection, Warehouse/3D/navegação, documentos, Auth e transação (consultar checks por SHA).

**Pendências e decisão:** (P0) homologar amostras **autênticas, anonimizadas** de Pedido SISCOFIS e seus layouts PDF/TXT; o W2 só reconhece `EMPROVEX_FIXTURE_R1` de dados sintéticos, logo documentos reais não são aceitos. (P0) acordar evento operacional oficial e momento da baixa auxiliar; implementar posteriormente transação atômica por posição e material, reaproveitar ledger da Central de Depósitos, idempotência e auditoria persistentes e homologar no Emulator/concorrência. (P1) criar fluxo server-side de aprovação e registro auditável de correspondências, histórico imutável e deduplicação entre sessões/usuários e validar snapshot de dados reais controlados. (P1) ensaiar acesso QA real e UX com operador e impressão visual multipágina, mais regressão específica da Central/Operador Móvel quando houver escrita. Nenhuma dessas pendências autoriza escopo adicional, merge, Rules ou deploy.

**Parecer W5: GO CONDICIONAL para continuar homologação técnica dirigida e preparar o próximo Worker; NO-GO para importação de pedidos SISCOFIS reais, confirmação de saída auxiliar, merge ou produção.** **Integração técnica verificada em fixtures ≠ aptidão para importar pedidos reais ≠ autorização para produção.** PR W5 permanece DRAFT; PRs W1–W4 permanecem independentes; nenhuma alteração em `main`.

---

### 13.4. Procedimento de verificação por mensagem curta

Ao receber **"verifique o resultado do worker"** sobre o Almoxarifado, o coordenador deverá:

1. Consultar a **PR #434** e seu branch documental e pesquisar **PRs/branches recentes W0/W1… de Almoxarifado**. Se o W0 tiver PR empilhada sobre #434, inspecionar o arquivo **na branch da PR do W0**, não apenas na main.
2. Ler integralmente o **último adendo de handoff na seção 13.3** e conferir contra código/arquivos/PRs/checks reais. Não tomar declaração do Worker como prova suficiente.
3. Confirmar SHA base, arquivo alterado, escopo, ausência de merge/deploy e se a PR documental preserva o memorial.
4. Responder com resumo das entregas, evidências, riscos e **GO/NO-GO para a fase seguinte**, e indicar a sequência correta (W1 ou correções pontuais).
5. Se nenhum handoff estiver persistido, reportar "**handoff não localizado no GitHub**", sem presumir conclusão.

**Regra de coordenação:** o memorial continua sendo a fonte do planejamento e histórico de Worker; PRs e commits fornecem a evidência material. Nunca exigir novo relato manual se houver acesso ao repositório.


---

### 13.5. Decisão executiva transversal — Cadastro Unificado de Clientes no Admin (31/10/2026)

**DECISÃO APROVADA PELO RESPONSÁVEL DO PRODUTO; IMPLEMENTAÇÃO AINDA PENDENTE.** Reaproveitar os cadastros das PRs **#436 (Aprovisionamento/Almoxarifado)** e **#419 (Empresas)**, oferecendo **uma única entrada "Cadastrar cliente" no painel Admin**, com escolha da modalidade e formulário específico. Esta decisão coordena as fundações e não modifica o escopo técnico certificado do W5 R1-C. Manter o memorial oficial do EMPROVEX Empresas sincronizado com esta decisão.

**Identidade e fluxo pretendidos:**
- **Aprovisionamento:** accountType='sector', sectorType='aprovisionamento', workspace setorial, UG, OM e e-mail autorizado; destino /central-empenhos.
- **Almoxarifado:** accountType='sector', sectorType='almoxarifado', workspace setorial **distinto**, UG/OM e e-mail autorizado; destino /almoxarifado.
- **Empresa fornecedora (cliente do SaaS):** accountType='company', workspaceType='company', CNPJ, razão social, contatos, e-mail/UID e workspace empresarial próprio, **sem UG setorial**; destino /empresa apenas após a homologação do provisionamento/roteamento empresarial.
- **Fundador/Admin:** accountType='platformAdmin', destino /admin, sem inferência de tenant por e-mail, UG ou URL. O acesso visual do fundador por senha e compatibilidade backend Google atuais são preservados.
- **Legado:** conta sector sem sectorType permanece Aprovisionamento. Não aplicar esse fallback a company, nem aceitar sectorType arbitrário. Dois workspaces com a mesma UG podem existir em modalidades distintas, sem compartilhamento de saldos/identidades.

**Solução mínima de UX (GOV-SIMP-01):** o Admin apresenta uma entrada única "Cadastrar cliente" e seletor **Aprovisionamento | Almoxarifado | Empresa**. A seleção usa os componentes e formulários **já escritos**, sem reconstruir validadores: AdminCreateSectorPanel/provisionamento da #436 para os dois setores; AdminCreateCompanyPanel/API e cadastro empresarial da #419 para empresas. Manter regras próprias de campos (UG/OM para setores; CNPJ/razão social para empresa), estados de erro, diretório e feedback, sem expor informações de outras modalidades. Uma interface de cadastro única **não exige** um endpoint, diretório ou mecanismo de Auth novo; usar despachos explícitos para os dois fluxos server-side existentes, com autorização e isolamento independentes.

**Reconciliar antes de implementar:** a PR #419 está em DRAFT, divergente da base W1/W5 e possui versão anterior de lib/platformIdentity.ts/app/login/page.tsx que usa o provedor Google como acesso principal do fundador. **Proibido mesclar integralmente ou substituir os arquivos de identidade/login recentes por versões antigas da #419.** Incorporar pontualmente as extensões company, campos, APIs e componentes empresariais sobre a identidade W1 corrigida; conciliar lib/platformAdminStore.ts, components/admin/PlatformAdminView.tsx, roteamento, tipos e autorização sem perder sectorType. Company não recebe UG, claims Warehouse, dados do Aprovisionamento, trial ou cobrança por inferência. Não declarar /empresa operacional antes dos testes específicos.

**Fase e responsabilidade:** realizar como etapa **integradora de fundações Admin/Identidade**, em branch/PR DRAFT própria baseada na fundação W5 ou em integração técnica equivalente, após preservar o W5 já certificado. **Não reabrir nem modificar os motores W2–W5 apenas para adicionar o cadastro.** Se necessário, executar um Worker específico de integração Admin, deixando o W5 e a #419 independentes até homologação.

**Aceite proporcional ao risco:** testes de TypeScript/build, cadastro de cada modalidade em Auth/Firestore Emulator, isolamento de workspaces mesmo com UG igual, CNPJ único, UID/e-mail autorizado, conta desativada, fallback legado, admin/fundador por senha, rota correta, tentativa de URL cruzada, negação de company no Warehouse setorial, e ausência de cobrança/trial assumidos. Publicação de Rules, merge, migração e Cloud Run exigem decisão posterior. Não usar dados reais para contornar pendências.

**Referências no momento da decisão:** W1 R0.1 PR #436 SHA baa5cde3957cb00b40bec9e1a250621a15cc4e06; W5 R1-C PR #441 SHA d89781d5347d04173af98bcc50c71d99bfb8f663 (GO CONDICIONAL técnico, saída desabilitada); Empresas PR #419 SHA 2281ac7deddc5271354e1f1faef441bc17246472 (DRAFT, não integrada). Esta seção é **exclusivamente documental**. Nenhum handoff W0–W5 foi modificado.


---

### 13.6. Handoff transversal — Integrador Admin e Identidade R1 (31/10/2026 BRT)

**PR DRAFT #447:** feat/emprovex-admin-identity-unified-r1, baseada na PR documental #444, originada do W5 R1-C PR #441, SHA de código certificado `7541b4c51b267b2122fdbde8022a07a762656214`. A PR continua **sem merge, deploy ou publicação**.

**Missão realizada:** cadastro único "Cadastrar cliente" com seletor de Aprovisionamento, Almoxarifado e Empresa; reaproveita AdminCreateSectorPanel da PR #436 e AdminCreateCompanyPanel/serviços empresariais da PR #419, sem terceiro sistema de provisionamento. Mantém AdminCompaniesPanel e diretório empresarial próprios, com distinção de dados comerciais e setoriais.

**Identidade reconciliada:** accountType sector + sectorType aprovisionamento/almoxarifado e accountType company + workspaceType company. Ausência de sectorType somente em conta sector é compatibilidade legada de Aprovisionamento. Company sem UG, sem claims Warehouse setoriais nem assinatura/trial herdados. A seleção do Admin não é fonte de autorização; o servidor confere identidade Firebase, UID, conta, status e workspace. Mesmo UG pode aparecer em dois workspaces setoriais diferentes sem acesso cruzado.

**Correção de login do fundador:** lib/platformIdentity.ts mantém FOUNDER_AUTH_PROVIDER=password, com Google compatível no backend Firebase, mas o botão "Entrar com Google — HGeSM" deixou de ser exibido. O /login passou a resolver a sessão company via /api/company/session antes de montar o shell operacional, que foi extraído sem alterar as regras de setor e assinatura para app/login/OperationalEntry.tsx. Company entra em /empresa, Almox em /almoxarifado, Aprovisionamento em /central-empenhos, Admin em /admin após resolução autorizada. Não reutilizar versões antigas de login da PR #419 sem reconciliação.

**Evidências de código:** TypeScript integral PASS, sete testes dirigidos de identidade/cadastro PASS e build integral PASS no workflow isolado "EMPROVEX Admin e Identidade R1" (SHA de código acima). Fast CI, Core Protection, Auth/tenant, Warehouse/3D, documentos, transações e testes de isolamento setorial Firebase/Firestore Emulator PASS na mesma revisão conforme checks GitHub. Browser E2E deve ser conferido no estado atual da PR, sem presumir aprovação antes de seu check definitivo. Os sete testes combinam contratos puros e inspeções estáticas; **não** representam homologação de provisionamento company real nem E2E empresarial com Auth Emulator.

**Pendências e limites:** QA independente da criação e login de empresa (CNPJ único, UID, rollback, contas desativadas, workspace de empresa, rotas e leitura de API); revisão de Firestore Rules/índices, permissões Cloud Run e fluxo de recuperação; homologação com conta QA e testes de não regressão quando publicar. Nenhuma alteração nas Rules ou nos motores W2–W5; importação SISCOFIS real e baixa permanecem desabilitadas. **GO CONDICIONAL para integração técnica; NO-GO para merge/main, publicação e produção sem QA empresarial específica.** Não presumir políticas comerciais de empresa e Almox.

**Documentação sincronizada:** checkpoint R1 do memorial EMPROVEX Empresas, nesta mesma PR. A PR #444 permanece documental, e W5 PR #441 com SHA d89781d5347d04173af98bcc50c71d99bfb8f663 não foi modificado. Preservados os handoffs W0–W5 nesta seção.

