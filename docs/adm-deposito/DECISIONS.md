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

## D-002 — NF cadastrada significa material recebido, sem dependência do ADM Depósito

No EMPROVEX:

> Nota Fiscal cadastrada com sucesso = material já conferido, aceito e fisicamente disponível.

Não haverá uma segunda etapa de "confirmar recebimento" no fluxo principal.

Regra de isolamento:
- o cadastro, edição ou exclusão da NF pertence exclusivamente ao núcleo operacional do EMPROVEX;
- nenhuma dessas operações depende de leitura ou escrita no namespace `warehouse`;
- indisponibilidade, erro de permissão ou regressão do ADM Depósito nunca pode impedir a operação da NF;
- o ADM Depósito consome posteriormente os dados canônicos já confirmados pelo EMPROVEX e projeta a entrada/correção/reversão de forma idempotente em seu próprio namespace;
- eventual atraso da projeção logística gera pendência/reconciliação dentro do ADM, nunca rollback da operação já válida do EMPROVEX.

A decisão anterior de integrar NF e estoque no mesmo ciclo transacional está formalmente revogada.

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

## D-025 — Alertas logísticos pertencem ao namespace `warehouse`

Não criar dependência de escrita do ADM Depósito sobre a Central de Avisos operacional do EMPROVEX.

Regras:
- alertas de validade, localização, divergência, estoque, SISCOFIS e entregas são persistidos exclusivamente em `warehouse/{workspaceId}/alerts`;
- IDs são determinísticos por tipo + entidade e a reconciliação é idempotente;
- quando a causa desaparece, o alerta é resolvido no próprio namespace logístico, não apagado;
- uma superfície agregadora futura poderá ler alertas logísticos por uma camada neutra, mas o ADM não pode chamar `saveAlert` nem escrever em `workspaces/{workspaceId}/alerts`;
- falha na persistência de alertas do ADM é best-effort e nunca bloqueia Dashboard, NF, Empenho, Cronograma ou qualquer fluxo operacional do EMPROVEX.

Esta decisão substitui a redação anterior de integração por escrita na Central de Avisos e é subordinada à D-052/D-053.

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

## D-033 — ADM projeta NF e item de empenho por identidade estável, sem escrever no núcleo

A fatia NF → Estoque não faz conciliação por descrição textual e não participa da transação operacional da NF.

Regras permanentes:
- a Nota Fiscal e o empenho confirmados pelo EMPROVEX são fontes canônicas somente de leitura para o ADM Depósito;
- o item da NF reutiliza o `itemId` operacional já existente;
- vínculos `itemId ↔ materialId`, estado de projeção, idempotência e histórico logístico pertencem ao namespace `warehouse/{workspaceId}`;
- o ADM não grava `warehouseMaterialId`, `warehouseMovementIds` ou `warehouseIntegration` em documentos operacionais novos;
- campos logísticos legados já existentes em documentos antigos podem ser lidos apenas para compatibilidade/migração controlada, sem voltar a ser requisito do EMPROVEX;
- a primeira projeção pode criar material canônico determinístico a partir de `workspace + empenho + item`;
- NFs anteriores ao cutoff não são retrointegradas silenciosamente;
- edição ou exclusão da NF nunca é bloqueada pelo ADM; na sincronização seguinte, o módulo gera correção/reversão idempotente ou sinaliza reconciliação;
- descrição, fornecedor ou texto livre não substituem os identificadores estáveis.

Consequência: o fluxo é unidirecional — `EMPROVEX → dados canônicos → ADM Depósito → warehouse/*`.


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

## D-037 — Distribuição física é projeção derivada do ledger, com Sem localização para legado

A FASE 6 adiciona localização física sem criar nova fonte de verdade para quantidade.

Regras permanentes:
- `warehouse_balance_v1` continua sendo o saldo geral do material na OM;
- `warehouse_location_balance_v1` registra somente a distribuição física desse saldo;
- a projeção física é vinculada ao mesmo ledger e nunca substitui `warehouse_balance_v1`;
- um material pode existir em N localizações;
- saldo anterior à FASE 6 que ainda não possui posição física é representado como `UNASSIGNED` / “Sem localização”;
- esse estado pode ser derivado virtualmente do saldo agregado menos posições já materializadas;
- a primeira movimentação a partir de saldo legado materializa `UNASSIGNED` sem alterar o total;
- novos movimentos externos processados pelo serviço oficial do ledger projetam sua variação em `UNASSIGNED` até organização física;
- IDs de depósito/local/subposição sobrevivem a renomeações e códigos lógicos não são usados como chave técnica.

