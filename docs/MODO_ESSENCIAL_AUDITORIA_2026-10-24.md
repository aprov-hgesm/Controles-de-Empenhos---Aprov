# EMPROVEX — MODO ESSENCIAL — AUDITORIA DE DESEMPENHO VISUAL (BASE HISTÓRICA DE 24/10/2026)

> **Arquivo de evidência, não especificação vigente.** Transcrição integral da auditoria estática de 24/10/2026. Na definição final do projeto, o modo é **por sessão** com `sessionStorage` (não `localStorage`) e as abas **Início** do EMPROVEX e da Central **não são exibidas nem montadas** no Essencial (não se limitam a ficar estáticas). A Central 3D permanece idêntica nos dois modos. Em caso de conflito, prevalece [MODO_ESSENCIAL_MEMORIAL_OFICIAL.md](./MODO_ESSENCIAL_MEMORIAL_OFICIAL.md), seção 0.
>
> A análise foi feita em `main@47323e3b8583e68c8344336a265ddd7d63563c36` e seus números não devem ser interpretados como benchmark do código atual.

---

# EMPROVEX — Auditoria técnica de desempenho visual e responsividade em computadores modestos

**Data:** 24/10/2026  
**Repositório:** [aprov-hgesm/Controles-de-Empenhos---Aprov](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov)  
**Escopo auditado:** `main@47323e3b8583e68c8344336a265ddd7d63563c36`  
**Natureza:** auditoria estática orientada a desempenho, inventário da árvore de arquivos, inspeção de componentes-chave/CSS, documentação de Performance R3 e build CI concluído. Não constitui medição de GPU/CPU em hardware real, nem execução de stress/perfil em navegador autenticado.  
**Regra inviolável:** preservar aparência, controles, precisão, interações e comportamento do visualizador 3D da Central de Depósitos, sem degradá-lo ou substituí-lo por 2D. Não tocar em produção, dados, Firestore Rules nem motores transacionais nesta etapa.

## Sumário executivo

**Classificação:** oportunidade alta de evolução, sem indicação de falha crítica de integridade ou de reprovação do CI. A melhor estratégia é **dois modos de apresentação sobre uma aplicação única**, com perfil Essencial global persistido apenas no dispositivo, sem leituras/escritas extras no Firestore. O modo Essencial deve ter visual de alto padrão baseado em tipografia, composição, hierarquia, contraste, microinterações reativas e efeitos estáticos; não depende de animações contínuas ou desfoques enormes.

A aplicação tem medidas prévias de desempenho relevantes que devem ser preservadas, especialmente separação de módulos por import dinâmico, plano de assinaturas Firestore por aba, cache de marca, perfil de desempenho do Início, pausa de Canvas quando a aba está oculta, alguns componentes memoizados na Central 3D e melhorias de derivação de Empenhos/NF. Não refazer o que já existe.

### Evidências quantitativas reproduzidas de fontes oficiais

- **HEAD:** `47323e3b8583e68c8344336a265ddd7d63563c36`.
- **Inventário Git:** 1.202 entradas na árvore recursiva (inclui diretórios). `app/globals.css`: aproximadamente 118,7 kB de fonte, 4.708 linhas; `public/emprovex-logo.png`: 1.132.701 bytes.
- **Amostra de 14 CSS auditados (não todo o CSS):** 101 definições `@keyframes`, 166 declarações `animation`, 92 ocorrências de `infinite`, 50 declarações `backdrop-filter`, 84 declarações `filter`, 190 declarações `box-shadow` e 52 referências a `prefers-reduced-motion`. **Essas contagens são de texto-fonte, não de efeitos executando simultaneamente, nem medições de GPU.**
- **CI exato do HEAD:** [Application CI 40063891651](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40063891651) = PASS, inclusive build de produção e verificação de desempenho/GPU existente; [Core Protection 40063891613](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40063891613) = PASS.
- **First Load JS no build do HEAD:** `/` 353 kB, `/admin` 350 kB, `/central-depositos` 107 kB, `/operador-movel/inventario` 271 kB, `/operador-movel/saida` 269 kB, partilhado 104 kB. São estimativas do Next.js para o primeiro carregamento, NÃO tamanho total de todos os chunks após navegação.
- **Baseline 01/10/2026:** `/` 460 kB, `/admin` 326 kB, rota histórica `/adm-deposito` 579 kB; comparar `/adm-deposito` de 01/10 com `/central-depositos` atual exige cuidado por reestruturação de rotas e carregamento dinâmico. O `/` reduziu aproximadamente 23% (460→353 kB) na métrica registrada.

