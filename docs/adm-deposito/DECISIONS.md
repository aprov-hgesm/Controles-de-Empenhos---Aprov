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


## D-056 — Início do ADM Depósito é uma central visual de localização sobre croqui 2.5D

A antiga superfície “Visão Geral” passa a se chamar **Início** e deixa de ser um dashboard convencional.

Direção aprovada pelo fundador:
- fundo predominantemente branco, mantendo Header e Sidebar oficiais do EMPROVEX;
- coluna esquerda dedicada à consulta de material;
- imediatamente abaixo da consulta, seletor do depósito cadastrado;
- ao selecionar um material, mostrar saldo total, quantidade no depósito selecionado, localizações físicas, lotes e validade;
- a área principal é o croqui do depósito, com o item pesquisado destacado na posição real;
- o croqui é 2D com perspectiva leve (2.5D), inspirado em visão isométrica de armazenagem;
- paredes não são renderizadas na home; o limite físico do depósito é representado pelo piso;
- permitir vista isométrica, vista superior e rotação em incrementos controlados;
- evitar engine 3D pesada, WebGL obrigatório ou animações que prejudiquem desempenho;
- o croqui continua derivado de warehouse_depot_layout_v1 e das localizações oficiais já existentes;
- a home é somente leitura para material, saldo, lote, localização e layout; edição estrutural permanece na superfície Visão do Depósito.

Objetivo: transformar o Início em uma superfície operacional de consulta e orientação física, sem criar nova fonte de verdade.

## D-057 — Execução de testes e CI do restante do ADM Depósito fica consolidada no fechamento

Por orientação do fundador durante a FASE 11.5, a execução de baterias de teste deixa de ocorrer a cada incremento restante do ADM Depósito.

Regras vigentes a partir desta decisão:
- implementação visual/funcional restante pode prosseguir sem executar suites locais a cada commit;
- Core Protection, guards, testes de domínio, TypeScript, build, Firestore Emulator, Browser E2E e regressão integrada permanecem obrigatórios, mas sua **execução é consolidada na campanha final do roadmap modular vigente — Módulo 14**, antes do encerramento do piloto;
- nenhum CI remoto deve ser disparado intencionalmente durante a implementação restante;
- testes existentes não são removidos; ficam acumulados para a campanha final;
- se surgir um bloqueio concreto que só possa ser diagnosticado por execução dirigida, um teste pontual pode ser usado como ferramenta de diagnóstico, sem transformar isso em gate de fase;
- a estação local do fundador possui PowerShell e pode executar comandos quando intervenção local for necessária;
- intervenções por PowerShell devem ser solicitadas apenas quando realmente necessárias e preferencialmente de forma consolidada.

D-057 substitui, quanto à **cadência de execução**, a exigência intermediária de gates rápidos descrita em D-054; a cobertura final prevista em D-054 permanece integralmente obrigatória.


## D-058 — Navegação do ADM Depósito consolidada em quatro áreas operacionais

A navegação plana anterior é substituída por quatro áreas principais definidas pelo fundador:

1. **Início** — central visual com croqui do depósito selecionado, consulta de item e destaque da posição física.
2. **Cadastro de Itens** — porta de entrada logística das NFs do EMPROVEX, decisão entre alocação física e consumo imediato, além da migração SISCOFIS manual/JSON.
3. **Meus Depósitos** — cadastro dos depósitos e localizações e edição/versionamento dos croquis físicos.
4. **Controle de Itens** — consulta do estoque disponível e acesso consolidado a resumo logístico, lotes/validade, saída expressa, movimentações, inventário, entregas, alertas e configurações.

As rotas antigas permanecem apenas como redirecionamentos de compatibilidade. Elas não formam mais a navegação principal.

Regras de preservação:
- o Dashboard Logístico passa a ser uma subárea de Controle de Itens;
- SISCOFIS deixa de ser aba principal e passa a integrar Cadastro de Itens;
- Localizações e Visão do Depósito passam a compor Meus Depósitos;
- Estoque, Saída Expressa, Movimentações, Inventário, Entregas, Alertas e Configurações passam a compor Controle de Itens;
- a reorganização não cria fonte de verdade paralela.

## D-059 — NF registrada no EMPROVEX gera decisão logística no ADM sem reacoplar o núcleo

O EMPROVEX permanece a fonte canônica da Nota Fiscal e do Empenho. O ADM Depósito apenas lê essas fontes e registra sua própria decisão logística em `warehouse/{workspaceId}/intakes`.

Contrato:
- cada item elegível de NF aparece em **Cadastro de Itens** como pendente até existir decisão logística completa;
- **Alocar no depósito** cria/resolve o material canônico do ADM, registra entrada no ledger, materializa saldo não localizado, transfere para a posição física escolhida, registra lote/validade e associa código de barras quando informado;
- a posição é composta por depósito + estrutura/local + nível/subposição opcional;
- **Consumo imediato** não cria entrada física, lote nem localização de estoque; o item é registrado como pendência para lançamento manual no SISCOFIS;
- o relatório de consumo imediato permite marcar o item como lançado no SISCOFIS sem modificar a NF original;
- a NF e o Empenho continuam sem importação ou dependência de `lib/warehouse`;
- falha do ADM nunca converte o cadastro operacional da NF em falha.

