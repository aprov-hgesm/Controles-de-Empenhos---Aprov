# EMPROVEX — MODO ESSENCIAL / MODO NORMAL — MEMORIAL OFICIAL R1

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


---

## Checkpoint de implementação — 29/10/2026 — R1 núcleo visual/navegação

> **Estado:** código inicial em desenvolvimento na branch `feat/visual-mode-r1-session-navigation`, **não integrado à main nem publicado**. O usuário autorizou desenvolvimento incremental com **somente verificações estáticas básicas nesta fase**; testes automatizados extensivos, benchmark real, auditoria e certificação ficam para a conclusão da configuração do Modo Essencial. **Não declarar PASS ou release pronta por este registro.**

### Implementação já gravada na branch

1. `components/visual-mode/VisualModeProvider.tsx`: um único provider React do modo `premium | essencial`, preferência versionada `emprovex:visual-mode:v1` em `sessionStorage`, bootstrap seguro, modo Normal padrão, API de limpar e atributo `data-visual-mode`.
2. `components/visual-mode/VisualModeControl.tsx` e `components/layout/AppHeader.tsx`: seletor acessível e compacto Normal/Essencial no cabeçalho compartilhado do EMPROVEX e da Central; não realiza chamadas Firestore.
3. `app/layout.tsx`: provider global, preservando o mesmo modo através das duas áreas da aplicação naquela sessão.
4. `app/page.tsx` e `components/layout/AppSidebar.tsx`: remove Início do menu no Essencial, redireciona a aba ativa para Painel, blinda `setActiveTab('inicio')`, carrega Início com `React.lazy` somente quando necessário e envia o operador diretamente ao Controle de Materiais da Central.
5. `features/warehouse/components/WarehouseSidebar.tsx` e `WarehouseModuleShell.tsx`: filtro de navegação, `home -> control` com `replaceState` em rotas diretas/histórico e renderização local do Controle para impedir que o conteúdo da landing seja montado no Essencial.
6. `components/layout/OperationalSurfaceTransition.tsx`: no Essencial, a transição operacional é estática, sem `motion`, blur ou feixes decorativos; no Normal permanece intacta.
7. Logout e invalidação de sessão: limpar preferência em `app/page.tsx`, `WarehouseModuleShell.tsx` e `WarehouseProtectedSurface.tsx`; mudança de identidade observada na página principal também limpa a preferência.

8. `components/layout/AppBackground.tsx` + `app/page.tsx`: modo Essencial utiliza fundo estático de gradiente leve **somente nas superfícies principais**, removendo os quatro círculos com blur de 120–150px. O Warehouse continua utilizando seu fundo/visual originais.
9. `components/layout/OperationalNavigationBeam.module.css`: suspende a animação contínua de feixe nas navegações do EMPROVEX em Essencial; contorno e estados ativos permanecem visíveis.

### Escopo preservado

- **3D intocado:** não editar `WarehouseHomeOperational`, `WarehouseIsometricPreview`, geometria, câmeras, materiais, etiquetas, interações, renderizador 2D/3D, cenas nem suas regras CSS.
- **Backend e domínio intactos:** nenhum endpoint, Firestore Rule, IAM, autenticador, ledger, saldo, NF, NS, faturamento ou persistência do workspace alterado nesta entrega.
- O modo visual não dá ou revoga autorização; o guard de acesso Warehouse existente segue obrigatório.
- **Sem Vercel:** não executar deploy, promote ou mudança no domínio nesta fase.

### Verificação básica disponível

- Comparação `main...feat/visual-mode-r1-session-navigation` consultada via GitHub: branch à frente, sem alterações em arquivos 3D ou backend.
- Inspeção estática pontual de hooks, imports, rotas, JSX e condições de renderização; **não equivale a `tsc`, build, smoke autenticado, teste de navegador, CI ou aceite visual**.

### Pendências para o desenvolvimento contínuo, antes da fase formal de testes

