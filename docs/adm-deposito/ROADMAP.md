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
- integração à `main` depende apenas da certificação final do PR correspondente.

## FASE 11.5 — Consolidação Visual e UX do ADM Depósito

Objetivo: consolidar a identidade visual definitiva do módulo depois que suas principais capacidades operacionais estiverem implementadas e antes do hardening técnico final.

Escopo:
- criar e consolidar um design system próprio do ADM Depósito, coerente com a identidade geral do EMPROVEX;
- revisar hierarquia visual, navegação interna, sidebar, cabeçalhos, cards, tabelas, filtros, badges, estados, formulários e feedbacks;
- harmonizar Estoque, Saída Expressa, Localizações, Visão do Depósito, Inventário, Entregas, Dashboard, Alertas e demais superfícies do módulo;
- melhorar responsividade, densidade de informação, ergonomia e consistência;
- aplicar microinterações e acabamento visual com foco em aparência profissional, elegante e operacional;
- preservar legibilidade e eficiência acima de efeitos puramente decorativos;
- não alterar regras de negócio, ledger, saldos, contratos logísticos ou Firestore Rules, salvo ajuste estritamente necessário para suportar a interface.

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
- FASES 11, 11.5 e 12 podem avançar com gates rápidos de Core Protection/isolamento e testes direcionados ao domínio alterado;
- a regressão pesada completa é deliberadamente consolidada aqui, após a implementação funcional do ADM Depósito;
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
- durante FASES 11–12, manter Core Protection/isolamento e testes direcionados como gates rápidos obrigatórios;
- evitar regressão pesada completa após cada pequena alteração quando ela não acrescentar evidência nova;
- concentrar Browser E2E completo, suíte multi-tenant integral, build/regressão ampla e campanha integrada na estabilização/FASE 13;
- preferir a estação local EMPROVEX para feedback rápido e reservar o GitHub CI como certificação final.