O contrato persistido é `warehouse_item_intake_v1`, imutável quanto à decisão original. Somente o estado SISCOFIS de um consumo imediato pode avançar de `PENDING` para `POSTED`.

## D-060 — Croqui ativo é independente por depósito e exclusão física é arquivamento operacional

Cada depósito pode possuir seu próprio croqui ativo e seu próprio histórico de versões. Criar ou editar o croqui de um depósito não arquiva o croqui de outro.

Estruturas visuais admitidas incluem estante, rack, armário, câmara, freezer, geladeira, palete, bancada, corredor, zona e outras estruturas, com dimensões, posição, rotação e elevação visual personalizáveis.

Para preservar auditoria:
- depósito/localização já utilizado não é apagado fisicamente;
- a ação apresentada ao usuário como **Excluir da operação** altera o status para inativo e preserva histórico e referências;
- o registro pode ser restaurado posteriormente;
- versões antigas de croqui permanecem arquivadas, nunca reescritas como histórico mutável.

## D-058 — Navegação operacional consolidada em quatro áreas

A navegação principal do ADM Depósito passa a possuir quatro áreas funcionais definitivas:

1. **Início** — croqui do depósito selecionado, consulta de item e localização visual;
2. **Cadastro de Itens** — tratamento logístico dos itens oriundos de NF e migração inicial SISCOFIS;
3. **Meus Depósitos** — cadastro de depósitos, localizações, estruturas físicas e croquis;
4. **Controle de Itens** — consulta do estoque e demais operações recorrentes do depósito.

As antigas superfícies `Estoque`, `Saída Expressa`, `Movimentações`, `Localizações`, `Visão do Depósito`, `Inventário`, `SISCOFIS / Conciliação`, `Entregas`, `Alertas` e `Configurações` deixam de ser áreas primárias de navegação.

Elas devem ser:
- absorvidas como subabas ou capacidades internas das quatro áreas acima;
- preservadas tecnicamente quando ainda necessárias;
- mantidas por redirecionamento quando houver rota legada;
- nunca duplicadas como uma segunda implementação concorrente.

A reorganização é de experiência e composição funcional; material canônico, ledger, saldos, lotes, barcodes, inventário, SISCOFIS, alertas e demais contratos existentes continuam sendo reutilizados.

## D-059 — Toda NF recebida gera tratamento logístico pendente no ADM, sem voltar a acoplar o núcleo EMPROVEX

O cadastro da Nota Fiscal continua pertencendo exclusivamente ao núcleo operacional do EMPROVEX e permanece independente do ADM Depósito, conforme D-002, D-033 e Core Protection.

O ADM passa a interpretar cada item de NF disponível como uma **pendência de tratamento logístico** até que sua quantidade seja classificada.

Destinos admitidos:
- **Alocação no depósito** — quantidade passa de `UNASSIGNED` para posição física do ADM;
- **Consumo imediato** — quantidade não ocupa posição física do depósito e passa a integrar a fila/relatório de lançamentos a realizar no SISCOFIS.

O tratamento pode ser parcial. Portanto, uma mesma quantidade recebida pode ser dividida entre armazenamento físico e consumo imediato.

O estado logístico deve pertencer ao namespace `warehouse/{workspaceId}`, referenciando a identidade estável da NF/item sem escrever de volta na NF para controlar o fluxo.

A alocação deverá reutilizar os contratos existentes de:
- material canônico;
- ledger;
- `warehouse_location_balance_v1`;
- lote/validade;
- barcode;
- localização física.

Não criar segundo saldo nem uma nova fonte de verdade quantitativa.

## D-060 — Cadastro de Itens concentra entrada logística e migração SISCOFIS

A área **Cadastro de Itens** possui duas responsabilidades operacionais relacionadas à formação do estoque:

### Notas Fiscais pendentes

A superfície lê NFs e empenhos canônicos do EMPROVEX e apresenta os itens que ainda exigem decisão logística.

O fluxo de alocação deverá reunir, em uma única jornada:
- depósito;
- estrutura/local;
- nível/subposição;
- quantidade;
- lote;
- validade;
- código de barras;
- confirmação.

Lote, validade e barcode reutilizam os contratos existentes e não criam um catálogo paralelo.

### Migração SISCOFIS

A migração inicial do inventário SISCOFIS permanece dentro de Cadastro de Itens e admite:
- lançamento manual;
- importação JSON gerada por prompt para IA externa.

As duas modalidades devem convergir para o mesmo contrato versionado e validação antes da confirmação.

A IA permanece externa, conforme D-008. Não introduzir agente ou interpretação automática interna do relatório.

## D-061 — Meus Depósitos é a autoridade de configuração física e cada depósito possui croqui próprio

A área **Meus Depósitos** concentra:
- criação e manutenção de 1..N depósitos;
- criação de localizações e subposições;
- configuração das estruturas físicas;
- edição e versionamento dos croquis.

O modelo alvo passa a ser **um layout ativo por depósito**, com histórico independente por depósito.