- Refinar superfícies decorativas restantes **fora** do 3D (blur, partículas, beams, animação contínua), com variantes visuais Essenciais sem CSS global de risco.
- Investigar melhorias pontuais de CPU/bundles por medição, sem refatorar lógica financeira/logística apenas por suposição.
- Validar ao fim da configuração toda a matriz VF-01 a VF-16, comparar hardware modesto e de referência, confirmar carregamento efetivo dos chunks e certificação de CI, integridade e ausência de regressão 3D.
- Só então preparar composição/merge e publicação manual mediante aprovação expressa do fundador.


---

## Checkpoint de desenvolvimento — simplificação visual ampliada (29/10/2026)

**Autorização:** finalizar simplificação visual agressiva fora da Central 3D, preservando estética profissional; realizar só pequenos testes de funcionamento, postergando testes/auditorias complexos.

**Status:** modificações gravadas **somente** em `feat/visual-mode-r1-session-navigation`. Nenhuma modificação na `main`, produção Vercel, Firestore, IAM, Rules, APIs, saldos ou componentes do renderizador 3D. Este checkpoint é de desenvolvimento, **não** uma certificação nem aceite de publicação.

### Entregas desta etapa

1. **CSS Essencial independente e escopado** — `app/visual-mode-essential.css`, importado depois de `app/globals.css`: remove `backdrop-filter` e sombras caras apenas do cabeçalho, menu, cartão de operador, backdrop mobile e do cabeçalho operacional não imersivo da Central. Mantém cores sólidas/gradientes estáticos, foco e contraste; não afeta `warehouse-emprovex-content` nem qualquer descendente de `WarehouseIsometricPreview`.
2. **Loops puramente visuais desligados** — anéis do cabeçalho, energia decorativa, nós SVG da assinatura, brilho pulsante do item de navegação e dot decorativo estáticos no Essencial, mantendo indicadores funcionais; sem CSS universal ou supressão de `animate-spin`/`animate-pulse` de operação.
3. **Transições e entrada de cards** — CSS de entrada/carregamento decorativo suspenso apenas no `main[data-visual-surface='operational']` do EMPROVEX. Navegação móvel com fundo opaco estático; transições operacionais do Essencial já eram estáticas no checkpoint anterior.
4. **Central sem blur de fundo** — `WarehouseModuleShell` passa `essential` ao componente `AppBackground`, que só escolhe fundo leve quando `!immersive`. Na seção `overview` (Meus Depósitos 3D), `immersive=true` prevalece e a cena/fundo original continua intocada. O cabeçalho de Controle/Alocação/Saída é simplificado sem tocar no conteúdo 2D/3D.
5. **Login operacional Essencial** — `EmprovexLogin` tem seletor antes da autenticação, mantém e-mail/senha, Google, recuperação e mensagens. Em Essencial não monta `LoginAtmosphere` (RAF, pointermove, rede decorativa), cenas/signatures ou `LoginBrandStage` cinematográfico; usa `LoginBrandStageEssential` estático. Em Normal, os visuais originais são lazy sob demanda; preserva efeito de login Normal e feedbacks de erro/loading.
6. **Sucesso de autenticação** — `LoginSuccessTransition` usa transição curta e simples no Essencial; callback `onComplete` continua obrigatório.
7. **Administração** — `PlatformAdminView` no Essencial abre `overview`/Visão Geral, sem montar a cena 3D puramente decorativa do bairro. A aba Início fica oculta só no Essencial, mas permanece no Normal com lazy import de `AdminWorldHomePanel`; demais setores, sessões, consumo, cobrança, backup e segurança preservados. Seletor acessível no cabeçalho da Administração, modo por sessão e limpeza no logout.
8. **Border Beam** — `EmprovexBorderBeam` muda a variante efetiva para `static` no Essencial e deixa de cadastrar `IntersectionObserver`/`visibilitychange` por cartão enquanto o modo leve estiver ativo; o contorno permanece visível.

