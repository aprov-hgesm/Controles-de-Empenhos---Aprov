# ADM Depósito — Roadmap Oficial de Implementação

Este é o passo a passo oficial do módulo ADM Depósito / Área Logística do EMPROVEX.

## Estratégia vigente — Roadmap V2

A partir do fechamento da FASE 2, o desenvolvimento deixa de avançar por microcamadas horizontais e passa a seguir um modelo híbrido:

**Fundação concluída → Walking Skeleton → fatias verticais completas → integração progressiva → hardening → expansão externa.**

Objetivos da mudança:
- reduzir retrabalho entre telas, domínio e persistência;
- entregar capacidades utilizáveis ao fim de cada fase;
- integrar dados progressivamente, em vez de adiar integrações para o final;
- preservar contratos canônicos já concluídos;
- diminuir a quantidade de fases futuras sem remover requisitos funcionais.

Os blocos DEP e EXT continuam sendo os requisitos oficiais. O que muda é o agrupamento e a ordem de execução.

Total vigente:
- FASES 0 a 2: concluídas e preservadas como histórico;
- FASES 3 a 13: desenvolvimento e validação do piloto fundador;
- FASE 14: expansão externa futura;
- blocos DEP-0 a DEP-37 preservados;
- blocos EXT-1 a EXT-6 preservados.

---

## FASE 0 — Fundação e isolamento — CONCLUÍDA

### DEP-0 — Feature flag exclusiva da conta fundadora
- `warehouseModuleEnabled`;
- sidebar, rotas, APIs e dados protegidos;
- acesso externo direto bloqueado.

### DEP-0.1 — Namespace próprio do módulo
Domínio separado para estoque, depósitos, localizações, movimentos, lotes, inventários e snapshots.

Gate: usuário externo não vê nem acessa nenhuma funcionalidade logística.

## FASE 1 — Fundação do material — CONCLUÍDA

### DEP-1 — Modelo canônico de material
Identidade interna, descrição, aliases, unidade, status e workspace/UG.

### DEP-1.1 — Unidades e conversões
Suporte às unidades e apresentações necessárias ao domínio.

## FASE 2 — Ledger e saldos — CONCLUÍDA

### DEP-2 — Ledger de movimentações
Tipos iniciais: INITIAL_BALANCE, INVOICE_ENTRY, OUTBOUND, TRANSFER, INVENTORY_ADJUSTMENT, INVOICE_CORRECTION e REVERSAL.

### DEP-2.1 — Saldo agregado
Saldo materializado para leitura rápida sem perder o ledger auditável.

### DEP-2.2 — Idempotência
Proteção contra duplicação de operações repetíveis.

---

# NOVA SEQUÊNCIA DE DESENVOLVIMENTO

## FASE 3 — Walking Skeleton do ADM Depósito — CONCLUÍDA

Objetivo: criar o esqueleto completo do módulo antes de aprofundar as próximas funcionalidades.

Esta fase é transversal e não substitui nem renumera blocos DEP.

Entregas:
- arquitetura de navegação interna do ADM Depósito;
- superfícies-base para Visão Geral, Estoque, Movimentações, Localizações, Visão do Depósito, Inventário, SISCOFIS/Conciliação, Entregas e Configurações;
- rotas e estados vazios consistentes;
- contratos de integração entre UI, domínio e repositories;
- fronteiras claras entre módulos;
- carregamento e erros padronizados;
- preservação da feature flag e do isolamento founder-only;
- nenhum comportamento funcional futuro deve ser simulado como concluído.

Gate:
- todas as superfícies estruturais abrem sem regressão;
- usuário externo continua sem acesso;
- o esqueleto não cria segunda fonte de verdade para material, ledger ou saldo;
- testes estruturais e build verdes.

## FASE 4 — NF → Estoque — CONCLUÍDA E DESACOPLADA DO NÚCLEO

Blocos: DEP-3, DEP-3.1, DEP-3.2, DEP-3.3 e DEP-4.

Capacidade vigente:
- NF cadastrada no EMPROVEX representa material recebido;
- o ADM lê a NF já confirmada e projeta INVOICE_ENTRY no ledger em seu próprio namespace;
- vínculo NF ↔ movimento ↔ item de origem e idempotência pertencem ao ADM;
- edição/correção/exclusão da NF nunca dependem do warehouse;
- correção/reversão logística acontece em reconciliação subsequente;
- cutoff/data de ativação logística por workspace continua protegido;
- nenhuma segunda lógica de saldo.

Gate vertical: o EMPROVEX deve permanecer operável com o ADM indisponível; a projeção logística é idempotente e reconciliável.

## FASE 5 — SISCOFIS, Marco Zero e Conciliação — CONCLUÍDA

Blocos: DEP-5, DEP-5.1, DEP-5.2, DEP-5.3, DEP-6, DEP-7, DEP-7.1, DEP-21, DEP-21.1, DEP-21.2 e DEP-21.3.

Capacidade completa:
- prompt oficial gerado pelo EMPROVEX;
- IA permanece externa;
- contrato JSON versionado;
- importador e validador;
- pré-visualização antes da confirmação;
- Marco Zero auditável;
- proteção contra duplicidade histórica via cutoff;
- snapshots posteriores apenas conciliam EMPROVEX x SISCOFIS;
- divergência nunca autocorrige estoque.

Gate vertical: prompt → JSON → validação → preview → Marco Zero/snapshot → conciliação.

## FASE 6 — Depósitos, Localizações e Transferências — CONCLUÍDA

Blocos: DEP-8, DEP-8.1, DEP-9, DEP-9.1 e DEP-10.

Capacidade completa:
- 1..N depósitos por UG;
- cadastro simples de depósitos;
- modelo Depósito → Local → Subposição opcional;
- código lógico estável;
- transferência interna muda localização sem alterar o total da OM;
- IDs lógicos preparados para uso posterior pela Visão do Depósito.

Gate vertical: cadastrar estrutura física, localizar material e transferi-lo preservando saldo total.

## FASE 7 — Estoque Operável, Lotes, Validade e FEFO — CONCLUÍDA

Blocos: DEP-11, DEP-11.1, DEP-11.2, DEP-12, DEP-15, DEP-15.1 e DEP-15.2.

Capacidade completa:
- lotes e validade como enriquecimento do estoque existente;
- pendências logísticas geram aviso, não bloqueio;
- recomendação FEFO;
- tela Estoque com pesquisa por descrição, código, depósito, local, lote, validade, NF e fornecedor;
- ficha do material com saldo, origem, lotes, locais e histórico;
- ação Localizar no depósito preparada para a FASE 9.