Estruturas físicas previstas incluem, no mínimo:
- estante;
- rack;
- armário;
- freezer;
- geladeira;
- câmara;
- palete;
- área de paletes;
- bancada;
- corredor;
- área livre;
- outros.

O editor permanece um croqui operacional 2D/2.5D, não CAD e não motor 3D.

A experiência alvo permite:
- adicionar estrutura;
- arrastar;
- redimensionar;
- rotacionar;
- duplicar;
- excluir;
- renomear;
- alinhar/encaixar em grid;
- associar a localização lógica;
- configurar níveis/subposições quando aplicável.

Mover ou redimensionar um objeto visual nunca movimenta estoque. A associação continua baseada no ID lógico da localização.

## D-062 — Controle de Itens absorve a operação recorrente e a execução segue módulos oficiais

A área **Controle de Itens** concentra as capacidades recorrentes do depósito.

Subáreas previstas:
- Itens disponíveis;
- Saída Expressa;
- Movimentações;
- Inventário;
- Entregas;
- Alertas;
- SISCOFIS operacional/conciliação quando aplicável;
- Configurações.

Relatórios logísticos derivados deverão ser incorporados nessa área ou em superfície subordinada, sem criar novo saldo ou duplicar dados.

A execução das pendências restantes segue o plano modular oficial registrado no ROADMAP.

A cadência de validação continua obedecendo D-057:
- não executar suítes completas a cada módulo;
- não abrir PR/CI intermediário apenas para marcar cada módulo;
- preservar todos os testes e guards existentes;
- executar a campanha consolidada na etapa final prevista;
- teste dirigido durante implementação somente quando necessário para diagnosticar bloqueio concreto.

## D-063 — Motor de pendências usa `warehouse_item_intake_v2` como estado de tratamento, sem criar saldo paralelo

O **Módulo 1 — Motor de pendências das Notas Fiscais** evolui a fila de Cadastro de Itens para suportar tratamento parcial sem antecipar a alocação física.

Contrato permanente:
- o path continua sendo `warehouse/{workspaceId}/intakes/{intakeId}`;
- novos estados parciais usam `schemaVersion = warehouse_item_intake_v2`;
- `warehouse_item_intake_v1` permanece preservado como contrato legado de decisões inteiras já registradas e não é reescrito para v2;
- a identidade permanece determinística por `workspaceId + invoiceRecordKey + itemId`, usando o mesmo formato `intake_<sha256>`;
- descrição textual, fornecedor ou número exibido da NF nunca formam a identidade;
- a ausência de documento `intakes` é o estado inicial canônico **PENDING** para a fila; refresh/reentrada não cria documentos nem duplica pendências;
- a persistência v2 começa quando um módulo operacional efetivamente registrar tratamento;
- `materialId` pode permanecer nulo até ser resolvido e, uma vez definido no estado v2, não pode ser trocado silenciosamente;
- `receivedQuantity` é o snapshot da quantidade canônica no início do tratamento e torna-se imutável no documento v2;
- `allocatedQuantity` e `immediateConsumptionQuantity` são progresso de tratamento, nunca saldo de estoque;
- `pendingQuantity = receivedQuantity - allocatedQuantity - immediateConsumptionQuantity`;
- os estados persistidos são `PENDING`, `PARTIALLY_PROCESSED` e `PROCESSED`;
- `warehouse_balance_v1` continua sendo a única autoridade quantitativa de estoque; `warehouse_location_balance_v1` continua sendo a distribuição física e `warehouse_movement_v1` a trilha auditável.

Reconciliação e compatibilidade:
- quando a quantidade atual da NF diverge do snapshot warehouse, a fila apresenta `RECONCILIATION_REQUIRED` como **estado efetivo de leitura** e não altera automaticamente o documento histórico;
- quando NF/item deixa de existir na fonte canônica, o estado histórico é preservado e a fila só conclui `CANONICAL_SOURCE_MISSING` quando a consulta de NFs não estiver truncada;
- quando existe projeção/movimento legado de NF sem estado `intakes` compatível, a fila usa `LEGACY_INVOICE_PROJECTION` e exige reconciliação antes de qualquer nova movimentação;
- NFs anteriores ao cutoff existente continuam fora da fila operacional; não existe retrointegração histórica automática;
- nenhum desses casos corrige saldo, ledger, NF ou Empenho silenciosamente.

Segurança e performance:
- Rules v2 são explícitas em `/warehouse/{workspaceId}/intakes/{intakeId}`, sem wildcard permissivo e sem delete físico;
- o piloto continua founder-only por `canAccessWarehouseModule`; usuários externos permanecem sem acesso;
- updates v2 preservam identidade, UG, snapshot recebido e metadados de criação e só admitem progresso monotônico de tratamento;
- a leitura da fila é bounded em até 250 empenhos, 300 NFs, 500 estados `intakes` e 250 movimentos recentes usados somente para detectar compatibilidade legada;
- Cadastro de Itens não carrega mais cronogramas, saldos, depósitos e localizações apenas para montar a fila;
- nenhuma escrita é feita no namespace operacional de NF/Empenho/Cronograma.