### Verificações mínimas executadas — limites de prova

- **16/16 verificações estáticas PASS** no conteúdo da branch via GitHub: CSS balanceado, ordem de import, escopos, ausência de regra universal e de seletores 3D, indicadores busy preservados, login (e-mail/senha/Google/recuperação) e controles presentes, cena removida da montagem no Essencial, Admin lazy e navegação, observers desativados, preferências por sessão, seletor compartilhado e fundo Warehouse condicionado a `!immersive`.
- **Não executados nesta etapa:** build Next.js, `tsc`, testes de unidade automatizados, GitHub CI, browser/E2E, smoke autenticado, perfil CPU/GPU/RAM, Lighthouse, regressão fotográfica 3D e publicação. Os 16 checks são inspeção de contratos e guardas no código; **não provam interação real ou ausência de regressões em navegador**.
- **Ambiente:** não foi possível obter checkout Git via acesso externo do container, então não há prova de compilação local nesta execução. Evitar usar a palavra `PASS` para rotas funcionais ainda não rodadas.
- **GO parcial:** desenvolvimento pode continuar na branch. **NO-GO de publicação** até build básico e smoke autenticado ao encerrar a configuração.

### Próxima continuidade

R1 tem núcleo do modo, navegação e simplificação ampla de decorativos. Reavaliar eventuais problemas detectados durante montagem final e, somente ao terminar as configurações, executar a matriz VF-01 a VF-16 e benchmark comparativo em PC modesto. Não alterar o 3D protegido para obter ganho de CPU. Não editar `main` nem chamar Vercel sem autorização posterior.


---

## Auditoria R2 — simplificação funcional, CPU e minimalismo (29/10/2026)

A segunda auditoria estática dirigida identificou trabalho de processamento ainda otimizable além dos efeitos visuais. **Documento técnico completo:** [MODO_ESSENCIAL_AUDITORIA_R2_2026-10-29.md](./MODO_ESSENCIAL_AUDITORIA_R2_2026-10-29.md).

**Achados priorizados:**
- **R2-A, baixo/moderado:** carregar Administração e painel de backup/Drive sob demanda; reduzir vidro e cartões redundantes somente em superfícies não 3D.
- **R2-B, moderado:** pré-agregação/memoização financeira no Dashboard e renderização gradual de linhas, **sem qualquer diferença em valores, contagem, filtros, pesquisa, edição ou exportações**.
- **R2-C, moderado/alto:** segregar hooks de operações por aba e retirar o Motion do caminho base do login Essencial, sem duplicar autenticação nem alterar motores transacionais.
- **R2-D, condicional:** particionar CSS enorme/recursos compartilhados apenas após demonstrar ganho; manter o que já está otimizado (listeners por aba, PDF lazy, branding cache e Warehouse dynamic).

**Risco de integração a acompanhar:** navegação da Central usa `usePathname` + histórico manual + estado local; na certificação final, conferir F5, voltar/avançar, links diretos e troca de modo. **3D intocável**.

**Estado da auditoria:** arquivo criado e vinculado na branch de desenvolvimento. Não foram executados build, CI, benchmark ou navegador real; **não confundir inspeção estática com certificado de desempenho/funcionalidade**. Nenhuma mudança adicional de código nesta auditoria e nenhum deploy/merge.

**Próximo marco recomendado:** iniciar implementação R2-A em branch atual, com verificações curtas e sem burocracia; testar cenários abrangentes no fechamento, observando os guardas críticos financeiros e de segurança.


---

## BLOQUEIO PREVENTIVO DE SEGURANÇA — AUDITORIA AS-R1 (29/10/2026)

**Documento:** [MODO_ESSENCIAL_AUDITORIA_SEGURANCA_R1_2026-10-29.md](./MODO_ESSENCIAL_AUDITORIA_SEGURANCA_R1_2026-10-29.md).

