# EMPROVEX — MODO ESSENCIAL / MODO NORMAL — MEMORIAL OFICIAL R1

## ATUALIZAÇÃO CANÔNICA — IMPLEMENTAÇÃO, E2E E NOVA FRENTE RAM (29/10/2026)

**Status vigente substitui exclusivamente os checkpoints antigos de "somente documentação" nesta página.** Implementação em [PR #411 DRAFT](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/411) sobre branch `feat/visual-mode-r1-session-navigation`. Nenhum merge ou deploy autorizado.

| Frente | Verificação atual |
| --- | --- |
| Normal/Essencial por sessão | Implementado em `sessionStorage` com selector, rotas de Painel e Central, sem alterar banco por modo |
| R2-A/B | Lazy de painéis/backup, acabamento visual econômico, agregados financeiros memoizados e tabela progressiva; totais/filtros preservam o conjunto completo |
| R2-C | Segmentação inicial segura; a decomposição dos hooks transacionais **não** está concluída |
| Recuperação automática | Boundary React + falha de chunk detectável retornam ao Normal, sem logout/reload, bloqueiam Essencial até fim da sessão; **não mascarar cobrança ou permissão** |
| Regressões e segurança | 5/5 jobs da matriz #40951319841 PASS; 11/11 Playwright autenticado no emulador (2 de fallback, 9 fluxos operacionais). Contratos críticos de TR, Drive, NF/NS, relatórios, 3D e Warehouse PASS no âmbito dos testes automatizados, mas **não houve transação externa real com Drive/InfinitePay** |
| Windows localhost | CI #40956724787: 5/5 checagens sintáticas/segurança PASS, **smoke Windows do emulador Warehouse FAIL por timeout de 8081**; a prévia Windows não está certificada |
| RAM real do EMPROVEX | **Não medida de modo isolado.** Capturas do Windows total: Essencial 6,8/7,8 GB e Normal 7,6/7,8 GB; delta global 0,8 GB, não atribuído à aplicação; CPU capturada 5%/81% sem controle de tempo |

### /goal — próximo ciclo: memória RAM com paridade funcional integral

**Achados de código, sem atribuição quantitativa:** listeners onSnapshot são desligados ao trocar abas, mas arrays operacionais do React mantêm registros; o `OperationalWorkspace` e seus hooks de ações permanecem montados depois da primeira visita a qualquer aba transacional; o Painel Essencial limita nós DOM mas não libera os dados usados em totais/relatórios; 3D SVG tem custo proporcional às estruturas, porém **é intangível**; `pdfToolkit` importa bibliotecas somente ao emitir PDFs.

**Plano de execução autorizado para desenvolvimento:**
1. Medir JS heap/RSS, nós DOM e retenção após visitas a Painel, Empenhos, NF, Relatórios e 3D em ambos os modos com dataset/conta iguais, sem dados de produção. Registrar baseline e processos Node/Java separadamente. Não projetar economia de MB sem prova.
2. Priorizar alocação temporária e caches de **leitura** que não causem perda; definir política explícita de retenção e reidratação antes de descarte. Não desligar em lote estados `invoices`/históricos: Relatórios pode depender deles mesmo sem listener em `relatorios`. Preservar rascunho digitado, arquivo PDF selecionado por NE, operações assíncronas e identidade UID/UG.
3. Garantir testes de equivalência monetária, listas/consultas completas, geração de TR/PDF, Drive, cronograma, backup, concorrência, saída Warehouse e 3D intacto; mecanismos de licença, aceite e Firestore Rules não podem sofrer mudanças.
4. Aplicar apenas melhorias isoladas comprovadas com ganhos medidos e testes de contrato + E2E em emulador; manter em PR DRAFT sem deploy até aprovação do fundador.

**Controles explícitos:** não confundir `npm run dev`/emuladores no Windows 8 GB com memória de um navegador de cliente em produção; não fazer `setInvoices([])` simplesmente por sair da aba de NF; não remover hooks de criação/termo/upload com operações em andamento; não reduzir detalhes/FPS/resolução do 3D. GOV-SIMP-01 proporcional a risco.

**Evidências:** [E2E completo #40951319841](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40951319841), [Windows CI incompleto #40956724787](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40956724787), [memorial mãe](./EMPROVEX_MEMORIAL_OFICIAL.md). As seções históricas abaixo preservam as decisões anteriores, mas não são o checkpoint atual de execução.

---

> **Registro canônico da frente de desempenho visual.** Criado em **29/10/2026** a partir da auditoria e do plano executivo integrais de 24/10/2026. Este memorial registra decisões de projeto, não certificação de implementação, benchmark ou publicação.
>
> **Estado na criação:** planejamento aprovado; implementação específica, testes comparativos e deploy do Modo Essencial **não comprovados**. Criar este memorial **não altera** a aplicação, a Vercel, o banco, o Firebase ou as Rules. Nenhuma atualização de produção está autorizada por este registro.
>
> **Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`.
> **Documento-mãe:** [EMPROVEX_MEMORIAL_OFICIAL.md](./EMPROVEX_MEMORIAL_OFICIAL.md).
> **Evidência histórica completa:** [MODO_ESSENCIAL_AUDITORIA_2026-10-24.md](./MODO_ESSENCIAL_AUDITORIA_2026-10-24.md).

## 0. Quadro de decisões definitivas (precedência obrigatória)

Este quadro prevalece sobre sugestões anteriores ou contradições no material histórico auditado, que foi preservado para rastreabilidade.

| Tema | Contrato obrigatório |
|---|---|
| Produto | **Uma única aplicação**, dois modos de apresentação; sem duplicar dados, autenticação, APIs ou regras de acesso |
| Nomes | **Normal (Premium)** — experiência visual completa; **Essencial** — desempenho visual otimizado. Para implementação, contrato interno proposto `premium \| essencial`; o rótulo de interface pode ser `Normal` |
| Escolha | **Por sessão/aba do navegador**, nunca por workspace/UG, usuário, setor ou configuração compartilhada |
| Persistência | `sessionStorage`, chave versionada `emprovex:visual-mode:v1`; **não usar `localStorage`**, Firestore, cookie ou configuração remota |
| Independência | Dois computadores na mesma UG podem usar modos distintos, sem influenciar um ao outro |
| Login/logout | Limpar modo no logout, revogação ou troca de identidade; modo padrão preserva experiência Normal até escolha explícita |
| Início EMPROVEX | **Ocultar no Essencial**, não importar/montar seus componentes exclusivos; entrar no **Painel** |
| Início Central | **Ocultar no Essencial**, não importar/montar a landing; entrar em **Controle de Materiais** quando autorizado |
| Central 3D | **Preservação absoluta**: geometria, cenas, câmeras, rótulos, materiais, controles, inspeções, zoom/pan, FPS/resolução e comportamento equivalentes em ambos |
| Estética | Essencial continua sofisticado, institucional e legível; remover custo decorativo fora do 3D sem empobrecer o produto |
| Integridade | Nenhuma alteração decorrente do modo em saldos, NF, NS, empenhos, cobrança, auditoria, IAM, Rules, autorização, APIs ou Firestore |
| Governança | **GOV-SIMP-01**; branches isoladas/PR de integração, testes proporcionais a risco, aprovação expressa do Fundador antes de merge/publicação |

### 0.1 Precedência documental e atualização de base

1. As decisões posteriores de **24/10/2026** (sessão em `sessionStorage`, ocultação integral dos dois Inícios e intangibilidade do 3D) **substituem** a sugestão preliminar de `localStorage` ou de manter um Início meramente estático no Essencial apresentada na auditoria inicial.
2. O texto do plano executivo abaixo é preservado integralmente como **especificação aprovada**, incluindo a matriz **VF-01 a VF-16**, fases, Workers, riscos e critérios de GO/NO-GO. Referências de arquivos e métricas são uma fotografia da base `main@47323e3b8583e68c8344336a265ddd7d63563c36` de 24/10, **não** uma prova de estado do código em 29/10.
3. Em 28/10, o Início Normal recebeu uma implementação mais leve do núcleo/logotipo (PR [#404](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/404)); o executor deve **rever nomes, imports e cenas atuais** antes de seguir instruções históricas referentes ao Orb anterior. A simplificação desse Início Normal **não substitui** o Modo Essencial.
4. O PR [#371](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/371) é citado no planejamento como **pendente em 24/10**; esse é um registro histórico, não uma afirmação sobre o estado atual. Consultar `main`, PRs e releases atuais antes de iniciar.
5. Nenhuma melhoria de CPU/GPU, redução de bundle, equivalência visual ou status de publicação pode ser declarada PASS apenas por existir este memorial. Mensurar e certificar sobre o commit de implementação.

### 0.2 Progresso e continuidade — 29/10/2026

- **Concluídos documentalmente:** auditoria estática inicial, decisões definitivas, arquitetura proposta, plano executivo, atribuição de frentes e critérios de aceite.
- **Não comprovados:** implementação do seletor global, proteção de rota nos dois Inícios, não montagem dos componentes no Essencial, ajustes de CSS fora do 3D, benchmark real em computadores modestos, certificação da R1 e deploy.
- **Próxima ação de execução:** trabalhar a partir de HEAD estável atual em branch isolada; implementar contrato de preferência, navegação e supressão real das landings; aplicar apenas melhorias visuais com escopo 3D protegido; medir; testar; compor em PR; aguardar autorização para publicar.
- **Ponto de retomada:** esta seção 0 prevalece para decisões e status; o Anexo A abaixo contém o plano integral; a auditoria integral está no arquivo de evidências vinculado.
- **Política de escrita:** futuras implementações devem acrescentar abaixo uma seção datada de mudanças/PRs/commits/CI e estado de release, sem apagar decisões nem transformar intenção em resultado.

---

## Anexo A — Plano executivo aprovado em 24/10/2026 (texto integral)


**Data:** 24 de outubro de 2026  
**Estado:** Planejamento aprovado como proposta técnica; implementação e certificação pendentes  
**Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`  
**Base auditada:** `main@47323e3b8583e68c8344336a265ddd7d63563c36`  
**Integração concorrente:** PR #371 (`feat/mobile-outbound-unified-scan-r2`) aberto e ainda não certificado para publicação na ocasião da conferência.  
**Diretriz operacional:** GOV-SIMP-01 — máxima desburocratização com segurança essencial.  
**Responsável por aprovação visual e publicação:** Fundador.  
**Produção:** nenhuma alteração autorizada por este documento.

## 1. Sumário executivo

Implementar dois modos de experiência visual, **Premium** e **Essencial**, usando o mesmo sistema, as mesmas funções e os mesmos dados. O modo será configurado **por sessão de navegador**, não por workspace, setor, conta de usuário ou configuração remota. Dois computadores autenticados no mesmo setor poderão usar modos distintos simultaneamente. A escolha não cria leituras/escritas no Firestore.

No **Essencial**, as abas puramente visuais **Início do EMPROVEX** e **Início da Central de Depósitos** deixam de ser exibidas e seus componentes exclusivos não devem ser carregados nem montados. O sistema abrirá diretamente no **Painel** e, na Central, no **Controle de Materiais**. O módulo **Meus Depósitos**, sua visualização 3D, controles e funções continuam **integralmente iguais ao Premium**. A economia incidirá nos efeitos decorativos, tarefas de renderização repetitivas e carregamento de módulos não utilizados. A estética continuará premium, com acabamento estático e preciso, alto contraste e hierarquia visual excelente.

**Definição de sucesso:** experiência mais responsiva e estável em equipamentos modestos, mantendo paridade funcional, integridade dos dados, ausência de regressão do 3D e nenhuma alteração de produção antes de certificação e aprovação humana.

## 2. Decisões irrenunciáveis

1. **Uma aplicação, uma base funcional.** Não bifurcar domínio, autenticação, motor transacional, APIs ou Firestore Rules.
2. **Dois modos de UI, não dois produtos.** O modo controla somente apresentação/carregamento de efeitos não essenciais.
3. **Escopo estrito da preferência:** aba/sessão do navegador; preferência independente entre computadores, navegadores e sessões. `sessionStorage`, sem gravação no workspace, Firestore, conta ou cookie servidor.
4. **Logout e mudança de identidade:** eliminar a escolha da sessão e reaplicar a decisão inicial na próxima autenticação. Revogação de sessão também limpa estado de apresentação; não persistir vínculo UID↔modo.
5. **Início EMPROVEX:** oculto no Essencial; abertura lógica no `painel`; impedir carregamento desnecessário de `InicioView` e seus componentes exclusivos.
6. **Início Central:** oculto no Essencial; entrada canônica no `/central-depositos/controle-de-itens` (se o perfil possuir acesso); links diretos ao `/central-depositos` deverão resolver para o destino autorizado.
7. **Visão 3D INTACTA:** `Meus Depósitos` (`/central-depositos/meus-depositos`) e demais contextos 3D ficam com os **mesmos componentes, visual, geometria, detalhe, câmeras, controles, labels, interações e fontes de dados** em ambos os modos. Nenhum downgrade 2D, LOD simplificado, corte de detalhes ou queda imposta de FPS/resolução.
8. **Dados e proteção invariantes:** não mexer em IAM, estoque, históricos, assinaturas, Rules, faturamento, autorização, trilhas de auditoria e motores de domínio por conta do visual.
9. **Sem hard reset ao alternar modo:** manter página operacional e campos preenchidos quando viável; quando a aba atual for uma das duas telas de Início removidas, direcionar para a tela operacional canônica.
10. **Sem atualização de produção:** branch isolada, PR DRAFT, CI, smoke real e publicação manual por PowerShell/Vercel mediante aprovação expressa.

## 3. Contexto real verificado

- `app/page.tsx` inicia com `activeTab='inicio'` e importa `InicioView` estaticamente; carrega `OperationalWorkspace` via `React.lazy`.
- `features/operational/components/OperationalWorkspace.tsx` usa `next/dynamic` para grandes telas operacionais; preservar esse ganho.
- `features/inicio/hooks/useInicioPerformanceProfile.ts` já contém `full | balanced | static`, detecta `prefers-reduced-motion`, CPU/`deviceMemory` aproximados e visibilidade da página. É um perfil de **efeitos da tela Início**, não uma preferência global; integrar sem destruir esse contrato.
- `features/visual-orbs/components/EmprovexThinkingOrb.tsx` usa Canvas 2D com laço `requestAnimationFrame`, modo `balanced` com intervalo-alvo de 50 ms e `static`, `IntersectionObserver` e visibilidade de documento; reutilizar.
- `features/warehouse/navigation.ts` define `home`=Início visual e `overview`=Meus Depósitos com visão 3D, ambos separados de `control`=Controle de Materiais.
- `features/warehouse/components/WarehouseSectionContent.tsx` usa imports dinâmicos para `WarehouseLandingOperational` (home) e `WarehouseHomeOperational` (overview).
- `features/warehouse/components/WarehouseModuleShell.tsx` controla uma aba local além da rota, de modo que apenas alterar `href` ou CSS é insuficiente: a guarda do modo deve atuar na seleção e no conteúdo.
- `features/inicio/hooks/useInicioOperationalSnapshot.ts` lê snapshot somente quando `activeTab === 'inicio'`, mas pode publicá-lo quando outras coleções ficam prontas. **Não excluir inadvertidamente sua manutenção operacional**: avaliar efeitos sobre badges de avisos e dados usados por usuários Premium.
- `app/page.tsx` calcula o contador de avisos com dados ativos ou com fallback do snapshot. Evitar mostrar zero falso quando o snapshot não for carregado no Essencial.
- `components/layout/OperationalSurfaceTransition.tsx` anima blur, escala e opacidade; substituível por transição leve apenas no Essencial.
- `app/globals.css` tem 4.708 linhas na base analisada, com muitas definições de filtros, máscaras e animações. Evitar uma duplicação integral de estilos.
- Build oficial de `main@47323e3`: First Load JS `/` ≈353 kB, `/admin` ≈350 kB, `/central-depositos` ≈107 kB, shared ≈104 kB. **Valores de referência histórica de compilação, não medição de FPS, GPU ou total de download final.**
- `Application CI` e `Core Protection` aprovados nesse HEAD; **não certificam a futura implementação nem o PR #371**.

## 4. Arquitetura proposta

### 4.1 Contrato global mínimo

Criar **um único** contexto `VisualModeProvider` no menor limite compartilhado viável entre o EMPROVEX e a Central, com hook `useVisualMode()` e funções `setVisualMode('premium'|'essencial')` e `clearVisualMode()`. Valores do contrato:

```ts
type VisualMode = 'premium' | 'essencial';
type VisualModeState = {
  mode: VisualMode;
  hydrated: boolean;
  setMode(mode: VisualMode): void;
  clear(): void;
};
```

Persistência: chave versionada `emprovex:visual-mode:v1` em `sessionStorage`; escrita apenas na interação direta do usuário e leitura no bootstrap local. Não usar Firestore, cookie remoto, perfil Firebase, workspace settings nem `localStorage`. Atualizar `document.documentElement.dataset.visualMode` para decisões de CSS. Encapsular falha de storage com fallback seguro. Não usar a preferência como autorização. Se necessário, um evento local integra as duas árvores/client roots sem novas dependências ou observadores permanentes.

**Atenção técnica:** `sessionStorage` tem semântica de *aba de navegador* e sobrevive a refresh nessa aba. Em uma nova aba pode ser inicialmente copiado pelo navegador, mas após isso é independente. Esse comportamento atende à independência entre computadores. Limpar no logout explícito, ao detectar troca de identidade autenticada e ao invalidar sessão. Nunca misturar a escolha de apresentação com o controle de segurança da sessão.

### 4.2 Boot sem tela errada e sem hydration mismatch

Ler o modo antes de montar componentes visuais caros. Evitar renderizar o Início Premium por um frame e logo desmontá-lo no Essencial. Resolver bootstrap com limite cliente estável (skeleton estático curto) ou estratégia equivalente segura de hidratação; não acessar `window` no render SSR indevidamente. O modo preexistente na sessão tem prioridade sobre recomendações heurísticas de hardware. O modo padrão na primeira sessão deve **preservar a experiência Premium existente**, salvo escolha manual; pode existir sugestão discreta de Essencial para hardware modesto, sem mudar o modo unilateralmente. Sem bloqueio do login ou coleta invasiva de hardware.

### 4.3 UI do seletor

Disponibilizar controle de dois estados em local descobrível e de baixo custo: preferencialmente menu do perfil/cabeçalho e ajuste simples na entrada, se necessário. Rótulos acessíveis “Premium — experiência visual completa” e “Essencial — desempenho otimizado”. Explicar “Somente nesta sessão; não altera o setor”. O seletor aparece em EMPROVEX e Central e reflete o mesmo estado local naquela aba. Usar feedback breve de troca e `aria-pressed` ou controle de rádio válido; funcionar com teclado, leitor de tela, toque e contraste alto.

### 4.4 Início do EMPROVEX

- Alterar fluxo inicial do `app/page.tsx` para escolher `activeTab='painel'` no Essencial **antes da montagem da superfície**.
- Tornar `InicioView` lazy/dynamic, evitando import estático da cena orbital na sessão Essencial. Garantir que sua carga transitiva (orb, constelação, motion específico) não entre desnecessariamente no chunk inicial do Essencial.
- Filtrar a opção `inicio` do menu lateral e demais menus/atalhos; proteger `setActiveTab('inicio')` por uma função de navegação consciente do modo. Corrigir qualquer seleção residual.
- Em troca Premium→Essencial estando em `inicio`, navegar para `painel`; em outra aba manter a aba ativa e os formulários. Essencial→Premium permanece na aba atual, apenas revela `inicio` no menu.
- Preservar os contratos de snapshots, contagem de avisos, IAM, prontidão operacional e assinaturas necessárias; nenhuma métrica pode virar zero artificial porque o Início não está aberto.

### 4.5 Início da Central de Depósitos

- `WarehouseModuleShell` deve filtrar `WAREHOUSE_SECTIONS` por modo sem alterar a lista canônica exportada, que continuará incluindo todas as seções para usuários Premium e para testes de contrato.
- Controlar `activeSectionId`, histórico de navegação e eventos de `popstate`: `home` não é seção permitida no Essencial. Mapear `home` → `control` para o usuário autorizado.
- Rotas canônicas: a abertura da Central pelo cabeçalho e o acesso ao `/central-depositos` devem levar ao `/central-depositos/controle-de-itens` quando o modo for Essencial, **depois da checagem de autenticação/autorização aplicável**. Links históricos `/adm-deposito` preservam seus redirects existentes e entram na mesma regra após normalização.
- Usar `replace` em redirecionamentos da rota visual para evitar loops no botão Voltar. Preservar estado ao mudar de aba dentro da Central.
- Não montar `WarehouseLandingOperational` no Essencial. Manter `WarehouseHomeOperational`, `WarehouseIsometricPreview` e os visualizadores 3D das demais abas exatamente como são no Premium.
- O modo não deve reduzir a disponibilidade de funções de inspeção, validade, localização, câmera, etiquetas, configuração de locais e saldo.

### 4.6 Efeitos e estética

Não criar um segundo CSS completo. Adicionar tokens e variantes por seletor `[data-visual-mode='essencial']`, aplicados somente às superfícies não protegidas. Regras visuais: fundo estático sofisticado (grafite/azul institucional), linhas finas, elevações discretas, tipografia clara, estados visuais precisos, cartões bem organizados; preservar contraste e foco. Suspender loops e efeitos decorativos que não adicionam informação. Preferir transform/opacity para transições curtas e retirar **blur animado** de mudanças de aba. Reduzir `backdrop-filter` em painéis grandes; preservar sombras leves e hierarquia visual. Border Beam estático no Essencial. Thinking Orb estático onde for apenas decorativo, sem substituir indicadores de processamento real. `prefers-reduced-motion` continua sendo respeitado em **ambos** os modos, inclusive no Premium.

**Proibição:** CSS global que atinja `WarehouseIsometricPreview` ou seus descendentes e modifique renderização 3D. Utilizar classes/escopos explicitamente excluindo a experiência 3D. O modo Essencial não deve transformar a visão 3D em imagem estática.

### 4.7 Dados e CPU

- Não refatorar motores transacionais para otimizar visual; separar responsabilidade.
- Preservar carregamento dinâmico já existente e avaliar se a árvore importada pelo Início vai realmente sair do JS inicial no Essencial; validar via análise de chunks, não por suposição.
- No `DashboardView.tsx`, estudar agregação por empenho/classe em passagem única com `useMemo` estável, mantendo todos os totais, filtros, status, valores financeiros e arredondamentos; medir antes/depois.
- Para listas extensas, aplicar virtualização **somente após benchmark demonstrar custo real** e validar navegação por teclado, impressão/PDF e seleção de itens.
- Manter o plano atual de assinaturas por aba e a economia de Firestore; nenhum listener ou leitura nova só para descobrir o modo.
- Não eliminar snapshots usados por outras superfícies nem modificar módulos de faturamento, NS, NF, recebimento, transferência, alocação ou baixa de estoque.

## 5. Etapas executivas e entregáveis

| Etapa | Entregável | Dependência | Aceite de passagem |
|---|---|---|---|
| 0 — Congelamento e medidas | HEAD, baseline da mesma revisão, matriz de rotas, definição de escopo | Main e PR #371 monitorados | Reprodutibilidade confirmada |
| 1 — Preferência de sessão | Hook/provider, persistência, seletor acessível | 0 | Dois computadores/sessões independentes; troca de identidade limpa estado |
| 2 — EMPROVEX sem Início | Lazy real do Início, menu filtrado, painel padrão, rotas internas protegidas | 1 | Início não baixa/monta no Essencial; funções íntegras |
| 3 — Central sem Início | Filtro navegação, guarda de rota, estado local seguro | 1 | Landing não baixa/monta; Meus Depósitos 3D intocado |
| 4 — Acabamento Essencial | Tokens visuais, motion enxuto, sombras e blur limitados | 2–3 | Interface premium, contraste e acessibilidade; 3D igual |
| 5 — CPU/Bundles pontuais | Ajustes comprovados de cálculos e carregamento | 0–4 | Melhoria medida, resultados funcionais iguais |
| 6 — QA e certificação | CI, E2E, telemetria local, comparação no hardware-alvo | 1–5 | Gates funcionais e de desempenho aprovados |
| 7 — Publicação controlada | Build prebuilt, smoke autenticado, aprovação, promote manual | 6 e integração base estável | Produção estável; rollback disponível |

**Execução paralela recomendada, com mínimo de coordenação:** Worker UI Core (Etapas 1–2), Worker Warehouse Navigation (Etapa 3), Worker Visual Polish (Etapa 4), Worker Performance (Etapa 5), Coordenador/QA (integração + Etapas 0/6), Fundador (aceite visual e deploy). Todos trabalham em branches isoladas. Nenhum worker mexe na `main`, produção ou Rules. Evitar mais PRs que o necessário; composição em um PR de integração é suficiente.

## 6. Plano de testes objetivos

### 6.1 Matriz funcional mínima

| ID | Cenário | Resultado obrigatório |
|---|---|---|
| VF-01 | Primeiro acesso sem preferência | Premium existente disponível, sem tela quebrada |
| VF-02 | Selecionar Essencial antes/durante acesso | Dashboard como entrada, Início orbital ausente |
| VF-03 | Abrir Central no Essencial | Abre Controle de Materiais com acesso autorizado |
| VF-04 | Abrir URL `/central-depositos` no Essencial | Substitui pela rota de controle sem loop |
| VF-05 | Navegar por histórico/links para Início oculto | Não monta home; redireciona ao destino canônico |
| VF-06 | Abrir Meus Depósitos no Essencial | 3D, câmera, zoom, etiquetas, localização e materiais iguais ao Premium |
| VF-07 | Alternar Premium↔Essencial | Menus e efeitos respondem imediatamente, sem perda de dados/formulário |
| VF-08 | Refresh na mesma aba | Preferência local mantida enquanto sessão ativa |
| VF-09 | Logoff/revogação/troca de conta | Preferência anterior apagada; sem vazamento para outro login |
| VF-10 | Dois computadores do mesmo workspace | Podem usar modos diferentes; um não altera o outro |
| VF-11 | Teclado/touch/alto contraste/reduced motion | Navegação e seletor acessíveis nos dois modos |
| VF-12 | Avisos, contadores e dados financeiros | Mesmos valores e nenhuma contagem falsa de zero |
| VF-13 | Rotas antigas e permissão negada | Sem regressão, sem loop e sem bypass de autorização |
| VF-14 | Build e chunks | Landing e orb exclusivos ausentes da carga inicial no Essencial quando não requeridos |
| VF-15 | Múltiplos workspaces e sessões | Nenhum registro de preferência no Firestore ou configuração remota |
| VF-16 | Operador Móvel, NF/NS, estoque, faturamento | Regressões inexistentes; contratos operacionais preservados |

### 6.2 Medições

Em **mesmo commit, mesmo browser, mesma conta autorizada e mesma massa de dados**, comparar Premium e Essencial pelo menos em uma máquina básica real e uma máquina de referência. Coletar (somente local e de forma agregada):

- Tempo até superfície operacional utilizável; LCP, INP e CLS; p50/p95 de interações de navegação quando houver amostragem estável.
- MB de JS transferido/avaliado por rota e por navegação; número de módulos carregados no Início e na Central.
- CPU em repouso por 30 s sem interações e CPU durante navegação; quantidade/duração de long tasks; heap após percorrer abas.
- FPS/fluidez e atividade gráfica conforme recursos do navegador/equipamento; reconhecer que porcentagem de uso de GPU pode ser indisponível ou imprecisa.
- Comparação fotográfica/funcional do 3D no Premium e Essencial na mesma dimensão de viewport, com mesmo conteúdo e configurações.
- Firestore: leituras de controle de modo = **0**; assinaturas e chamadas de dados sem acréscimo por efeito visual.

**Metas de trabalho, não resultados já comprovados:** Essencial com menor CPU e menos animação contínua que Premium em repouso; nenhuma regressão material de carregamento/INP/CLS; nenhuma regressão de funções, cálculos ou 3D; buscar melhoria significativa em tempo de interação (alvo inicial indicativo ≥20% em cenários limitados por efeitos visuais, condicionado ao hardware). Adotar guard numérico estrito só após repetir benchmark e aferir variação; não prometer percentuais sem medida.

## 7. Riscos, mitigação e rollback

| Risco | Mitigação |
|---|---|
| Preferência atravessar login diferente | Limpar no logout, UID diferente e revogação; testar |
| Home visual escondida mas ainda carregando | Condicionar montagem e import; inspecionar chunks/network |
| Flash Premium antes de recuperar modo | Bootstrap/hidratação segura, fallback estático |
| `/central-depositos` entrar em loop | Roteamento centralizado e teste com Back/Forward |
| Ocultar Início invalidar contador de avisos | Auditar fallback snapshot e preservar indicador verdadeiro |
| CSS Essencial afetar 3D | Escopos específicos e regressão visual 3D automatizada/humana |
| PR #371 introduzir conflitos | Isolar trabalho; rebase/composição sobre HEAD certificado; não misturar motores |
| Troca de modo desmontar formulário ativo | Manter estado por superfície; mudar aba apenas quando saída de Início for exigida |
| `sessionStorage` bloqueado por privacidade | Memória por aba com degradação segura, sem quebra |
| Otimização falsa por CSS `display:none` | Verificar ausência de imports/execução/assinaturas desnecessárias |
| Ganho visual com perda de acessibilidade | Contraste, foco, reduced motion, navegação teclado, estados carregando |
| Degradação de performance em hardware | Medições com hardware alvo e rollback de variantes antes do deploy |

**Rollback:** manter a versão previamente promovida na Vercel e o commit imutável de referência. Em caso de regressão, restaurar o deployment anterior via procedimento manual já adotado pelo projeto. Alteração puramente visual não deve exigir migração de Firestore, rollback de dados ou alteração das Rules. Não executar rollback sem apuração dos efeitos sobre alterações concomitantes.

## 8. Critérios formais de GO / NO-GO

**GO apenas se:**

- CI do commit candidato verde; TypeScript, Core Protection e gates relevantes de Warehouse, Legal e Recovery aprovados.
- PR #371 e quaisquer alterações de domínio concorrentes certificados e integrados de modo controlado, quando forem parte da mesma entrega; não usar sucesso de HEAD antigo como autorização.
- Matriz VF-01 a VF-16 com evidência, sem bloqueadores.
- Smoke autenticado nos dois modos, na mesma organização em dois equipamentos distintos.
- A tela Início de cada módulo realmente não se monta nem transfere JS exclusivo no Essencial; provas de carga.
- Meus Depósitos 3D sem nenhuma alteração visual, funcional ou de resultado, inclusive interações e labels.
- Nenhuma leitura/escrita Firestore causada pelo modo, nenhum bypass de identidade/autorização.
- Fundador aprova a estética do Essencial e o comparativo visual.
- Prebuild Vercel na conta administrativa correta, validação do preview/RC e promoção manual **somente após autorização**.

**NO-GO se:** divergência financeira/logística, dados faltantes/errados, 3D visualmente alterado, acesso indevido, loop de rota, usuário preso no login, contadores enganadores, CI crítico falho, PR concorrente sem certificação ou ambiente de deploy não validado.

## 9. Escopo excluído da R1

Não atualizar React/Next/Firebase indiscriminadamente; não trocar biblioteca 3D; não mexer no renderizador isométrico; não alterar schemas, Rules, motores financeiros ou Warehouse; não redesenhar a UI Premium; não implantar telemetry permanente custosa; não vincular modo ao setor; não implementar sincronização entre computadores; não adicionar serviço externo para escolher perfil de hardware. Otimizações posteriores só com evidência de perfil real.

## 10. Ordem de execução recomendada

**A. Preparar:** criar branch isolada a partir do commit de integração estável; registrar baseline build/runtimes, verificar conflitos com PR #371; mapear os testes já existentes para não duplicar documentação/CI.

**B. Entregar núcleo:** `useVisualMode`, seletor, inicialização segura, controle de logout/identidade e dataset CSS.

**C. Entregar ganho estrutural:** Início EMPROVEX lazy; Central sem landing no Essencial; navegação/URLs consistentes e sem carga desnecessária.

**D. Refinar a estética:** tema Precision com superfícies estáticas, redução de motion/blur e foco; nenhuma alteração em 3D.

**E. Otimizar o que a medição comprovar:** CPU do Dashboard, listas e imports/cargas; deixar ajustes sem evidência fora do PR R1.

**F. Certificar:** comparação em navegador real, CI, smoke autenticado, visual 3D e Firestore.

**G. Publicar:** entregar PR e memorial de handoff, aguardar aprovação do fundador, preparar prebuild e promover manualmente.

## 11. Handoff operacional — obrigatório

**Onde estamos:** planejamento pronto, auditado contra `main@47323e3` e arquitetura atual de navegação. PR #371 continua uma frente concorrente; produção não alterada por este plano.

**O que estamos fazendo:** especificação de dois modos independentes por sessão, com telas Início puramente visuais omitidas no Essencial, mantendo a visualização 3D totalmente intacta.

**Quem está fazendo:** arquitetura e especificação documentadas pelo coordenador; desenvolvimento por Workers UI Core, Warehouse Navigation, Visual Polish e Performance; certificação pelo coordenador/QA; aceite e publicação pelo fundador.

**O que fazer a seguir:** criar branch isolada sobre base estável, medir, implementar os componentes de modo e rotas, consolidar apenas mudanças visuais/CPU comprovadas, executar testes e preparar PR DRAFT.

**Quem fará:** Workers e coordenador, sem merge/deploy de produção até autorização explícita.

## 12. Referências de código e evidências

- Repositório: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov
- PR #371 (integração concorrente): https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/371
- Build auditado: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40063891651
- `app/page.tsx`, `features/operational/components/OperationalWorkspace.tsx`
- `features/inicio/hooks/useInicioPerformanceProfile.ts`, `features/inicio/hooks/useInicioOperationalSnapshot.ts`
- `features/warehouse/navigation.ts`, `features/warehouse/components/WarehouseModuleShell.tsx`, `features/warehouse/components/WarehouseSectionContent.tsx`
- `features/warehouse/components/WarehouseHomeOperational.tsx`, `features/warehouse/components/WarehouseIsometricPreview.tsx`
- `features/visual-orbs/components/EmprovexThinkingOrb.tsx`
- `components/layout/OperationalSurfaceTransition.tsx`, `features/dashboard/components/DashboardView.tsx`

**Registro final:** este é um plano executivo técnico, não uma certificação de ganhos de CPU/GPU. As melhorias serão verificadas e quantificadas durante a implementação em ambiente isolado.

---

## Anexo B — Consulta da auditoria completa

A auditoria de arquitetura, baseline histórico, evidências e oportunidades **DV-01 a DV-20** está preservada integralmente em [MODO_ESSENCIAL_AUDITORIA_2026-10-24.md](./MODO_ESSENCIAL_AUDITORIA_2026-10-24.md). Seus trechos preliminares sobre `localStorage` e Início estático foram expressamente superados pelas decisões canônicas da seção 0 deste documento.
