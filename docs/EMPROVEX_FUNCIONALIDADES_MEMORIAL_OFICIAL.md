# EMPROVEX — MEMORIAL OFICIAL DE FUNCIONALIDADES E PROCEDIMENTOS

**Versão:** R1.0 — 02/11/2026 (Brasília)  
**Objetivo:** referência canônica de funcionalidades, passos de uso e corpus-base para orientação da Eleonor.  
**Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`  
**Baseline de código:** `main@b62f82ec6a87403a84cd7ba19c6b7cd8ac7a6329`  
**PRs paralelas consultadas:** Almoxarifado R1-D #463 (W1–W8: #436, #438, #439, #441, #458, #459, #460), Empresas #419/#444/#447, AI #453/#457 e integração #462, Suporte #442/#443/#448.  
**Escopo:** funções de usuário, administrador e operador móvel; módulos com barreira de autorização; funcionalidades em PR claramente separadas.  
**Tipo de auditoria:** estática e documental de código GitHub; sem acesso a dados de usuários, sem navegação autenticada no domínio, sem homologação transacional real e sem deploy.  
**Diretriz:** GOV-SIMP-01 — documentação prática sem alterar rotas, regras, IAM, banco, cobrança ou tráfego.

> Este memorial distingue **o que está implementado**, **o que o usuário pode ver**, **o que ainda depende de habilitação** e **o que não está publicado**. A Eleonor deve reconhecer essa distinção em todas as respostas. Os passos descrevem o caminho funcional esperado pelas telas auditadas, não garantem que o botão esteja disponível em qualquer sessão/revisão.

## 1. Metodologia e fontes

1. Inspeção da árvore completa da `main` pelo endpoint GitHub Git Tree (`recursive=1`): **1.541 entradas**, resposta marcada `truncated=false`. Incluídos `app`, `features`, `components`, `lib`, `docs`, APIs, shell de navegação e Operador Móvel.
2. Conferência dos destinos de navegação realmente definidos em `components/layout/AppSidebar.tsx`, `features/warehouse/navigation.ts`, `features/warehouse/components/WarehouseSectionContent.tsx`, `features/warehouse/components/WarehouseItemControlOperational.tsx`, `features/warehouse/mobile/WarehouseMobileHome.tsx` e `components/admin/PlatformAdminView.tsx`.
3. Inspeção dos componentes e hooks operacionais de Empenhos, NF, Cronogramas, Fornecedores, Itens, Relatórios/SAG, Avisos, Depósitos, saídas, inventário, site, assinatura, ajuda, gestão de usuários e Eleonor.
4. Verificação dos memoriais históricos e PRs paralelas para não misturar tecnologia proposta ou testes sintéticos com produção. Fonte de hospedagem: `README.md` e `docs/EMPROVEX_CLOUD_RUN_CUTOVER_GO_20261031.md`.
5. **Limite de exaustividade:** a cobertura inclui as famílias de funcionalidades e controles de navegação identificados, com subdivisão de operações úteis; não comprova disponibilidade em cada perfil, cada ramificação condicional oculta, todos os botões visuais ou qualquer interação real. Auditar runtime, permissões e novas revisões antes de chamar um passo de "confirmado em produção".

## 2. Semântica de disponibilidade

| Marcador | Interpretação | Como Eleonor deve tratar |
| --- | --- | --- |
| **MAIN** | Implementação/rota ou UI observada na `main` auditada | Orientar **condicionalmente**: o recurso pode depender do perfil, dados, flags e revisão Cloud Run realmente ativa |
| **MAIN COM GATES** | Implementação existe na `main`, mas backend/feature flags/conta podem negar a ação | Confirmar disponibilidade; jamais apresentar como sucesso garantido |
| **PR / PILOTO** | Código em PR DRAFT/branch isolada sem merge e sem deploy comprovado | Descrever como futuro ou ambiente de teste; **não** ensinar como usar agora em produção |
| **PAUSADO** | Desenvolvimento suspenso por decisão do responsável | Informar indisponibilidade e não sugerir ativação |

**Nota crítica:** inventário de interface/implementação não é certificado de produção. O domínio público roda a revisão Cloud Run efetivamente promovida; esta auditoria não executou login real nem comprovou o SHA da imagem do tráfego.

## 3. Rotas e mapa rápido

| Destino | Função | Evidência |
| --- | --- | --- |
| `/login` | autenticação, recuperação e entrada operacional | `app/login/page.tsx`, `components/auth/EmprovexLogin.tsx` |
| `/central-empenhos` | núcleo Aprovisionamento (Painel, Empenhos, NF, Fornecedores, Itens, Cronogramas, Relatórios, Avisos, Eleonor) | `components/layout/AppSidebar.tsx` |
| `/central-empenhos?tab=eleonor` | chat completo Eleonor | `features/eleonor/components/EleonorExperience.tsx` |
| `/central-depositos` | Início logística | `features/warehouse/navigation.ts` |
| `/central-depositos/meus-depositos` | visão de depósitos/3D | idem |
| `/central-depositos/cadastro-de-itens` | alocação/entrada/migração | idem |
| `/central-depositos/saida-de-material` | saída com rastreio | idem |
| `/central-depositos/controle-de-depositos` | estrutura, endereços, croqui | idem |
| `/central-depositos/controle-de-itens` | Resumo, Estoque, Movimentações, Inventário, Relatórios | `WarehouseItemControlOperational.tsx` |
| `/operador-movel` | oito ações móveis de logística | `WarehouseMobileHome.tsx` |
| `/admin` | painéis administrativos da conta fundadora | `PlatformAdminView.tsx` |
| `/regularizacao` | regularização da assinatura conforme gate | `app/regularizacao/page.tsx` |
| `/almoxarifado` | portal Almoxarifado em PR #463, **não na main** | PR DRAFT #463 |
| `/empresa` | portal empresarial **pausado** | PR DRAFT #419 |

**Rotas legadas:** há diretórios adicionais em `app/central-depositos` (ex.: `estoque`, `inventario`, `movimentacoes`, `siscofis-conciliacao`, `saida-expressa`, `alertas`, `configuracoes`, `relatorios` e `localizacoes`). Tratá-los como caminhos auxiliares/históricos e **não** como módulos canônicos independentes sem verificar redirecionamento e interface atual.

## 4. Catálogo detalhado e passo a passo

Cada entrada contém: **ID estável**, finalidade, sequência orientativa e restrições. Os títulos e IDs podem ser usados como intents de recuperação da Eleonor.

### Acesso, identidade e preferência

**Disponibilidade:** MAIN. **Fontes de implementação:** `components/auth/EmprovexLogin.tsx; app/login/page.tsx; components/layout/AppHeader.tsx; components/visual-mode; components/auth`.

#### F-01-001 — Entrar como setor

**Como fazer**
1. Abrir https://emprovex.com.br/login.
2. Informar e-mail operacional e senha.
3. Acionar a entrada; aguardar autenticação e carregamento do próprio workspace.

**Condição/limite:** Exige credenciais válidas, setor ativo e autorização; não compartilhar senhas.

#### F-01-002 — Entrar como fundador

**Como fazer**
1. Abrir a tela de login.
2. Escolher a entrada do fundador quando apresentada.
3. Autenticar com o método habilitado e acessar o perfil correspondente.

**Condição/limite:** Acesso administrativo depende da identidade fundadora, não da aparência de um botão.

#### F-01-003 — Recuperar senha

**Como fazer**
1. Na tela de login, selecionar recuperação de senha.
2. Informar o e-mail da conta.
3. Seguir o procedimento enviado pelo provedor de autenticação.

**Condição/limite:** Não solicitar códigos ou senhas na conversa.

#### F-01-004 — Mostrar ou ocultar senha

**Como fazer**
1. Abrir o campo de senha no login.
2. Usar o botão de visibilidade.
3. Conferir o texto apenas em ambiente privado.

**Condição/limite:** Controle visual; não modifica a senha.

#### F-01-005 — Aceite de termos e privacidade

**Como fazer**
1. Entrar com a conta autorizada.
2. Ler Termos e Política de Privacidade quando o bloqueio legal aparecer.
3. Aceitar para prosseguir com a operação, se concordar.

**Condição/limite:** Não contornar bloqueio de aceite obrigatório.

#### F-01-006 — Primeiro acesso setorial

**Como fazer**
1. Entrar pela primeira vez.
2. Seguir o checklist curto de dados e navegação quando exibido.
3. Concluir ou prosseguir conforme o fluxo disponível.

**Condição/limite:** Checklist de orientação, não prova de execução de tarefa real.

#### F-01-007 — Alterar senha de setor

**Como fazer**
1. Abrir a área de conta/credenciais disponível ao setor.
2. Informar os dados requisitados pelo formulário.
3. Confirmar a alteração e validar novo login.

**Condição/limite:** Não instruir a modificar senhas de terceiros.

#### F-01-008 — Abrir Minha Conta

**Como fazer**
1. Autenticar-se.
2. Acionar 'Abrir minha conta' no cabeçalho.
3. Revisar informações e ações habilitadas para o perfil.

**Condição/limite:** As ações disponíveis dependem do perfil e do estado comercial.

#### F-01-009 — Alternar perfil fundador/setor

**Como fazer**
1. Entrar com identidade que tenha os dois perfis.
2. Selecionar o controle de troca de perfil.
3. Escolher Administração ou operação setorial e aguardar nova navegação.

**Condição/limite:** Não pressupor disponibilidade para todo usuário.

#### F-01-010 — Sair com segurança

**Como fazer**
1. Abrir o menu lateral ou conta.
2. Acionar 'Sair'.
3. Aguardar o encerramento da sessão antes de usar conta distinta.

**Condição/limite:** Não presumir que fechar a aba equivale a logout.

#### F-01-011 — Alternar modo Normal/Essencial

**Como fazer**
1. Localizar seletor de modo visual.
2. Escolher Normal para experiência completa ou Essencial para interface reduzida.
3. Prosseguir com as mesmas operações e dados autorizados.

**Condição/limite:** Modo Essencial não é um segundo banco nem autoriza operações diferentes.

#### F-01-012 — Usar menu móvel e acessibilidade

**Como fazer**
1. Abrir EMPROVEX em tela pequena.
2. Tocar menu principal.
3. Selecionar módulo e fechar a gaveta, se necessário.

**Condição/limite:** Controles de teclado e responsividade podem variar por superfície.

#### F-01-013 — Acessar módulo Depósitos autorizado

**Como fazer**
1. Autenticar-se no setor.
2. Localizar Central de Depósitos no menu.
3. Abrir e aguardar verificação de autorização do servidor.

**Condição/limite:** A presença do atalho não substitui autorização por workspace.


### Início e Painel Financeiro

**Disponibilidade:** MAIN. **Fontes de implementação:** `features/inicio/components/InicioView.tsx; features/inicio/components/InicioQuickActions.tsx; features/dashboard/components/DashboardView.tsx`.

#### F-02-001 — Abrir tela Início

**Como fazer**
1. Entrar na Central de Empenhos.
2. Escolher 'Início' no menu quando no modo Normal.
3. Explorar atalhos e resumo operacional autorizado.

**Condição/limite:** No modo Essencial a interface pode usar o Painel como entrada.

#### F-02-002 — Abrir Painel

**Como fazer**
1. No menu lateral selecionar 'Painel'.
2. Aguardar consolidação dos empenhos.
3. Conferir indicadores de saldo e execução.

**Condição/limite:** Valores dependem dos documentos disponíveis no workspace.

#### F-02-003 — Filtrar indicadores por pregão

**Como fazer**
1. Abrir Painel.
2. Selecionar pregão no filtro superior.
3. Analisar indicadores recalculados do recorte.

**Condição/limite:** Não confundir filtro visual com alteração de dados.

#### F-02-004 — Filtrar indicadores por classe

**Como fazer**
1. Abrir Painel.
2. Selecionar classe de empenho ou 'Todas'.
3. Comparar totais agregados e quantidade de empenhos.

**Condição/limite:** Classes dependem de configuração vigente.

#### F-02-005 — Consultar saldo empenhado, recebido e disponível

**Como fazer**
1. Abrir Painel.
2. Selecionar o recorte desejado.
3. Ler os totais de compromissos, recebimentos e saldo.

**Condição/limite:** Cálculo depende dos registros e da consistência financeira.

#### F-02-006 — Pesquisar NE ou fornecedor no painel

**Como fazer**
1. No detalhamento financeiro do Painel digitar número da NE ou nome do fornecedor.
2. Examinar resultados filtrados.
3. Abrir registro para investigar.

**Condição/limite:** Busca local, não busca global entre organizações.

#### F-02-007 — Examinar detalhamento por classe

**Como fazer**
1. No Painel localizar a tabela por classe.
2. Expandir/ver as linhas necessárias.
3. Selecionar uma NE para visualizar seus itens ou lançar NF.

**Condição/limite:** Linhas podem carregar progressivamente.

#### F-02-008 — Abrir itens ou cadastro de NF pelo Painel

**Como fazer**
1. No registro desejado clicar na ação de itens ou 'Lançar NF'.
2. Confirmar a NE de destino.
3. Prosseguir na aba operacional correspondente.

**Condição/limite:** Confirme identidade da NE antes de registrar recebimento.


### Gestão de Empenhos e itens de NE

**Disponibilidade:** MAIN. **Fontes de implementação:** `features/empenhos/components/EmpenhosView.tsx; features/empenhos/components/ItensEmpenhoView.tsx; features/empenhos/hooks/useEmpenhoActions.ts; app/api/empenhos/parse-ne/route.ts`.

#### F-03-001 — Listar empenhos

**Como fazer**
1. Abrir 'Empenhos'.
2. Selecionar aba de visão geral.
3. Examinar cartões ou detalhamento das NE.

**Condição/limite:** Somente registros acessíveis à UG/workspace.

#### F-03-002 — Pesquisar NE ou fornecedor

**Como fazer**
1. Em Empenhos digitar o número ou fornecedor na busca.
2. Aguardar filtro.
3. Abrir o registro correspondente.

**Condição/limite:** Cheque exercício e fornecedor para homônimos.

#### F-03-003 — Filtrar NE por pregão

**Como fazer**
1. Abrir Empenhos.
2. Usar seletor 'Todos os Pregões'.
3. Selecionar pregão desejado.

**Condição/limite:** É filtro de consulta.

#### F-03-004 — Filtrar NE por exercício

**Como fazer**
1. Abrir Empenhos.
2. Escolher ano em 'Todos os Anos'.
3. Examinar as NE retornadas.

**Condição/limite:** Exercícios anteriores podem ter regras específicas de saldo.

#### F-03-005 — Filtrar NE por classe

**Como fazer**
1. Abrir Empenhos.
2. Selecionar classe cadastrada.
3. Conferir os registros classificados.

**Condição/limite:** Classe é atributo próprio da NE.

#### F-03-006 — Filtrar NE por situação/saldo

**Como fazer**
1. Na visão geral de Empenhos escolher filtro situacional disponível.
2. Avaliar resultado filtrado.
3. Abrir a NE para verificar valores.

**Condição/limite:** Rótulos exatos podem variar com os estados presentes.

#### F-03-007 — Cadastrar NE manualmente

**Como fazer**
1. Abrir Empenhos > Cadastrar Novo Empenho.
2. Escolher modo 'Manual'.
3. Preencher número da NE, fornecedor, CNPJ quando exigido, pregão, descrição, classe e demais campos.
4. Revisar dados e confirmar gravação.

**Condição/limite:** Não duplicar NE; respeitar validações de número/identidade.

#### F-03-008 — Cadastrar NE por PDF

**Como fazer**
1. Abrir Empenhos > Cadastrar Novo Empenho.
2. Escolher modo 'PDF' e fornecer arquivo suportado.
3. Revisar os campos extraídos do documento.
4. Confirmar o cadastro após conferência.

**Condição/limite:** Extração exige revisão humana; modo JSON de cadastro de NE foi desativado.

#### F-03-009 — Revisar NE importada

**Como fazer**
1. Após leitura do PDF examinar prévia de importação.
2. Corrigir campos extraídos incorretos.
3. Confirmar apenas depois de conferir o documento oficial.

**Condição/limite:** A IA não deve inventar valores ausentes.

#### F-03-010 — Abrir detalhe da NE

**Como fazer**
1. Buscar o empenho.
2. Selecionar cartão/linha de NE.
3. Analisar fornecedor, pregão, itens, NFs e saldos.

**Condição/limite:** Ação de leitura.

#### F-03-011 — Editar CNPJ do fornecedor em NE

**Como fazer**
1. Abrir detalhe da NE.
2. Selecionar edição de CNPJ.
3. Informar novo CNPJ e revisar impactos em NF/NS vinculadas.
4. Confirmar somente após as advertências do sistema.

**Condição/limite:** Migração de identidade financeira pode afetar documentos relacionados.

#### F-03-012 — Editar pregão da NE

**Como fazer**
1. Abrir detalhe da NE.
2. Acionar edição de pregão.
3. Corrigir número e salvar.

**Condição/limite:** Não alterar outros atributos desnecessariamente.

#### F-03-013 — Editar nota de crédito da NE

**Como fazer**
1. Abrir detalhe da NE.
2. Selecionar edição da NC.
3. Inserir identificador no formato exigido.
4. Salvar.

**Condição/limite:** Validar formato e origem documental.

#### F-03-014 — Alterar classificação da NE

**Como fazer**
1. Abrir detalhe da NE.
2. Selecionar classe de empenho.
3. Salvar e conferir a nova classificação.

**Condição/limite:** Classes configuráveis pela unidade.

#### F-03-015 — Adicionar item à NE

**Como fazer**
1. Abrir detalhe da NE ou Itens do Empenho.
2. Selecionar 'Adicionar Novo Item'.
3. Informar código/NR do item, descrição, unidade, quantidade e preço unitário.
4. Salvar e conferir saldo.

**Condição/limite:** Unidade e quantidade devem corresponder ao documento original.

#### F-03-016 — Editar descritivo ou NR de item

**Como fazer**
1. No detalhe da NE localizar item.
2. Acionar editar.
3. Corrigir descritivo e/ou número do item.
4. Salvar.

**Condição/limite:** Não substituir identificação oficial por aproximação textual.

#### F-03-017 — Remover item de NE

**Como fazer**
1. Abrir itens da NE.
2. Escolher remoção do item específico.
3. Ler validações e confirmar, se permitido.

**Condição/limite:** Pode ser bloqueado por NF, saldo ou vínculos existentes.

#### F-03-018 — Consultar saldo por item de NE

**Como fazer**
1. Abrir detalhe da NE.
2. Localizar 'Saldo por Itens do Empenho'.
3. Ler quantidade empenhada, recebida e restante por item.

**Condição/limite:** Saldo de NE não equivale a saldo físico do depósito.

#### F-03-019 — Gerar ou imprimir relatório de NE

**Como fazer**
1. Abrir detalhe da NE.
2. Selecionar impressão/relatório em PDF.
3. Conferir conteúdo e salvar ou imprimir.

**Condição/limite:** O documento reproduz registros autorizados.

#### F-03-020 — Gerenciar classes de empenho

**Como fazer**
1. Abrir Empenhos > Classes.
2. Consultar códigos e descrições.
3. Editar classe ou adicionar nova classe, preenchendo código e descritivo.
4. Salvar.

**Condição/limite:** Configuração tem impacto em classificações e relatórios.

#### F-03-021 — Excluir NE

**Como fazer**
1. Abrir detalhe da NE.
2. Acionar excluir.
3. Ler bloqueios de integridade e confirmar se permitido.

**Condição/limite:** Ação destrutiva: a Eleonor apenas orienta, não executa.

#### F-03-022 — Anexar ou consultar PDF de Nota de Empenho

**Como fazer**
1. Abrir a NE desejada.
2. Usar os controles de documento PDF da NE.
3. Anexar versão permitida ou abrir/baixar arquivo salvo.

**Condição/limite:** Depende de storage/Drive e autorização; não inventar link documental.


### Notas Fiscais, NS e recebimento

**Disponibilidade:** MAIN. **Fontes de implementação:** `features/notas-fiscais/components/NotasFiscaisView.tsx; features/notas-fiscais/hooks/useNotasFiscaisActions.ts; components/InvoiceDocumentActions.tsx; components/TermoRecebimentoActions.tsx; lib/nsIntegrity.ts`.

#### F-04-001 — Acompanhar NFs cadastradas

**Como fazer**
1. Abrir 'Notas Fiscais'.
2. Selecionar 'Acompanhar Notas Cadastradas'.
3. Examinar listagem, fornecedor, NE, totais e tramitação.

**Condição/limite:** A situação é derivada dos registros existentes.

#### F-04-002 — Buscar nota fiscal

**Como fazer**
1. Na aba Acompanhar digitar número, fornecedor ou NE.
2. Examinar os resultados.
3. Abrir a nota para conferir.

**Condição/limite:** Checar CNPJ e identidade da NF para números repetidos.

#### F-04-003 — Filtrar NF por NE

**Como fazer**
1. Abrir Acompanhar Notas.
2. Selecionar empenho no filtro.
3. Ler apenas as NFs relacionadas.

**Condição/limite:** Somente NFs autorizadas.

#### F-04-004 — Filtrar NF por mês

**Como fazer**
1. Abrir Acompanhar Notas.
2. Selecionar mês/ano disponível.
3. Examinar as notas do período.

**Condição/limite:** Usar a data do documento definida pelo sistema.

#### F-04-005 — Filtrar NF por tramitação

**Como fazer**
1. Abrir Acompanhar Notas.
2. Selecionar filtro de tramitação.
3. Revisar status e pendências listadas.

**Condição/limite:** Não afirmar que todo documento pendente foi efetivamente recebido.

#### F-04-006 — Ordenar NFs

**Como fazer**
1. Na listagem de Notas Fiscais usar a ordenação disponível.
2. Selecionar sequência desejada.
3. Verificar os resultados.

**Condição/limite:** Ordenação não altera registros.

#### F-04-007 — Cadastrar NF

**Como fazer**
1. Abrir Notas Fiscais > Cadastrar Nova Nota Fiscal.
2. Selecionar a NE associada.
3. Informar número e data da NF e quantidades recebidas por item.
4. Revisar valores, saldo e duplicidade e confirmar.

**Condição/limite:** Cadastro altera recebimento financeiro e precisa refletir documento real.

#### F-04-008 — Anexar PDF da NF

**Como fazer**
1. No cadastro ou detalhe da NF selecionar arquivo PDF.
2. Conferir formato/tamanho permitido.
3. Enviar e confirmar registro da versão documental.

**Condição/limite:** No formulário auditado o limite indicado é 10 MB.

#### F-04-009 — Editar NF

**Como fazer**
1. Na lista ou detalhe selecionar NF.
2. Acionar edição.
3. Corrigir campos/quantidades permitidos.
4. Salvar após revisão das repercussões na NE.

**Condição/limite:** Recalcular saldo vinculado com integridade transacional.

#### F-04-010 — Excluir NF

**Como fazer**
1. Na NF selecionar ação excluir.
2. Ler confirmação e eventuais impedimentos.
3. Confirmar quando a exclusão for legítima.

**Condição/limite:** Exclusão ajusta recebimentos da NE; não tratar como simples remoção visual.

#### F-04-011 — Abrir itens de NF

**Como fazer**
1. Na listagem ou detalhe clicar na ação 'Ver Itens da Nota Fiscal'.
2. Conferir itens e quantidades.
3. Retornar à lista.

**Condição/limite:** Consulta não modifica registros.

#### F-04-012 — Gerar/imprimir relatório ou PDF de NF

**Como fazer**
1. Abrir o detalhe/ações da NF.
2. Selecionar geração/impressão do documento disponível.
3. Revisar e salvar.

**Condição/limite:** Não confundir espelho da NF com documento original do fornecedor.

#### F-04-013 — Anexar ou consultar espelho da NF

**Como fazer**
1. Abrir nota e suas ações documentais.
2. Selecionar espelho quando disponível.
3. Anexar versão ou abrir/baixar documento registrado.

**Condição/limite:** Armazenamento e acesso dependem de permissões.

#### F-04-014 — Registrar ou corrigir NS

**Como fazer**
1. Abrir NF com controle de Nota de Sistema disponível.
2. Preencher ou corrigir número da NS.
3. Validar identidade UG, CNPJ, NF, NE e ausência de conflito.
4. Salvar.

**Condição/limite:** Não forçar NS em documento sem conciliação íntegra.

#### F-04-015 — Consultar tramitação de NF/NS

**Como fazer**
1. Abrir Notas Fiscais ou detalhe da NE.
2. Localizar situação de tramitação e NS.
3. Interpretar o status conforme os campos efetivamente preenchidos.

**Condição/limite:** Pendente é um estado verificável, não uma previsão de conclusão.

#### F-04-016 — Configurar comissão de recebimento

**Como fazer**
1. Abrir Notas Fiscais > Comissões de Recebimento.
2. Informar mês, boletim, data e integrantes/postos.
3. Salvar configuração da comissão.

**Condição/limite:** Documentos devem seguir os dados administrativos reais.

#### F-04-017 — Emitir Termo de Recebimento

**Como fazer**
1. Abrir NF com recebimento correspondente.
2. Selecionar 'Baixar Termo de Recebimento'.
3. Conferir comissão e dados da nota no PDF.

**Condição/limite:** Disponibilidade condicionada a dados/documentação exigidos.

#### F-04-018 — Conferir vínculo de documentos com NE

**Como fazer**
1. Abrir detalhe de Empenhos.
2. Localizar 'Notas Fiscais Cadastradas para este Empenho'.
3. Abrir NF e verificar itens/NS/recebimentos.

**Condição/limite:** Não deduzir relação apenas de semelhança no fornecedor.


### Cronogramas de entrega e comunicação

**Disponibilidade:** MAIN. **Fontes de implementação:** `features/cronogramas/components/CronogramasView.tsx; features/cronogramas/components/CronogramaEnviosView.tsx; features/cronogramas/hooks/useCronogramaActions.ts; features/cronogramas/components/CronogramaEmailDialog.tsx`.

#### F-05-001 — Listar cronogramas por NE

**Como fazer**
1. Abrir 'Cronogramas'.
2. Consultar NE e indicadores de configuração/execução.
3. Selecionar a NE a programar.

**Condição/limite:** A lista usa empenhos do setor.

#### F-05-002 — Criar cronograma

**Como fazer**
1. Abrir Cronogramas.
2. Escolher NE e 'Gerar Cronograma'.
3. Distribuir as quantidades disponíveis entre remessas e datas.
4. Salvar.

**Condição/limite:** Não programar recebimentos acima do saldo registrado.

#### F-05-003 — Editar cronograma

**Como fazer**
1. Na NE com status Configurado clicar 'Editar Cronograma'.
2. Alterar distribuição, datas e instruções.
3. Salvar novamente.

**Condição/limite:** Manter histórico e não tratar edição como envio automático.

#### F-05-004 — Adicionar remessa

**Como fazer**
1. No editor de cronograma escolher adicionar remessa.
2. Definir data e quantidade por item.
3. Revisar total programado.

**Condição/limite:** Remessas referem-se à NE selecionada.

#### F-05-005 — Remover remessa

**Como fazer**
1. No editor localizar coluna de remessa.
2. Selecionar remover.
3. Conferir redistribuição antes de salvar.

**Condição/limite:** Pode mudar total programado.

#### F-05-006 — Aplicar distribuição predefinida

**Como fazer**
1. No editor selecionar opção de parcelas/preset.
2. Revisar datas e quantidades sugeridas.
3. Ajustar manualmente conforme necessidade.

**Condição/limite:** Sugestões não substituem o planejamento operacional.

#### F-05-007 — Programar tudo na primeira remessa

**Como fazer**
1. Selecionar opção de alocação integral na primeira remessa.
2. Conferir itens e saldo.
3. Salvar se a entrega integral for o objetivo.

**Condição/limite:** Não pressupor disponibilidade de fornecedor.

#### F-05-008 — Limpar distribuição de remessas

**Como fazer**
1. Usar opção de limpar distribuição.
2. Confirmar as linhas zeradas.
3. Preencher novo planejamento antes de salvar.

**Condição/limite:** Não é exclusão da NE.

#### F-05-009 — Preencher instruções de entrega

**Como fazer**
1. No editor localizar informações complementares.
2. Informar local, dias/horários, exigências de temperatura, validade e orientações.
3. Conferir contato e responsável.

**Condição/limite:** Tratar como instrução institucional, não mensagem espontânea da Eleonor.

#### F-05-010 — Gerar prévia de cronograma

**Como fazer**
1. Selecionar prévia de impressão.
2. Revisar cabeçalho, NE, itens, quantidades e instruções.
3. Fechar prévia ou corrigir dados.

**Condição/limite:** Prévia não prova que o fornecedor recebeu.

#### F-05-011 — Imprimir ou baixar cronograma PDF

**Como fazer**
1. No cronograma configurado selecionar imprimir/gerar PDF.
2. Conferir documento.
3. Salvar ou imprimir.

**Condição/limite:** Documento do setor e da NE autorizada.

#### F-05-012 — Enviar cronograma por e-mail

**Como fazer**
1. No cronograma abrir ação de envio disponível.
2. Selecionar destinatário/endereço do fornecedor e revisar mensagem.
3. Confirmar envio pelo fluxo habilitado.

**Condição/limite:** Não alegar entrega de e-mail sem confirmação registrada.

#### F-05-013 — Consultar histórico de envios

**Como fazer**
1. Abrir acompanhamento de cronogramas enviados.
2. Pesquisar fornecedor, NE ou destinatário.
3. Verificar data, status e paginação.

**Condição/limite:** O histórico de envio não comprova aceite pelo destinatário.


### Fornecedores e Consulta de Itens

**Disponibilidade:** MAIN. **Fontes de implementação:** `features/fornecedores/components/FornecedoresView.tsx; features/itens/components/ConsultaItensView.tsx; lib/supplierDirectory.ts`.

#### F-06-001 — Listar fornecedores

**Como fazer**
1. Abrir 'Fornecedores'.
2. Examinar diretório de fornecedores.
3. Selecionar fornecedor para ver vínculos e contatos.

**Condição/limite:** Somente cadastro autorizado.

#### F-06-002 — Pesquisar fornecedor

**Como fazer**
1. Na Central de Fornecedores digitar razão social, CNPJ, NE, e-mail ou telefone.
2. Examinar resultados.
3. Abrir cadastro correto.

**Condição/limite:** Identidade preferencial por CNPJ.

#### F-06-003 — Filtrar fornecedores por situação

**Como fazer**
1. Abrir Fornecedores.
2. Selecionar 'Todos', 'Ativos' ou 'Pendentes'.
3. Examinar recorte.

**Condição/limite:** Situação é calculada a partir de registros da unidade.

#### F-06-004 — Cadastrar fornecedor

**Como fazer**
1. Na Central de Fornecedores selecionar cadastrar.
2. Informar razão social, CNPJ e contatos permitidos.
3. Revisar e salvar.

**Condição/limite:** Validar CNPJ e evitar registro duplicado.

#### F-06-005 — Editar cadastro de fornecedor

**Como fazer**
1. Buscar e abrir fornecedor.
2. Acionar ícone Editar.
3. Corrigir razão social ou contatos autorizados.
4. Salvar.

**Condição/limite:** Conciliação com NE pode exigir tratamento de identidade.

#### F-06-006 — Consultar vínculos de fornecedor

**Como fazer**
1. Abrir cartão do fornecedor.
2. Examinar NE, saldo ou pendências relacionadas apresentados.
3. Abrir registro vinculado para detalhes.

**Condição/limite:** Não somar documentos de identidades distintas sem validação.

#### F-06-007 — Consultar itens empenhados

**Como fazer**
1. Abrir 'Consulta de Itens'.
2. Pesquisar item, NE, pregão ou fornecedor.
3. Examinar resultados agregados.

**Condição/limite:** Item de NE difere de material de estoque físico.

#### F-06-008 — Filtrar itens por saldo

**Como fazer**
1. Na Consulta de Itens selecionar filtro situacional de saldo.
2. Examinar lista.
3. Limpar filtros quando necessário.

**Condição/limite:** Não altera quantidade.

#### F-06-009 — Abrir composição de item por NE

**Como fazer**
1. Na Consulta de Itens expandir o item.
2. Ler 'Composição por empenho'.
3. Selecionar NE de origem, se necessário.

**Condição/limite:** Pode haver itens homônimos em NEs distintas.


### Relatórios financeiros, SAG e integridade

**Disponibilidade:** MAIN. **Fontes de implementação:** `features/relatorios/components/RelatoriosView.tsx; features/relatorios/components/RelatorioPorEmpenhoView.tsx; features/relatorios/components/RelatorioPorFornecedorView.tsx; features/relatorios/components/SagImportView.tsx; features/relatorios/components/HistoricalConsistencyView.tsx`.

#### F-07-001 — Abrir Central de Relatórios

**Como fazer**
1. No menu selecionar 'Relatórios'.
2. Escolher Por Empenho, Por Fornecedor, Importar NS — SAG ou Integridade.
3. Aplicar os filtros adequados.

**Condição/limite:** Cada modo tem fontes e permissões próprias.

#### F-07-002 — Relatório por empenho

**Como fazer**
1. Abrir Relatórios > Por Empenho.
2. Selecionar NE e critérios disponíveis.
3. Consultar NF, NS e saldo.

**Condição/limite:** Registros refletem os dados da UG.

#### F-07-003 — Relatório por fornecedor

**Como fazer**
1. Abrir Relatórios > Por Fornecedor.
2. Selecionar fornecedor/CNPJ ou filtro permitido.
3. Consultar consolidação e detalhamento.

**Condição/limite:** Consolidação financeira por CNPJ exige identidade consistente.

#### F-07-004 — Filtrar relatórios por data

**Como fazer**
1. Abrir relatório com período.
2. Informar início/fim ou filtro temporal disponível.
3. Atualizar consulta e conferir datas.

**Condição/limite:** A coluna temporal exata depende do relatório.

#### F-07-005 — Exportar/imprimir relatório

**Como fazer**
1. Abrir modalidade de relatório.
2. Selecionar exportação, download ou impressão disponível.
3. Conferir dados e formato gerado.

**Condição/limite:** Nem todas as modalidades têm o mesmo formato.

#### F-07-006 — Iniciar importação SAG de NS

**Como fazer**
1. Abrir Relatórios > Importar NS — SAG.
2. Ler orientações do contrato de importação.
3. Obter JSON no formato esperado a partir da fonte institucional.

**Condição/limite:** Importação assistida manual: não pressupor integração automática com SAG.

#### F-07-007 — Colar e validar JSON SAG

**Como fazer**
1. Na seção de importação colar JSON.
2. Selecionar validar.
3. Corrigir erros de schema/identidade indicados.

**Condição/limite:** JSON para NS/SAG não é cadastro JSON de NE.

#### F-07-008 — Conferir conciliação CNPJ → NF → NE

**Como fazer**
1. Após validação examinar 'Conciliação CNPJ → NF → NE'.
2. Investigar correspondências seguras, conflitos e notas ambíguas.
3. Resolver casos problemáticos antes de aplicar.

**Condição/limite:** Conflito ou NF não encontrada não autoriza associação aproximada.

#### F-07-009 — Pré-visualizar alterações SAG

**Como fazer**
1. Após conciliação abrir prévia da aplicação.
2. Revisar cada NS e documento de destino.
3. Confirmar somente se correspondências forem seguras.

**Condição/limite:** Mudanças financeiras exigem revisão humana.

#### F-07-010 — Aplicar NS importadas

**Como fazer**
1. Concluir validação/preview.
2. Selecionar aplicar quando habilitado.
3. Conferir resultado e itens rejeitados.

**Condição/limite:** Respeitar deduplicação, concorrência e integridade; sem execução autônoma pela Eleonor.

#### F-07-011 — Verificar integridade histórica

**Como fazer**
1. Abrir Relatórios > Integridade.
2. Executar ou consultar diagnóstico disponível.
3. Revisar divergências históricas indicadas.

**Condição/limite:** Diagnóstico não é prova de que um saneamento foi feito.

#### F-07-012 — Sanear inconsistências históricas permitidas

**Como fazer**
1. Analisar diagnóstico e documentos originais.
2. Usar apenas a ação de saneamento explicitamente habilitada.
3. Validar resultados e rastreabilidade.

**Condição/limite:** Nunca orientar correção cega de saldos e NS.


### Central de Avisos

**Disponibilidade:** MAIN. **Fontes de implementação:** `features/avisos/components/CentralAvisosView.tsx; features/avisos/domain/noticeLifecycle.ts`.

#### F-08-001 — Abrir Central de Avisos

**Como fazer**
1. No menu escolher 'Central de Avisos'.
2. Consultar indicadores Pendentes, Novos, Críticos e Histórico.
3. Abrir registro para detalhes.

**Condição/limite:** Avisos têm severidade e ciclo de vida.

#### F-08-002 — Pesquisar aviso

**Como fazer**
1. Digitar título, NE, fornecedor ou CNPJ na busca.
2. Aplicar filtros necessários.
3. Examinar avisos encontrados.

**Condição/limite:** Busca de avisos da unidade.

#### F-08-003 — Filtrar por severidade

**Como fazer**
1. Escolher Todos, Críticos, Atenção ou Informativos.
2. Revisar lista.
3. Priorizar alertas críticos.

**Condição/limite:** Severidade não equivale a confirmação de risco externo.

#### F-08-004 — Filtrar avisos por situação

**Como fazer**
1. Escolher Ativos, Novos, Lidos, Resolvidos, Arquivados ou Todos.
2. Analisar registros.
3. Selecionar ação pertinente.

**Condição/limite:** Estados explícitos no código.

#### F-08-005 — Marcar avisos como lidos

**Como fazer**
1. Abrir aviso e usar 'Marcar como lido', ou 'Marcar todos como lidos' quando apropriado.
2. Confirmar atualização visual.

**Condição/limite:** Marcar como lido não significa resolver o evento.

#### F-08-006 — Resolver, reabrir ou arquivar aviso

**Como fazer**
1. Abrir o aviso.
2. Selecionar resolver, voltar para novo ou arquivar conforme contexto.
3. Conferir situação final.

**Condição/limite:** Ciclo de vida auditável; não eliminar a origem do problema por mera mudança de estado.

#### F-08-007 — Ir ao empenho associado ao aviso

**Como fazer**
1. Abrir aviso com NE vinculada.
2. Selecionar ação de abrir empenho.
3. Inspecionar documento de origem.

**Condição/limite:** Sem vínculo, não inventar NE correspondente.


### Central de Depósitos — estruturas e visualização

**Disponibilidade:** MAIN. **Fontes de implementação:** `features/warehouse/navigation.ts; features/warehouse/components/WarehouseLandingOperational.tsx; WarehouseDepotViewOperational.tsx; WarehouseDepotRegistrationR1.tsx; WarehouseDepotLayoutEditor.tsx; WarehouseDepotCroquis.tsx; WarehouseGlobalMaterialSearch.tsx`.

#### F-09-001 — Abrir Início dos Depósitos

**Como fazer**
1. No menu EMPROVEX selecionar Central de Depósitos.
2. Abrir Início.
3. Examinar resumo visual dos depósitos e alocações pendentes.

**Condição/limite:** Exige autorização Warehouse.

#### F-09-002 — Abrir Meus Depósitos

**Como fazer**
1. Na Central selecionar 'Meus Depósitos'.
2. Escolher depósito da unidade.
3. Consultar representação física e informações.

**Condição/limite:** Localizações e saldos são setoriais.

#### F-09-003 — Cadastrar depósito

**Como fazer**
1. Abrir Controle de Depósitos > Cadastramento.
2. Informar código, nome e dimensões.
3. Configurar estruturas internas e confirmar.

**Condição/limite:** Não criar código duplicado.

#### F-09-004 — Configurar estantes/prateleiras

**Como fazer**
1. No cadastro/edição do depósito escolher tipos de estruturas.
2. Informar quantidades, níveis e características permitidas.
3. Salvar estrutura e conferir posições.

**Condição/limite:** Evitar alteração destrutiva se existir saldo.

#### F-09-005 — Cadastrar geladeira/freezer e outros suportes

**Como fazer**
1. Abrir configuração física do depósito.
2. Selecionar modelo de estrutura frio/suporte disponível.
3. Informar quantidade e dimensões.
4. Salvar e revisar visual.

**Condição/limite:** A aparência 3D não é controle de temperatura.

#### F-09-006 — Editar nome/dimensões de depósito

**Como fazer**
1. Localizar depósito em Controle de Depósitos.
2. Selecionar edição.
3. Alterar dados admitidos e salvar.
4. Reabrir croqui para conferir.

**Condição/limite:** Preservar códigos e saldos vinculados.

#### F-09-007 — Duplicar ou renomear localização

**Como fazer**
1. Abrir estrutura do depósito.
2. Selecionar posição/estrutura e comando disponível.
3. Informar novo nome/código.
4. Confirmar, preservando vínculos.

**Condição/limite:** Não duplicar saldo físico junto com o endereço.

#### F-09-008 — Excluir depósito/local bloqueado por saldo

**Como fazer**
1. Abrir estrutura e solicitar exclusão.
2. Ler bloqueio de integridade se houver quantidade armazenada.
3. Transferir ou regularizar material antes de qualquer remoção permitida.

**Condição/limite:** Não burlar salvaguarda de saldo positivo.

#### F-09-009 — Editar croqui 2D

**Como fazer**
1. Abrir depósito > croqui/estrutura.
2. Entrar em edição da disposição.
3. Arrastar/posicionar estruturas e ajustar medidas.
4. Salvar alterações.

**Condição/limite:** Croqui é representação física do mesmo cadastro.

#### F-09-010 — Visualizar depósito em 3D

**Como fazer**
1. Abrir Meus Depósitos > depósito.
2. Selecionar visualização 3D.
3. Girar/inspecionar conforme controles disponíveis.

**Condição/limite:** 3D depende de navegador, desempenho e modo visual.

#### F-09-011 — Alternar perspectivas de estrutura

**Como fazer**
1. Abrir inspeção 3D de geladeira/freezer/estrutura.
2. Escolher perspectiva disponível.
3. Conferir compartimentos e etiquetas.

**Condição/limite:** Interação visual, não alteração de estoque.

#### F-09-012 — Inspecionar posição ou prateleira

**Como fazer**
1. Na visualização clicar ou passar o cursor sobre estrutura habilitada.
2. Ler código, materiais, lotes e quantidades.
3. Abrir inspeção detalhada quando disponível.

**Condição/limite:** Dados vêm do depósito autorizado.

#### F-09-013 — Pesquisar material em todos os depósitos

**Como fazer**
1. Abrir busca global de materiais.
2. Digitar nome/código.
3. Conferir depósitos e localizações retornados.

**Condição/limite:** Pesquisar não é movimentar.

#### F-09-014 — Ver validade no ambiente 3D

**Como fazer**
1. Abrir estrutura com material armazenado.
2. Inspecionar indicações de validade e sinalização de vencimento.
3. Abrir item para conferir data efetiva.

**Condição/limite:** Destaque visual é alerta, não descarte automático.

#### F-09-015 — Gerar PDF de conteúdo por local

**Como fazer**
1. Abrir inspeção do local.
2. Selecionar relatório PDF por posição quando disponível.
3. Conferir materiais, lotes e saldo.

**Condição/limite:** Relatório de consulta, não inventário assinado.

#### F-09-016 — Criar/editar etiquetas de posições

**Como fazer**
1. Abrir controles de depósito/localizações/etiquetas.
2. Selecionar estrutura/endereços.
3. Gerar ou imprimir etiquetas.

**Condição/limite:** Códigos devem corresponder a localizações reais.


### Central de Depósitos — entrada, alocação e SISCOFIS

**Disponibilidade:** MAIN. **Fontes de implementação:** `features/warehouse/components/WarehouseItemRegistrationOperational.tsx; WarehouseManualEntryOperational.tsx; WarehouseBulkManualEntryOperational.tsx; WarehouseSiscofisOperational.tsx; WarehouseSiscofisPendingAllocation.tsx; WarehouseAllocatedItemsOperational.tsx; features/warehouse/pdf`.

#### F-10-001 — Abrir Alocação de Material

**Como fazer**
1. Na Central de Depósitos selecionar 'Alocação de Material'.
2. Escolher Materiais pendentes, Entrada avulsa, Itens armazenados, Migração SISCOFIS ou Histórico legado.
3. Trabalhar no subfluxo adequado.

**Condição/limite:** Recebimento documental e posição física são conceitos distintos.

#### F-10-002 — Consultar NFs pendentes de alocação

**Como fazer**
1. Abrir Alocação > Materiais pendentes.
2. Selecionar NF pendente.
3. Inspecionar itens e quantidades por alocar.

**Condição/limite:** Somente documentos disponíveis para entrada.

#### F-10-003 — Abrir alocação detalhada de NF

**Como fazer**
1. Selecionar NF pendente.
2. Acionar 'Abrir alocação detalhada desta NF'.
3. Distribuir cada item entre depósitos/posições.
4. Conferir quantidades e confirmar.

**Condição/limite:** Não ultrapassar saldo pendente, respeitar local ativo.

#### F-10-004 — Alocar por item e posição

**Como fazer**
1. Abrir detalhe de alocação.
2. Selecionar material e posição física.
3. Informar quantidade, lote/validade quando exigidos.
4. Confirmar operação.

**Condição/limite:** Alocação oficial altera posição; verificar saldo antes e depois.

#### F-10-005 — Cadastrar entrada avulsa

**Como fazer**
1. Abrir Alocação > Entrada avulsa.
2. Selecionar ou cadastrar material conforme formulário.
3. Informar quantidade, unidade, lote/validade e destino.
4. Confirmar.

**Condição/limite:** A origem avulsa não deve ser confundida com recebimento de NF.

#### F-10-006 — Cadastrar entradas em lote

**Como fazer**
1. Abrir fluxo de entrada manual em lote, se habilitado.
2. Preencher itens/quantidades/posições.
3. Revisar todas as linhas.
4. Confirmar.

**Condição/limite:** Validação de lote deve ser atômica ou apresentar falhas por linha.

#### F-10-007 — Consultar itens já armazenados

**Como fazer**
1. Abrir Alocação > Itens armazenados.
2. Buscar material ou NF de origem.
3. Examinar posição e quantidade armazenada.

**Condição/limite:** Não duplicar total com a mesma posição em telas distintas.

#### F-10-008 — Consultar histórico legado de entrada

**Como fazer**
1. Abrir Alocação > Histórico legado / SISCOFIS.
2. Examinar registros legados e sua origem.
3. Investigar divergências sem gravar automaticamente.

**Condição/limite:** Legado pode ter saldo sem rastreio de posição.

#### F-10-009 — Iniciar Migração SISCOFIS de estoque

**Como fazer**
1. Abrir Alocação > Migração SISCOFIS.
2. Selecionar PDF de Mapa de Existência compatível.
3. Aguardar extração e conferir data/fonte.

**Condição/limite:** Este é Mapa de Existência para estoque, diferente de Pedido de Material R1-D.

#### F-10-010 — Revisar itens extraídos do Mapa SISCOFIS

**Como fazer**
1. Após leitura PDF analisar tabela de itens.
2. Conferir descrições, unidades e quantidades.
3. Corrigir linhas permitidas e revalidar.

**Condição/limite:** Parser pode exigir intervenção; não supor leitura perfeita.

#### F-10-011 — Conciliar item SISCOFIS com material

**Como fazer**
1. Na prévia selecionar material canônico correspondente.
2. Revisar correspondência e warnings.
3. Manter pendente se identidade for ambígua.

**Condição/limite:** Evitar criar duas identidades para o mesmo material.

#### F-10-012 — Excluir linha inadequada do importador

**Como fazer**
1. Na prévia do SISCOFIS selecionar excluir linha.
2. Revalidar inventário.
3. Usar Desfazer exclusões quando necessário.

**Condição/limite:** Excluir da prévia não é excluir estoque produtivo.

#### F-10-013 — Confirmar importação SISCOFIS

**Como fazer**
1. Concluir revisão de mapa, itens e pendências.
2. Selecionar confirmar importação.
3. Revisar resultado e eventuais posições ainda pendentes.

**Condição/limite:** Necessário validar quantidade e não duplicar importação.

#### F-10-014 — Acompanhar pendências pós-importação

**Como fazer**
1. Abrir pendências de alocação/legado.
2. Localizar material importado sem posição.
3. Alocar à estrutura física após conferência.

**Condição/limite:** Saldo sem local não pode ser tratado como saldo disponível em toda retirada.

#### F-10-015 — Imprimir ficha/etiqueta de alocação

**Como fazer**
1. Selecionar NF/material ou posição no fluxo de alocação.
2. Acionar geração de ficha/etiqueta disponível.
3. Conferir dados de destino e imprimir.

**Condição/limite:** Fichas são documentos auxiliares.


### Central de Depósitos — controle, estoque e inventário

**Disponibilidade:** MAIN. **Fontes de implementação:** `features/warehouse/components/WarehouseItemControlOperational.tsx; WarehouseStockOperational.tsx; WarehouseMovementsOperational.tsx; WarehouseInventoryOperational.tsx; WarehouseLogisticsReports.tsx; WarehouseLogisticsAlerts.tsx`.

#### F-11-001 — Abrir Controle de Materiais

**Como fazer**
1. Na Central de Depósitos selecionar Controle de Materiais.
2. Escolher Resumo, Estoque, Movimentações, Inventário ou Relatórios.

**Condição/limite:** Essas cinco abas são explicitamente definidas no código.

#### F-11-002 — Consultar resumo logístico

**Como fazer**
1. Abrir Controle de Materiais > Resumo.
2. Examinar totalizadores e pendências.
3. Navegar à aba de detalhe pertinente.

**Condição/limite:** Resumo é projeção; use ledger para conferir histórico.

#### F-11-003 — Pesquisar estoque

**Como fazer**
1. Abrir Controle de Materiais > Estoque.
2. Buscar nome/código de material.
3. Examinar saldos por posição, validade e origem.

**Condição/limite:** Respeitar contexto de depósito.

#### F-11-004 — Consultar lotes e validades

**Como fazer**
1. Na aba Estoque selecionar material.
2. Ver lotes, vencimentos e quantidades por posição.
3. Conferir rótulos e datas.

**Condição/limite:** Não dispensar checagem física da validade.

#### F-11-005 — Consultar códigos de barras

**Como fazer**
1. Na aba Estoque selecionar material ou código associado.
2. Inspecionar vinculações de barcode.
3. Validar correspondência física.

**Condição/limite:** Etiqueta errada não autoriza atribuir material diferente.

#### F-11-006 — Consultar movimentações

**Como fazer**
1. Abrir Controle de Materiais > Movimentações.
2. Aplicar filtros pertinentes.
3. Ler histórico do ledger oficial.

**Condição/limite:** Movimentações registradas não devem ser reexecutadas por consulta.

#### F-11-007 — Abrir inventário

**Como fazer**
1. Acessar Controle de Materiais > Inventário.
2. Escolher localização/material do escopo.
3. Iniciar conferência conforme opções.

**Condição/limite:** Conferência física exige observação no depósito.

#### F-11-008 — Registrar contagem física

**Como fazer**
1. Selecionar sessão/posição de inventário.
2. Informar quantidade efetivamente contada.
3. Revisar diferenças com o saldo de sistema.
4. Salvar contagem.

**Condição/limite:** Não inventar contagem ou zerar material não verificado.

#### F-11-009 — Tratar divergência de inventário

**Como fazer**
1. Na conferência identificar item com diferença.
2. Revisar lote, localização e histórico.
3. Usar ajuste explícito/autorizado quando o sistema permitir.
4. Conferir auditoria.

**Condição/limite:** Ajustes de estoque são operações sensíveis.

#### F-11-010 — Consultar histórico de inventários

**Como fazer**
1. Abrir relatórios ou histórico do Inventário.
2. Selecionar execução/data.
3. Ler divergências e ajustes registrados.

**Condição/limite:** Histórico distinto de contagem nova.

#### F-11-011 — Relatórios logísticos gerais

**Como fazer**
1. Abrir Controle de Materiais > Relatórios.
2. Selecionar modalidade logística desejada.
3. Filtrar, gerar e revisar dados.

**Condição/limite:** Relatório deriva de transações reais e das lacunas de dados.

#### F-11-012 — Exportar relatório logístico CSV

**Como fazer**
1. Na aba Relatórios selecionar filtro e período.
2. Acionar 'CSV' quando disponível.
3. Conferir separadores, colunas e período no arquivo.

**Condição/limite:** Exportação contém dados operacionais da unidade.

#### F-11-013 — Consultar consumo por destino

**Como fazer**
1. Abrir relatórios de saída/consumo.
2. Definir período e destino.
3. Gerar consolidado por destino.

**Condição/limite:** Não inferir consumo real fora das saídas registradas.

#### F-11-014 — Consultar consumo por material ou responsável

**Como fazer**
1. Abrir relatórios de saídas.
2. Selecionar filtro de material/responsável.
3. Gerar e conferir quantidades agregadas.

**Condição/limite:** Nomes de responsáveis dependem de preenchimento na saída.

#### F-11-015 — Consultar alertas de logística

**Como fazer**
1. Abrir área de alertas ou resumo logístico disponível.
2. Filtrar tipo/período.
3. Ver vencimento, pendências ou divergências.

**Condição/limite:** Alertas não executam correção automática.

#### F-11-016 — Consultar relatórios SISCOFIS históricos

**Como fazer**
1. Abrir Relatórios em Controle de Materiais.
2. Selecionar histórico/relatório SISCOFIS disponível.
3. Comparar importação, baixa ou movimentação.

**Condição/limite:** Separar histórico importado e operações nativas.


### Central de Depósitos — saída e rastreabilidade

**Disponibilidade:** MAIN. **Fontes de implementação:** `features/warehouse/components/WarehouseMaterialWithdrawal.tsx; WarehouseConsumptionReports.tsx; features/warehouse/pdf/WarehouseOutboundDocuments.ts; lib/warehouse`.

#### F-12-001 — Abrir Saída de Material

**Como fazer**
1. Na Central selecionar 'Saída de Material'.
2. Escolher 'Nova Saída' ou 'Registro de Saídas'.
3. Prosseguir no fluxo escolhido.

**Condição/limite:** A baixa é protegida por validações do servidor.

#### F-12-002 — Iniciar nova saída

**Como fazer**
1. Selecionar Nova Saída.
2. Identificar material por busca/código.
3. Selecionar posição física válida.

**Condição/limite:** Somente material efetivamente alocado e apto pode sair.

#### F-12-003 — Localizar material por barcode

**Como fazer**
1. No campo de leitura usar leitor ou digitar código de barras.
2. Acionar identificar.
3. Conferir nome/material e posição antes de lançar.

**Condição/limite:** Código vinculado pode mudar; reconferir se aviso de divergência.

#### F-12-004 — Selecionar posição de retirada

**Como fazer**
1. Após localizar item escolher depósito/local e lote quando necessário.
2. Conferir saldo apto da posição.
3. Informar quantidade.

**Condição/limite:** Bloqueia saldo insuficiente ou não rastreado para posição.

#### F-12-005 — Informar quantidade/unidade da saída

**Como fazer**
1. Na linha da saída selecionar apresentação/unidade disponível.
2. Informar quantidade física.
3. Conferir conversão de unidade e saldo.

**Condição/limite:** Não utilizar quantidade maior que estoque apto.

#### F-12-006 — Adicionar material ao carrinho

**Como fazer**
1. Depois de identificar o item e preencher quantidade acionar 'Adicionar ao carrinho'.
2. Conferir linhas do carrinho.
3. Repetir para outros materiais.

**Condição/limite:** O carrinho ainda não é baixa concluída.

#### F-12-007 — Editar/remover linha do carrinho

**Como fazer**
1. No carrinho localizar linha.
2. Ajustar quantidade ou remover.
3. Conferir totais e saldos novamente.

**Condição/limite:** Revalidar antes de concluir a saída.

#### F-12-008 — Selecionar destino da saída

**Como fazer**
1. Na seção 'Destino e responsável' selecionar destino autorizado.
2. Conferir destinação/identificação.
3. Prosseguir.

**Condição/limite:** Destinos inativos não podem ser usados.

#### F-12-009 — Identificar responsável/retirante

**Como fazer**
1. Na seção 'Destino e responsável' preencher identificação exigida.
2. Revisar material e quantidade.
3. Confirmar conformidade documental.

**Condição/limite:** Dados devem corresponder a pessoa/finalidade real.

#### F-12-010 — Finalizar saída

**Como fazer**
1. Conferir carrinho, locais, validades, destino e responsável.
2. Acionar finalizar/confirmar saída.
3. Aguardar confirmação do servidor e registrar resultado.

**Condição/limite:** A operação pode ser negada se saldo ou validade tiver mudado.

#### F-12-011 — Retomar saída incompleta

**Como fazer**
1. Se o sistema alertar falha ou recarga, reabrir Nova Saída.
2. Consultar rascunho de recuperação quando disponível.
3. Revalidar estoque e concluir apenas uma vez.

**Condição/limite:** Não duplicar baixa após timeout/erro incerto.

#### F-12-012 — Consultar registro de saídas

**Como fazer**
1. Abrir 'Registro de Saídas'.
2. Selecionar período/filtros.
3. Conferir itens, destino, responsável e documento.

**Condição/limite:** Histórico auditável de retirada.

#### F-12-013 — Emitir ficha de saída

**Como fazer**
1. Após saída confirmada abrir ações de documento.
2. Gerar/baixar/imprimir ficha da saída.
3. Conferir itens e assinaturas requeridas.

**Condição/limite:** Fichas não substituem confirmação no ledger.

#### F-12-014 — Emitir pedido de recolhimento de vencidos

**Como fazer**
1. Identificar material vencido por relatório ou seleção.
2. Abrir ação de pedido de recolhimento de vencidos.
3. Gerar e revisar PDF auxiliar.

**Condição/limite:** Vencido não deve ser retirado como consumo regular.

#### F-12-015 — Gerar relatório de consumo

**Como fazer**
1. Em Registro de Saídas abrir filtros de consumo.
2. Selecionar período, destino ou responsável.
3. Gerar relatório e exportar/copiar quando disponível.

**Condição/limite:** Consumo reportado deriva das saídas contabilizadas.


### Operador Móvel

**Disponibilidade:** MAIN. **Fontes de implementação:** `app/operador-movel; features/warehouse/mobile/WarehouseMobileHome.tsx; WarehouseMobileScanner.tsx; WarehouseMobileOutbound.tsx; app/api/central-depositos/mobile-read/route.ts; mobile-barcode/route.ts`.

#### F-13-001 — Abrir Operador Móvel

**Como fazer**
1. Em dispositivo compatível abrir /operador-movel.
2. Autenticar e validar permissão do setor.
3. Selecionar operação do painel.

**Condição/limite:** Fluxo móvel protegido por API do servidor.

#### F-13-002 — Ler etiqueta/código no celular

**Como fazer**
1. Abrir tarefa móvel com scanner.
2. Autorizar câmera, se solicitado, ou digitar código.
3. Confirmar leitura e identificação.

**Condição/limite:** O acesso à câmera depende de navegador/HTTPS/permissão.

#### F-13-003 — Alocar recebimento no móvel

**Como fazer**
1. Abrir Operador Móvel > Alocar recebimento.
2. Selecionar NF/material pendente.
3. Ler posição e informar quantidade/validade.
4. Confirmar alocação.

**Condição/limite:** Não confundir leitura de etiqueta com gravação já realizada.

#### F-13-004 — Cadastrar avulso no móvel

**Como fazer**
1. Abrir Cadastrar avulso.
2. Identificar material e destino.
3. Informar quantidade e validade, quando necessária.
4. Confirmar registro.

**Condição/limite:** Origem avulsa deve ser identificada.

#### F-13-005 — Transferir material no móvel

**Como fazer**
1. Abrir Transferir material.
2. Ler item/posição de origem.
3. Informar quantidade e posição de destino.
4. Revisar e confirmar.

**Condição/limite:** Transferência não deve escolher automaticamente validade por FEFO.

#### F-13-006 — Fazer saída móvel

**Como fazer**
1. Abrir Saída de material.
2. Ler item e posição.
3. Selecionar quantidade apta, destino e responsável.
4. Confirmar e verificar protocolo.

**Condição/limite:** Validade e posição protegidas no servidor.

#### F-13-007 — Consultar localização no móvel

**Como fazer**
1. Abrir Consultar localização.
2. Ler etiqueta ou informar endereço físico.
3. Conferir materiais/quantidades da posição.

**Condição/limite:** Consulta apenas.

#### F-13-008 — Consultar item no móvel

**Como fazer**
1. Abrir Consultar item.
2. Buscar por nome/código ou usar scanner.
3. Conferir lotes, quantidades e posições.

**Condição/limite:** Dados limitados ao workspace.

#### F-13-009 — Realizar inventário móvel

**Como fazer**
1. Abrir Inventário.
2. Selecionar local/material.
3. Informar contagem real e revisar diferença.
4. Salvar contagem ou ajuste permitido.

**Condição/limite:** Requer conferência física.

#### F-13-010 — Conferir posição no móvel

**Como fazer**
1. Abrir Conferir posição.
2. Ler etiqueta da posição.
3. Comparar conteúdo físico com registro.
4. Registrar resultado conforme formulário.

**Condição/limite:** Não inventar conferência sem presença física.

#### F-13-011 — Voltar ao EMPROVEX

**Como fazer**
1. Na tela inicial móvel selecionar 'Voltar ao EMPROVEX'.
2. Retornar ao painel principal.
3. Continuar operações no perfil atual.

**Condição/limite:** Não troca identidade.


### Administração da plataforma

**Disponibilidade:** MAIN. **Fontes de implementação:** `components/admin/PlatformAdminView.tsx; AdminCreateSectorPanel.tsx; AdminBillingPanel.tsx; AdminSessionsPanel.tsx; AdminBackupPanel.tsx; AdminConsumptionHub.tsx; app/api/admin`.

#### F-14-001 — Abrir Administração

**Como fazer**
1. Entrar com perfil fundador autorizado.
2. Acionar 'Abrir Administração EMPROVEX' ou /admin.
3. Aguardar validação de privilégios.

**Condição/limite:** Usuário setorial comum não pode administrar outros workspaces.

#### F-14-002 — Consultar Início administrativo

**Como fazer**
1. Em Admin escolher Início no modo Normal.
2. Examinar visão visual da plataforma e atalhos.
3. Navegar à ação necessária.

**Condição/limite:** Pode ser substituído por Visão Geral no modo Essencial.

#### F-14-003 — Consultar Visão Geral

**Como fazer**
1. No Admin abrir Visão Geral.
2. Conferir setores, sessões e indicadores de saúde disponíveis.
3. Abrir aba de detalhe.

**Condição/limite:** Não interpretar indisponibilidade de métrica como serviço indisponível.

#### F-14-004 — Listar setores e workspaces

**Como fazer**
1. Abrir Administração > Setores.
2. Consultar diretório.
3. Selecionar setor correto para ações administrativas.

**Condição/limite:** Respeitar UG e workspace.

#### F-14-005 — Buscar setor

**Como fazer**
1. Em Setores digitar UG, OM, e-mail, nome ou workspace.
2. Aplicar filtro de estado quando disponível.
3. Conferir identidade antes de ação.

**Condição/limite:** Duas organizações podem ter identificadores semelhantes.

#### F-14-006 — Cadastrar novo setor

**Como fazer**
1. Abrir Administração > Cadastrar Setor.
2. Informar identificação da OM, UG, e-mail operacional, senha inicial e perfil.
3. Revisar configuração/trial se aplicável e confirmar provisionamento.

**Condição/limite:** Cria identidade e workspace; não simular com cadastro manual no Firestore.

#### F-14-007 — Editar dados do setor

**Como fazer**
1. Na lista selecionar editar.
2. Corrigir campos permitidos.
3. Salvar e verificar atualização.

**Condição/limite:** Mudanças de UG/identidade podem ser sensíveis.

#### F-14-008 — Suspender ou reativar setor

**Como fazer**
1. Em Setores localizar unidade.
2. Escolher suspender/reativar.
3. Confirmar após avaliar efeito no acesso.

**Condição/limite:** Nunca contornar controle de acesso.

#### F-14-009 — Redefinir senha de setor no Admin

**Como fazer**
1. Localizar setor no diretório.
2. Selecionar redefinição de senha.
3. Seguir fluxo seguro de credenciais.
4. Orientar usuário a trocar no acesso.

**Condição/limite:** Credenciais não devem aparecer na Eleonor.

#### F-14-010 — Excluir setor

**Como fazer**
1. Abrir ação excluir em Setores.
2. Revisar impacto e confirmação.
3. Executar somente com autorização e protocolo aplicável.

**Condição/limite:** Ação altamente destrutiva; não aconselhar sem backups.

#### F-14-011 — Consultar interessados

**Como fazer**
1. Abrir Admin > Interessados.
2. Examinar solicitações de acesso institucional.
3. Selecionar registro e status.

**Condição/limite:** Lead não equivale a conta provisionada.

#### F-14-012 — Atualizar situação de interessado

**Como fazer**
1. No registro selecionar novo/contatado/em teste/concluído/descartado.
2. Revisar alteração.
3. Salvar.

**Condição/limite:** Não marcar trial como ativo sem verificar billing/workspace.

#### F-14-013 — Contatar interessado

**Como fazer**
1. Em Interessados abrir atalho de contato e-mail/WhatsApp disponível.
2. Verificar destinatário.
3. Enviar mensagem manual pelo canal escolhido.

**Condição/limite:** Não afirmar que o contato foi enviado sem comprovante.

#### F-14-014 — Consultar Consumo & Cotas

**Como fazer**
1. No Admin escolher Consumo & Cotas.
2. Abrir visão consolidada, Firebase, estimativas por UG ou limites.
3. Conferir fontes e janelas temporais.

**Condição/limite:** Telemetria real global ≠ estimativa por UG.

#### F-14-015 — Analisar custos Firestore

**Como fazer**
1. Abrir módulos de consumo/custo.
2. Selecionar período e entidade disponíveis.
3. Examinar estimativa e limites.

**Condição/limite:** Estimativa não equivale a fatura oficial.

#### F-14-016 — Configurar alertas de uso

**Como fazer**
1. Abrir área de alertas/limites de consumo.
2. Revisar política e limiares apresentados.
3. Salvar alteração autorizada.

**Condição/limite:** Não confundir alerta com bloqueio automático.

#### F-14-017 — Consultar sessões ativas

**Como fazer**
1. Abrir Admin > Sessões.
2. Localizar unidade/usuário.
3. Examinar estados e atividade registrada.

**Condição/limite:** Último heartbeat não mede produtividade.

#### F-14-018 — Encerrar sessão remotamente

**Como fazer**
1. Em Sessões selecionar sessão autorizada.
2. Acionar encerramento remoto.
3. Confirmar e verificar efeito.

**Condição/limite:** Operação administrativa de segurança.

#### F-14-019 — Consultar backups

**Como fazer**
1. Abrir Admin > Backup & Recuperação.
2. Verificar última execução, saúde e integridade indicadas.
3. Selecionar ação de backup/recuperação permitida.

**Condição/limite:** Verificar realmente o arquivo antes de prometer recuperação.

#### F-14-020 — Backup administrativo de identidades

**Como fazer**
1. Na área Backups selecionar mecanismo de backup Auth disponível.
2. Revisar escopo.
3. Gerar/consultar resultado.

**Condição/limite:** Dados de autenticação exigem proteção rigorosa.

#### F-14-021 — Recuperação de backup

**Como fazer**
1. Verificar backup válido e ponto de restauração.
2. Executar processo de recuperação oficialmente suportado.
3. Validar integridade após restaurar.

**Condição/limite:** Não improvisar restauração via chat, nem afetar outros workspaces.

#### F-14-022 — Consultar Segurança

**Como fazer**
1. Abrir Admin > Segurança.
2. Conferir indicadores de isolamento, integridade e recomendações.
3. Investigar anomalias nas fontes apropriadas.

**Condição/limite:** Painel não substitui auditoria de configuração externa.


### Assinaturas, suporte, documentos e operação institucional

**Disponibilidade:** MAIN. **Fontes de implementação:** `app/regularizacao/page.tsx; components/billing; components/layout/WorkspaceDriveControl.tsx; WorkspaceBackupSection.tsx; features/support/EmprovexHelpCenter.tsx; app/api/billing/portal/route.ts; public/institucional`.

#### F-15-001 — Abrir Minha Assinatura

**Como fazer**
1. Na área de conta/assinatura abrir painel de assinatura.
2. Conferir plano, condição de trial ou vencimento.
3. Escolher ação comercial disponível.

**Condição/limite:** Exibição pode ser condicionada a flags e perfil.

#### F-15-002 — Consultar período de teste

**Como fazer**
1. Abrir área de assinatura.
2. Verificar datas e dias restantes do trial, se houver.
3. Consultar regularização quando apropriado.

**Condição/limite:** Período de trial depende do cadastro; não inventar prazo individual.

#### F-15-003 — Regularizar acesso

**Como fazer**
1. Ao receber indicação de regularização abrir fluxo /regularizacao ou link oficial.
2. Conferir valor, destino e identificação.
3. Prosseguir apenas por meio de checkout oficial autorizado.

**Condição/limite:** Não pedir dados de cartão no chat.

#### F-15-004 — Gerar pagamento/checkout InfinitePay

**Como fazer**
1. Abrir Minha Assinatura/fluxo de cobrança habilitado.
2. Selecionar gerar ou abrir link.
3. Conferir identidade da cobrança e realizar no ambiente do provedor.

**Condição/limite:** Checkout e pagamento confirmado são estados diferentes.

#### F-15-005 — Acompanhar retorno de pagamento

**Como fazer**
1. Após pagamento retornar ao EMPROVEX.
2. Atualizar situação da assinatura quando disponível.
3. Se persistir pendência, buscar suporte com comprovante.

**Condição/limite:** Webhook e conciliação podem não ser instantâneos.

#### F-15-006 — Configurar cobrança no Admin

**Como fazer**
1. Entrar Admin > Assinaturas.
2. Revisar plano, regras de trial e condição por workspace.
3. Alterar somente campos administrativos permitidos.
4. Salvar e conferir status.

**Condição/limite:** Não modificar preço ou VIP por suposição da Eleonor.

#### F-15-007 — Consultar cobrança por workspace

**Como fazer**
1. Em Admin > Assinaturas localizar setor/UG.
2. Revisar estado comercial.
3. Abrir ação administrativa habilitada.

**Condição/limite:** Billing setorial e lead interessado são cadastros separados.

#### F-15-008 — Gerenciar mensalidade compartilhada

**Como fazer**
1. Abrir componente de mensalidade compartilhada, quando habilitado.
2. Informar participantes e confirmar consentimento.
3. Criar/consultar links de parcelas permitidas.

**Condição/limite:** Não pressupor disponibilidade para todos os workspaces.

#### F-15-009 — Consultar área institucional

**Como fazer**
1. Abrir emprovex.com.br.
2. Ler apresentação, FAQ e informações de acesso.
3. Usar canal oficial de contato.

**Condição/limite:** Páginas públicas não exigem sessão operacional.

#### F-15-010 — Solicitar acesso pelo site

**Como fazer**
1. No institucional selecionar 'Solicitar acesso'.
2. Preencher formulário.
3. Enviar e aguardar resposta humana.

**Condição/limite:** Não equivale a criar conta automaticamente.

#### F-15-011 — Abrir Central de Ajuda

**Como fazer**
1. No menu autenticado selecionar Ajuda, se disponível.
2. Abrir catálogo temático.
3. Buscar a tarefa desejada.

**Condição/limite:** Catálogo está em main; disponibilidade da entrada depende da revisão publicada.

#### F-15-012 — Pesquisar um dos 14 tutoriais

**Como fazer**
1. Na Central de Ajuda digitar palavra-chave ou escolher tema.
2. Selecionar tutorial.
3. Abrir vídeo somente por ação explícita.

**Condição/limite:** Não inventar tutoriais ou vídeos fora da lista oficial.

#### F-15-013 — Contato com suporte

**Como fazer**
1. Abrir Ajuda, assinatura ou página institucional.
2. Conferir contato oficial exibido.
3. Enviar dúvidas pela via autorizada.

**Condição/limite:** Eleonor não deve inventar SLA ou protocolo de chamado.

#### F-15-014 — Usar Google Drive para documentos

**Como fazer**
1. Na área de conta/armazenamento acessar controle Drive quando habilitado.
2. Conferir vínculo e permissões.
3. Abrir, enviar ou baixar documentos via ações próprias.

**Condição/limite:** Não assumir que todo setor está vinculado ao Drive.

#### F-15-015 — Consultar backup do workspace

**Como fazer**
1. Abrir seção de backup disponível ao setor.
2. Conferir última geração e estado.
3. Baixar/gerar backup apenas se permitido.

**Condição/limite:** Distinguir backup lógico e arquivo PDF de NE/NF.

#### F-15-016 — Instalar acesso PWA

**Como fazer**
1. No navegador compatível abrir EMPROVEX.
2. Usar opção de instalar aplicativo/adicionar à tela inicial quando oferecida.
3. Abrir o atalho instalado.

**Condição/limite:** PWA não muda permissões nem autoriza operação offline.


### Eleonor — interface e consultas

**Disponibilidade:** MAIN COM GATES. **Fontes de implementação:** `features/eleonor/components/EleonorExperience.tsx; app/api/emprovex-ai/ask/route.ts; app/api/emprovex-ai/query/route.ts; lib/emprovex-ai; docs/EMPROVEX_AI_PRODUCTION_PILOT_R0.md`.

#### F-16-001 — Abrir Eleonor em aba própria

**Como fazer**
1. No menu autenticado selecionar Eleonor, quando exibida.
2. Abrir /central-empenhos?tab=eleonor.
3. Escrever pergunta.

**Condição/limite:** A presença do chat não prova que backend/IA está habilitado.

#### F-16-002 — Abrir chat flutuante

**Como fazer**
1. Na superfície operacional localizar botão flutuante da Eleonor.
2. Acionar o símbolo.
3. Digitar pergunta e enviar.

**Condição/limite:** Visibilidade pode variar por revisão e estado de UI.

#### F-16-003 — Expandir chat

**Como fazer**
1. Com janela flutuante aberta selecionar expandir/abrir conversa completa.
2. Continuar no chat em aba própria.

**Condição/limite:** Não pressupor persistência entre dispositivos.

#### F-16-004 — Iniciar nova conversa

**Como fazer**
1. No chat Eleonor selecionar Nova conversa.
2. Confirmar limpeza do contexto local.
3. Fazer nova pergunta.

**Condição/limite:** Contexto anterior não deve se misturar automaticamente.

#### F-16-005 — Consultar fornecedor ou empenho

**Como fazer**
1. Perguntar à Eleonor por fornecedor, NE ou saldo com identificadores suficientes.
2. Ler resultado e referências.
3. Confirmar filtros e limitações exibidos.

**Condição/limite:** Só se gates de IA e permissões estiverem ativos; consultas de leitura.

#### F-16-006 — Consultar NF/NS com Eleonor

**Como fazer**
1. Perguntar por NF ou tramitação com período, NE ou fornecedor.
2. Ler resposta e eventual cobertura parcial.
3. Abrir módulo para verificar detalhe.

**Condição/limite:** Não inferir pendência por mera ausência de registro; usar dados determinísticos.

#### F-16-007 — Consultar localização de material com Eleonor

**Como fazer**
1. Informar material e, se possível, depósito/identificador.
2. Ler posição e quantidade retornadas.
3. Conferir fisicamente antes de movimentar.

**Condição/limite:** Localização e estoque exigem autorização Warehouse.

#### F-16-008 — Entender resposta indisponível

**Como fazer**
1. Se Eleonor indicar que ambiente não está habilitado ou falhou, não repetir como fato.
2. Consultar diretamente os módulos originais.
3. Registrar caso para teste do motor.

**Condição/limite:** Flags de piloto, IAM e roteamento determinístico podem bloquear consultas.

#### F-16-009 — Entender escopo sem escrita

**Como fazer**
1. Solicitar orientação sobre uma tarefa.
2. Receber instruções e referências autorizadas.
3. Executar manualmente na interface com própria permissão.

**Condição/limite:** A Eleonor atual não deve executar exclusão, baixa, cadastro, cobrança ou mutação por chat.


### EMPROVEX Almoxarifado R1-D (PR #463, não integrado)

**Disponibilidade:** PR / PILOTO. **Fontes de implementação:** `PR #463; docs/EMPROVEX_ALMOXARIFADO_MEMORIAL_OFICIAL.md na integration/emprovex-almox-r1d-w9-pilot; PRs #436 #438 #439 #441 #458 #459 #460`.