Limite deste módulo:
- **Alocar no depósito** permanece apenas como porta para o Módulo 2 e não executa transferência, localização, lote, validade ou barcode;
- **Consumo imediato** permanece apenas como porta para módulo posterior e não classifica/baixa quantidade nem conclui SISCOFIS neste Módulo 1;
- o `warehouse_item_intake_v1` já existente continua legível para compatibilidade histórica, mas não autoriza reuso do fluxo inteiro como implementação do tratamento parcial.

Esta decisão substitui a interpretação anterior de D-059 de que uma decisão nova precisaria consumir o item inteiro de uma vez; o v1 continua válido apenas para registros legados já materializados.



## D-064 — Módulos 2 e 3 usam uma única jornada transacional de alocação parcial, com entrada quantitativa idempotente e enriquecimento logístico

Os **Módulos 2 e 3** passam a formar uma única jornada operacional em **Cadastro de Itens → Notas Fiscais pendentes**. Não existe segunda tela concorrente para lote/barcode e não existe novo saldo.

### Autoridades preservadas

Permanecem autoridades:
- material: `warehouse_material_v1`;
- ledger: `warehouse_movement_v1`;
- saldo agregado: `warehouse_balance_v1`;
- distribuição física: `warehouse_location_balance_v1`;
- lote/validade: `warehouse_lot_v1`, como atribuição logística e não saldo;
- barcode: `warehouse_barcode_v1`, como identificador auxiliar;
- tratamento da pendência: `warehouse_item_intake_v2`.

A quantidade `allocatedQuantity` do intake só avança depois de uma transferência física confirmada. O intake nunca é usado para recalcular ou substituir o saldo oficial.

### Entrada da NF e prevenção de duplicação

Antes da primeira alocação v2, o serviço resolve o material canônico pela vinculação existente ou por `deriveWarehouseMaterialIdForEmpenhoItem`.

A entrada quantitativa da NF usa uma identidade idempotente única por `intakeId`:
`adm-intake-v2:<intakeId>:invoice-entry`.

Antes de criar essa entrada, o repository executa uma busca bounded dos movimentos da mesma `invoiceRecordKey`. Se houver outro movimento `INVOICE` que já represente o mesmo item, a operação é interrompida como reconciliação necessária. Assim, uma projeção NF → estoque anterior nunca é somada novamente.

Quando não existe entrada oficial anterior, é criado exatamente um `INVOICE_ENTRY` para a quantidade recebida inteira pelo repository oficial do ledger. Essa entrada materializa a quantidade em `UNASSIGNED`. Alocações parciais posteriores não criam novas entradas: apenas transferem parcelas de `UNASSIGNED` para posições físicas.

### Fronteira transacional e recuperação segura

As Rules atuais vinculam cada movimento ao `lastMovementId` final do saldo agregado. Por isso, a criação inicial de `INVOICE_ENTRY` e a transferência física não podem ser dois movimentos independentes dentro do mesmo commit sem violar essa invariável.

A fronteira adotada é:
1. **entrada quantitativa idempotente** pelo ledger oficial;
2. **transação de alocação** que grava conjuntamente:
   - `TRANSFER` com `quantityDelta = 0`;
   - nova revisão de `warehouse_balance_v1` sem alterar a quantidade total;
   - redução de `UNASSIGNED`;
   - aumento da `warehouse_location_balance_v1` de destino;
   - criação/incremento da atribuição `warehouse_lot_v1`;
   - criação de `warehouse_barcode_v1` somente quando o código ainda é desconhecido;
   - criação/avanço monotônico do `warehouse_item_intake_v2`.

Se a etapa 1 confirmar e a etapa 2 falhar, nenhuma alocação é fingida: a quantidade permanece oficialmente em `UNASSIGNED`, o intake não avança e a repetição reutiliza a mesma entrada. Não existe compensação silenciosa.

### Quantidade parcial e concorrência

Cada confirmação aceita apenas:
`0 < quantidade <= pendingQuantity`.

A transação relê o intake antes da escrita e compara `allocatedQuantity` e `immediateConsumptionQuantity` com a revisão observada pela tela. Se outra tela tiver avançado a pendência, a operação aborta com conflito e exige recarga. A retry do Firestore não pode transformar uma tela obsoleta em sobrealocação.

O status continua derivado exclusivamente por:
`pendingQuantity = receivedQuantity - allocatedQuantity - immediateConsumptionQuantity`.

### Idempotência da confirmação

Cada tentativa confirmável recebe `operationId` estável. A transferência usa:
`adm-intake-v2:<intakeId>:allocation:<operationId>`.

Na interface, o `operationId` é preservado em `sessionStorage` durante a tentativa. Refresh, duplo clique ou resposta de rede ambígua reutilizam a mesma identidade. O movimento também recebe um fingerprint compacto de quantidade + posição + lote + validade + barcode, incorporado ao payload auditável comparado pelo replay. Assim, replay idêntico retorna o movimento existente; payload divergente conflita e não movimenta novamente.

O lote usa identidade determinística por intake + movimento de entrada + código do lote + posição. Repetidas parcelas do mesmo lote na mesma posição incrementam a atribuição existente; lote igual em outra posição permanece uma atribuição distinta.

### Lote, validade e barcode

