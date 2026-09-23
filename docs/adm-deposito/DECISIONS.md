# ADM Depósito — Decisões Arquiteturais Oficiais

Este documento registra decisões que devem ser tratadas como **congeladas** até que haja decisão explícita em contrário.

Última consolidação inicial: 2026-09-22.

## D-001 — Piloto exclusivo da conta fundadora

Toda a primeira implementação do módulo logístico será habilitada somente para a conta fundadora.

Usuários externos:
- não veem menu;
- não acessam rotas;
- não acessam APIs;
- não acessam dados do módulo;
- não recebem novas permissões logísticas.

A liberação externa só começa após o gate final do piloto fundador.

## D-002 — NF cadastrada significa material recebido

No EMPROVEX:

> Nota Fiscal cadastrada com sucesso = material já conferido, aceito e fisicamente disponível.

Não haverá uma segunda etapa de "confirmar recebimento" pelo ADM Depósito.

O cadastro da NF gera a entrada de estoque automaticamente.

## D-003 — Pendências logísticas não bloqueiam operação

Lote, validade e localização podem estar pendentes.

Essas pendências:
- geram alertas;
- podem ser enriquecidas posteriormente;
- não impedem o material de existir no estoque;
- não impedem saída normal, salvo regra específica de segurança de saldo.

## D-004 — Estoque é baseado em movimentos

O saldo operacional não será apenas um campo mutável.

Movimentos formam o histórico auditável. Ajustes, correções, transferências e reversões devem preservar o histórico.

Movimentos consolidados não são apagados silenciosamente.

## D-005 — Edição de NF após movimentação usa compensação

Alterações de NF já refletidas no estoque nunca devem sobrescrever silenciosamente o histórico.

Exemplo:
- entrada original: +100;
- correção: -10;
- saldo: 90.

## D-006 — SISCOFIS continua como referência oficial externa

O EMPROVEX será a camada operacional.

O SISCOFIS não será copiado integralmente nem substituído.

Após o Marco Zero:
- importações posteriores de SISCOFIS são snapshots de comparação;
- nunca somam estoque automaticamente;
- divergências são apresentadas para análise;
- não haverá autocorreção silenciosa.

## D-007 — Sem Número de Ficha SISCOFIS

O Número de Ficha e campos patrimoniais não fazem parte do núcleo da primeira versão.

Descrição, quantidade, unidade, valores e data-base são suficientes para o fluxo inicial.

## D-008 — IA externa, nunca embutida no fluxo inicial

O EMPROVEX não chamará uma IA para interpretar relatórios SISCOFIS.

Fluxo oficial:
1. EMPROVEX disponibiliza prompt padronizado;
2. operador usa uma IA externa;
3. IA retorna JSON;
4. operador cola/importa o JSON no EMPROVEX;
5. EMPROVEX valida;
6. operador confirma.

O mesmo padrão deve seguir a filosofia já usada em outros fluxos assistidos do sistema.

## D-009 — Contrato JSON versionado

Toda importação assistida terá schema versionado e validação rígida antes de persistir dados.

JSON inválido, campos ausentes ou unidades desconhecidas devem ser apresentados ao usuário antes da confirmação.

## D-010 — Múltiplos depósitos por UG

Uma OM/UG pode possuir 1..N depósitos.

Exemplos:
- gêneros secos;
- câmara fria;
- hortifrúti;
- descartáveis;
- bebidas;
- depósito secundário.

## D-011 — Localização lógica simples e flexível

Modelo mínimo:

> Depósito → Local

Quando necessário:

> Depósito → Local → Subposição

Não obrigar todas as OMs a usar a mesma profundidade de hierarquia.

## D-012 — Código de barras desde a primeira versão

Um material pode possuir múltiplos códigos de barras.

Códigos podem representar:
- unidade;
- pacote;
- caixa;
- outras apresentações.

Conversões de embalagem podem existir, por exemplo:

> 1 caixa = 12 unidades.

Leitores USB que se comportam como teclado devem funcionar no navegador sem serviço externo por leitura.