#### F-17-001 — Acessar portal Almoxarifado (piloto)

**Como fazer**
1. Após futura autorização e publicação de piloto, entrar como setor tipo almoxarifado.
2. Abrir /almoxarifado.
3. Navegar aos módulos setoriais.

**Condição/limite:** NÃO instruir usuário comum a acessar hoje como disponível em produção.

#### F-17-002 — Cadastrar setor Almoxarifado (piloto)

**Como fazer**
1. No Admin de build piloto abrir cadastro de setor.
2. Escolher tipo Almoxarifado se habilitado.
3. Provisionar conta/workspace após autorização.
4. Homologar login.

**Condição/limite:** Provisionamento real ainda requer validação específica.

#### F-17-003 — Consultar empenhos do Almoxarifado

**Como fazer**
1. No portal piloto abrir Empenhos.
2. Filtrar NE do próprio setor.
3. Verificar itens e saldos.

**Condição/limite:** Reaproveita núcleo; não herdar dados de Aprovisionamento sem autorização.

#### F-17-004 — Cadastrar NF do Almoxarifado

**Como fazer**
1. No portal piloto abrir Notas Fiscais.
2. Selecionar NE e preencher itens recebidos.
3. Revisar e salvar somente após liberação transacional.

**Condição/limite:** Cobertura funcional de QA sintético não certifica mutação real.

