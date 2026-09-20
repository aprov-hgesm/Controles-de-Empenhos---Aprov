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

## Próximas etapas

- 19.3: núcleo/logo interativo;
- 19.3: núcleo/logo interativo;
- 19.4: órbitas e planetas adicionais;
- 19.5: constelação operacional completa;
- 19.6: identidade/UG e contexto do operador;
- 19.7: atalhos e retomada de trabalho;
- 19.8: microinterações;
- 19.9: transições entre superfícies;
- 19.10: snapshot otimizado por UG;
- 19.11: performance/GPU/reduced motion;
- 19.12: responsividade;
- 19.13: polimento;
- 19.14: auditoria e testes externos.