O lote é obrigatório na jornada atual porque a confirmação cria ou amplia uma atribuição `warehouse_lot_v1`. A validade pode ser uma data ISO válida ou `null` mediante escolha humana explícita **Sem validade**. Nenhuma validade é inferida automaticamente.

Barcode é opcional. Digitação manual e scanner USB HID usam o mesmo campo; ENTER apenas captura a leitura na interface. Código conhecido precisa pertencer ao mesmo material e a uma apresentação válida; código de outro material, incompatível ou inativo é bloqueado. Código desconhecido pode ser associado ao material canônico já resolvido, nunca cria material implicitamente.

### Estrutura física e performance

Somente depósitos, locais e subposições ativos da UG/workspace corrente podem receber a quantidade. A interface carrega depósitos/localizações somente ao abrir o painel de alocação, com limites existentes de 250 depósitos e 500 localizações. A prevenção de projeção legada consulta no máximo 51 movimentos para a NF específica. A fila principal continua usando os limites definidos em D-063.

### Segurança e Core Protection

Nenhuma Firestore Rule precisou ser relaxada ou ampliada. Founder-only, UG, workspace, ledger imutável, saldos derivados, delete físico negado para histórico, lote sem autoridade quantitativa e barcode auxiliar continuam valendo.

Os Módulos 2 e 3 não alteram cadastro, edição ou exclusão de NF, Empenho ou Cronograma e não escrevem pendência no namespace operacional. A única dependência do núcleo é leitura da fonte canônica.

O **Módulo 4 — Consumo imediato e fila SISCOFIS** permanece explicitamente fora deste fechamento. Testes completos, Browser E2E, Application CI, regressão e PR continuam diferidos para o Módulo 14 conforme D-057.


## D-065 — Saída de Material absorve Saída Expressa e compartilha a projeção de consumo/SISCOFIS com o consumo imediato

Os **Módulos 3.5 e 4** consolidam a retirada de materiais e o consumo imediato sem criar uma segunda autoridade quantitativa, um segundo scanner ou um segundo motor de relatórios.

### Superfície operacional e compatibilidade da Saída Expressa

A superfície principal passa a ser:

**Controle de Itens → Saída de Material**

com as subabas:
- **Nova Saída**;
- **Relatórios**.

A antiga `WarehouseExpressOutbound` permanece somente como wrapper de compatibilidade para rota/imports históricos. Ela renderiza a nova `WarehouseMaterialWithdrawal`; portanto não existe fluxo concorrente de baixa.

O movimento oficial continua sendo:
- contrato `warehouse_movement_v1`;
- tipo `OUTBOUND`;
- source legado compatível `EXPRESS_OUTBOUND`.

Não foi criado novo tipo de movimento apenas para renomear a experiência visual.

### Checkout e carrinho

A jornada operacional é:

`barcode → material → quantidade → ENTER/TAB → próxima leitura`.

Regras:
- foco retorna ao campo de barcode após a inclusão da linha;
- scanner USB HID e digitação manual usam o mesmo campo;
- barcode conhecido resolve a associação `warehouse_barcode_v1`;
- barcode nunca substitui `materialId`;
- barcode desconhecido não cria material; pode apenas ser associado a material canônico já existente;
- ENTER no barcode resolve o material;
- ENTER ou TAB na quantidade adiciona a linha ao carrinho;
- adicionar ao carrinho não altera saldo;
- quantidade/apresentação é convertida para unidade-base antes da finalização;
- linha pode ser editada ou removida enquanto nenhuma tentativa de finalização tiver iniciado;
- após tentativa de finalização ambígua/parcial, o carrinho fica bloqueado para preservar identidade e permitir retry seguro.

O checkout reutiliza posição, lote, barcode, conversões de apresentação e o seletor FEFO existentes. A recomendação FEFO continua sendo recomendação; não existe segunda implementação de FEFO.

### Contrato de retirada

Foi criado o contrato operacional:
- `warehouse_material_withdrawal_v1`;
- path `warehouse/{workspaceId}/withdrawals/{withdrawalId}`.

O cabeçalho registra:
- ID estável `wd_<32 hex>`;
- workspace/UG;
- destino;
- `withdrawnBy`;
- `createdBy`;
- `payloadHash`;
- quantidade esperada/aplicada de linhas;
- status `FINALIZING | PARTIALLY_APPLIED | FINALIZED`;
- timestamps de servidor.

Limite operacional:
- no máximo **40 linhas por retirada**.

A retirada não replica o ledger. Cada linha chama o repository oficial de Saída Expressa/OUTBOUND com identidade:
`material-withdrawal:<withdrawalId>:<lineId>`.

A operação possui ainda `payloadHash` SHA-256 de todas as linhas. Um retry com o mesmo `withdrawalId` e conteúdo diferente é rejeitado.

### Atomicidade, concorrência e recuperação

A finalização é deliberadamente idempotente por linha porque cada OUTBOUND já possui sua própria transação oficial de:
- movimento;
- saldo agregado;
- locationBalance;
- lote, quando aplicável.

O cabeçalho registra progresso após cada linha.