#### F-17-005 — Criar cronograma do Almoxarifado

**Como fazer**
1. No portal piloto abrir Cronogramas.
2. Escolher NE e compor remessas.
3. Gerar e validar documento.

**Condição/limite:** Reuso funcional ainda em PR.

#### F-17-006 — Consultar fornecedores setoriais

**Como fazer**
1. No portal piloto abrir Fornecedores.
2. Buscar CNPJ/nome.
3. Inspecionar vínculos permitidos.

**Condição/limite:** Consulta de W7 prioritariamente leitura.

#### F-17-007 — Consultar itens e materiais setoriais

**Como fazer**
1. No portal piloto abrir Consulta de Itens ou Materiais.
2. Pesquisar descrição/código.
3. Ver resultado e localização quando autorizada.

**Condição/limite:** Item financeiro e material físico são identidades distintas.

#### F-17-008 — Usar Warehouse no Almoxarifado

**Como fazer**
1. No portal piloto abrir acesso ao Warehouse.
2. Selecionar depósito.
3. Operar conforme permissões e bloqueios.

**Condição/limite:** Não declarar estoque setorial produtivo antes de homologação.

#### F-17-009 — Consultar relatórios do Almoxarifado

**Como fazer**
1. No portal piloto abrir Relatórios.
2. Selecionar modalidade financeira/logística.
3. Revisar marcador de completude parcial, quando indicado.

