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

## Bloco 19.10 — snapshot econômico por UG

Concluído:

- o perfil realtime do `Início` foi reduzido para **zero coleções operacionais brutas**;
- a Home observa somente **1 documento**: `workspaces/{workspaceId}/settings/homeSnapshot`;
- Empenhos, Alertas, Notas Fiscais, Comissões e Cronogramas ficam totalmente desligados enquanto o operador permanece no Início;
- o snapshot é apenas dado derivado de apresentação e nunca substitui Empenhos/Alertas como fonte de verdade;
- `InicioView`, sistema orbital e constelação passaram a consumir exclusivamente `InicioOperationalSnapshot`;
- o documento agrega total de empenhos, valor total, alertas, recebimentos, execução, classes e até 72 estrelas;
- o publisher só funciona em **Empenhos** e **Notas Fiscais**, superfícies que já carregam Empenhos + Alertas para o trabalho normal;
- nenhuma coleção adicional é consultada para gerar o snapshot;
- antes da primeira publicação da sessão, no máximo uma leitura documental compara o `contentHash` remoto;
- se o conteúdo não mudou, nenhuma gravação é executada;
- alterações sucessivas são agrupadas por debounce de 900 ms;
- quando o operador veio do próprio Início, o hash já conhecido evita até a leitura de comparação;
- telemetria registra separadamente a leitura do snapshot e cada write efetivamente realizado;
- Rules dedicadas vinculam o snapshot ao workspace/UG, limitam a constelação a 72 estrelas e proíbem delete pelo runtime;
- a suíte multitenant testa isolamento entre workspaces, UG divergente, limite de estrelas e tentativa de delete;
- o Browser E2E comprova `data-active-realtime-collections="1"` no Início e confirma `data-snapshot="ready"`;
- a contagem **1** refere-se ao conteúdo operacional da Home; listeners independentes de autenticação, lifecycle e sessão permanecem ativos por segurança;
- snapshot ausente não provoca fallback caro: a Home mostra um aviso e continua sem abrir coleções brutas;
- o primeiro snapshot é criado automaticamente quando Empenhos ou Notas Fiscais estiverem em uso e os dados necessários já tiverem sido carregados.

### Regra econômica consolidada

```
Início
→ 0 coleções operacionais brutas
→ 1 documento realtime por workspace/UG
→ até 72 estrelas já agregadas
```

O objetivo do bloco é reduzir agressivamente leituras de Firestore na superfície mais visual do sistema. A Home não deve voltar a montar sua experiência a partir de centenas de documentos individuais.

## Bloco 19.11 — performance, GPU e reduced motion

Concluído:

- novo `useInicioPerformanceProfile` define os perfis `full`, `balanced` e `static`;
- `prefers-reduced-motion` força o perfil estático;
- ponteiro coarse, até 4 threads lógicas ou até 4 GB reportados ativam o perfil balanceado;
- o estado de visibilidade da aba é observado por `visibilitychange`;
- ao ocultar a aba, animações CSS contínuas são pausadas por `animation-play-state`;
- os loops de `requestAnimationFrame` do parallax global, retículo e núcleo deixaram de ser contínuos;
- esses RAFs agora iniciam somente sob demanda e encerram automaticamente quando a interpolação estabiliza;
- parallax fino e microinteração de cursor ficam restritos ao perfil `full`;
- o perfil `balanced` reduz partículas, nebulosas, sweeps, órbitas, filtros blur e `backdrop-filter`;
- sinais críticos permanecem visualmente distinguíveis mesmo quando animações são reduzidas;
- `will-change: transform` permanente foi removido da atmosfera e do núcleo para evitar reserva desnecessária de memória GPU;
- a cena recebeu `contain: paint style` para limitar invalidações de pintura;
- o perfil `static` remove movimentos decorativos preservando integralmente navegação, alertas e informações;
- nenhuma informação de hardware é persistida;
- nenhuma leitura, listener ou gravação Firestore adicional foi introduzida.

A política é adaptativa e exclusivamente visual: o mesmo snapshot operacional e as mesmas ações permanecem disponíveis em todos os perfis.

## Bloco 19.12 — responsividade completa

Concluído:

