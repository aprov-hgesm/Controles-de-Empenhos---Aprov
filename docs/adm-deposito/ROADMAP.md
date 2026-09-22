# ADM Depósito — Roadmap Oficial de Implementação

Este é o passo a passo oficial do módulo ADM Depósito / Área Logística do EMPROVEX.

Total planejado:
- 21 fases de desenvolvimento/validação do fundador: FASE 0 a FASE 20;
- 1 fase posterior de expansão externa: FASE 21;
- blocos DEP-0 a DEP-37;
- blocos EXT-1 a EXT-6.

## FASE 0 — Fundação e isolamento

### DEP-0 — Feature flag exclusiva da conta fundadora
- criar `warehouseModuleEnabled`;
- liberar inicialmente apenas para a conta fundadora;
- proteger sidebar, rotas, APIs e dados;
- acesso externo direto deve ser bloqueado.

### DEP-0.1 — Namespace próprio do módulo
Definir domínio separado para estoque, depósitos, localizações, movimentos, lotes, inventários e snapshots SISCOFIS.

Gate: usuário externo não vê nem acessa nenhuma funcionalidade logística.

## FASE 1 — Fundação do material

### DEP-1 — Modelo canônico de material
- identidade interna de material;
- descrição principal;
- aliases;
- unidade;
- status;
- workspace/UG.

### DEP-1.1 — Unidades e conversões
Suportar unidade, kg, g, L, mL, pacote, caixa, fardo e outras apresentações necessárias.

## FASE 2 — Ledger e saldos

### DEP-2 — Ledger de movimentações
Tipos iniciais:
- INITIAL_BALANCE;
- INVOICE_ENTRY;
- OUTBOUND;
- TRANSFER;
- INVENTORY_ADJUSTMENT;
- INVOICE_CORRECTION;
- REVERSAL.

### DEP-2.1 — Saldo agregado
Criar saldo materializado para leitura rápida sem perder o ledger auditável.

### DEP-2.2 — Idempotência
Evitar duplicação em NF→estoque e demais operações repetíveis.

## FASE 3 — Nota Fiscal → estoque

### DEP-3 — Entrada automática pela NF
NF cadastrada gera estoque imediatamente.

### DEP-3.1 — Ligação permanente NF ↔ estoque
Guardar `sourceType`, `sourceId` e `sourceItemId`.

### DEP-3.2 — Alterações de NF
Usar movimentos compensatórios.

### DEP-3.3 — Exclusão/estorno controlado
Nunca destruir histórico silenciosamente.

### DEP-4 — Data de ativação logística
Definir cutoff por workspace/UG para evitar duplicação de histórico.

## FASE 4 — SISCOFIS e Marco Zero

### DEP-5 — Prompt oficial SISCOFIS
EMPROVEX gera prompt; IA permanece externa.

### DEP-5.1 — Contrato JSON
Schema oficial versionado, sem Número de Ficha por padrão.

### DEP-5.2 — Importador JSON
Operador cola/importa retorno da IA externa.

### DEP-5.3 — Validador
Validar schema, unidades, quantidades, valores e possíveis duplicidades.

### DEP-6 — Pré-visualização
Mostrar resumo de válidos, inconsistências e possíveis duplicidades antes de confirmar.

### DEP-7 — Marco Zero
Criar saldo inicial com origem SISCOFIS_INITIAL_BALANCE e data-base.

### DEP-7.1 — Proteção contra duplicidade histórica
Conciliar cutoff e NFs existentes antes de confirmar o saldo inicial.

## FASE 5 — Depósitos e localizações

### DEP-8 — Múltiplos depósitos por UG
Permitir 1..N depósitos por workspace.

### DEP-8.1 — Cadastro simples
Nome, código, status e descrição opcional.

### DEP-9 — Localizações
Modelo mínimo Depósito → Local; subposição opcional.

### DEP-9.1 — Código lógico
Exemplos: DS-E04, DS-E04-N02, CF-P03.

### DEP-10 — Movimentação interna
Transferências alteram localização, não o total da OM.

## FASE 6 — Lotes, validade e FEFO

### DEP-11 — Estrutura de lotes
Permitir classificar posteriormente uma quantidade já existente em lotes.

### DEP-11.1 — Validade
Validade pertence ao lote.

### DEP-11.2 — Dados logísticos pendentes
Lote, validade e localização ausentes geram aviso, não bloqueio.

### DEP-12 — FEFO
Recomendar lote com vencimento mais próximo.

## FASE 7 — Código de barras

### DEP-13 — Catálogo de códigos
Um material pode possuir múltiplos códigos/apresentações.