## Achados priorizados

Cada item abaixo descreve evidência, ação recomendada e limite de segurança. Severidade de desempenho indica potencial, não valor medido.

### P0 — intervenções mais promissoras, de baixo risco funcional

**DV-01 | Perfil único de desempenho visual (alto impacto; risco baixo/moderado).** Atualmente [`useInicioPerformanceProfile.ts`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/features/inicio/hooks/useInicioPerformanceProfile.ts) só resolve `full`, `balanced` e `static` no Início; heurística usa `hardwareConcurrency`, `deviceMemory`, pointer coarse e redução de movimento; não é um seletor global persistido por dispositivo. Introduzir `premium | essencial` na apresentação com estado/contexto único, leitura de `localStorage`, respeito a `prefers-reduced-motion`, e preferência individual por dispositivo. Não depender de dados, permissões ou Firestore. Não confiar cegamente em detecção de hardware, pois campos podem faltar ou não corresponder à capacidade real.

**DV-02 | Escopo CSS Essencial para áreas decorativas (alto; baixo).** Amostra com elevado número de animações CSS, filtros e blur. Criar tokens de superfície, iluminação e animação. Reduzir efeitos contínuos e `backdrop-filter` em painel, Início, login, admin, menus e transições, mantendo bordas e contraste. **Nunca aplicar `* {animation:none!important}` global**: poderia interferir na Central 3D, microestados, indicadores e funcionalidades. Aplicar seletores estritamente nos componentes decorativos do modo Essencial.

**DV-03 | Início orbital como principal alvo fora da Central 3D (alto; baixo/moderado).** [`InicioCore.module.css`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/features/inicio/components/InicioCore.module.css), [`InicioOrbitSystem.module.css`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/features/inicio/components/InicioOrbitSystem.module.css) e [`InicioConstellation.module.css`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/features/inicio/components/InicioConstellation.module.css) definem múltiplos movimentos orbitais, brilhos, pulsações e sombras. Manter toda a geometria informacional e estética no Essencial, porém estática ou quase estática; ativar animação pontual no hover/foco e na resposta de uma ação. Preservar estados de alerta e legibilidade.

**DV-04 | Paralisar cálculos visuais de alta frequência no Essencial (alto; moderado).** [`InicioView.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/features/inicio/components/InicioView.tsx) e [`InicioCore.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/features/inicio/components/InicioCore.tsx) usam ciclos `requestAnimationFrame` para parallax. Já existe pausa por visibilidade/perfil; estender ao modo Essencial e confirmar que não existe loop ativo sem necessidade. Não afetar o renderizador 3D da Central.