## D-013 — FEFO como recomendação

Quando houver validade, o EMPROVEX recomenda primeiro o lote com vencimento mais próximo.

FEFO não deve criar burocracia excessiva nem impedir exceções operacionais justificadas.

## D-014 — Saída Expressa é requisito crítico de adoção

Fluxo ideal:

> SCAN → quantidade → ENTER

ou:

> pesquisar → quantidade → confirmar.

Se a saída for lenta, o operador tenderá a contornar o sistema; portanto a experiência deve ser mínima.

## D-015 — Visão do Depósito não é 3D real

Não haverá motor 3D, modelos 3D ou planta arquitetônica detalhada.

A visualização será um **croqui 2D com perspectiva visual tridimensional/isométrica**, usando tecnologia web leve, como SVG/CSS e, se necessário, Canvas.

## D-016 — Visão do Depósito representa locais, não produtos

O mapa exibe apenas elementos estruturais e identificadores, por exemplo:
- E01;
- E02;
- Câmara 01;
- Freezer 01;
- Área de pallets;
- Porta.

Produtos, lotes, quantidades e validades não são desenhados na planta.

## D-017 — Pesquisa destaca os locais por mudança visual

Ao pesquisar um item:

> item → IDs de localização → destaque visual no croqui.

Os locais encontrados mudam de cor/estado visual.

O restante do mapa pode ser atenuado.

Se FEFO indicar uma localização preferencial:
- localização prioritária recebe destaque principal;
- demais locais recebem destaque secundário.

## D-018 — Localização lógica é independente da posição gráfica

Um item está associado ao ID lógico do local, por exemplo `E04`.

O objeto `E04` possui coordenadas visuais no layout.

Mover `E04` no editor não altera os vínculos de estoque com `E04`.

## D-019 — Editor de depósito é simplificado

O editor é um croqui operacional, não CAD.

Objetos iniciais:
- estante;
- câmara;
- freezer;
- pallet;
- área;
- armário;
- porta.

Não exigir medidas técnicas, altura, capacidade ou geometria arquitetônica.

## D-020 — Firestore mantém o layout operacional ativo

A versão ativa do layout deve estar disponível no Firestore para abertura rápida e independência operacional do Drive.

A Visão do Depósito não deve depender de baixar o arquivo do Drive a cada abertura.

## D-021 — Drive é persistência complementar do layout

O Google Drive da própria UG pode armazenar:
- `layout.json`;
- histórico de versões;
- opcionalmente `preview.svg`.

O Drive funciona como persistência/backup/versionamento complementar, não como banco operacional principal da tela.

Firestore deve guardar IDs estáveis do Drive quando aplicável, como:
- `driveFileId`;
- `driveFolderId`;
- `lastDriveSyncAt`.

Não depender de caminho textual como identificador.

## D-022 — Preview visual não é fonte da verdade

Se existir `preview.svg`, ele é somente representação visual.

A fonte estrutural do mapa é o JSON versionado.

## D-023 — Inventário nunca corrige silenciosamente

Contagem física mostra esperado vs contado.

Divergência gera ajuste explícito e auditável somente após confirmação.

## D-024 — Planejamento de Entregas migra conceitualmente para Logística

O cronograma atual deve ser reaproveitado, sem duplicar dados.

Transição visual pode manter compatibilidade temporária com a rota atual.

## D-025 — Alertas logísticos integram a central existente

Não criar um sistema paralelo de notificações.

Alertas de validade, localização, divergência, estoque e SISCOFIS entram na central atual do EMPROVEX.

## D-026 — Toda entidade é isolada por workspace/UG

Segurança multi-tenant deve existir em regras/backend, não apenas em filtros de interface.

Layouts de depósito e dados logísticos não são públicos.

## D-027 — Telemetria logística por UG

O novo módulo deverá permitir medir:
- leituras;
- gravações;
- movimentações;
- saídas;
- inventários;
- consultas de localização;
- scans;
- sincronizações Drive.