**Condição/limite:** W8 read-only e pode sinalizar partial.

#### F-17-010 — Usar FUNADOM inicial

**Como fazer**
1. No contexto Almoxarifado verificar classe FUNADOM prevista.
2. Aplicar classificação apenas à operação elegível.
3. Validar relatório.

**Condição/limite:** Não confundir com inclusão automática de outras classificações.

#### F-17-011 — Importar Pedido de Material SISCOFIS TXT/PDF

**Como fazer**
1. No fluxo experimental escolher Pedido de Material.
2. Carregar TXT ou PDF textual compatível.
3. Conferir itens interpretados.
4. Rejeitar/ajustar caso não corresponda ao documento.

**Condição/limite:** Somente fixtures sintéticas homologadas; PDF real e operação oficial NO-GO.

#### F-17-012 — Planejar separação física

**Como fazer**
1. Com Pedido experimental validado rodar correspondência determinística.
2. Revisar posições sugeridas.
3. Ajustar plano sem alterar saldo.

**Condição/limite:** Motor de planejamento W3 não faz baixa nem reserva produtiva.

#### F-17-013 — Emitir ficha de separação PDF A4

**Como fazer**
1. Com plano experimental aprovado abrir Ficha de Separação.
2. Gerar PDF.
3. Conferir posição, itens e quantidades.