Gate vertical: material pode ser consultado e operado de ponta a ponta com contexto logístico.

## FASE 8 — Código de Barras, Scanner e Saída Expressa — CONCLUÍDA

Blocos: DEP-13, DEP-13.1, DEP-14, DEP-14.1, DEP-14.2, DEP-16, DEP-16.1, DEP-16.2 e DEP-16.3.

Capacidade completa:
- múltiplos códigos/apresentações por material;
- conversão de embalagem;
- leitor USB tipo teclado;
- enriquecimento de lote/validade/localização;
- fluxo SCAN → quantidade → ENTER ou pesquisa → quantidade → confirmar;
- FEFO sugerido;
- proteção contra saldo negativo;
- operação contínua sem modais repetitivos.

Gate vertical: retirada rápida, segura e auditável por pesquisa ou scanner.

## FASE 9 — Visão do Depósito, Editor e Persistência — CONCLUÍDA

Blocos: DEP-17 a DEP-19.5.

Capacidade completa:
- aba Visão do Depósito;
- croqui 2D com perspectiva tridimensional leve;
- objetos estruturais simples;
- nenhum produto desenhado;
- pesquisa de material destaca IDs de localização;
- FEFO pode destacar prioridade;
- editor simplificado;
- objeto visual vinculado a warehouseLocationId;
- mover objeto não move estoque;
- layout ativo versionado no Firestore;
- JSON versionado;
- Firestore como estado operacional ativo;
- histórico de versões com recuperação por nova versão;
- JSON versionado e preview SVG derivados/exportáveis;
- contrato preparado para sincronização complementar com Drive da UG sem transformar o Drive em fonte de verdade nem bloquear o croqui quando a autorização temporária não estiver disponível.

Gate vertical: pesquisar material → abrir mapa → destacar local correto → editar layout sem alterar estoque.

## FASE 10 — Inventário Físico — CONCLUÍDA

Blocos: DEP-20, DEP-20.1, DEP-20.2 e DEP-20.3.

Capacidade concluída:
- inventário total ou parcial por depósito/local/subposição;
- sessão versionada warehouse_inventory_v1 com itens bounded em subcoleção;
- snapshot histórico do esperado derivado das projeções oficiais;
- contagem separada do estoque oficial;
- esperado x contado e divergência explícita;
- revisão e confirmação humana obrigatória;
- INVENTORY_ADJUSTMENT auditável, idempotente e atômico;
- controle otimista de concorrência por revisão da posição física;
- estado RECONCILIATION_REQUIRED quando a referência ficou obsoleta;
- fila derivada de materiais sem localização;
- histórico imutável e founder-only;
- Browser E2E e guards específicos incluídos.

Gate vertical: contagem → divergência → confirmação → ajuste auditável → novo saldo.

Fechamento: PR #180 aprovado e integrado à `main` por squash merge `0a15586ff39d740f48f71c33c7cbff578835e11f`, com Application CI #702 e Recovery guardrails #463 aprovados.

## FASE 11 — Entregas, Dashboard Logístico e Alertas — IMPLEMENTADA / VALIDAÇÃO LOCAL CONCLUÍDA

Blocos: DEP-22, DEP-22.1, DEP-23, DEP-23.1 e DEP-23.2.

Capacidade completa:
- consumir Planejamento/Cronograma existente em modo somente leitura, sem duplicar dados;
- correlacionar Entrega → NF → projeção de estoque dentro do ADM;
- dashboard com indicadores acionáveis;
- alertas de localização, validade, vencimento, baixo estoque, inventário, SISCOFIS e entregas persistidos no namespace warehouse;
- nenhuma alteração das Rules ou coleções operacionais do EMPROVEX para atender alertas logísticos;
- NF cadastrada continua significando recebido, independentemente da disponibilidade do ADM.

Gate vertical: expectativa de entrega e situação logística aparecem no ADM sem introduzir dependência operacional no EMPROVEX.

Estado de fechamento:
- implementação funcional concluída na branch protegida da FASE 11;
- Core Protection aprovado localmente;
- testes de domínio logístico 5/5;
- guard permanente da FASE 11 aprovado;
- walking skeleton 6/6;
- CI remoto e integração à `main` ficam deliberadamente diferidos até a conclusão das fases restantes do ADM Depósito; até lá, a continuidade usa a branch/baseline protegida e gates locais rápidos.

## FASE 11.5 — Consolidação Visual e UX do ADM Depósito

Objetivo: consolidar a identidade visual definitiva do módulo depois que suas principais capacidades operacionais estiverem implementadas e antes do hardening técnico final.

Escopo:
- usar o mesmo chrome visual oficial do EMPROVEX para Header, Sidebar e framework principal;
- transformar a antiga Visão Geral em **Início**, central visual branca de consulta e localização;
- posicionar consulta de itens e seletor de depósito na coluna esquerda;
- mostrar saldo, quantidade no depósito, localizações, lotes e validade do item selecionado;
- usar croqui 2.5D/isométrico sem paredes na home, com piso delimitador, destaque de localização, vista superior e rotação controlada;
- preservar a edição/versionamento do croqui na superfície Visão do Depósito;
- criar e consolidar um design system próprio do ADM Depósito, coerente com a identidade geral do EMPROVEX;
- revisar hierarquia visual, navegação interna, sidebar, cabeçalhos, cards, tabelas, filtros, badges, estados, formulários e feedbacks;
- harmonizar Estoque, Saída Expressa, Localizações, Visão do Depósito, Inventário, Entregas, Dashboard, Alertas e demais superfícies do módulo;
- melhorar responsividade, densidade de informação, ergonomia e consistência;
- aplicar microinterações e acabamento visual com foco em aparência profissional, elegante e operacional;
- preservar legibilidade e eficiência acima de efeitos puramente decorativos;
- não alterar regras de negócio, ledger, saldos, contratos logísticos ou Firestore Rules, salvo ajuste estritamente necessário para suportar a interface.