O objetivo é medir custo real por UG durante o piloto fundador antes da expansão comercial.

## D-028 — O sistema deve reduzir trabalho

Princípio central:

> O operador nunca deve redigitar informação que o EMPROVEX já conhece.

Critério de adoção:

> o sistema deve reduzir trabalho, não apenas digitalizar burocracia.


## D-029 — Identidade idempotente de movimentos

Todo movimento repetível do ADM Depósito deve possuir uma chave de idempotência estável.

O ID persistido do movimento é derivado deterministicamente do workspace e dessa chave.

Consequências:
- repetir a mesma operação não pode duplicar saldo;
- mesma chave com conteúdo divergente é conflito;
- consumidores futuros, especialmente NF → estoque, devem produzir chaves estáveis;
- idempotência pertence ao domínio do ledger, não apenas à interface.

## D-030 — Saldo materializado é projeção do ledger

O saldo rápido por material existe como projeção materializada do histórico de movimentos.

Regras:
- ledger continua sendo a trilha auditável;
- movimento e saldo correspondente são persistidos atomicamente;
- saldo não pode ser alterado isoladamente;
- revisão do saldo é monotônica;
- correções e reversões criam novos movimentos;
- nenhuma funcionalidade futura deve manter um segundo saldo concorrente fora deste contrato.

## D-031 — Desenvolvimento por Walking Skeleton e fatias verticais

Após a conclusão das FASES 0, 1 e 2, o desenvolvimento do ADM Depósito passa a seguir o modelo:

> Fundação concluída → Walking Skeleton → fatias verticais completas → integração progressiva → hardening.

Consequências:
- preservar FASES 0–2 como histórico concluído;
- criar primeiro a estrutura navegável e arquitetural completa do módulo;
- depois concluir uma capacidade funcional de cada vez;
- evitar separar artificialmente UI, domínio, persistência e testes em fases diferentes;
- requisitos DEP/EXT continuam válidos, apenas reagrupados;
- a mudança não autoriza antecipar funcionalidades de fases futuras.

## D-032 — Integração essencial pertence à própria fatia vertical

Uma capacidade não deve ser considerada concluída se sua integração essencial com o domínio existente foi adiada sem necessidade.

Quando aplicável, a mesma fase deve fechar:
- interface;
- regra de domínio;
- persistência;
- segurança/Rules;
- integração com capacidades anteriores;
- testes relevantes;
- documentação.

Exceções precisam estar explicitamente previstas no ROADMAP ou documentadas como decisão técnica.

## D-033 — NF vincula item de empenho ao material canônico por identidade estável

A fatia NF → Estoque não faz conciliação por descrição textual.

Regras permanentes:
- o item da Nota Fiscal reutiliza o `itemId` já ligado ao item do empenho;
- o item do empenho passa a guardar, quando resolvido, o `warehouseMaterialId` do contrato canônico da FASE 1;
- na primeira entrada de um item ainda sem vínculo, o material canônico pode ser criado de forma determinística a partir de `workspace + empenho + item`, sem criar um segundo modelo de material;
- NF, vínculo do item, movimento do ledger e saldo materializado são confirmados no mesmo ciclo transacional;
- NFs anteriores ao cutoff de ativação do workspace não são retrointegradas silenciosamente;
- edições e exclusões de NFs já integradas produzem movimentos compensatórios, preservando a origem anterior quando houver troca de identidade/empenho;
- o vínculo persistido por ID passa a ser a autoridade; descrição, fornecedor ou texto livre não substituem esse identificador.

Consequência: futuras rotinas de catálogo/conciliação podem unificar materiais conscientemente, mas não podem reintroduzir matching textual implícito no fluxo de recebimento.


## D-034 — CI proporcional ao impacto da mudança

O EMPROVEX adota como diretriz oficial a evolução de um CI monolítico para validação proporcional ao risco.