**Condição/limite:** Documento é auxiliar e não comprova retirada efetiva.

#### F-17-014 — Registrar estado experimental de atendimento

**Como fazer**
1. No piloto consultar situação do Pedido.
2. Comparar itens previstos e tratados.
3. Manter pendente quando houver divergência.

**Condição/limite:** Não criar baixa SISCOFIS nem alteração de saldo.

#### F-17-015 — Limitações excluídas do piloto

**Como fazer**
1. Ao ser perguntada por CREM/TREM, comissão QR ou baixa auxiliar explicar a exclusão.
2. Orientar a usar apenas funcionalidades realmente disponíveis no setor apropriado.

**Condição/limite:** CREM/TREM fora do escopo R1-D; baixa auxiliar desabilitada; pedido real adiado.


### EMPROVEX Empresas (desenvolvimento pausado)

**Disponibilidade:** PAUSADO. **Fontes de implementação:** `PRs #419 #444 #447; docs/EMPROVEX_EMPRESAS_MEMORIAL_OFICIAL.md na cadeia empresarial`.

#### F-18-001 — Provisionar conta empresa

**Como fazer**
1. Quando desenvolvimento for reativado, validar identidade empresarial e CNPJ.
2. Usar Admin autorizado para provisionar workspace.
3. Homologar login.

