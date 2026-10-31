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

\`\`\`text
W0 — AUDITORIA CURTA DE REAPROVEITAMENTO (somente leitura de código + escrita do handoff neste memorial)
 ↓ checkpoint: arquitetura recomendada, dependências reais, contratos e GO/NO-GO fundamentado
W1 — FUNDAÇÃO R0 (identidade de setor, Admin, roteamento, workspace, shell do Almoxarifado)
 ↓ checkpoint: contrato compartilhado de Pedido/Material/Posição/Ficha congelado e testes dirigidos
 ├── W2 — IMPORTADOR SISCOFIS PDF/TXT (R1-A) ────────────────┐
 ├── W3 — LOCALIZAÇÃO E PLANEJAMENTO DE SEPARAÇÃO (R1-B) ────┼→ W5 INTEGRADOR
 └── W4 — FICHA DE SEPARAÇÃO PDF (R1-B) ──────────────────────┘   + SAÍDA R1-C
                                                                      ↓
                                                HOMOLOGAÇÃO → merge autorizado → Cloud Run
\`\`\`

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

### 13.4. Procedimento de verificação por mensagem curta

Ao receber **"verifique o resultado do worker"** sobre o Almoxarifado, o coordenador deverá:

1. Consultar a **PR #434** e seu branch documental e pesquisar **PRs/branches recentes W0/W1… de Almoxarifado**. Se o W0 tiver PR empilhada sobre #434, inspecionar o arquivo **na branch da PR do W0**, não apenas na main.
2. Ler integralmente o **último adendo de handoff na seção 13.3** e conferir contra código/arquivos/PRs/checks reais. Não tomar declaração do Worker como prova suficiente.
3. Confirmar SHA base, arquivo alterado, escopo, ausência de merge/deploy e se a PR documental preserva o memorial.
4. Responder com resumo das entregas, evidências, riscos e **GO/NO-GO para a fase seguinte**, e indicar a sequência correta (W1 ou correções pontuais).
5. Se nenhum handoff estiver persistido, reportar "**handoff não localizado no GitHub**", sem presumir conclusão.

**Regra de coordenação:** o memorial continua sendo a fonte do planejamento e histórico de Worker; PRs e commits fornecem a evidência material. Nunca exigir novo relato manual se houver acesso ao repositório.