**Decisão em 29/10:** **GO somente para corrigir compatibilidade e gates em branch de desenvolvimento; NO-GO de R2-A/R2-B/R2-C, merge, deploy ou publicação até resolver AS-01 + AS-02.** A inspeção foi estática (14 contratos verificados, 9 salvaguardas presentes e 5 lacunas de integração), sem emulador, build ou browser autenticado. Não foi verificada corrupção persistente nem exploração, mas não existe certificação de segurança.

**P0 de disponibilidade:** `app/page.tsx` omite o terceiro parâmetro obrigatório de `useOperationalData`, que tem `billingAccessGranted=false` como padrão; `app/login/page.tsx` implementa corretamente gate de assinatura. Divergência preexistente na `main` — falha de disponibilidade potencial e **não** prova de bypass. Resolver com uma única entrada/gate canônico, nunca com `true` fixo.

**P0 de experiência visual:** `app/login/page.tsx` não usa `useVisualMode` no `activeTab` e continua montando Início apesar da preferência Essencial; o menu compartilhado já o oculta. Unificar as duas rotas sem perder `/login?tab=cronogramas` ou cobrança.

**P1 de integridade do usuário:** `setNfQuantities` zera o draft em `useEffect` dependente de `empenhos`, inclusive possíveis snapshots. Proteger dados não salvos antes de refatorar hooks, abas ou processamento financeiro.

**P1/P2 adicionais:** fonte dupla de estado URL/aba Warehouse, sinalização de dados stale quando listener falha, consistência de entitlement durante a sessão, limpeza de modo no logout em todas as rotas, ausência de mutações por troca de aparência, proteção absoluta da Central 3D.

**Contrato inegociável:** nenhum modo concede direitos, altera assinatura, renova lease, grava Firestore, desliga validação, altera valores financeiros, elimina funcionalidades ou recria a cena 3D. Segurança e isolamento devem permanecer iguais, e alteração visual deve preservar drafts em curso. `firestore.rules` e backend nunca serão relaxados para ganhar desempenho.

**Próxima execução:** correções AS-01 + AS-02 primeiro, depois proteção AS-03; só então retomar R2-A e demais fases, com verificações curtas e auditoria completa antes da publicação.


---

## CHECKPOINT DE IMPLEMENTAÇÃO — HARDENING P0/NF E R2-A/B/C (29/10/2026)

**Estado:** alterações em desenvolvimento exclusivamente na branch `feat/visual-mode-r1-session-navigation`; nenhuma publicação na Vercel, migração Firestore, alteração de Rules, API, motor de estoque, câmera ou visualizador Warehouse 3D.

**P0-A — Entrada canônica:** `app/page.tsx` deixa de manter uma aplicação operacional divergente e reexporta `app/login/page.tsx`. `next.config.ts` continua reescrevendo `/` para a vitrine `/institucional`. A rota operacional `/login` permanece a fonte única da verificação `checkSectorBillingAccess` + identidade + aceite legal, **sem nunca passar acesso `true` fixo**.

**P0-B — Modo Essencial na rota real:** `app/login/page.tsx` usa `useVisualMode`, faz `inicio -> painel`, `InicioView` lazy apenas no Normal, preserva `?tab=cronogramas` e envia operador Essencial a `/central-depositos/controle-de-itens`. A liberação de cobrança exibida foi vinculada a UID/workspace/UG para impedir utilização visual de resposta antiga em troca de identidade. Não houve alteração em `sectorBillingGate`, regras de acesso, IAM ou servidor.

**NF — Rascunhos:** `app/login/page.tsx` armazena as quantidades **em memória por NE** e as recupera quando o operador retorna à NE; removeu o efeito que zerava valores a cada mudança do array `empenhos`. Limpa drafts em logout/mudança de identidade. Demais estados de NF continuam na `useOperationalViewState`. Atenção: o estado é **efêmero**, não um backup persistente contra fechamento abrupto do navegador; não criar gravações automáticas de NF.