- a cena ganhou breakpoints explícitos para desktop intermediário, tablet, celular e telefone estreito;
- `100svh` passou a complementar a altura mínima em mobile para respeitar viewports dinâmicas;
- o sistema orbital deixou de usar `126vw` no celular e passou a escalar de forma controlada;
- planetas foram reposicionados para manter distância do dock inferior, especialmente Recebimentos e Painel;
- o sistema de classes reduz sua escala e oculta luas em telas pequenas sem remover o acesso ao Painel;
- a constelação mantém as estrelas visuais, mas esconde tooltips dependentes de hover em dispositivos touch;
- áreas de toque das estrelas foram ampliadas de forma invisível em ponteiro coarse;
- a legenda da constelação sobe para uma zona reservada acima do dock e remove a nota secundária de densidade no celular;
- o núcleo usa `clamp` para manter escala coerente em telas pequenas;
- o painel de identidade reduz tipografia, cards e assinatura conforme a largura, preservando organização e operador;
- telas baixas em landscape recebem um layout compacto dedicado;
- o dock de ações rápidas deixou de depender de rolagem horizontal e distribui cinco ações dentro da largura disponível;
- alvos touch do dock preservam altura mínima de 44 px;
- a sequência cinematográfica inicial foi compactada para aparelhos abaixo de 420 px;
- foram adicionadas âncoras E2E específicas para cena, identidade, órbitas, constelação e ações rápidas;
- o Browser E2E agora valida 360×800, 390×844, 768×1024 e 844×390;
- cada viewport testa ausência de overflow horizontal e confinamento da identidade/dock à cena;
- nenhuma leitura, listener, gravação Firestore, regra de negócio ou autenticação foi alterada.

## Bloco 19.13 — polimento visual final

Concluído:

- a cena recebeu tokens visuais compartilhados para linhas, vidro, texto, azul, âmbar e crítico;
- esses tokens passaram a ser reutilizados por identidade, dock, tooltips, núcleo, órbitas e constelação;
- foi criada a camada puramente decorativa `InicioSceneChrome`, com cantos técnicos, trilhos e escala lateral;
- o chrome é `aria-hidden`, não intercepta ponteiro e não possui efeitos de runtime;
- nenhuma animação, `@keyframes`, blur ou `backdrop-filter` foi adicionado ao chrome;
- a moldura interna da cena foi refinada e acompanha os raios responsivos dos breakpoints;
- o painel de identidade ganhou acabamento superior sutil nos cards e melhor coesão com a paleta central;
- ações rápidas ganharam acabamento de borda/luz consistente sem alterar navegação ou áreas touch;
- tooltips orbitais e da constelação passaram a compartilhar o mesmo material visual;
- o núcleo recebeu uma moldura técnica estática adicional e brilho mais controlado;
- a constelação consolidou cores semânticas de atenção/crítico nos tokens da cena;
- a legenda ganhou superfície discreta para leitura sem competir com o sistema orbital;
- o horizonte da atmosfera recebeu uma linha focal estática, sem custo contínuo de GPU;
- no mobile, o chrome reduz-se aos cantos para preservar espaço visual;
- o Browser E2E exige que a camada de chrome esteja presente nos quatro viewports responsivos;
- nenhuma leitura, listener, gravação Firestore, autenticação, regra ou lógica de negócio foi alterada.

O objetivo do bloco foi elevar a percepção de acabamento e consistência comercial sem transformar o Início em uma superfície mais pesada.

## Bloco 19.14 — auditoria, testes externos e fechamento

Concluído tecnicamente:

- criada auditoria final dedicada em `docs/block-19-final-audit.md`;
- o fechamento verifica a presença e registro de todos os guards dos blocos 19.1–19.13;
- o Painel permanece explicitamente como landing pós-login até homologação humana;
- o contrato econômico final permanece em zero coleções operacionais brutas + um `homeSnapshot`;
- Rules do snapshot, isolamento por workspace/UG e limite de 72 estrelas permanecem protegidos;
- a auditoria confirma perfis de performance, reduced motion e pausa por visibilidade;
- a suíte externa automatizada cobre dois workspaces setoriais independentes;
- isolamento de dados entre setores é validado em navegador/emulador;
- duas sessões simultâneas por setor e bloqueio da terceira sessão são validados;
- o E2E continua comprovando perfil realtime econômico no Início;
- os quatro viewports responsivos permanecem obrigatórios;
- WebGL, Three.js e Canvas permanecem ausentes da experiência Início;
- criado o `Block 19 Final Closure Gate` para exigir CI principal + Browser E2E verdes no mesmo commit;
- homologação humana real com as contas externas planejadas permanece como gate operacional pré-merge;
- a PR deve permanecer Draft até autorização explícita para homologação/merge/deploy.