### DEP-13.1 — Embalagens
Conversão por código de barras, por exemplo caixa→unidades.

### DEP-14 — Scanner
Suporte a leitores USB tipo teclado.

### DEP-14.1 — Scanner para lote/validade
Fluxo rápido de enriquecimento logístico.

### DEP-14.2 — Scanner de localização
Permitir scan do local + scan do produto + quantidade.

## FASE 8 — Tela Estoque

### DEP-15 — Consulta
Pesquisar por descrição, código, depósito, local, lote, validade, NF e fornecedor.

### DEP-15.1 — Ficha do material
Saldo, lotes, validades, depósitos, locais, origem e histórico.

### DEP-15.2 — Localizar no depósito
Ação que abre a Visão do Depósito focada nos locais do material.

## FASE 9 — Saída Expressa

### DEP-16 — Retirada simples
Fluxo mínimo por scan ou pesquisa.

### DEP-16.1 — FEFO sugerido
Pré-selecionar lote recomendado quando houver.

### DEP-16.2 — Proteção de saldo
Impedir retirada acidental acima do saldo.

### DEP-16.3 — Operação contínua
Evitar modais repetitivos em sequência de retiradas.

## FASE 10 — Visão do Depósito

### DEP-17 — Aba própria
Criar aba `Visão do Depósito` com identidade visual EMPROVEX.

### DEP-17.1 — Croqui 2D com perspectiva tridimensional
Implementação leve, sem motor 3D.

### DEP-17.2 — Objetos básicos
Estante, câmara, freezer, pallet, área, armário e porta.

### DEP-17.3 — Nenhum produto desenhado
Mapa exibe somente locais/estrutura.

### DEP-17.4 — Pesquisa destaca locais
Produto pesquisado retorna IDs; os locais correspondentes mudam de cor/estado visual.

### DEP-17.5 — Destaque de prioridade
FEFO pode definir destaque principal e secundário.

### DEP-17.6 — Clique no local
Mostrar apenas contexto estrutural simples; detalhes de estoque permanecem na tela Estoque.

## FASE 11 — Editor do depósito

### DEP-18 — Editor simplificado
Criar/mover objetos em um croqui operacional.

### DEP-18.1 — Criar objeto
Nome/código + tamanho visual simples + posição.

### DEP-18.2 — Sem medidas técnicas
Não exigir CAD ou dimensões arquitetônicas.

### DEP-18.3 — Ligação ao ID lógico
Objeto visual deve referenciar `warehouseLocationId`.

### DEP-18.4 — Movimento visual não move estoque
Alterar coordenadas do objeto não altera vínculo dos materiais.

## FASE 12 — Persistência e Drive

### DEP-19 — Layout ativo no Firestore
Guardar versão operacional pequena e rápida.

### DEP-19.1 — Layout JSON
Serialização versionada do croqui.

### DEP-19.2 — Sincronização com Drive
Guardar layout no Drive próprio da UG.

### DEP-19.3 — IDs estáveis do Drive
Persistir IDs, nunca depender do caminho textual.

### DEP-19.4 — Histórico de versões
Versionar alterações do layout.

### DEP-19.5 — Preview SVG
Opcional; visualização somente, não fonte da verdade.

## FASE 13 — Inventário

### DEP-20 — Inventário por depósito/local
Contagem total ou parcial.

### DEP-20.1 — Contagem física e divergência
Mostrar esperado vs contado.

### DEP-20.2 — Ajuste explícito
Gerar INVENTORY_ADJUSTMENT auditável.

### DEP-20.3 — Materiais sem localização
Fila específica para organização progressiva.

## FASE 14 — SISCOFIS contínuo

### DEP-21 — Snapshot
Novos relatórios após Marco Zero não somam estoque.

### DEP-21.1 — Mesmo fluxo de prompt externo
Prompt → IA externa → JSON → validação.

### DEP-21.2 — Conciliação
Comparar EMPROVEX vs SISCOFIS.

### DEP-21.3 — Nunca autocorrigir
Divergência exige decisão humana.

## FASE 15 — Entregas

### DEP-22 — Migração do Cronograma
Trazer Planejamento/Cronograma para a área logística reaproveitando os dados existentes.

### DEP-22.1 — Entrega → NF → estoque
Conectar expectativa de entrega ao recebimento via NF.

## FASE 16 — Dashboard logístico e alertas

### DEP-23 — Início Logístico
Indicadores acionáveis: sem localização, sem validade, vencimentos, baixo estoque, inventário, SISCOFIS e entregas.