Arquitetura de informação aprovada durante a execução:
- Sidebar principal reduzida a **Início**, **Cadastro de Itens**, **Meus Depósitos** e **Controle de Itens**;
- Início concentra croqui/consulta/localização visual;
- Cadastro de Itens concentra fila derivada das NFs, decisão entre alocação física e consumo imediato, relatório de consumo imediato para SISCOFIS e migração SISCOFIS manual/JSON;
- Meus Depósitos concentra cadastro/inativação de depósitos e localizações e croquis independentes por depósito;
- estruturas de croqui incluem estante, rack, armário, câmara, freezer, geladeira, palete, bancada, corredor, zona e outras, com dimensões/posição/rotação personalizáveis;
- Controle de Itens concentra resumo logístico, estoque consultável, lotes/validade, saída expressa, movimentações, inventário, entregas, alertas e configurações;
- rotas antigas permanecem apenas como redirecionamentos de compatibilidade;
- `warehouse_item_intake_v1` registra a decisão logística no namespace warehouse sem escrever de volta em NF/Empenho;
- cada depósito pode manter seu próprio croqui ativo e histórico versionado.

Desvio funcional autorizado durante a fase:
- a pedido do fundador, a FASE 11.5 passou a consolidar também a arquitetura de informação e o fluxo de entrada logística;
- alterações de domínio ficam restritas ao ADM/namespace `warehouse` e não autorizam reacoplamento ao núcleo EMPROVEX;
- D-059 e D-060 definem os limites permanentes dessa ampliação.

Direção criativa:
- a definição estética será conduzida pessoalmente pelo fundador de forma iterativa durante esta fase;
- cores, referências visuais, intensidade de efeitos, composição e prioridades estéticas não devem ser fechadas antecipadamente;
- o agente deve transformar as decisões do fundador em componentes, tokens, padrões e implementação técnica consistentes;
- nas FASES 8 a 11, realizar apenas ajustes visuais necessários para usabilidade, consistência ou conclusão funcional, sem antecipar a reformulação estética global.

Gate:
- todas as superfícies operacionais do ADM Depósito compartilham linguagem visual consistente;
- a interface está responsiva e adequada ao uso real;
- nenhuma alteração estética modifica a fonte de verdade ou o comportamento funcional do estoque;
- a identidade final está aprovada pelo fundador antes do início da FASE 12.

## FASE 12 — Operacionalização, Segurança, Performance e Telemetria

Blocos: DEP-24, DEP-24.1, DEP-25, DEP-25.1, DEP-25.2, DEP-25.3, DEP-25.4, DEP-26, DEP-26.1, DEP-26.2 e DEP-26.3.

Capacidade completa:
- preparar role ADM Depósito sem privilégios financeiros desnecessários;
- consultas sob demanda e agregações;
- Visão do Depósito econômica;
- listeners controlados;
- métricas logísticas por UG;
- painel administrativo de consumo logístico;
- isolamento integral por workspace/UG;
- Drive por workspace;
- layouts privados;
- trilha de auditoria completa.

Gate vertical: módulo mensurável, isolado, econômico e seguro para o piloto fundador.

## FASE 13 — Validação Integrada e Fechamento do Piloto Fundador

Blocos: DEP-27 a DEP-37.

Executar como uma campanha integrada de qualidade, não como dez microfases separadas.

Política de entrada na FASE 13:
- por D-057, a execução de testes do restante das FASES 11.5 e 12 é deliberadamente acumulada para esta campanha final;
- os testes e guards existentes continuam preservados no repositório, mas não precisam ser executados a cada incremento;
- a regressão completa é consolidada aqui, após a implementação funcional do ADM Depósito;
- esta fase inclui estabilização, correção consolidada das falhas encontradas e reexecução até todos os gates finais ficarem verdes;
- o objetivo é evitar repetição de suítes longas durante cada pequeno incremento sem reduzir a cobertura final.

Cobertura obrigatória:
- fluxo ponta a ponta;
- scanner;
- NF e correções;
- Visão do Depósito;
- inventário;
- SISCOFIS;
- concorrência;
- consumo;
- TypeScript/build;
- Firestore/Rules/índices;
- segurança e isolamento;
- Drive;
- auditoria funcional;
- gate final apto/não apto para piloto externo.

Até DEP-37 aprovado, usuários externos continuam sem acesso.

## FASE 14 — Expansão Externa Futura

Blocos: EXT-1 a EXT-6.

Esta fase só começa com autorização explícita após DEP-37.

Capacidade:
- ativar role ADM Depósito;
- feature flag por UG;
- primeira OM piloto;
- validar depósito estruturalmente diferente;
- piloto ampliado em 3 a 5 OMs;
- liberação geral/comercial controlada por UG.

---

## Definition of Done de uma fatia vertical

Uma fase funcional só é concluída quando, conforme aplicável:
- interface utilizável;
- regra de domínio implementada;
- persistência integrada;
- Firestore Rules/segurança coerentes;
- integração com capacidades anteriores concluída;
- testes unitários/contrato relevantes;
- testes de integração/E2E relevantes;
- build e TypeScript aprovados;
- documentação e STATUS atualizados;
- nenhuma fonte de verdade paralela criada.

Não deixar para uma fase futura a integração essencial da capacidade atual, salvo dependência explicitamente prevista neste roadmap.

## Ordem macro vigente

```text
FASE 0 Fundação e isolamento ✓
→ FASE 1 Material ✓
→ FASE 2 Ledger e saldos ✓
→ FASE 3 Walking Skeleton ✓
→ FASE 4 NF → estoque ✓
→ FASE 5 SISCOFIS / Marco Zero ✓
→ FASE 6 Depósitos / localizações ✓
→ FASE 7 Estoque operável ✓
→ FASE 8 Saída / scanner ✓
→ FASE 9 Visão do Depósito ✓
→ FASE 10 Inventário ✓
→ CORE PROTECTION EMPROVEX ✓ obrigatório antes da FASE 11
→ FASE 11 Entregas / dashboard / alertas
→ FASE 11.5 Consolidação Visual / UX
→ FASE 12 Segurança / performance / telemetria
→ FASE 13 Validação integrada / fechamento
→ FASE 14 Expansão externa
```

## Regras permanentes de execução