**Condição/limite:** PAUSADO: não disponível como processo corrente.

#### F-18-002 — Cadastrar e gerenciar diretório de empresas

**Como fazer**
1. Após reativação, abrir painel Admin empresarial.
2. Cadastrar CNPJ e contatos.
3. Revisar unicidade e salvar.

**Condição/limite:** PAUSADO: não executar com dados reais no sistema atual.

#### F-18-003 — Login de empresa

**Como fazer**
1. Após publicação autorizada, entrar com credencial empresarial.
2. Validar redirecionamento ao portal /empresa.
3. Conferir autorização do workspace.

**Condição/limite:** PAUSADO: não prometer /empresa em produção.

#### F-18-004 — Cadastro unificado de clientes

**Como fazer**
1. Depois de merge futuro, no Admin selecionar tipo de cliente.
2. Escolher setor ou empresa.
3. Completar identificação e cadastro.

**Condição/limite:** PAUSADO: UI unificada não integra main auditada.

#### F-18-005 — Gestão empresarial de notas/fornecedores

**Como fazer**
1. Após reativação e homologação verificar módulos liberados para empresa.
2. Operar conforme permissões e fluxos certificados.

**Condição/limite:** Não extrapolar funções atuais do Aprovisionamento para Empresa.

## 5. Regras normativas do motor de orientação Eleonor