Contratos:
- `warehouse_depot_v1`;
- `warehouse_location_v1`;
- `warehouse_location_balance_v1`.

Documento técnico: `docs/adm-deposito/PHASE_6_LOCATIONS.md`.

## D-038 — Transferência interna reutiliza TRANSFER e é uma única operação atômica

A transferência física não altera o saldo total da OM.

Regras permanentes:
- reutilizar `warehouse_movement_v1.type = TRANSFER`;
- `quantityDelta` do saldo geral permanece `0`;
- todo novo TRANSFER operacional da FASE 6 possui origem estruturada `LOCATION_TRANSFER`;
- o movimento registra ator, quantidade, origem, destino e IDs das duas projeções físicas;
- origem e destino são atualizados na mesma transação que cria o movimento e avança a revisão do saldo agregado;
- saldo insuficiente, origem igual ao destino, posição inativa/inexistente e escopo divergente são rejeitados;
- o serviço genérico do ledger não executa TRANSFER: a operação deve passar pelo fluxo específico de localização;
- a identidade idempotente existente continua sendo a autoridade para retry;
- replay idêntico não movimenta novamente; replay divergente falha;
- Firestore Rules exigem coerência entre o movimento e as projeções físicas correspondentes.

Documento técnico: `docs/adm-deposito/PHASE_6_LOCATIONS.md`.

## D-039 — Lote é enriquecimento logístico e nunca saldo concorrente

A FASE 7 introduz o contrato `warehouse_lot_v1` sem alterar a autoridade quantitativa construída nas fases anteriores.

Regras permanentes:
- `warehouse_balance_v1` continua sendo o saldo agregado oficial;
- `warehouse_location_balance_v1` continua sendo a distribuição física oficial;
- `warehouse_lot_v1.quantity` é atribuição/rastreabilidade logística e não um terceiro saldo;
- criar, editar ou inativar lote não produz movimento de estoque;
- lote não pode escrever diretamente saldo agregado nem projeção física;
- inconsistências entre atribuição logística e saldo viram pendência, não autocorreção;
- identidade do lote referencia sempre `materialId` canônico, nunca descrição textual.

Documento técnico: `docs/adm-deposito/PHASE_7_STOCK_LOTS_FEFO.md`.

## D-040 — FEFO é recomendação derivada e não executa saída

A recomendação FEFO considera somente lotes ativos, com quantidade positiva, validade informada e não vencida.

Regras permanentes:
- priorizar a validade futura mais próxima;
- vencidos permanecem visíveis como situação separada;
- lotes sem validade não são escolhidos automaticamente pelo FEFO;
- FEFO não reduz saldo, não cria movimento e não bloqueia exceção operacional;
- a futura FASE 8 poderá consumir a recomendação sem substituir o ledger.

Documento técnico: `docs/adm-deposito/PHASE_7_STOCK_LOTS_FEFO.md`.

## D-041 — Ausência de lote/validade é pendência não bloqueante e o histórico é consultado sob demanda

Estoque legado ou material sem informação logística completa permanece operável.

Regras permanentes:
- ausência de lote e validade gera contexto/aviso quando aplicável, sem invalidar o saldo;
- posição `UNASSIGNED` continua válida conforme D-037;
- nenhum dado é inventado para eliminar aviso;
- vínculo documental de lote com NF é explícito e, quando presente, referencia movimento oficial;
- histórico da ficha do material é carregado por `materialId`, de forma bounded e sob demanda;
- a tela Estoque não carrega o ledger global para montar uma listagem simples.

Documento técnico: `docs/adm-deposito/PHASE_7_STOCK_LOTS_FEFO.md`.


## D-042 — Barcode é identificador auxiliar subordinado ao material e à conversão canônica

A FASE 8 introduz `warehouse_barcode_v1` sem alterar a identidade principal do estoque.

Regras permanentes:
- um material canônico pode possuir 0..N barcodes;
- barcode nunca substitui `materialId`;
- a apresentação de um barcode deve existir como unidade canônica ou conversão de `warehouse_material_v1`;
- `factorToBaseUnit` não cria nova autoridade de conversão: ele materializa a conversão canônica já existente;
- código desconhecido nunca cria material automaticamente;
- a associação crítica barcode → material/apresentação é imutável após criação; pode ser inativada;
- ID técnico é determinístico por workspace + código no repository;
- barcode não cria saldo ou ledger paralelo.

Documento técnico: `docs/adm-deposito/PHASE_8_BARCODE_SCANNER_EXPRESS_OUTBOUND.md`.