Se houver falha após parte das linhas:
- status permanece `PARTIALLY_APPLIED`;
- nenhuma mensagem de sucesso completo é exibida;
- as mesmas identidades são reapresentadas no retry;
- movimentos já aplicados são reconhecidos como replay;
- linhas faltantes podem prosseguir;
- a retirada só vira `FINALIZED` quando todas as linhas estiverem aplicadas.

Antes de cada OUTBOUND, o repository existente relê material, saldo, posição, barcode e lote. Assim, saldo alterado entre carrinho e finalização é detectado e nunca produz estoque negativo.

### Destinos

Foi criado o contrato:
- `warehouse_destination_v1`;
- path `warehouse/{workspaceId}/destinations/{destinationId}`.

Campos:
- ID estável `dest_<32 hex>`;
- workspace/UG;
- nome;
- status `active | inactive`;
- createdBy/updatedBy;
- timestamps.

Destinos não são hardcoded. Cozinha, Padaria, Copa ou qualquer outro nome são dados cadastráveis.

Delete físico é negado. Destino histórico deve ser inativado.

O mesmo catálogo é reutilizado por:
- saída normal de estoque;
- consumo imediato.

### Retirante e operador

`withdrawnBy` representa a pessoa que recebeu/retirou fisicamente o material.

Ele permanece separado de:
- usuário autenticado;
- `createdBy`;
- `operatorUid`.

Isso permite registrar, por exemplo, um operador do EMPROVEX diferente do militar/servidor que retirou o material.

### Projeção operacional de consumo e relatórios SISCOFIS

Foi criado:
- `warehouse_consumption_record_v1`;
- path `warehouse/{workspaceId}/consumptions/{consumptionId}`.

Essa coleção é **projeção operacional para relatório**, não autoridade de saldo.

Cada registro possui exatamente um `movementId` OUTBOUND e origem:
- `STOCK_OUTBOUND`;
- `IMMEDIATE_CONSUMPTION`.

Estado local SISCOFIS:
- `PENDING`;
- `PREPARED`;
- `POSTED`.

Não existe integração automática com SISCOFIS.

O relatório principal fica em:
**Controle de Itens → Saída de Material → Relatórios**.

Presets:
- Diário;
- Semanal: segunda a domingo;
- Quinzenal: 1–15 ou 16–último dia do mês;
- Mensal: mês-calendário;
- período personalizado.

Filtros:
- Todos;
- Saída de estoque;
- Consumo imediato;
- destino;
- retirante.

Consolidações:
- por material;
- por destino;
- por retirante/recebedor;
- por dia;
- detalhamento de movimento.

Saídas adicionais:
- copiar;
- imprimir;
- CSV sem biblioteca pesada.

Consulta moderna é bounded em até 250 consumos por período. Compatibilidade com Saída Expressa legada consulta no máximo 100 movimentos do período e só projeta movimento não representado por `consumptions`, impedindo dupla contabilização.

### Consumo imediato do intake v2

O botão **Consumo imediato** em **Cadastro de Itens → Notas Fiscais pendentes** passa a ser operacional.

A quantidade aceita:
`0 < quantidade <= pendingQuantity`.

Pode ser parcial.

A operação registra:
- destino compartilhado;
- recebido/retirado por;
- operador autenticado;
- consumo projetado;
- estado SISCOFIS pendente.

O efeito sobre o intake é:
`immediateConsumptionQuantity += quantidade`

e:
`pendingQuantity = receivedQuantity - allocatedQuantity - immediateConsumptionQuantity`.

O status continua derivado por `warehouse_item_intake_v2`.

### Efeito quantitativo real do consumo imediato

D-064 estabeleceu que a primeira operação de tratamento cria/reutiliza um único `INVOICE_ENTRY` da quantidade recebida inteira e a materializa em `UNASSIGNED`.

Consequentemente, consumo imediato não pode apenas incrementar o intake: isso deixaria saldo físico inflado.

A decisão adotada é:
1. criar/reutilizar a mesma entrada quantitativa idempotente do intake;
2. na confirmação do consumo imediato, executar **uma única transação** que:
   - cria `OUTBOUND` da parcela a partir de `UNASSIGNED`;
   - reduz `warehouse_balance_v1`;
   - reduz a `warehouse_location_balance_v1` de `UNASSIGNED`;
   - avança `immediateConsumptionQuantity`;
   - recalcula `pendingQuantity/status`;
   - cria uma projeção `warehouse_consumption_record_v1`.

Não é criada localização física, lote ou transferência para depósito.

Esse OUTBOUND não representa uma segunda saída: ele é a retirada quantitativa necessária porque D-064 já materializou a NF no saldo oficial antes da classificação. A mesma parcela nunca deve receber posteriormente outro OUTBOUND por consumo imediato.

Idempotência:
`adm-intake-v2:<intakeId>:immediate:<operationId>`.

O `operationId` é preservado em `sessionStorage`; retry idêntico retorna o movimento/consumo existentes, enquanto revisão obsoleta do intake gera conflito.

### Compatibilidade histórica

Permanecem preservados:
- `EXPRESS_OUTBOUND` histórico;
- `warehouse_item_intake_v1`;
- consumo imediato legado;
- relatórios legados.

A subaba antiga de consumo imediato/SISCOFIS foi renomeada visualmente como **Histórico legado / SISCOFIS** para não competir com o novo motor consolidado de relatórios.