### DEP-23.1 — Sem status de recebimento pendente
NF cadastrada já significa recebido.

### DEP-23.2 — Central de alertas existente
Integrar logística ao sistema de alertas atual.

## FASE 17 — Papel ADM Depósito

### DEP-24 — Role interna no piloto
Preparar papel com acesso somente ao necessário.

### DEP-24.1 — Sem funções financeiras
Não conceder billing, administração global ou funções financeiras desnecessárias.

## FASE 18 — Performance, telemetria e segurança

### DEP-25 — Estratégia de consultas
Consultas sob demanda e agregações.

### DEP-25.1 — Visão do Depósito econômica
Abrir mapa carrega layout; localização de produto só é consultada na pesquisa.

### DEP-25.2 — Listeners controlados
Sem listener por estante/local.

### DEP-25.3 — Métricas por UG
Reads, writes, movimentos, saídas, inventários, scans e sincronizações.

### DEP-25.4 — Métricas específicas do módulo
Painel administrativo para consumo logístico.

### DEP-26 — Isolamento por UG
Todas as entidades vinculadas a workspace/UG.

### DEP-26.1 — Drive por workspace
Usar Drive autorizado da própria UG.

### DEP-26.2 — Layout restrito
Croquis não são públicos.

### DEP-26.3 — Auditoria completa
Mapa, depósitos, locais, inventário, ajustes, importações, transferências e conciliações.

## FASE 19 — Testes do fundador

### DEP-27 — Teste funcional inicial
Fluxo ponta a ponta de depósito, Marco Zero, NF, estoque, pesquisa e destaque visual.

### DEP-28 — Teste de scanner
Códigos conhecidos/desconhecidos, embalagens, lote e localização.

### DEP-29 — Teste de NF
Salvar, repetir, editar, cancelar/excluir e corrigir após saída.

### DEP-30 — Teste da Visão do Depósito
Um local, vários, nenhum, múltiplos depósitos, FEFO, mapa vazio, 50+ objetos, mobile e desktop.

### DEP-31 — Teste de inventário
Saldo correto, menor, maior, localização errada e sem localização.

### DEP-32 — Testes SISCOFIS
JSON válido/inválido, unidade desconhecida, duplicidade, repetição e snapshot.

### DEP-33 — Teste de concorrência
Saídas simultâneas, inventário+saída, NF+retirada, transferência+retirada.

### DEP-34 — Teste de consumo
Comparar custo/consumo do EMPROVEX antes e depois do módulo.

## FASE 20 — Auditoria e fechamento do piloto fundador

### DEP-35 — Auditoria técnica
TypeScript, build, Firestore, Rules, índices, concorrência, segurança, Drive, isolamento e consumo.

### DEP-36 — Auditoria funcional
Medir se o módulo efetivamente reduz trabalho.

### DEP-37 — Gate final
Classificar o módulo como apto ou não apto para piloto externo.

Até DEP-37 aprovado, usuários externos continuam sem acesso.

## FASE 21 — Expansão externa futura

Esta fase só pode começar com autorização explícita após DEP-37.

### EXT-1 — Ativar role ADM Depósito
Permissões reais para usuários externos.

### EXT-2 — Feature flag por UG
Ativação individual por workspace.

### EXT-3 — Primeira OM piloto
Somente uma OM externa.

### EXT-4 — Validar depósito estruturalmente diferente
Garantir que o modelo não dependa do HGeSM.

### EXT-5 — Piloto ampliado
3 a 5 OMs.

### EXT-6 — Liberação geral/comercial
Habilitação controlada por UG.

## Ordem macro de execução

```
DEP-0
→ DEP-1
→ DEP-2
→ DEP-3/4
→ DEP-5/7
→ DEP-8/10
→ DEP-11/12
→ DEP-13/14
→ DEP-15
→ DEP-16
→ DEP-17
→ DEP-18
→ DEP-19
→ DEP-20
→ DEP-21
→ DEP-22
→ DEP-23
→ DEP-24
→ DEP-25/26
→ DEP-27/34
→ DEP-35/37
→ EXT-1/6
```

## Regras permanentes de execução

- uma fase por chat como padrão;
- uma branch e um PR por fase, salvo motivo técnico documentado;
- nenhuma fase seguinte começa antes do fechamento da anterior;
- todo chat novo consulta GitHub e estes documentos antes de alterar código;
- mudanças paralelas na `main` devem ser comparadas com o commit registrado em `STATUS.md`;
- qualquer desvio do roadmap deve ser documentado;
- usuários externos permanecem protegidos durante todo o piloto fundador.