- uma capacidade vertical por chat/branch como padrão;
- uma branch e um PR por fase, salvo motivo técnico documentado;
- fases grandes podem ser divididas em commits/subtarefas internas sem criar microfases artificiais;
- nenhuma fase seguinte começa antes do fechamento da anterior;
- todo chat novo consulta GitHub e os documentos oficiais antes de alterar código;
- mudanças paralelas na `main` devem ser comparadas com o baseline registrado em `STATUS.md`;
- qualquer desvio do roadmap deve ser documentado;
- integrações essenciais devem acontecer dentro da própria fatia vertical;
- usuários externos permanecem protegidos durante todo o piloto fundador;
- Cloud Shell deve ser usado de forma consolidada sempre que a intervenção externa não for bloqueante;
- conforme D-057, não executar baterias de teste/CI a cada incremento restante das FASES 11.5–12;
- preservar todos os testes/guards existentes e concentrar sua execução na estabilização/FASE 13;
- usar PowerShell local do fundador quando uma intervenção prática for necessária, preferencialmente de forma consolidada;
- reservar o GitHub CI como certificação final, após a campanha local consolidada.

## Replanejamento oficial — módulos de desenvolvimento após a reorganização funcional

Este plano substitui, para o trabalho ainda pendente do ADM Depósito, a interpretação de que as antigas abas independentes devem continuar evoluindo isoladamente.

A navegação alvo é: **Início · Cadastro de Itens · Meus Depósitos · Controle de Itens**.

### Módulo 1 — Motor de pendências das Notas Fiscais — CONCLUÍDO

Capacidade implementada:
- fila derivada das NFs e empenhos canônicos em modo somente leitura;
- identidade determinística por `workspaceId + invoiceRecordKey + itemId`;
- novo contrato `warehouse_item_intake_v2` no path `warehouse/{workspaceId}/intakes/{intakeId}`;
- distinção explícita entre quantidade recebida, alocada, consumo imediato e pendente;
- fórmula invariável `pendente = recebido - alocado - consumo imediato`;
- estados persistidos `PENDING`, `PARTIALLY_PROCESSED` e `PROCESSED`;
- suporte contratual a processamento parcial e progresso monotônico;
- estado inicial pendente derivado sem escrita automática: ausência de documento warehouse não altera a NF e não cria duplicação por refresh;
- compatibilidade somente leitura com `warehouse_item_intake_v1` e com projeções legadas de NF;
- `RECONCILIATION_REQUIRED` efetivo quando a quantidade canônica mudou, a fonte canônica deixou de existir de forma confirmável ou há projeção legada sem estado compatível;
- cutoff existente preservado, sem retrointegração histórica automática;
- consulta dedicada e bounded: até 250 empenhos, 300 NFs, 500 estados e 250 movimentos recentes para detecção de legado;
- Rules explícitas, founder-only no piloto, sem delete físico e sem wildcard novo;
- nenhuma escrita em NF, Empenho ou Cronograma e nenhuma nova autoridade de saldo.

Limites deliberados:
- **Alocar no depósito** não executa operação física neste módulo; a ação real pertence ao Módulo 2;
- lote, validade, barcode, scanner e confirmação física continuam para os módulos seguintes;
- **Consumo imediato** ainda não classifica quantidade nem conclui SISCOFIS; o fluxo operacional pertence ao Módulo 4;
- `warehouse_balance_v1`, `warehouse_location_balance_v1` e `warehouse_movement_v1` permanecem as autoridades de estoque/distribuição/auditoria.

Validação:
- nenhuma suíte, Browser E2E, Application CI ou PR foi executado neste fechamento, conforme D-057 e a regra modular vigente;
- a execução consolidada permanece reservada ao Módulo 14.

### Módulo 2 — Alocação física do item recebido — CONCLUÍDO

Capacidade implementada:
- ação **Alocar no depósito** operacional dentro de **Cadastro de Itens → Notas Fiscais pendentes**;
- quantidade parcial por confirmação, limitada por `0 < quantidade <= pendingQuantity`;
- seleção somente de depósito/localização/subposição ativos do mesmo workspace/UG;
- material canônico resolvido pela vinculação existente ou pelo mecanismo oficial de derivação;
- entrada quantitativa única e idempotente por intake quando não existe projeção anterior;
- bloqueio por reconciliação quando movimento de NF anterior já representa o mesmo item;
- alocação física por `TRANSFER` de `UNASSIGNED` para a posição selecionada;
- `warehouse_balance_v1` permanece com a mesma quantidade total e recebe apenas a revisão do movimento;
- `warehouse_location_balance_v1` reduz origem e aumenta destino;
- `warehouse_item_intake_v2.allocatedQuantity` avança somente após a operação física confirmada;
- `pendingQuantity` e status são recalculados no mesmo commit da transferência;
- concorrência controlada pela releitura transacional das quantidades observadas;
- idempotência forte por `operationId` preservado durante refresh/retry;
- falha após a entrada inicial deixa a quantidade em `UNASSIGNED` e não avança o intake.

### Módulo 3 — Lote, validade e código de barras no recebimento — CONCLUÍDO

Capacidade implementada na mesma jornada do Módulo 2:
- lote integrado à confirmação da alocação, sem segunda tela concorrente;
- `warehouse_lot_v1` reutilizado como atribuição logística e nunca como saldo;
- mesma NF/item pode ser dividida em múltiplas operações, lotes e posições;
- parcelas do mesmo lote na mesma posição incrementam a atribuição determinística existente;
- validade aceita data ISO real ou escolha humana explícita **Sem validade**;
- nenhuma validade é inferida automaticamente;
- barcode opcional reutilizando `warehouse_barcode_v1`;
- código conhecido é validado contra material/apresentação e conflito com outro material é bloqueado;
- código desconhecido pode ser associado somente ao material canônico já resolvido;
- digitação manual e scanner USB HID/teclado usam o mesmo campo, com ENTER para captura;
- lote, barcode, transferência e avanço do intake são confirmados dentro da mesma transação de alocação;
- depósitos/localizações são carregados sob demanda, somente ao abrir a jornada;
- Firestore Rules existentes foram suficientes e não foram enfraquecidas;
- Core Protection preservada: NF, Empenho e Cronograma continuam apenas como fontes canônicas de leitura para esta jornada.

Validação dos Módulos 2 e 3:
- inspeção estática confirmou que o diff funcional permanece em `features/warehouse/**` e `lib/warehouse/**`;
- nenhum serviço crítico de cadastro/edição/exclusão de NF foi alterado;
- nenhuma suíte completa, Browser E2E, Application CI, PR, merge ou deploy foi executado, conforme D-057;
- campanha consolidada permanece reservada ao Módulo 14.

### Módulo 3.5 — Saída de Material e relatórios operacionais — CONCLUÍDO