## D-043 — Saída expressa é OUTBOUND atômico, idempotente e não admite saldo negativo

A operação rápida da FASE 8 é uma especialização transacional do ledger oficial.

Regras permanentes:
- reutilizar `warehouse_movement_v1.type = OUTBOUND`;
- origem estruturada `EXPRESS_OUTBOUND` registra interface, ator, apresentação, fator, posição, barcode e lote quando aplicáveis;
- quantidade da apresentação é convertida para unidade oficial antes do movimento;
- movimento, `warehouse_balance_v1` e a `warehouse_location_balance_v1` escolhida avançam na mesma transação;
- saldo oficial insuficiente ou saldo insuficiente na posição aborta toda a operação;
- nenhuma saída produz quantidade agregada ou física negativa;
- retry usa a idempotência do ledger; replay idêntico não baixa duas vezes;
- lote escolhido explicitamente tem sua atribuição logística reduzida na mesma transação, sem se tornar saldo oficial.

Documento técnico: `docs/adm-deposito/PHASE_8_BARCODE_SCANNER_EXPRESS_OUTBOUND.md`.

## D-044 — Scanner HID compartilha o fluxo manual e FEFO continua exigindo ação humana

A interface operacional da FASE 8 não depende de integração proprietária de hardware.

Regras permanentes:
- leitores USB HID são tratados como teclado: código + ENTER;
- digitação manual utiliza o mesmo campo e o mesmo resolvedor;
- após operação bem-sucedida, o foco retorna ao scanner para permitir sequência contínua;
- pesquisa manual converge para o mesmo serviço transacional da leitura por barcode;
- FEFO é exibido como recomendação;
- usar o lote FEFO exige ação explícita do operador;
- ausência de lote/validade continua não bloqueante conforme D-041.

Documento técnico: `docs/adm-deposito/PHASE_8_BARCODE_SCANNER_EXPRESS_OUTBOUND.md`.

## D-045 — Consolidação visual do ADM Depósito ocorre na FASE 11.5 e é conduzida pelo fundador

A identidade visual definitiva do ADM Depósito será consolidada somente depois que as principais capacidades operacionais estiverem implementadas, em uma fase própria entre as FASES 11 e 12.

Regras permanentes:
- a FASE 11.5 é dedicada a design system, hierarquia visual, navegação, cards, tabelas, filtros, badges, formulários, estados, responsividade, microinterações, ergonomia e acabamento;
- a direção criativa será conduzida pessoalmente pelo fundador, de forma iterativa;
- cores, referências, intensidade de efeitos, composição e prioridades estéticas permanecem deliberadamente abertas até a execução da fase;
- o agente atua como executor técnico e guardião de consistência das decisões estéticas aprovadas pelo fundador;
- FASES 8 a 11 podem receber ajustes necessários de usabilidade e coerência, mas não devem antecipar a reformulação estética global;
- a FASE 11.5 não altera regras de negócio, ledger, saldos ou contratos logísticos, salvo suporte estritamente necessário à interface;
- a FASE 12 inicia sobre a interface visual consolidada para que segurança, performance e telemetria sejam avaliadas sobre a experiência definitiva.

Documento de planejamento: `docs/adm-deposito/ROADMAP.md`.


## D-046 — Layout visual é representação versionada, nunca fonte de estoque

A FASE 9 introduz `warehouse_depot_layout_v1` exclusivamente como representação da estrutura física.

Regras permanentes:
- o layout não persiste saldo, lote ou quantidade;
- objetos visuais referenciam localizações reais por `warehouseLocationId`;
- mover, redimensionar, renomear ou remover um objeto visual não movimenta estoque;
- `warehouse_balance_v1`, `warehouse_location_balance_v1` e `warehouse_movement_v1` permanecem autoridades quantitativa, física e auditável;
- cada salvamento relevante cria nova versão ativa e arquiva a anterior, sem sobrescrever silenciosamente o histórico;
- uma versão arquivada pode servir de base para uma nova versão ativa, preservando auditoria;
- versões não são excluídas fisicamente no piloto.

Documento técnico: `docs/adm-deposito/PHASE_9_DEPOT_VIEW_LAYOUT.md`.

## D-047 — Firestore é estado operacional do croqui; Drive permanece complementar e não bloqueante

O estado operacional ativo da Visão do Depósito é mantido no Firestore.