### 5.1. Prioridade de evidência

1. Confirmação de sessão, permissões, dados e controles em runtime autorizados > código `main` > memorial versionado > PR DRAFT > projeto/ideia.
2. O código visível nesta auditoria é uma **base**, não substitui a consulta de disponibilidade efetiva do usuário no momento da pergunta.
3. Se a função não existir na revisão ativa, dizer claramente **"não está disponível nesta versão"** e, se houver, indicar caminho manual já disponível.
4. Nunca misturar **NF cadastrada**, **NF pendente de tramitação**, **NS**, **entrada em estoque**, **alocação em posição** e **saída física**: são eventos distintos.
5. Nunca confundir **Pedido de Material SISCOFIS** (Almox R1-D experimental) com **Mapa de Existência SISCOFIS** (estoque Warehouse).
6. Ao orientar qualquer edição, confirmar visualmente NE, fornecedor, CNPJ, UG/workspace, quantidade, documento e consequências antes de salvar.

### 5.2. Formato recomendado de resposta sobre uma funcionalidade

- **Onde fica:** módulo > aba > ação, com rota opcional.
- **Para que serve:** uma frase simples.
- **Passo a passo:** três a cinco passos, sem abstrações internas de Firestore/IAM.
- **O que conferir:** origem documental, saldo/posição, data ou autorização.
- **Limite:** avisar quando há gate, permissão, ambiente de teste, limitação de importador ou indisponibilidade.
- **Próxima ação:** abrir tela ou esclarecer um identificador; não afirmar que um cadastro/baixa foi feito sem prova.