Capacidade implementada em **Controle de Itens → Saída de Material**:
- antiga Saída Expressa absorvida como wrapper de compatibilidade, sem segundo motor de baixa;
- checkout orientado a teclado/leitor HID: barcode ENTER → quantidade ENTER/TAB → próxima leitura;
- carrinho sem baixa imediata, com revisão, edição e remoção antes da tentativa de finalização;
- limite bounded de 40 linhas por retirada;
- destino obrigatório por catálogo compartilhado, cadastrável e inativável;
- `Retirado por` obrigatório e separado do operador autenticado;
- baixa somente na finalização por `OUTBOUND` oficial;
- posição, lotes, conversão de apresentação, barcode e recomendação FEFO reutilizados dos contratos existentes;
- identidade estável por retirada e linha;
- fingerprint SHA-256 do carrinho para rejeitar replay divergente;
- progresso `FINALIZING | PARTIALLY_APPLIED | FINALIZED` para recuperação segura quando alguma linha falha;
- nenhuma retirada parcialmente aplicada é apresentada como sucesso completo;
- relatório principal com presets Diário, Semanal, Quinzenal, Mensal e período personalizado;
- filtros por origem, destino e retirante;
- consolidação por material, destino, retirante e dia;
- copiar, imprimir e CSV sem biblioteca pesada;
- compatibilidade bounded com `EXPRESS_OUTBOUND` legado sem dupla projeção.

Novos contratos:
- `warehouse_destination_v1`;
- `warehouse_material_withdrawal_v1`;
- `warehouse_consumption_record_v1`.

Paths:
- `warehouse/{workspaceId}/destinations/{destinationId}`;
- `warehouse/{workspaceId}/withdrawals/{withdrawalId}`;
- `warehouse/{workspaceId}/consumptions/{consumptionId}`.

### Módulo 4 — Consumo imediato e fila/relatórios SISCOFIS — CONCLUÍDO

Capacidade implementada:
- botão **Consumo imediato** operacional em **Cadastro de Itens → Notas Fiscais pendentes**;
- quantidade parcial limitada a `0 < quantidade <= pendingQuantity`;
- destino reutiliza exatamente o catálogo do Módulo 3.5;
- recebedor/retirante obrigatório;
- `warehouse_item_intake_v2.immediateConsumptionQuantity` avança monotonicamente;
- `pendingQuantity` e status são recalculados no mesmo commit da classificação;
- como D-064 materializa a quantidade recebida em `UNASSIGNED`, a parcela de consumo imediato é retirada desse saldo pelo `OUTBOUND` oficial na mesma transação que avança o intake;
- nenhum depósito, localização física, lote ou transferência é criado para consumo imediato;
- a mesma parcela não recebe segunda saída posterior;
- operação usa identidade `adm-intake-v2:<intakeId>:immediate:<operationId>`;
- concorrência compara as quantidades observadas pela tela antes de escrever;
- projeção operacional entra no mesmo `warehouse_consumption_record_v1` usado pela saída normal;
- relatório principal de Saída de Material distingue **Saída de estoque** e **Consumo imediato** e também consolida ambos;
- estados locais SISCOFIS: `PENDING | PREPARED | POSTED`;
- nenhuma integração automática externa foi criada;
- histórico de consumo imediato v1 permanece preservado na superfície **Histórico legado / SISCOFIS**.

Validação dos Módulos 3.5 e 4:
- inspeção estática confirmou isolamento funcional em `features/warehouse/**`, `lib/warehouse/**` e Rules dedicadas;
- nenhuma escrita foi adicionada em NF, Empenho ou Cronograma;
- nenhum wildcard permissivo foi criado;
- nenhum CI completo, Browser E2E completo, PR, merge ou deploy foi executado, conforme D-057;
- campanha consolidada permanece reservada ao Módulo 14.

### Módulo 5 — Migração inicial do SISCOFIS

Objetivo:
- consolidar na subaba de Cadastro de Itens os dois métodos:
  - entrada manual;
  - JSON por prompt com IA externa;
- fazer ambos convergirem para o contrato SISCOFIS versionado;
- manter validação, prévia e confirmação humana;
- preservar Marco Zero e snapshots conforme decisões anteriores.


### Módulo 5 — Migração inicial do SISCOFIS — CONCLUÍDO

Capacidade consolidada sobre o motor histórico da FASE 5:
- superfície permanece em **Cadastro de Itens → Migração SISCOFIS**;
- entrada manual e JSON externo usam o mesmo contrato `emprovex_siscofis_inventory_v1`;
- somente `numeroItem`, `descricao`, `quantidade` e `valorUnitario` vêm da extração;
- UG vem do contexto autenticado e data-base é informada pelo operador;
- valor total é calculado deterministicamente;
- Nº Ficha é preservado por linha, inclusive quando repetido, sem virar `materialId` nem chave de consolidação;
- IA permanece externa, sem catálogo/materialId/workspace/estruturas internas;
- prévia permite correção humana dos quatro campos e exige revalidação antes da confirmação;
- correspondência canônica segura reutiliza unidade do material existente; material novo reutiliza o fallback explícito do fluxo de NF (`other / Apresentação não informada`) sem inventar unidade concreta;
- Marco Zero continua usando `INITIAL_BALANCE` no ledger e a projeção física oficial em `UNASSIGNED`;
- snapshots posteriores somente conciliam e não alteram saldo;
- novos snapshots usam `warehouse_siscofis_snapshot_v2`, mantendo leitura histórica de v1;
- sem avanço para o Módulo 6.

Gate: manual/JSON → validação → prévia editável → confirmação humana → motor oficial de Marco Zero/snapshot, sem escrita direta de saldo.

### Módulo 6 — Meus Depósitos multi-depósito — CONCLUÍDO

Capacidade consolidada:
- 1..N depósitos continuam usando exclusivamente `warehouse_depot_v1`;
- criação, edição e inativação reutilizam o repository e as invariantes históricas da FASE 6;
- código lógico, workspace, UG, IDs e metadados de criação permanecem imutáveis;
- localizações/subposições continuam em `warehouse_location_v1`, vinculadas ao `depotId` correto;
- `UNASSIGNED` permanece posição logística de material não alocado e nunca vira depósito fictício;
- a seleção de depósito em **Meus Depósitos → Croquis** carrega layout ativo e histórico de forma explicitamente scoped por `depotId`;
- histórico de um depósito não depende mais de uma listagem global limitada de layouts;
- salvar uma versão arquiva a versão ativa anterior somente do mesmo depósito;
- depósito sem croqui apresenta estado vazio próprio e não recebe layout fictício;
- nenhuma coleção, saldo ou fonte de verdade paralela foi criada;
- Firestore Rules existentes foram suficientes e permaneceram inalteradas.