Regras permanentes:
- Firestore é a fonte operacional da configuração do croqui;
- JSON e SVG são artefatos derivados/exportáveis, nunca autoridade;
- o Drive da UG não substitui o Firestore;
- sincronização Drive deve reutilizar a autorização temporária existente e nunca introduzir dependência capaz de encerrar a sessão EMPROVEX;
- enquanto o runtime Drive não estiver autorizado, a Visão do Depósito continua plenamente utilizável pelo Firestore;
- IDs estáveis do layout/versionamento devem ser preservados em qualquer futura cópia complementar no Drive.

Documento técnico: `docs/adm-deposito/PHASE_9_DEPOT_VIEW_LAYOUT.md`.

## D-048 — Destaque visual usa posições reais e FEFO permanece consultivo

A busca da Visão do Depósito deriva seus destaques das fontes logísticas existentes.

Regras permanentes:
- material selecionado é identificado pelo `materialId` canônico;
- posições são obtidas de `warehouse_location_balance_v1`;
- todas as posições positivas aplicáveis podem ser destacadas simultaneamente;
- a recomendação FEFO pode sinalizar visualmente uma posição prioritária;
- FEFO nunca executa saída, altera saldo ou seleciona lote silenciosamente;
- ausência de objeto visual vinculado não altera nem invalida a localização logística real.

Documento técnico: `docs/adm-deposito/PHASE_9_DEPOT_VIEW_LAYOUT.md`.


## D-049 — Inventário é sessão auditável; snapshot esperado nunca se torna saldo

A FASE 10 introduz warehouse_inventory_v1 e warehouse_inventory_item_v1 sem criar uma quarta autoridade quantitativa.

Regras permanentes:
- esperado é capturado das projeções oficiais existentes ao abrir a sessão;
- esperado persistido é snapshot histórico, não saldo operacional;
- contado pertence somente ao domínio de inventário enquanto não houver confirmação;
- salvar ou corrigir contagem nunca cria movimento nem altera saldo;
- toda divergência exige confirmação humana explícita;
- somente a confirmação pode gerar warehouse_movement_v1.type = INVENTORY_ADJUSTMENT;
- movimento, saldo agregado, distribuição física e item ajustado devem convergir atomicamente;
- sessão finalizada não é reaberta nem apagada; correção posterior usa nova sessão/movimento.

Documento técnico: docs/adm-deposito/PHASE_10_PHYSICAL_INVENTORY.md.

## D-050 — Concorrência do inventário é otimista e validada na posição física contada

A confirmação de uma divergência nunca aplica cegamente um cálculo feito sobre uma posição que mudou.

Regras permanentes:
- cada item captura revision e lastMovementId da warehouse_location_balance_v1 usada como referência;
- antes do ajuste, a transação compara esses valores com a posição oficial atual;
- alteração concorrente bloqueia o ajuste e leva a sessão para RECONCILIATION_REQUIRED;
- não existe lock global de depósito ou UG;
- a revisão agregada capturada permanece evidência histórica, mas não bloqueia ajustes de outras posições da mesma sessão gerados pelo próprio inventário;
- a posição física contada é a autoridade de concorrência para o item;
- reconciliação posterior preserva a sessão anterior e usa novo inventário parcial.

Documento técnico: docs/adm-deposito/PHASE_10_PHYSICAL_INVENTORY.md.

## D-051 — Inventário por posição não redistribui divergência entre lotes sem evidência de contagem por lote

A FASE 10 preserva a natureza de enriquecimento logístico de warehouse_lot_v1 definida em D-039.

Regras permanentes:
- uma divergência observada em depósito/local/subposição não é atribuída artificialmente a lotes;
- inventário não altera validade, origem ou FEFO;
- lotes continuam subordinados ao material e às autoridades oficiais de saldo/distribuição;
- uma futura contagem por lote deverá ampliar o contrato de forma explícita e reutilizar warehouse_lot_v1, sem criar saldo paralelo.

Documento técnico: docs/adm-deposito/PHASE_10_PHYSICAL_INVENTORY.md.


## D-052 — EMPROVEX Core Protection é gate permanente e anterior às integrações opcionais

A operacionalidade do EMPROVEX tem prioridade sobre qualquer módulo complementar.

Regras permanentes:
- serviços críticos de NF, empenhos, cronogramas, avisos, sincronização e paths operacionais não importam implementação de `lib/warehouse` ou `features/warehouse`;
- o shell principal consulta políticas de módulo por uma camada neutra de plataforma, nunca pela implementação do ADM;
- módulos opcionais não chamam serviços de mutação do núcleo;
- Firestore Rules do bloco operacional `workspaces/{workspaceId}/...` não podem referenciar `warehouse` nem autorização do ADM;
- qualquer PR funcional executa o workflow rápido `EMPROVEX Core Protection` antes da suíte longa;
- o Application CI repete o guard para impedir bypass;
- a proteção é obrigatória já durante FASE 11 e seguintes, não apenas no fechamento do ADM.