Não foi feita migração em massa.

### Firestore Rules

Foram adicionadas Rules explícitas para:
- `destinations`;
- `withdrawals`;
- `consumptions`.

Permanecem:
- founder-only do piloto;
- workspace/UG;
- movimentos imutáveis;
- saldo/locationBalance derivados;
- lote/barcode sem autoridade de saldo;
- intake v2 monotônico;
- deletes físicos negados para os novos históricos;
- nenhum wildcard permissivo.

As Rules foram reconstruídas a partir do baseline limpo após a inspeção detectar uma corrupção textual local durante edição; a correção ocorreu antes de qualquer deploy.

### Core Protection e validação

Nenhum código de cadastro/edição/exclusão de NF, Empenho ou Cronograma foi alterado.

Fluxo continua:
`EMPROVEX → NF/Empenho canônicos → ADM Warehouse`.

Nenhuma dependência inversa foi criada.

Conforme D-057:
- suíte completa não executada;
- Browser E2E completo não executado;
- Application CI não executado;
- regressão completa não executada;
- campanha multi-tenant completa não executada;
- nenhum PR, merge ou deploy realizado.

O **Módulo 5 permanece explicitamente NÃO INICIADO**.


## D-066 — Migração SISCOFIS simplificada preserva Nº Ficha na origem

A partir do Módulo 5 da consolidação 11.5, o contrato externo oficial é `emprovex_siscofis_inventory_v1` e contém somente `numeroItem`, `descricao`, `quantidade` e `valorUnitario`. A IA permanece externa e somente extratora; UG, data-base, materialId e unidade não são solicitados à IA. O Nº Ficha passa a ser preservado por linha para auditoria, sem se tornar materialId, ID Firestore ou chave de deduplicação. Linhas repetidas permanecem independentes. O adaptador converge para o motor histórico `warehouse_siscofis_import_v1`; snapshots novos usam `warehouse_siscofis_snapshot_v2` para tornar explícita a presença do Nº Ficha, enquanto v1 permanece legível. Material canônico reutiliza correspondência segura; quando a unidade não está disponível para material novo, o fluxo reutiliza explicitamente o fallback canônico já existente na integração de NF (`other` / `Apresentação não informada`), sem inventar uma unidade concreta e permitindo enriquecimento posterior.


## D-067 — Biblioteca de estruturas é catálogo estático e layouts permanecem a única persistência visual por depósito

Os Módulos 6 e 7 consolidam capacidades já existentes sem criar nova fonte de verdade.

Decisão permanente:
- `warehouse_depot_v1` continua sendo a identidade do depósito;
- `warehouse_location_v1` continua sendo a identidade de local/subposição;
- `warehouse_depot_layout_v1` continua sendo o único contrato persistido de croqui;
- layout ativo e histórico são consultados explicitamente por `depotId`, evitando dependência de listagem global limitada;
- salvar nova versão continua arquivando somente a versão ativa anterior do mesmo depósito;
- a biblioteca padrão de estruturas físicas é versionada no código, como catálogo de defaults de composição;
- não existe coleção Firestore de tipos de estrutura;
- somente instâncias efetivamente usadas são persistidas em `layout.objects`;
- tipos novos de biblioteca devem preferir mapear para `kind` já suportado quando semanticamente compatível;
- layouts históricos não são migrados nem sobrescritos apenas para adotar nomes/defaults novos;
- níveis/subposições visuais não criam estoque próprio: quando houver vínculo operacional, ele referencia IDs logísticos existentes;
- mover, redimensionar ou rotacionar objeto visual nunca altera `warehouse_balance_v1`, `warehouse_location_balance_v1` ou `warehouse_movement_v1`.

O catálogo pode oferecer dimensões, proporções, rotação e comportamento visual iniciais, mas esses valores não são medidas arquitetônicas oficiais e não transformam o editor em CAD.

## D-068 — Editor visual permanece leve e sem engine gráfica externa

No Módulo 8 da reorganização funcional, Fabric.js foi avaliado como primeira opção e Konva/react-konva como alternativa.

Decisão permanente para o baseline atual:
- não adicionar Fabric.js, Konva, Three.js ou outro motor gráfico;
- evoluir a camada React/pointer-events já existente;
- manter `warehouse_depot_layout_v1` como único modelo persistido;
- manter todas as interações geométricas em memória até o comando explícito Salvar versão;
- prévia 2.5D é somente representação derivada, nunca segundo layout;
- não persistir estado proprietário de canvas;
- priorizar baixo custo de CPU/GPU, compatibilidade com máquinas antigas e ausência de animações contínuas;
- uma futura troca de camada gráfica só é justificável se complexidade funcional concreta superar a solução atual, sem alterar o contrato persistido.

A decisão evita dependência imperativa adicional e mantém a separação entre camada de interação visual e domínio logístico.


## D-069 — Hardening do ADM reutiliza telemetria existente, preserva históricos e degrada fontes auxiliares com segurança

No Módulo 13, ficam congeladas as seguintes decisões:

