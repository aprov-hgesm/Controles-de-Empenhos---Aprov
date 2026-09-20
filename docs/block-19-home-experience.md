# Bloco 19 — Início cinematográfico do EMPROVEX

## Objetivo

Criar uma superfície `Início` separada do Dashboard. A tela deve funcionar como o átrio visual do sistema: forte identidade cinematográfica, pouca densidade operacional e leitura contextual dos dados sem duplicar o painel analítico.

## Princípios

1. **Login = portal; Início = universo; Painel = análise; módulos = trabalho.**
2. O Início não substitui o Dashboard e não concentra formulários.
3. O sistema solar comunica macroestado; as estrelas representam empenhos individuais.
4. Movimento deve sugerir profundidade e vida, nunca competir com a tarefa.
5. Estados visuais precisam ter semântica estável e acessível.
6. `prefers-reduced-motion` é obrigatório.
7. A tela não deve elevar de forma permanente o custo de Firestore. Antes de virar destino padrão pós-login, deverá existir snapshot/agregação específica da Home.

## Fundação entregue

- nova aba lógica `inicio`;
- visão isolada em `features/inicio`;
- Sol/Núcleo EMPROVEX com quantidade e valor dos empenhos;
- planeta de alertas;
- planeta de acesso ao Painel;
- sistema de classes QR/CALI/PASA/FUNADOM;
- constelação de até 72 empenhos, priorizando itens com atenção;
- hover/focus com recado contextual;
- estrelas normais, atenção e críticas;
- parallax leve por ponteiro;
- fallback para movimento reduzido;
- navegação Início → Empenhos/Painel;
- Dashboard preservado e ainda mantido como destino inicial nesta etapa.

## Semântica inicial

- estrela regular: empenho sem sinal relevante;
- estrela atenção: alerta ATENÇÃO, status Sem Movimentação ou NF sem registro recente;
- estrela crítica: alerta CRÍTICO/ESTOQUE ZERADO ou status Urgente;
- Sol: total e valor de empenhos;
- planeta Alertas: quantidade de alertas ativos;
- planeta Classes: QR, CALI, PASA e FUNADOM.

## Limites da primeira etapa

A constelação usa os dados já disponíveis no runtime e limita a renderização a 72 estrelas. O Bloco 19 posterior deverá criar um snapshot compacto por UG antes de tornar `Início` a tela automática após autenticação, evitando que a experiência estética reverta os ganhos de escalabilidade dos blocos 14–17.

## Bloco 19.2 — cenário cinematográfico

Concluído na mesma branch da fundação:

- atmosfera modular com nebulosas, poeira, estrelas profundas e arcos;
- varredura luminosa e horizonte de profundidade;
- sinal orbital animado ao redor do núcleo;
- sequência cinematográfica de abertura;
- sequência completa apenas na primeira visita ao Início por sessão;
- visitas seguintes usam fade curto para não cansar o operador;
- redução automática dos movimentos com `prefers-reduced-motion`;
- nenhum listener Firestore adicional e nenhuma dependência WebGL.

A transição automática **Login → Início** permanece propositalmente adiada até a homologação visual. O Dashboard continua como landing pós-login, e a animação completa é validada ao entrar manualmente em Início.

## Bloco 19.3 — núcleo/logo interativo

Concluído:

- Sol estático substituído por componente `InicioCore`;
- logo institucional real integrado com `next/image`;
- fallback EMP preservado caso não exista logo;
- resposta 3D local ao cursor, sem mover a cena inteira;
- três órbitas energéticas com velocidades distintas;
- arco telemétrico e pulsos concêntricos;
- intensidade do halo deriva suavemente da quantidade de empenhos;
- tooltip mantém total de empenhos, valor empenhado e contexto de alertas;
- alerta afeta somente um sinal secundário do núcleo, preservando o planeta de Alertas como indicador primário;
- nenhuma leitura Firestore adicional;
- nenhuma dependência WebGL/Three.js;
- `prefers-reduced-motion` preservado.