Documento global: `docs/EMPROVEX_CORE_PROTECTION.md`.

## D-053 — Efeitos auxiliares são best-effort após a confirmação operacional

Uma operação crítica deve persistir primeiro seu estado canônico mínimo.

Classificação inicial:
- **crítico/atômico:** NF + saldo recebido do empenho + locks/identidade NS + auditoria de integridade quando aplicável;
- **auxiliar/não bloqueante:** alerta informativo, anexo de PDF/Drive, telemetria de consumo e projeções do ADM Depósito.

Regras:
- falha de efeito auxiliar não converte operação crítica já válida em erro;
- o usuário recebe mensagem clara quando um complemento não foi concluído;
- anexos podem ser reenviados posteriormente pelas superfícies próprias;
- alertas auxiliares podem ser reconstruídos/reconciliados;
- nenhuma dependência externa deve ser adicionada antes do commit crítico sem decisão arquitetural explícita e teste de falha correspondente.


## D-054 — Desenvolvimento contínuo com gates rápidos; regressão pesada consolidada no fechamento

Com o EMPROVEX protegido por D-052 e o fluxo unidirecional definido em D-002/D-033, o desenvolvimento das capacidades restantes do ADM Depósito não deve repetir a suíte pesada completa a cada incremento.

Regras permanentes:
- durante a implementação das FASES 11, 11.5 e 12, executar obrigatoriamente os gates rápidos de isolamento/Core Protection e os testes direcionados ao domínio efetivamente alterado;
- Browser E2E completo, suíte multi-tenant integral, build/regressão ampla e campanha integrada não são exigidos após cada pequena alteração quando não agregarem evidência nova;
- nenhum incremento pode prosseguir se o gate de Core Protection indicar acoplamento do ADM ao núcleo operacional do EMPROVEX;
- falhas em testes direcionados da capacidade em desenvolvimento devem ser corrigidas antes de continuar naquela capacidade;
- ao concluir a implementação funcional do ADM Depósito, executar uma campanha consolidada de estabilização com segurança, Firestore Emulator, Browser E2E/Chromium, TypeScript/build, guards, concorrência e integrações relevantes;
- as correções encontradas nessa campanha devem ser tratadas de forma consolidada e os testes afetados repetidos até ficarem verdes;
- a FASE 13 permanece o gate de validação integrada e fechamento do piloto fundador; nenhuma expansão externa ocorre antes de sua aprovação;
- o CI do GitHub permanece como certificação final, não como mecanismo primário para descobrir erros que podem ser detectados localmente.

Ambiente preferencial:
- a estação local de validação do EMPROVEX pode executar Node, Java, Firebase Emulator, Next.js, Playwright e Chromium;
- a validação local é pré-certificação técnica; não substitui o gate final do GitHub/FASE 13.

Objetivo: maximizar velocidade de implementação sem abrir mão da fronteira de segurança do EMPROVEX nem da regressão completa antes do fechamento.


## D-055 — ADM Depósito reutiliza o chrome visual oficial do EMPROVEX

A FASE 11.5 abandona a aparência de painel administrativo isolado e passa a usar a mesma linguagem estrutural da plataforma operacional EMPROVEX.

Diretriz:
- o ADM Depósito deve reutilizar o mesmo Header oficial por meio de `AppHeader`;
- a sidebar do ADM deve replicar as mesmas classes, hierarquia, operador, status, assinatura visual, comportamento responsivo e footer do `AppSidebar`;
- a navegação interna continua específica do domínio logístico, mas visualmente pertence ao mesmo produto;
- o fundo, espaçamento principal, largura de conteúdo, offsets de Header/Sidebar e composição geral devem seguir o shell operacional do EMPROVEX;
- o ADM não deve voltar a usar uma moldura própria semelhante à área administrativa;
- alterações desta decisão são exclusivamente visuais/UX e não autorizam mudança de regras de negócio, ledger, saldo, Rules operacionais ou dependências do núcleo.

A referência visual de verdade para o chrome é:
- `components/layout/AppHeader.tsx`;
- `components/layout/AppSidebar.tsx`;
- `components/layout/AppBackground.tsx`;
- composição do shell em `app/page.tsx`.

A sidebar logística pode possuir seus próprios itens, desde que preserve a mesma estrutura visual e comportamental da sidebar principal.