### Estado do Bloco 19

**Desenvolvimento técnico encerrado; pronto para homologação humana.**

O fechamento técnico não muda automaticamente o landing para Início, não publica a branch na `main` e não realiza deploy.


## Refinamento visual pós-homologação — Home minimalista

A composição final foi simplificada para priorizar o mapa operacional e reduzir competição visual. A Home mantém apenas uma saudação contextual curta; cartões de organização/ambiente, status online, assinatura de unidade, texto descritivo do ambiente, instrução de cursor, retomada e dock de ações rápidas deixam de ser renderizados.

O núcleo central permanece interativo, porém sem imagem do logotipo. Núcleo e planetas passam a usar escala menor, liberando espaço negativo para órbitas, constelações e tooltips. A aba Início também utiliza shell escuro imersivo e largura integral da área operacional; as demais abas preservam o shell claro existente.

A navegação funcional permanece disponível pela Sidebar e, dentro da cena, exclusivamente pelas estrelas da constelação. Planetas, Classes e núcleo são informativos: hover/foco revela contexto, mas clique não troca de módulo. A memória de retomada deixa de ser montada pela página enquanto não houver interface correspondente, evitando lógica ociosa.

### Refinamento de interação — navegação exclusiva por estrelas

- planetas Alertas, Recebimentos, Execução, Painel e Classes não executam navegação;
- núcleo central não executa navegação;
- o planeta Classes mantém QR/CALI/PASA/FUNADOM somente em tooltip sob demanda;
- a camada de microinterações não trata elementos meramente focáveis como alvos clicáveis;
- o pulso de acionamento fica restrito a controles realmente navegáveis;
- estrelas continuam representando empenhos individuais;
- atenção/crítico exibem “Pendência identificada” no tooltip;
- clique em estrela abre diretamente o empenho específico na aba Empenhos.


### Refinamento de interação — zonas seguras para estrelas

- planetas e núcleo são tratados como zonas de exclusão geométrica da constelação;
- estrelas não podem permanecer atrás nem excessivamente próximas desses elementos;
- a posição real dos planetas/núcleo é medida no navegador, portanto a regra acompanha desktop, tablet, mobile e mudanças responsivas;
- estrelas em atenção recebem margem adicional de segurança;
- estrelas críticas recebem margem ainda maior para preservar hover, foco e clique quando houver pendência importante;
- o reposicionamento continua determinístico e preserva a proximidade por fornecedor sempre que possível;
- nenhuma leitura Firestore, listener de dados ou nova persistência é criada; a medição é exclusivamente de layout DOM.


### Refinamento visual — dinâmica orbital e deriva estelar

- estrelas deixam de apenas pulsar e passam a executar deriva espacial lenta e determinística de poucos pixels;
- cada estrela possui vetor e duração próprios derivados do ID, evitando movimento sincronizado/artificial;
- hover/foco pausa a animação da estrela para preservar a seleção do empenho;
- planetas passam a executar órbitas reais ao redor do núcleo em três raios distintos;
- Alertas e Painel compartilham a órbita externa em oposição de 180°;
- Recebimentos e Classes compartilham a órbita intermediária em oposição de 180°;
- Execução utiliza a órbita interna;
- os planetas foram reduzidos para aproximadamente metade do diâmetro anterior, favorecendo movimento e espaço visual;
- a rotação visual do conteúdo é compensada para que ícones e tooltips permaneçam legíveis durante a órbita;
- hover/foco pausa a órbita correspondente enquanto o operador consulta o tooltip;
- as três faixas orbitais são corredores de exclusão da constelação, garantindo que o movimento dos planetas não atravesse estrelas clicáveis;
- perfis balanced/static e prefers-reduced-motion continuam removendo movimento contínuo.


### Refinamento atmosférico — partículas em fluxo

- a Home recebe uma camada adicional de partículas decorativas inspirada na atmosfera cinematográfica do login;
- as partículas usam deslocamentos lentos em profundidade, com tamanhos, atrasos e velocidades variados;
- são visualmente distintas das estrelas de empenho: menores, desfocadas, não interativas e posicionadas atrás da constelação;
- não usam JavaScript contínuo nem RAF; o movimento é exclusivamente CSS;
- mobile reduz a quantidade renderizada;
- perfil balanced reduz densidade, brilho e velocidade;
- perfil static e prefers-reduced-motion removem totalmente o movimento dessas partículas;
- nenhuma leitura Firestore, persistência ou dependência adicional foi introduzida.