### Módulo 7 — Biblioteca de estruturas físicas — CONCLUÍDO

Capacidade consolidada:
- catálogo central estático `WAREHOUSE_STRUCTURE_LIBRARY`, sem coleção Firestore de tipos;
- biblioteca contempla Estante, Rack, Armário, Freezer, Geladeira, Câmara, Palete, Área de Paletes, Bancada, Corredor, Área Livre e Outra estrutura;
- cada definição possui tipo legado compatível, categoria, dimensões/proporções iniciais, rotação inicial, variante visual e indicação de níveis/subposições;
- instâncias usadas continuam persistidas exclusivamente como `objects` de `warehouse_depot_layout_v1`;
- Área de Paletes e Área Livre reutilizam o `kind = AREA` existente em vez de criar schema concorrente;
- tipos legados válidos como WALL/ZONE continuam editáveis e históricos antigos permanecem compatíveis;
- objetos visuais podem continuar referenciando `warehouseLocationId`, mas não representam material, saldo ou movimento;
- biblioteca integrada ao editor atual apenas como seleção de estruturas; drag avançado, resize por handles, grid/snap, zoom/pan e demais capacidades permanecem para o Módulo 8;
- teste contratual do layout foi preparado para cobrir o catálogo na campanha consolidada do Módulo 14;
- nenhuma Firestore Rule foi alterada.

Próximo módulo oficial: **Módulo 8 — Editor visual do croqui**.

### Módulo 8 — Editor visual do croqui

Objetivo:
- converter o editor técnico atual em experiência visual de composição;
- arrastar, redimensionar, girar, duplicar, excluir, renomear e vincular;
- usar grid/snap, zoom, vista superior, perspectiva isométrica e rotação;
- permanecer leve, 2D/2.5D e sem engine 3D pesada.

### Módulo 9 — Integração croqui ↔ estoque — CONCLUÍDO

Capacidade entregue:
- material canônico relacionado a posições reais por saldo de localização;
- destaque simultâneo de uma ou várias posições;
- isolamento estrito pelo depósito selecionado;
- `warehouseLocationId` preservado como ponte visual;
- local/subposição tratados sem inventar níveis;
- FEFO consultivo reutilizando o motor oficial;
- localização com saldo sem objeto visual continua informada;
- estrutura sem vínculo lógico continua visual;
- nenhuma ação no croqui movimenta estoque.

### Módulo 10 — Finalização da aba Início — CONCLUÍDO

Capacidade entregue:
- seletor de depósito;
- leitura sob demanda somente do layout ativo;
- pesquisa central de material;
- saldo total e saldo no depósito;
- localizações, lotes, validade e FEFO;
- consulta 2.5D / vista superior;
- inspeção da estrutura clicada;
- estado profissional para depósito sem croqui e item sem saldo;
- nenhuma edição de geometria na Início;
- editor preservado em Meus Depósitos / Croquis.

### Módulo 11 — Consolidação do Controle de Itens

Objetivo:
- finalizar a absorção das antigas superfícies operacionais;
- disponibilizar subabas para estoque, saída, movimentações, inventário, entregas, alertas, SISCOFIS operacional e configurações;
- evitar duplicação de componentes ou domínios.

### Módulo 12 — Relatórios logísticos

Objetivo:
- disponibilizar relatórios derivados, no mínimo:
  - estoque atual;
  - itens por depósito/localização;
  - itens sem localização;
  - próximos do vencimento;
  - vencidos;
  - lotes;
  - consumo imediato;
  - pendências SISCOFIS;
  - entradas por NF;
  - saídas;
  - movimentações;
  - inventário;
- sempre derivados das fontes oficiais existentes.

### Módulo 13 — Segurança, Firestore, performance e telemetria

Objetivo:
- revisar Rules, índices, bounded queries, idempotência, concorrência, atomicidade, isolamento `warehouse`, multi-tenant e tratamento de erros;
- resolver bloqueios de permissão observados no piloto fundador;
- preservar Core Protection e independência operacional do EMPROVEX.

### Módulo 14 — Campanha final de validação e fechamento

Executar de forma consolidada:
- Core Protection;
- TypeScript;
- build;
- guards permanentes do ADM;
- testes de domínio;
- Firestore Emulator;
- multi-tenant/security;
- walking skeleton;
- Browser E2E;
- regressão EMPROVEX;
- regressão ADM Depósito;
- correções finais;
- PR;
- Application CI;
- merge e deploy quando aprovados.

### Ordem oficial

`M1 → M2 → M3 → M3.5 → M4 → M5 → M6 → M7 → M8 → M9 → M10 → M11 → M12 → M13 → M14`

### Regras de execução

- desenvolver sobre a branch oficial da FASE 11.5 enquanto a consolidação funcional/visual permanecer em andamento;
- não reabrir as antigas abas como áreas primárias;
- não reimplementar contratos já existentes;
- NF/Empenho/Cronograma permanecem fontes canônicas somente de leitura para o ADM;
- escritas logísticas permanecem no namespace `warehouse`;
- a execução de testes completos e CI continua diferida para o Módulo 14 conforme D-057;
- testes dirigidos durante os Módulos 1–13 somente quando indispensáveis para diagnosticar falha concreta.

### Módulo 8 — Editor visual do croqui — CONCLUÍDO

Capacidade entregue:
- composição em planta superior 2D sobre `warehouse_depot_layout_v1`;
- inserção a partir de `WAREHOUSE_STRUCTURE_LIBRARY`;
- drag, resize por alça, rotação controlada e controle numérico legado;
- duplicação com novo ID e deslocamento;
- exclusão somente do objeto visual;
- renomeação e vínculo a `warehouseLocationId` preservados;
- grade e snap opcionais;
- zoom e pan;
- indicação clara de seleção;
- bring-to-front/send-to-back usando `layer`;
- atalhos Delete, Ctrl/Cmd+C, Ctrl/Cmd+V, Ctrl/Cmd+D, Ctrl/Cmd+Z e redo;
- undo/redo local sem writes por interação;
- alternância Vista superior / Prévia 2.5D usando os mesmos dados;
- persistência somente em Salvar versão, preservando histórico e um ativo por depósito;
- nenhuma coleção paralela, nenhum motor 3D e nenhuma mudança de saldo/movimento.