Regras:
- todo PR mantém validações essenciais de compilação, tipos e higiene;
- guards e testes de domínio devem ser selecionados conforme os arquivos/capacidades alterados;
- Browser E2E completo é obrigatório quando houver mudança em jornada funcional do usuário;
- alterações puramente visuais, documentais ou estáticas não devem, por regra, exigir regressão completa de navegador;
- smoke E2E pode cobrir PRs de baixo risco quando houver necessidade de confirmar navegador/interação básica;
- E2E completo permanece disponível para mudanças funcionais, integrações, releases, regressões e execuções periódicas;
- a redução de execução redundante não autoriza reduzir cobertura crítica.

Enquanto o workflow atual ainda executar a suíte completa em todo PR, suas regras continuam válidas. A próxima refatoração do CI deve implementar esta decisão.

Documento global: `docs/DEVELOPMENT_CI_WORKFLOW.md`.

## D-035 — Cloud Shell como ferramenta oficial de coexecução

O Cloud Shell deixa de ser tratado apenas como último recurso.

O operador/fundador pode atuar de forma presente e deliberada no desenvolvimento para:
- executar pré-validações rápidas;
- antecipar falhas de guards;
- testar hipóteses antes de novo push;
- executar builds/deploys quando isso for mais eficiente;
- fornecer evidência de ambiente que o agente não consegue obter diretamente.

Consequências:
- o agente deve preferir autonomia para tarefas que consegue executar;
- quando a participação manual trouxer ganho claro, deve fornecer comandos curtos, copiáveis e de baixo risco;
- clones de trabalho que precisem sobreviver a reciclagem de sessão devem preferir `~/...` a `/tmp`;
- testes leves e específicos devem vir antes de `npm ci`, build e E2E completos;
- a intervenção manual é parte normal da estratégia de aceleração e não uma exceção arquitetural;
- toda evidência manual deve ser tratada como pré-validação, sem mascarar falhas reais do CI.

Documento global: `docs/DEVELOPMENT_CI_WORKFLOW.md`.

## D-036 — SISCOFIS estabelece Marco Zero no ledger e depois opera somente por snapshots de conciliação

A FASE 5 consolida a transição entre a realidade externa do SISCOFIS e o estoque operacional do EMPROVEX sem criar segunda fonte de verdade.

Regras permanentes:
- o primeiro SISCOFIS confirmado, enquanto não existir Marco Zero confirmado, representa o Marco Zero;
- saldo inicial é registrado exclusivamente como movimento `INITIAL_BALANCE` no ledger da FASE 2;
- saldo materializado nunca é escrito diretamente;
- a importação possui hash determinístico e cada movimento inicial possui chave de idempotência estável;
- o Marco Zero é auditável, não pode ser substituído por outra fonte e pode retomar uma aplicação interrompida sem duplicar movimentos;
- o cutoff da integração NF → estoque é reutilizado; se ainda não existir, a confirmação do Marco Zero o estabelece no contrato oficial da FASE 4;
- quando já existem saldos posteriores ao cutoff, a data-base do Marco Zero deve anteceder o dia do cutoff;
- após o Marco Zero, todo novo relatório SISCOFIS é snapshot de comparação e não produz movimento de estoque;
- divergência nunca gera autocorreção;
- vínculo com material existente só é aceito por `materialId` canônico explícito e validado;
- o prompt oficial pode fornecer um catálogo bounded de IDs à IA externa, mas o EMPROVEX não reintroduz matching textual implícito;
- linha sem materialId no Marco Zero pode criar material canônico determinístico; linha sem materialId em snapshot posterior permanece não conciliada;
- Número de Ficha SISCOFIS não integra o contrato inicial.

Contratos:
- importação: `warehouse_siscofis_import_v1`;
- snapshot: `warehouse_siscofis_snapshot_v1`;
- documento permanente do Marco Zero: `warehouse/{workspaceId}/siscofisSnapshots/marco-zero`;
- snapshots posteriores: `warehouse/{workspaceId}/siscofisSnapshots/snapshot_<hash>`.

Documento técnico: `docs/adm-deposito/PHASE_5_SISCOFIS.md`.