**DV-05 | Thinking Orb estático no Essencial, original no Premium (alto; baixo).** [`EmprovexThinkingOrb.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/features/visual-orbs/components/EmprovexThinkingOrb.tsx) já oferece modo `static`, `balanced` (~20 FPS) e `full` (~45 FPS), limita DPR a 2 e interrompe o loop fora de foco. Usar essas opções existentes no controle central; não recriar o motor. Substituição estática deve manter a marca reconhecível e não suprimir sinalização de carregamento.

**DV-06 | Transições por opacidade curta e sem filtro (alto; baixo).** [`OperationalSurfaceTransition.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/components/layout/OperationalSurfaceTransition.tsx#L30-L69) hoje aplica blur/saturação, escala e translado no Premium; respeita `prefers-reduced-motion`. No Essencial, evitar animar `filter`, eliminar entrada cinematográfica e usar somente opacidade curta (ou transição instantânea). Preservar nomes de superfícies, navegação e acessibilidade.

**DV-07 | Border Beam e linha de navegação estacionários (médio/alto; baixo).** [`OperationalNavigationBeam.module.css`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/components/layout/OperationalNavigationBeam.module.css) tem borda com máscara/conic-gradient em rotação de 24s, e [`EmprovexBorderBeam.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/components/visual/EmprovexBorderBeam.tsx) já dispõe de variante `static`, `IntersectionObserver` e `visibilitychange`. Reutilizar variante estática e trocar realce contínuo por borda monocromática delicada, mantendo identidade.

**DV-08 | Redução coordenada dos `backdrop-filter` (alto em certas GPUs; baixo/moderado).** [`app/globals.css`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/app/globals.css) possui dezenas de `backdrop-filter`, além dos CSS da cena orbital. Em superfícies translúcidas sobre animações, testar troca por cor sólida/semitransparente pré-combinada e sombras suaves estáticas. Manter aparência com contraste, outline e separação entre planos.

### P1 — oportunidades relevantes de CPU, carregamento e memória

**DV-09 | Dashboard: eliminar múltiplos scans da mesma lista (alto com massas de dados; risco moderado).** [`DashboardView.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/features/dashboard/components/DashboardView.tsx) contém vários `filter`/`reduce` de `empenhos`, inclusive dentro de cartões por classificação e lista de renderização, sem `useMemo` no componente. Derivar indicadores por empenho e por classificação em passagem única memoizada, filtrando depois com índices; confirmar resultados com testes financeiros antes/depois. **Não alterar cálculos, valores, filtros ou dados financeiros**.

**DV-10 | Suspensão do trabalho de superfícies inativas (alto potencial, risco moderado).** [`app/page.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/app/page.tsx#L118-L122) mantém `hasOpenedOperationalSurface=true` após primeira visita; a partir daí o `OperationalWorkspace` pode permanecer montado mesmo ao voltar para Início. [`OperationalWorkspace.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/features/operational/components/OperationalWorkspace.tsx) chama hooks de ações de vários domínios. Medir custo de renders/efeitos inativos; se confirmado, isolar trabalho pesado por aba **sem perder formulários, seleções, sessões ou drafts**.

**DV-11 | Carregamento condicional do Início depois da autenticação (médio/alto; moderado).** [`app/page.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/app/page.tsx#L3-L30) importa `InicioView` estaticamente mas usa `lazy()` para o `OperationalWorkspace`. Considerar `dynamic`/`lazy` para cena orbital somente após autenticação, com prefetch sensível e fallback curto. Testar também o tempo de entrada autenticada: chunk extra pode deslocar a espera, não necessariamente reduzi-la.

**DV-12 | Listas extensas: renderização por janela (alto apenas em grande volume; moderado).** Inspecionar volumes reais antes de virtualizar Empenhos, cronogramas, notas, relatórios e estoque. Para centenas de cards ou linhas, renderizar a janela visível com overscan; garantir teclado, leitores de tela, impressão, pesquisa, seleção, exportação e fluxo de foco. Para listas pequenas, não adicionar dependência/complexidade.

**DV-13 | Busca e filtros: manter input responsivo (médio/alto; baixo/moderado).** [`EmpenhosView.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/features/empenhos/components/EmpenhosView.tsx) e [`NotasFiscaisView.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/features/notas-fiscais/components/NotasFiscaisView.tsx) já usam `useDeferredValue` e memoização; preservar. Aplicar a abordagem onde ausente, a começar por buscas/seletores do dashboard se o React Profiler confirmar custo. Não atrasar campos de formulário transacional.

**DV-14 | Componentes pesados da administração (médio/alto; moderado).** `/admin` apresenta 350 kB First Load JS. [`PlatformAdminView.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/components/admin/PlatformAdminView.tsx), [`AdminWorldHomePanel.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/components/admin/AdminWorldHomePanel.tsx) e seus CSS fazem composição visual rica. Lazy-load de subáreas administrativas e simplificação de animações em modo Essencial, preservando painéis e métricas. Validar não disparar novas consultas quando se muda apenas o modo visual.

**DV-15 | Limite da Central 3D (protegida).** [`WarehouseIsometricPreview.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/features/warehouse/components/WarehouseIsometricPreview.tsx) implementa cena isométrica interativa em SVG com câmera e rótulos, e [`WarehouseLandingOperational.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/features/warehouse/components/WarehouseLandingOperational.tsx) utiliza `memo()` e diversas derivações memoizadas. Manter cena, labels, detalhes, comportamento de zoom/pan, padrões de desenho, dimensões e qualidade idênticos nos dois modos. É aceitável suspender **apenas efeitos decorativos externos** quando o visualizador abrir. Possíveis otimizações internas invisíveis exigem autorização posterior e comparação visual idêntica.

### P2 — ajustes condicionados a evidência

**DV-16 | Fontes e pesos (ganho dependente do navegador).** [`app/layout.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/app/layout.tsx) configura Inter, JetBrains Mono e Montserrat, com Montserrat 600–900. Medir requests, pesos efetivamente usados e carregamento inicial; somente então reduzir variantes e evitar fontes não utilizadas por rota. Preservar a identidade tipográfica.

**DV-17 | Bibliotecas de animação (ganho potencial; exigir verificação).** [`package.json`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/package.json) declara `framer-motion` e `motion`; componentes atuais auditados importam `motion/react`. Verificar se `framer-motion` possui consumidores legítimos e se há duplicação efetiva no bundle antes de remover algo. Nunca retirar pacote com base somente em nomes similares.

**DV-18 | Logo institucional, PWA e payload de mídia (ganho condicional).** `public/emprovex-logo.png` tem aproximadamente 1,13 MB, mas é insumo do endpoint de ícones de instalação, com cache e derivação server-side; **não há prova de download integral desse arquivo em cada abertura**. Priorizar otimização se Network mostrar transferência significativa; gerar tamanhos apropriados sem perda de qualidade perceptível, preservando PWA e marca.

**DV-19 | Script externo de identidade (ganho condicional; risco funcional).** [`app/layout.tsx`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/app/layout.tsx#L39-L48) inclui o Google Identity Services após interatividade. Avaliar lazy load específico de autenticação apenas com rastreio de dependências e testes de login Google; não modificar autenticação durante implementação de modo visual.

**DV-20 | Orçamento de desempenho do CI (médio; baixo).** [`ops/performance-r3-budgets.json`](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/main/ops/performance-r3-budgets.json) indica que o guard de bundle ainda não foi ligado automaticamente ao Application CI. Já existe guard gráfico e build de produção. Após estabelecer baseline atual, adicionar **somente** verificação leve de regressão de JS/CSS em CI ou revisão de PR, com tolerâncias para evitar falsos positivos. Não criar pipeline paralelo pesado.

### Achados positivos que NÃO devem ser reimplementados

- `useInicioPerformanceProfile`: heurística já existente, redução de movimento e `visibilitychange`.
- `EmprovexThinkingOrb`: modo estático, modos limitados a ~20/~45 FPS, pause offscreen e DPR controlado.
- `EmprovexBorderBeam`: pausa quando fora da tela e tipo `static`.
- `OperationalWorkspace`: dynamic imports para oito/nove superfícies principais.
- `useOperationalRealtimeCollections`: plano por aba; Início tem listeners de coleções principais desligados via `operationalSubscriptionPlan`.
- `usePlatformBranding`: sessão com cache da logo e sem listener realtime contínuo.
- `EmpenhosView` e `NotasFiscaisView`: memoização, pré-agregação e busca deferida já implementadas pela Performance R3.
- `WarehouseLandingOperational`: memoização do renderizador isométrico; dados e câmera do 3D devem permanecer intactos.
- `InicioAtmosphere`: alguns arrays decorativos de poeira/estrelas/partículas já estão explicitamente desabilitados (`false &&`); **não contabilizá-los como partículas animadas em execução**.

## Arquitetura recomendada: somente uma aplicação

1. Preferência local `emprovex:visual-mode:v1 = premium | essential`, com acesso acessível em Configurações/Aparência. Persistir por navegador/dispositivo, sem Firestore.
2. Tema visual via atributo no elemento-raiz ou contexto React com tokens e alvos decorativos selecionados, **excetuando todos os subcomponentes da Central de Depósitos 3D**.
3. Premium mantém comportamento atual; Essencial mantém mesma hierarquia, controles, dados e identidade, muda apenas complexidade de efeitos decorativos.
4. Respeitar `prefers-reduced-motion` nos dois modos. Heurística de hardware apenas sugere a opção Essencial; nunca desabilitar 3D automaticamente.
5. Todos os hooks/motores financeiros, Warehouse, autenticação, IAM, Firestore Rules e APIs permanecem compartilhados, sem bifurcações por modo.
6. Não executar nenhuma leitura adicional do Firestore para detectar ou registrar modo visual.
7. Hidratação inicial cuidadosa, evitando flash de tema e conversões repetidas do modo.

## Padrão de estética premium no Essencial

- Fundo azul-negro/grafite sólido com degradê estático discreto, sem brilho fullscreen em movimento.
- Cartões com contraste controlado, divisores finos, cantos coerentes, sombras estáticas curtas; dispensar vidro desfocado como principal elemento visual.
- Tipografia forte e legível, espaço em branco generoso, números tabulares, ícones consistentes.
- Microinterações rápidas somente após ação do usuário, preferencialmente `opacity` e `transform` e sem `filter: blur()` animado; foco/hover acessíveis.
- Indicadores operacionais sempre presentes; nenhum efeito de performance pode camuflar erro, alerta, processamento, confirmação ou sessão inválida.
- Tela Início continua memorável como composição orbital estática, com realces seletivos por foco e hover.
- Central de Depósitos 3D idêntica ao Premium.

## Certificação enxuta proposta

**Baseline necessário:** dois computadores ou perfis reais: (A) PC antigo com CPU dual/quad-core, 4–8 GB RAM, GPU integrada e navegador atualizado suportado; (B) máquina moderna. Mesmas credenciais de teste autorizadas, massa de dados, resolução e navegador. Não abrir dados sensíveis nas capturas.

**Cenários:** (1) login + primeira abertura; (2) Início parado 60s; (3) navegação Início→Painel→Empenhos→NF→Início; (4) digitação de busca com muitos empenhos; (5) abrir 100–500 itens e rolar se houver massa real; (6) carregar administração; (7) abrir Central de Depósitos 3D, zoom/pan, mudar câmera e labels; (8) aba oculta/visível; (9) PWA instalado quando pertinente.

**Métricas:** processador, GPU (quando disponível), memória, long tasks, tempo de bloqueio da thread principal, quadros acima de 50 ms, duração de interações, First Load JS, requests, LCP/INP/CLS e React Profiler. Usar medianas e p75 em pelo menos 5 passagens por cenário, comparando Premium vs Essencial na mesma máquina. Nunca inventar % de ganho.

**Critérios de aceitação:** (i) cenário 3D passa por comparação visual e funcional sem regressão nos dois modos; (ii) mesmos valores de saldos, NF, empenhos, alertas e permissões; (iii) nenhum aumento de leitura Firestore decorrente de alternância visual; (iv) runtime menos custoso/mais responsivo no PC antigo em cenários representativos; (v) não degradar significativamente a máquina moderna; (vi) CI de proteção e build aprovados. Se os ganhos não forem medidos, não declarar certificação de desempenho.

## Sequência de implementação, responsáveis e dependências

- **Etapa A — Coordenador / UI:** criar seletor central, preferência local e contrato de exclusão do 3D. Não tocar no backend.
- **Etapa B — Worker Visual:** simplificar Início, orb, beams, transições, blur e superfícies, modo Essencial estático de alto padrão; preservar Premium.
- **Etapa C — Worker Performance:** otimizar o Dashboard com índices e memoização; medir superfícies inativas e listas; aplicar outras melhorias apenas após confirmação de gargalo.
- **Etapa D — Worker QA:** comparar nos dois equipamentos/perfis, capturar métricas reais, regressão visual do 3D, smoke operacional, testes de preferência, reduced-motion, build e gates de segurança existentes.
- **Etapa E — Integração:** integrar em branch de trabalho, testar localhost e Preview apenas se apropriado; **sem push direto na main nem publicação na Vercel/produção sem autorização específica**.

## Estado / handoff

**Onde estamos:** diagnóstico estático realizado no HEAD `47323e3b...`, build e Core Protection do mesmo HEAD já PASS.  
**O que estamos fazendo:** planejamento técnico de modo Essencial premium, otimização de CPU/GPU/JS com proteção do 3D.  
**Quem está fazendo:** auditoria presente; implementação não iniciada nesta tarefa.  
**Próximo passo:** implementar em branch isolada DV-01 a DV-08; depois medir DV-09 a DV-20 e realizar QA comparativo.  
**Quem o fará:** equipe/Workers do repositório quando essa fase for autorizada.