1. **Material canônico é histórico e não sofre delete físico.**
   - `warehouse_material_v1` pode ser inativado pelo contrato já existente;
   - Firestore Rules negam delete físico;
   - referências de ledger, saldo, lote, barcode, inventário e relatórios não devem ser órfãs por exclusão do catálogo.

2. **Telemetria do ADM não cria sistema paralelo.**
   - o namespace warehouse utiliza um adaptador leve sobre `workspaceUsageTelemetry`;
   - snapshots bounded registram contagens estimadas no mesmo buffer de consumo do workspace;
   - a telemetria é best-effort, sem listener e sem bloquear operação;
   - não existe write Firestore por render ou por simples interação visual;
   - eventual granularidade adicional deve continuar aproveitando a mesma infraestrutura, salvo decisão arquitetural futura explícita.

3. **Fonte auxiliar degradada não transforma ausência de dado em estado resolvido.**
   - Dashboard pode continuar com dados principais quando Inventários, SISCOFIS ou Configurações estiverem temporariamente indisponíveis;
   - a indisponibilidade deve ser explicitada na UI;
   - enquanto o contexto estiver incompleto, reconciliação pode criar/atualizar condições observáveis, mas não resolver automaticamente alertas históricos que podem depender da fonte ausente.

4. **Otimização não cria nova autoridade.**
   - `Map`/`Set` em memória e derivação sobre lotes já carregados são preferidos a novas coleções/caches;
   - relatórios continuam derivados;
   - nenhuma materialização de relatório foi autorizada;
   - nenhum índice composto é criado preventivamente.

Essas decisões preservam a fronteira `EMPROVEX → ADM Depósito` e não alteram a política D-057 de campanha consolidada no Módulo 14.


## D-070 — Prioridade operacional: concluir ADM, estabilizar e só então executar hardening transversal de segurança

Data: 2026-09-25.

Fica estabelecida a sequência oficial:

1. concluir o ADM Depósito e seu fechamento atual;
2. executar bateria específica de testes, uso real e melhorias do ADM;
3. executar o pacote transversal de segurança de dados do EMPROVEX originado da auditoria preventiva.

Racional:
- o cenário atual possui apenas um usuário externo;
- o risco operacional de ampliar complexidade no meio do fechamento do ADM é maior do que o benefício de interromper agora por hardenings preventivos não explorados;
- a auditoria não encontrou evidência de vazamento ativo nem Firestore operacional publicamente aberto;
- o ADM deve ser estabilizado antes da próxima expansão externa significativa.

A Etapa 3 de hardening inclui, inicialmente, dependências, CSP, App Check, sessão, política de senha, OIDC/WIF para credenciais administrativas, configuração pública, PDFs, especificação de segurança e automação de segurança.

**Exceção permanente:** qualquer vulnerabilidade crítica confirmada — vazamento, bypass de autorização, acesso cross-tenant, segredo exposto, comprometimento ou vulnerabilidade crítica aplicável à produção — é bloqueante e deve ser corrigida imediatamente, mesmo durante as etapas 1 ou 2.

Esta decisão não reduz nem substitui Core Protection, Firestore Rules, multi-tenant ou os gates do Módulo 14.

## D-071 — Publicação inicial founder-only e liberação granular futura do ADM Depósito

Data: 2026-09-25.

Fica estabelecido o modelo oficial de disponibilização do ADM Depósito após o encerramento técnico do Módulo 14:

1. **Publicação inicial em produção (Vercel) permanece founder-only.**
   - a conta fundadora continua com acesso ao ADM Depósito;
   - usuários externos não recebem acesso automaticamente por causa de merge, deploy ou publicação;
   - a fase inicial em produção será utilizada para testes reais, observação e ajustes antes de qualquer expansão externa.

2. **A expansão externa será individual e opt-in por usuário.**
   - o painel administrativo deverá futuramente oferecer um controle do tipo `ADM Depósito habilitado`;
   - o valor padrão para usuários externos será **desativado**;
   - o fundador poderá habilitar ou desabilitar o ADM Depósito para cada usuário externo individualmente;
   - habilitar um usuário não altera o estado dos demais usuários.

3. **A autorização deve ser efetiva em navegação e em acesso direto.**
   - usuário externo sem autorização não deve visualizar o ADM Depósito na navegação;
   - acesso direto às rotas do ADM também deve ser negado;
   - a proteção não pode depender apenas de esconder itens de interface;
   - qualquer futura implementação deve preservar workspace/UG, isolamento multi-tenant e Core Protection.

4. **A abertura externa não muda as autoridades canônicas.**
   - Empenhos, Nota Fiscal, Comissão, Liquidação/Tesouraria, Cronograma e demais módulos Core permanecem independentes do ADM;
   - nenhuma nova fonte de verdade é criada por esta autorização;
   - founder-only atual permanece vigente até uma implementação específica, testada e explicitamente aprovada desse controle granular.

5. **Ordem operacional prevista.**
   - concluir Módulo 14;
   - publicar/testar em produção com a conta fundadora;
   - executar ajustes e estabilização pós-publicação;
   - somente depois implementar e validar a liberação granular por usuário externo.

Esta decisão não autoriza agora a expansão externa e não altera o escopo de certificação founder-only do Módulo 14.