## Bloco 19.4 — sistema orbital e planetas adicionais

Concluído:

- sistema orbital extraído para `InicioOrbitSystem`;
- três trilhas orbitais e duas varreduras energéticas independentes;
- planeta **Alertas** com leitura de críticos e atenções;
- planeta **Recebimentos** com empenhos/itens que ainda possuem saldo e valor pendente;
- planeta **Execução** com percentual estimado de recebido/liquidado e valor executado;
- planeta **Painel** preservado como acesso à visão analítica;
- planeta **Classes** mantido com luas QR/CALI/PASA/FUNADOM e seus valores;
- identidade visual própria por planeta para facilitar leitura sem depender do texto;
- navegação contextual: Recebimentos → Itens; indicadores analíticos → Painel;
- métricas derivadas exclusivamente dos empenhos e alertas já carregados;
- nenhuma subscription de invoices, comissões ou cronogramas adicionada;
- nenhum acesso direto ao Firebase no componente;
- movimento reduzido preservado.

As métricas de Execução e Recebimentos desta etapa usam `item.received`, que já representa o quantitativo recebido/liquidado no domínio atual. Indicadores específicos de NF permanecem reservados para o snapshot agregado por UG, evitando abrir novas coleções realtime na Home.

## Bloco 19.5 — constelação operacional completa

Concluído:

- constelação extraída para `InicioConstellation`;
- cada estrela representa um empenho e abre diretamente o respectivo detalhe;
- estados regular, atenção, crítico, urgente, sem movimentação e encerrado possuem leitura visual própria;
- tamanho varia discretamente conforme o valor empenhado, sem transformar a Home em gráfico;
- até 60 empenhos ativos ficam em primeiro plano e até 12 encerrados formam uma camada histórica suave;
- empenhos críticos/atenção recebem prioridade no orçamento visual;
- estrelas do mesmo fornecedor são posicionadas por proximidade determinística;
- ao focar/hover uma estrela, empenhos do mesmo fornecedor permanecem destacados e recebem linhas de conexão temporárias;
- tooltip expandido mostra classe, status, motivo, fornecedor, valor, saldo e percentual recebido;
- legenda passa a exibir contagens por estado;
- dispositivos menores removem as linhas relacionais, preservando as estrelas e tooltips;
- `prefers-reduced-motion` preservado;
- nenhuma subscription de invoices, comissões ou cronogramas adicionada;
- nenhum acesso direto ao Firebase, Canvas ou WebGL.

A limitação de 72 estrelas de primeiro plano permanece intencional. Grandes históricos serão tratados pelo snapshot agregado/densidade visual, não por milhares de nós DOM simultâneos.

## Bloco 19.6 — identidade da UG e contexto do operador

Concluído:

- novo componente `InicioIdentityPanel` dedicado à identidade do ambiente;
- saudação muda conforme manhã/tarde/noite usando o horário local do navegador;
- organização, sigla, setor, workspace e UG vêm exclusivamente do `workspaceContext` já validado;
- workspace fundador é identificado pela origem segura `legacy-hgesm-bootstrap`;
- workspaces externos aparecem como ambiente setorial;
- nenhum e-mail operacional é exibido na Home;
- assinatura visual determinística `UNIT XXXXXXXX` é calculada localmente a partir da UG/workspace, sem criar novo dado;
- nó fundador recebe sinal visual discreto, sem alterar autorização ou privilégios;
- estado EMPROVEX ONLINE permanece visível;
- responsividade e `prefers-reduced-motion` preservados;
- nenhuma leitura, listener ou persistência adicional foi adicionada.

A identidade visual é contextual, não autorizadora: permissões continuam sendo determinadas exclusivamente pelo fluxo de autenticação, diretório da plataforma e Firestore Rules.

## Bloco 19.7 — atalhos e retomada de trabalho

Concluído:

- novo hook `useInicioWorkMemory` mantém a última área operacional relevante por workspace;
- a memória utiliza somente `sessionStorage`, nunca Firestore ou `localStorage`;
- a chave é separada por workspace + UG, evitando cruzamento entre unidades;
- a entrada automática inicial no Painel não sobrescreve uma retomada anterior da mesma sessão;
- a própria Home nunca é salva como destino de retomada;
- quando o último contexto é um empenho específico, o ID é preservado e reaberto diretamente;
- antes de reabrir um empenho memorizado, o sistema confirma que ele ainda existe;
- logout explícito limpa a memória efêmera da sessão;
- novo `InicioQuickActions` adiciona atalhos para Novo empenho, Cadastrar NF, Itens, Relatórios e Cronogramas;
- Novo empenho abre diretamente o modal de cadastro;
- Cadastrar NF abre diretamente a subaba de cadastro;
- dock permanece visualmente secundário ao sistema solar e à constelação;
- layout mobile usa uma faixa compacta rolável;
- `prefers-reduced-motion` permanece preservado;
- nenhuma leitura ou subscription Firestore adicional foi adicionada.

A retomada é uma conveniência de interface, não estado de negócio. Ela não altera autorização, sincronização, histórico, filtros persistentes ou dados operacionais.

## Bloco 19.8 — microinterações

Concluído:

- nova camada `InicioInteractionLayer` dedicada à resposta fina do cenário;
- retículo visual acompanha o cursor com interpolação via `requestAnimationFrame`;
- o retículo se expande discretamente quando o ponteiro encontra um elemento interativo;
- clique/pressionamento gera um pulso visual curto no ponto exato da interação;
- cursor nativo permanece visível e funcional;
- núcleo recebeu resposta visual de compressão e aceleração telemétrica no pressionamento;
- planetas, planeta de classes, luas e estrelas receberam resposta `:active` própria;
- ações rápidas e retomada receberam feedback de pressionamento;
- a camada é totalmente `pointer-events: none`, portanto nunca bloqueia controles;
- em dispositivos `pointer: coarse`, a camada de cursor é desativada;
- com `prefers-reduced-motion`, retículo/pulso são desativados e o comportamento funcional permanece intacto;
- nenhum áudio, vibração, Canvas, WebGL, Three.js ou nova dependência foi introduzido;
- nenhuma leitura ou subscription Firestore adicional foi adicionada.

As microinterações foram tratadas como feedback visual, não como requisito de navegação: mouse, toque e teclado continuam operando os mesmos controles sem depender dos efeitos.

## Bloco 19.9 — transições entre superfícies

Concluído:

- novo `OperationalSurfaceTransition` envolve a superfície operacional ativa;
- a troca funcional de `activeTab` continua imediata;
- a tela anterior não permanece montada durante a animação;
- não foi usado `AnimatePresence`, `mode="wait"` nem animação de saída;
- o perfil realtime muda imediatamente junto com a aba selecionada;
- a nova superfície recebe entrada curta com opacidade, deslocamento, escala e saturação;
- um feixe horizontal discreto reforça a continuidade entre áreas;
- um pequeno indicador contextual mostra a superfície que acabou de ser aberta;
- Início, Painel, Empenhos, Itens, Notas Fiscais, Relatórios, Itens do Empenho e Cronogramas usam o mesmo contrato visual;
- com `prefers-reduced-motion`, a animação funcional é reduzida a duração zero e os ornamentos CSS são desativados;
- nenhuma espera artificial, persistência ou nova subscription foi introduzida.

A transição é estritamente de apresentação. A lógica de navegação, carregamento condicional e plano realtime continuam sendo comandados pelo `activeTab` original.

## Próximas etapas

- 19.10: snapshot otimizado por UG;
- 19.11: performance/GPU/reduced motion;
- 19.12: responsividade;
- 19.13: polimento;
- 19.14: auditoria e testes externos.