Decisão técnica: manter editor React/canvas DOM leve existente em vez de adicionar Fabric.js/Konva. Ver D-068.

Próximo módulo oficial: **Módulo 11 — Consolidação do Controle de Itens**.


## CONSOLIDAÇÃO 11.5 — MÓDULOS 11 E 12 — CONCLUÍDOS

Data de fechamento: 2026-09-25.

### Módulo 11 — Consolidação do Controle de Itens — CONCLUÍDO
Objetivo atingido: transformar **Controle de Itens** na superfície operacional consolidada do material sem reimplementar domínios existentes.

Arquitetura final:
- Resumo logístico;
- Estoque;
- Saída de Material;
- Movimentações;
- Inventário;
- Entregas;
- Alertas;
- SISCOFIS;
- Relatórios;
- Configurações relacionadas ao item.

Regras preservadas:
- Cadastro de Itens continua responsável por cadastro/intake/migração inicial;
- Meus Depósitos continua responsável pela estrutura física/croquis;
- Início continua responsável pela consulta visual;
- ledger, saldos, lotes, inventários, retiradas, consumos e SISCOFIS continuam nas fontes oficiais existentes;
- rotas legadas permanecem como redirect ou reutilização do mesmo componente;
- nenhuma Firestore Rule foi alterada.

### Módulo 12 — Relatórios Logísticos — CONCLUÍDO
Camada oficial implementada como leitura derivada e bounded:
- estoque atual;
- estoque por depósito/localização;
- itens sem localização;
- lotes ativos, próximos do vencimento e vencidos;
- consumo imediato;
- saídas de material;
- movimentações;
- entradas por NF;
- inventários;
- pendências e histórico SISCOFIS;
- consumo por período/destino/responsável conforme dados existentes.

Estratégia:
- somente a subaba de relatório aberta é montada;
- componentes operacionais oficiais são reutilizados quando já fornecem a consulta necessária;
- movimentações/entradas por NF leem no máximo 250 movimentos por abertura;
- materiais são carregados em lote e indexados em memória;
- filtros de período/tipo/material/origem são aplicados sem N+1;
- CSV é oferecido onde já é simples e leve;
- nenhuma coleção `warehouse_report_*` ou cache paralelo foi criada;
- nenhum saldo é recalculado via ledger.

### Gate de continuidade
- Módulo 11: **CONCLUÍDO**;
- Módulo 12: **CONCLUÍDO**;
- Módulo 13: **NÃO INICIADO**;
- próximo módulo oficial: **Módulo 13 — Segurança, Firestore, performance e telemetria**;
- campanha consolidada de CI/E2E continua reservada ao Módulo 14 pela D-057.


## CONSOLIDAÇÃO 11.5 — MÓDULO 13 — CONCLUÍDO

Data de fechamento: 2026-09-25.

O Módulo 13 executou hardening da implementação existente, sem reabrir os Módulos 1–12.

Entregue:
- auditoria founder-only/multi-tenant e proteção de dados;
- material canônico protegido contra delete físico;
- confirmação de ledger append-only e saldos derivados;
- resiliência parcial do Dashboard/Alertas para fontes auxiliares;
- otimização em memória do Estoque com índices por material;
- remoção de releitura duplicada de materiais na abertura do Inventário;
- instrumentação leve das leituras bounded usando `workspaceUsageTelemetry`;
- guard permanente `verify:adm-deposito-phase-13`;
- cenário de segurança para impedir delete físico do material;
- auditoria de documentos grandes, consultas, listeners e índices;
- nenhum índice composto novo e nenhuma coleção/cache de relatório.

A campanha pesada de TypeScript/build/Firestore Emulator/Browser E2E/regressão/CI permanece deliberadamente no **Módulo 14**, conforme D-057.

### Gate de continuidade
- Módulo 13: **CONCLUÍDO**;
- Módulo 14: **NÃO INICIADO**;
- próximo trabalho oficial: **Módulo 14 — Campanha final de validação e fechamento**;
- este fechamento não autoriza expansão externa nem publicação por si só.


## PLANEJAMENTO OFICIAL DO MÓDULO 14 — AUDITADO EM 2026-09-25

O plano operacional detalhado da campanha final está registrado em:

`docs/adm-deposito/MODULE_14_FINAL_VALIDATION_PLAN.md`

Baseline do planejamento:
- branch: `feat/adm-deposito-phase-11-5-visual-ux`;
- HEAD: `2d8160db956296779bcf86c7040829776d4e20ef`;
- branch idêntica a essa baseline no momento da auditoria.

A campanha será executada em ordem de custo crescente:
1. congelamento da baseline e auditoria estática;
2. Core Protection/isolamento/guards;
3. testes de domínio ADM;
4. TypeScript;
5. Firestore Emulator + multitenancy/security;
6. walking skeleton integrado;
7. build;
8. Browser E2E específico do ADM;
9. regressão EMPROVEX + ADM;
10. correções consolidadas e reexecução seletiva;
11. regressão final completa;
12. PR + Application CI como certificação final.

Achados preparatórios:
- o Browser E2E atual não oferece cobertura identificável das novas jornadas ADM; o Módulo 14 deverá complementar essa cobertura;
- `verify:adm-deposito-phase-11-5` existe no projeto e deverá ser executado localmente; sua inclusão no CI final deve ser avaliada durante a campanha.

PowerShell local do fundador permanece o ambiente preferencial para a campanha pesada. Cloud Shell fica reservado a necessidade remota real. Módulo 14 continua **NÃO INICIADO** até a execução prática.


## PRIORIDADE PÓS-ADM — DEFINIDA EM 2026-09-25

A sequência oficial após a auditoria preventiva de segurança passa a ser:

1. **concluir o ADM Depósito**, incluindo o fechamento do Módulo 14;
2. **executar uma bateria dedicada de testes, uso real e melhorias do ADM Depósito**;
3. **executar o hardening transversal de segurança de dados da plataforma**.

Documento detalhado:
`docs/adm-deposito/POST_ADM_STABILIZATION_AND_SECURITY_PLAN.md`

Motivação operacional:
- existe apenas um usuário externo no cenário atual;
- a prioridade imediata é concluir e estabilizar o ADM;
- a auditoria preventiva não identificou evidência de vazamento ativo, permitindo tratar os hardenings preventivos em uma etapa própria;
- vulnerabilidade crítica/ativamente explorável continua sendo exceção bloqueante e deve ser corrigida imediatamente, independentemente da etapa corrente.