### 5.3. Política de segurança conversacional

- Padrão **somente leitura e orientação**. O usuário efetiva alterações na interface.
- Não solicitar senha, token, chave IAM, segredo de webhook, documento pessoal desnecessário nem colar conteúdo confidencial em prompt.
- Não inferir existência de dados entre workspaces, nem enumerar contas, UGs ou dados de outros setores.
- Se existir dúvida documental, solicitar confirmação/campo de referência antes de responder com números.
- **Cobertura parcial/sem dados ≠ saldo zero**; explicitar ausência ou parcialidade.
- Não inventar botão, status, dado, URL de PDF, envio de e-mail, confirmação bancária, alteração de assinatura ou autenticação bem-sucedida.
- A personalidade Eleonor pode ajustar o **tom**; não pode alterar valor, fonte, ressalva ou decisão do núcleo determinístico.

### 5.4. Exemplos de perguntas para treinar recuperação de instruções

| Intenção | Exemplos de perguntas | Grupo |
| --- | --- | --- |
| howto.empenho.criar | "Como cadastrar uma NE manualmente?" / "Dá para importar uma NE em PDF?" | Gestão de Empenhos |
| howto.empenho.saldo | "Onde vejo o saldo de itens da NE?" | Gestão de Empenhos |
| howto.nf.pendente | "Como filtrar NFs pendentes de tramitação?" | Notas Fiscais |
| howto.ns.sag | "Como importar NS pelo SAG sem duplicar?" | Relatórios |
| howto.cronograma.enviar | "Como gerar e enviar um cronograma ao fornecedor?" | Cronogramas |
| howto.fornecedor.cnpj | "Como corrigir o CNPJ do fornecedor?" | Fornecedores / Empenhos |
| howto.warehouse.alocar | "Como alocar uma NF numa prateleira?" | Alocação |
| howto.warehouse.estoque | "Onde vejo o lote e a validade do arroz?" | Controle de Materiais |
| howto.warehouse.saida | "Como registrar retirada por código de barras?" | Saídas |
| howto.mobile.transferir | "Como transferir pelo celular?" | Operador Móvel |
| howto.admin.setor | "Como cadastrar um novo setor?" | Administração |
| howto.admin.sessao | "Como encerrar sessão de um operador?" | Administração |
| howto.billing.regularizar | "Onde posso regularizar minha mensalidade?" | Assinaturas |
| howto.ajuda.video | "Onde estão os tutoriais do sistema?" | Ajuda |
| howto.ai.ask | "Como consultar uma nota pela Eleonor?" | Eleonor |
| availability.almox.pedido | "Já posso importar pedido SISCOFIS no Almox?" | PR #463; ainda não |
| availability.empresa.login | "Posso usar o módulo Empresas?" | PAUSADO |

## 6. Verificação de cobertura e lacunas de auditoria

**Catálogo desta versão:** 242 procedimentos individuais em 18 grupos. Cobertura estática de navegação canônica, operações financeiras/logísticas, Administração, assinatura, apoio ao usuário, IA e iniciativas paralelas.

**O que foi verificado:** estrutura integral da árvore de arquivos sem truncamento, rotas, componentes, handlers de ações principais, documentos canônicos e estado das PRs relevantes. **O que NÃO foi verificado:** credenciais reais de perfis, confirmação visual de cada botão no domínio produtivo, trilha de ponta a ponta de todas as escritas, permissionamento exato por usuário, versão Cloud Run efetivamente servida, disponibilidade do serviço LFM3, uso real do PDF SISCOFIS Pedido.

**Critério de revisão contínua:** após todo merge funcional relevante ou alteração de menu/rota, comparar a versão `main` com este catálogo e atualizar os IDs existentes; acrescentar IDs novos para novas operações. Não apagar IDs estáveis sem registrar substituição. Mudanças só de visual podem atualizar rótulo sem mudar sentido operacional. Antes de ativar a Eleonor como orientadora oficial, executar um smoke manual por família com um setor de teste e registrar diferenças encontradas.

## 7. Fronteira de integração futura com o contexto da Eleonor

- **Fonte:** este markdown; futura ingestão deve produzir entradas estruturadas `featureId, intent, title, role, status, route, steps, guards, sourceCommit, updatedAt`, preservando IDs e disponibilidade.
- **Busca:** priorizar identificação determinística por nome/variações PT-BR e ID; palavras como "cadastrar", "excluir", "saldo", "NF", "NS", "alocação", "baixa", "SISCOFIS" exigem desambiguação de domínio quando necessário.
- **Respostas:** no MVP, responder como orientação textual e, quando autorizado, apontar a rota. Nenhum motor novo de escrita nem agente que clique sozinho.
- **Segurança:** revalidar autorização do usuário antes de indicar dados pessoais/financeiros do contexto operacional. Tutoriais gerais podem ser reutilizados sem consulta ao Firestore.
- **Telemetria de treinamento:** usar testes sintéticos e casos anonimizados; não registrar perguntas reais com segredos nem reutilizar dados privados de outros workspaces.
- **Rótulo de disponibilidade:** nunca apagar ou reclassificar como MAIN as entradas PR/Pausado por mera existência em documentos.

## 8. Registro de auditoria R1

- **Data:** 02/11/2026 (Brasília).
- **Base:** `main@b62f82ec6a87403a84cd7ba19c6b7cd8ac7a6329`.
- **Almoxarifado:** PR #463 DRAFT aberta, integração/QA sintético com GO técnico de revisão, NO-GO merge/publicação sem autorização. Pedido real de Material SISCOFIS ainda não homologado.
- **Empresas:** PRs #419, #444 e #447 DRAFT pausadas.
- **Eleonor:** UI e código de conversa presentes na árvore `main`, com gates explícitos; personalidade e opções generativas em especificações/PRs não substituem comportamento comprovado da versão ativa.
- **Ações realizadas nesta auditoria:** inspeção e documentação. Nenhuma alteração de schema, Firebase, Firestore Rules, IAM, cobrança, usuários, domínio ou Cloud Run.
- **Próximo uso:** transformar as perguntas do §5.4 em lote de testes de contexto, comparando resposta real da Eleonor com estas instruções e estados de disponibilidade. 