**R2-A — Carregamento e minimalismo seguros:**
- `PlatformAdminView.tsx`: oito subpainéis (backup, consumo, assinaturas, sessões, segurança, interessados, criar setor e modal de edição) via `React.lazy + Suspense`, sem alterar callbacks, permissões ou hooks administrativos responsáveis pelos dados.
- `WorkspaceDriveControl.tsx`: `WorkspaceBackupSection` lazy dentro do diálogo; sessão OAuth, indicador, conexão e expiração seguem com o hook já existente.
- `DashboardView.tsx` + `visual-mode-essential.css`: superfície escopada para reduzir vidro, sombras grandes e transições caras **somente no Essencial**, sem esconder indicadores nem afetar Central 3D.

**R2-B — CPU e linhas:**
- `DashboardView.tsx` usa `useMemo([empenhos])` para acumulados financeiros, contagem/segmentos RPNP/regular e valores por NE, evitando varrer a base repetidamente por cartão e tabela. Somas e regras financeiras preservadas na forma existente (`quantity * unitPrice`, `received * unitPrice`, `Math.max(0, ...)`).
- No Essencial, tabelas detalhadas mostram inicialmente até 60 linhas por classe, com botão `Mostrar mais 60`. **Pesquisa, contagem e totais continuam sobre o conjunto completo filtrado**; Normal continua exibindo a tabela completa. Nenhuma exportação foi modificada.

**R2-C — Carregamento de código por estágio, sem desmontar operações:**
- Novo `OperationalDashboardEntry.tsx` monta apenas o Painel e `useEmpenhoClasses`, **sem os hooks de escrita** de Empenhos, NFs, SAG/NS, relatórios ou Cronogramas.
- `app/login/page.tsx` mantém o painel leve até o operador abrir a primeira aba operacional/transacional; depois carrega `OperationalWorkspace` completo e **não o desmonta ao voltar ao Painel**, evitando perder estado interno de hooks, callbacks, confirmações de e-mail e ações em andamento.
- Trata-se da **primeira segmentação segura** da R2-C; a divisão de cada motor transacional em chunks distintos continua condicionada a testes de fluxo/estado e **não** foi feita cegamente.

**Verificação rápida de contratos:** 17/17 inspeções estáticas PASS no GitHub para canonicalidade, gate, `/login?tab=cronogramas`, drafts, lazy/exports de painéis, agregação, tabela progressiva, R2-C e escopo do CSS. Também foi removida uma referência órfã `rpnpEmpenhos.length` após a agregação (substituída por contagem memoizada). **Não** foi realizado compilação Next/TypeScript local, teste autenticado, emulador, browser real ou benchmark. `next.config.ts` do projeto contém `typescript.ignoreBuildErrors`: um build Next `Ready` sozinho **não** equivale à prova de typecheck.

**Pendências para GO de integração e publicação:**
1. Validar typecheck real (`tsc --noEmit`) e o conjunto mínimo de rotas de login, admin, NF, Painel e Central, incluindo autorização VIP, trial, vencida e revogada.
2. Exercitar fluxo de NF (quantidades em rascunho, snapshot em tempo real, voltar à NE, salvar/cancelar, alternar modos, logoff), cronograma com email e workflows de administração.
3. Comparar números financeiros/RPNP de base controlada antes/depois, testar paginação/busca/teclado em massa grande, acompanhar `onSnapshot`, uso de memória/CPU e preservar 3D.
4. Certificar alterações no CI e só então propor merge/promoção via método Vercel do memorial; autorização expressa de publicação é obrigatória.

**Regra:** é permitido continuar desenvolvimento da R2 em branch; **NO-GO de merge/produção** enquanto essa matriz não for executada. A implementação não reduz proteções do Firestore ou acesso por assinatura.