O Módulo 14 continua válido e não é substituído por essa decisão.

## Atualização de execução do Módulo 14 — 2026-09-25

A campanha foi iniciada apenas nas duas primeiras subetapas:
- **14.0 — Congelamento da baseline: CONCLUÍDO**;
- **14.1 — Auditoria estática final: CONCLUÍDO**;
- **14.2+ — NÃO INICIADOS**.

Baseline congelada:
`88dff395649f7700f2c9c080ba9d7de0acf13ae9`.

Relatório:
`docs/adm-deposito/MODULE_14_STATIC_AUDIT.md`.

Gate: auditoria estática sem bloqueio crítico confirmado; autorizado seguir para 14.2 quando PowerShell estiver disponível. A autorização não substitui os gates dinâmicos posteriores.

## PÓS-PUBLICAÇÃO — PILOTO FOUNDER-ONLY E EXPANSÃO GRANULAR

Após o fechamento técnico do Módulo 14:

1. publicar o ADM Depósito mantendo acesso exclusivo da conta fundadora;
2. realizar testes em produção na Vercel e ajustes de estabilidade/UX;
3. preservar usuários externos sem acesso durante essa etapa;
4. em etapa posterior, implementar no Admin um controle individual `ADM Depósito habilitado`;
5. manter esse controle desativado por padrão para usuários externos;
6. exigir autorização tanto para exibição na navegação quanto para acesso direto às rotas;
7. revalidar Firestore Rules, multi-tenant, workspace/UG e Browser E2E antes de liberar qualquer usuário externo.

Referência arquitetural: **D-071** em `docs/adm-deposito/DECISIONS.md`.

A implementação desse controle granular é trabalho **pós-Módulo 14** e não deve ser misturada com a certificação founder-only atual.

## REPLANEJAMENTO OFICIAL — FASE 9 v2 — CROQUI OPERACIONAL

Data: 2026-09-25.

A Fase 9 originalmente marcada como concluída permanece válida quanto ao domínio, contratos e integração croqui ↔ estoque, porém sua **interface visual foi reaberta para refatoração estrutural** após falhas recorrentes de estabilidade no Browser E2E remoto.

Novo estado:
- Fase 9 domínio/contratos: **PRESERVADOS**;
- Fase 9 interface atual: **SUPERSEDIDA / EM SUBSTITUIÇÃO**;
- Fase 9 v2: **EM DESENVOLVIMENTO — 9.0 e 9.1 CONCLUÍDOS**;
- Módulo 14 certificação remota: **PAUSADA ATÉ A FASE 9 v2**.

### Sequência oficial

`9.0 → 9.1 → 9.2 → 9.3 → 9.4 → 9.5 → 9.6 → 9.7 → 9.8 → 9.9`

#### 9.0 — Auditoria e congelamento — CONCLUÍDO em 2026-09-25
Baseline inicial: `6642a3cbd37e17352a83bb330ad99cdbb0449381`.

Auditoria confirmou:
- `warehouse_depot_layout_v1`, versionamento, histórico e `warehouseLocationId`: **PRESERVAR**;
- `layoutRepository`, repositories de depósitos/localizações/materiais/lotes e FEFO consultivo: **PRESERVAR**;
- `WarehouseDepotLayoutEditor`: **REUTILIZAR COM ADAPTAÇÃO**;
- composição antiga de pesquisa + seletor + edição na mesma faixa: **SUBSTITUIR NA UI**;
- `warehouse_balance_v1`, `warehouse_location_balance_v1`, `warehouse_movement_v1`, Core, Rules e autoridade de estoque: **NÃO TOCAR**.

Acoplamento principal identificado: `selectedDepotId`, `queryText`, `selectedMaterialId` e o controle de modo eram coordenados dentro de `WarehouseDepotViewOperational`, com pesquisa e seletor compartilhando o mesmo cartão/flex dinâmico.

#### 9.1 — Nova estrutura de Croquis — CONCLUÍDO em 2026-09-25
Implementada a fundação estrutural do Croqui Operacional v2:
- `WarehouseDepotSelector` em região própria e estável;
- `WarehouseCroquiModeSwitch` com modos explícitos **Visualizar / Localizar** e **Editar Croqui**;
- `WarehouseCroquiViewMode` e `WarehouseCroquiEditMode` em containers independentes;
- `WarehouseCroquiMainRegion` para isolar a superfície principal;
- resultados de pesquisa mantidos com altura limitada e scroll interno, sem disputar a região do seletor;
- `min-w-0` aplicado nas regiões críticas para evitar overflow horizontal;
- sem posicionamento absoluto/fixed para controles operacionais;
- contratos e comportamento histórico preservados.

Guard estrutural preparado em `scripts/verify-adm-deposito-phase-9.mjs`.

Testes completos, Application CI e Browser E2E não foram executados, conforme D-073. Próximo módulo oficial: **9.2 — Visualizar / Localizar**.

#### 9.2 — Visualizar / Localizar
Criar pesquisa em painel próprio com resultados visualmente bounded e sem sobreposição com controles globais.

#### 9.3 — Destaque operacional
Reutilizar saldos por localização e FEFO para destacar posições reais sem qualquer mutação quantitativa.

#### 9.4 — Editor de Croqui v2
Concentrar geometria, estruturas, propriedades e vínculo com localizações em modo dedicado, sem pesquisa de materiais.

#### 9.5 — Persistência e versionamento
Preservar `warehouse_depot_layout_v1`, histórico, versão ativa e independência absoluta do estoque.

#### 9.6 — UX e estabilidade visual
Validar responsividade, Linux/Windows, ausência de overlaps, controles ocultos e carga visual excessiva.

#### 9.7 — Testes específicos
Separar Localização, Editor, Persistência, Integridade logística, Segurança e Geometria visual.

#### 9.8 — Integração/regressão ADM
Revalidar Fases 6–8 e 10, redirects, navegação e autoridades.

#### 9.9 — Fechamento/certificação
Atualizar documentação, executar regressão ampla e retomar Application CI final do Módulo 14.

### Política de execução
- sem CI global por submódulo durante 9.0–9.6;
- testes locais/direcionados primeiro;
- Browser E2E específico no 9.7;
- regressão ampla e Application CI apenas no fechamento 9.8/9.9.

Referência arquitetural: **D-073** em `docs/adm-deposito/DECISIONS.md`.
