# EMPROVEX — Modernização visual da Administração atual

**Data:** 18/10/2026 · **Nova branch:** `feat/admin-visual-organizacao-base-emprovex` · **Origem:** `main@50fb01bff2718c913e63ac4082c13030d8f8e354`

## Decisão de escopo

O Fundador interrompeu a criação da Administração 2.0 e solicitou **somente estética e organização da Administração que já funciona na main**.

- NÃO adicionar funcionalidades, abas comerciais, CRM, novos modelos de workspace, provisionamento, mudanças de billing nem endpoints;
- NÃO alterar autenticação, Firestore, dados reais, regras, queries, mutations, backend ou deploy;
- NÃO usar/recuperar o antigo PR #339 nem PR #340;
- Manter as oito abas e todas as operações existentes em `components/admin/PlatformAdminView.tsx` sem substituí-las por prévias fictícias.

## Primeiro incremento (somente layout)

1. Reaproveitado **App Shell visual original**: `emprovex-app-header`, `emprovex-app-sidebar`, `AppShellSignature`, cartão de operador e rodapé de estado.
2. Os **mesmos oito IDs** da navegação foram apenas AGRUPADOS visualmente: Central (Visão Geral); Setores e Clientes (Setores, Cadastrar Setor, Assinaturas); Operação (Consumo & Cotas, Sessões, Backup & Recuperação); Governança (Segurança).
3. Reutilização do `OperationalNavigationBeam.module.css`, com trilho animado sutil no item ativo, sem criar animation loop JS, respeitando reduced-motion; barra lateral mantém scrolling controlado, hierarquia e indicadores legíveis.
4. Cabeçalho 64px, fontes e espaçamento compatíveis com o EMPROVEX operacional, sem alterar handlers.
5. CSS local e de escopo reduzido: `components/admin/AdminVisualShell.module.css`. **Nenhuma alteração no CSS global**, App Sidebar operacional ou componentes de billing/serviços.

## Correção visual solicitada pelo Fundador — fundo claro e sidebar fixa

O primeiro incremento mantinha o canvas escuro e uma sidebar `sticky`. Isso **não refletia** a estética operacional que o Fundador solicitou. Foi corrigido nesta mesma branch:

- **Canvas claro e confortável**: plano de fundo `#edf3fb`, atmosférico discreto, cards brancos com bordas azul-acinzentadas e tipografia escura de bom contraste.
- **Header escuro fixo**: `emprovex-app-header fixed` com acabamento estrutural/assinatura EMPROVEX, 64 px.
- **Sidebar escura realmente fixa no desktop**: `lg:fixed lg:bottom-0 lg:left-0 lg:top-16 lg:w-72`, rolagem interna, mesmo visual de operador, status e Border Beam no item selecionado; a área de conteúdo usa `lg:pl-72` sem sobreposição.
- **Módulos preexistentes**: os painéis existentes foram adaptados com **CSS escopado apenas no conteúdo administrativo**, convertendo superfícies dark em claras, inputs para branco e textos em tons escuros/semânticos. Cabeçalho, menu, diálogos e componentes da aplicação operacional NÃO foram alterados. Não foram mudadas regras de negócio nem consultas.
- **Responsividade**: abaixo de 1024 px o menu aparece antes do conteúdo (não fica sobreposto), preservando a navegação original e o acesso por teclado.
- **Guardas**: `scripts/admin-visual-only.test.mjs` verifica fundo, sidebar fixed, cabeçalho, oito abas e componentes; `scripts/verify-admin-sidebar-google-usage.mjs` atualizado para garantir a nova disposição sem perder os diagnósticos Google.

O aceite deve verificar contraste das abas reais (Visão Geral, Setores, Cadastro, Consumo, Sessões, Assinaturas, Backup e Segurança) e indicar pequenos refinamentos. **Não houve publicação**, o CI certifica código, não substitui o smoke visual no navegador.

---

## Incremento de legibilidade — Consumo & Cotas

**Pedido do Fundador:** tornar a aba de consumo mais fácil de entender, com termos simples e indicação clara do que cada número mostra.

**Alterações de interface (nenhum cálculo/consulta alterado):**
- `AdminConsumptionHub`: resumo em três cartões (percentual da cota diária, interpretação e origem), frases explicativas para as cinco subvisões e limite apresentado como **referência de uso, não como fatura**. Sem medição é mostrado como ausência de dado, não zero.
- `AdminGlobalUsagePanel`: ajuda ao lado das barras de leituras, tempo real e gravações; glossário de operações e Read/Write Units; quantidade restante para a referência diária; diagnósticos técnicos recolhíveis via `<details>`; aviso de atraso e período diário do Google distinto do brasileiro.
- `AdminUsagePanel`: nomes legíveis (leituras, gravações, exclusões, atualizações recebidas, pico de observadores e envios de medição), cada qual explicado; unidades sem amostra exibem **Sem medição**, não um zero fictício.
- `AdminConsolidatedUsagePanel`: sequência de leitura (Google > UG > alertas), referência diária e cobertura explicadas; valores por UG mantidos como estimativas e não rateio financeiro.
- `AdminUsageReportsPanel`: ajuda sobre seleção de período, diferença entre fontes, datas sem registro e exportação CSV.
- `scripts/admin-visual-only.test.mjs`: testes estruturais adicionais integrados ao Application CI preexistente.

**Proteções:** Nenhuma edição em `app/api`, `lib`, `hooks`, `firestore.rules`, faturamento, autenticação, credenciais, métricas, fórmulas, agregações ou listeners. Os cinco componentes originais de consumo permanecem em operação, com os mesmos props, handlers e fontes. Nenhum custo novo de leitura induzido por essas explicações.

**Aceite humano:** Em `/admin?tab=consumo`, avaliar resumo superior; alternar entre cinco subvisões; compreender Read Units, consumos por UG, histórico e alertas; testar `Ver diagnósticos técnicos` apenas para inspeção. **Não usar ações reais de atualização de políticas** durante a validação visual.

---

## Superfícies e arquivos modificados

- `components/admin/PlatformAdminView.tsx`: somente importações visuais, grupos de navegação, marcação e classes de header/sidebar. Não mexer em callbacks/handlers/hook subscriptions.
- `components/admin/AdminVisualShell.module.css`: scrollbars/acentos visuais locais.
- `scripts/admin-visual-only.test.mjs`: assert de oito abas, callbacks funcionais, contratos do shell.
- `.github/workflows/application-ci.yml`: executar o teste visual-only durante Application CI.

## Como validar no localhost Windows

Execute num checkout isolado para não ressuscitar a branch antiga:

```powershell
cd "$HOME\emprovex-admin2-preview"
git fetch origin
git worktree add -b feat/admin-visual-organizacao-base-emprovex "$HOME\emprovex-admin-visual" origin/feat/admin-visual-organizacao-base-emprovex
cd "$HOME\emprovex-admin-visual"
npm.cmd ci
node --test scripts/admin-visual-only.test.mjs
npm.cmd run dev -- --port 3001
```

Abra `http://localhost:3001/admin` com a **conta fundadora**. Se o navegador estiver deslogado, efetue login pelo fluxo habitual. Como esta rota é a Administração **real** do app, teste **somente navegação/estética**; não clique em botões que alterem setor, cobrança, senha, backup ou sessões.

**Checklist de aceite:** oito abas intactas; mesmo conteúdo e tabelas; navegação em grupos; trilho luminoso discreto apenas no item ativo; header, identidade e rodapé alinhados; mobile 2 col/desktop 1 col; sem scroll desnecessário, sobreposições, contraste ruim ou animação com reduced motion; módulos e indicadores reais não substituídos por fictícios.

**Gates:** Application CI, Core Protection, guard Admin Information Architecture, guard Admin Sidebar Google Usage, build TypeScript, visual-only test e aceite humano. PR permanecerá DRAFT e não sofrerá merge/deploy antes do aceite.

## Handoff

**Onde estamos:** nova branch isolada da main para polimento estético da Administração atual. **O que fazemos:** adaptar navegação/header/identidade do App Shell original sem duplicar sistema. **Quem faz:** executor GitHub. **A seguir:** validar CI + smoke humano no localhost e ajustar detalhes visuais. **Quem fará:** executor valida CI; Fundador avalia a aparência e navegação.


## Ampliação expressa de escopo — UG-TELEMETRY-R3 (19/10/2026)

O Fundador pediu a execução das melhorias de estimativa por UG **na mesma branch/PR #341**, apesar de este PR ter nascido como exclusivamente visual. A partir desta autorização, o escopo foi ampliado para telemetria; a produção e a `main` permanecem fora de alcance.

### Implementado nesta rodada

1. **Categoria de origem em cada operação instrumentada**: `empenhos`, `notas`, `deposito`, `sessoes`, `outros`, em `lib/workspaceUsageTelemetry.ts`; as chamadas existentes em FirebaseSync, consultas históricas de NF, realtime operacional, concorrência de empenhos, sessões e depósito foram rotuladas por origem. Não é alegada cobertura completa de operações não instrumentadas.
2. **Mesmo documento diário por workspace**: campo opcional `moduleOperations`, com cinco contadores monotônicos; preserva `workspaces/{workspaceId}/usageEstimates/{dia}`, buffer em `sessionStorage`, primeiro envio após 60s e subsequentes após 15min. Contadores por módulo usam `increment` junto aos contadores existentes, sem `getDoc`, novos listeners ou documentos extras.
3. **Compatibilidade com dias antigos**: `lib/platformAdminUsage.ts` identifica ausência do mapa e informa ao painel que o detalhamento não existe; não presume zero como medição de módulo.
4. **Regras e isolamento**: `firestore.rules` autoriza apenas cinco chaves fixas de mapa, cada uma numérica não negativa e sem redução; conserva owner workspace/UG, version, source, dayKey, lastReportedAt e os demais invariantes v1.
5. **Interface por UG**: detalhamento de operações classificadas por módulo (incluindo `Outros`) e indicador de qual porcentagem das operações já captadas tem categoria conhecida; comparação proporcional com as Read Units do Google já carregadas, reutilizando `buildUsageReconciliation`; parcela global não atribuída não é redistribuída.
6. **Qualidade dos eventos**: snapshots de consulta enviados só do cache não são tratados como leitura comprovada do servidor. Os demais custos internos e de Rules continuam descritos como limitações.
7. **Testes**: cenários do Emulator para módulo aceito, incremento, negativa, redução e nome desconhecido; guardas de preservação do baixo custo e dos limites atualizados.

### Limites assumidos, sem falsos PASS

- **Não existe medição oficial Google de custo financeiro por UG**: os números continuam estimativos/proxy, jamais faturamento.
- Não há garantia `exactly once` no `setDoc(... increment(...))` atual: em falha ambígua de confirmação da rede um replay pode duplicar um lote. Implementar idempotência de ponta a ponta exigirá modelo adicional de confirmação no servidor/Emulator e comparação de custo, não deve ser improvisado em produção.
- A cobertura ainda não alcança absolutamente todas as operações diretas (incluindo algumas transações, backend e leituras indiretas de Rules), e a fórmula atual não calcula o custo específico de índices/tamanho por consulta. Isso exigirá auditoria de rotas e calibração representativa com Google Query Explain em ambiente controlado.
- `moduleOperations` mede o total de operações documentais instrumentadas classificadas por módulo, e **não** Read Units por módulo nem uma taxa de precisão do billing.
- A política de publicação permanece: PR DRAFT; exigir CI (Application CI, Core Protection, Firestore Emulator, TypeScript/build) e aceite humano de todas as abas afetadas; nunca migrar Rules isoladamente antes do código ou publicar sem autorização.

### Handoff

**Onde estamos:** PR #341 com evolução por módulo implementada, aguardando validações. **O que fazemos:** qualificar estimativas por UG sem leituras desnecessárias. **Quem faz:** executor GitHub. **A seguir:** CI e testes reais de Emulator, revisão de economia por UG e teste no localhost; projetar fase independente de idempotência/cobertura avançada. **Quem fará:** executor e fundador no aceite visual, sem mudanças em produção.

---


## Continuidade congelada em 19/10/2026 — próximo objetivo financeiro

**Estado vigente:** PR [#341](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/341) **DRAFT, SEM MERGE, SEM DEPLOY**. O último HEAD de código R3 aprovado por Application CI, Core Protection e Legal foi `5c61636799c53b7464f387a07d37131ead490808`. Os commits posteriores desta retomada são **documentais**; conferir CI do HEAD vigente antes de certificá-los. A `main`, a produção, Rules ativas e os dados dos usuários permanecem intocados nesta iniciativa.

**O Fundador perguntou, em seguida:** “é possível incluir um calculo em cima do consumo do firestore para saber qual vai ser o meu custo (diário, semanal e mensal) em reais considerando os dados que o firebase dispoe?”. A pergunta **ainda não recebeu implementação** e é exatamente a próxima solicitação a ser tratada no chat seguinte.

### Resposta/arquitetura a investigar antes de programar

É tecnicamente possível **estimar parcialmente** gasto do Firestore a partir das métricas e tarifas conhecidas. Para dar um valor em reais que não induza ao erro, o sucessor deve verificar tarifa efetiva, banco/edição/região, franquias diárias, pesos de `Read Units`/`Write Units`/`Realtime Read Units`, custos de storage/backup/rede quando houver fontes, preços e câmbio atuais, impostos/créditos e dados oficiais do Cloud Billing disponíveis. Onde essas fontes faltarem, marcar valor como **estimativa parcial/indisponível**, não como custo exato ou cobrança confirmada.

**Proposta de UX:** acrescentar à área `Consumo & Cotas`, mantendo a identidade visual clara do PR #341, cartões de **Estimativa hoje**, **Últimos 7 dias**, **Mês atual** e **Projeção do mês**, com rótulos sobre períodos incompletos, atraso da métrica, timestamp das tarifas/câmbio, itens incluídos/não incluídos e um link/atalho para fatura oficial. Não somar dados por UG como se fossem a fatura: a comparação por UG segue proxy, não custo financeiro oficial.

**Aproveitar fontes presentes no código:** `lib/server/googleCloudMonitoring.ts`, `lib/platformCapacity.ts`, `lib/server/globalUsageHistory.ts`, `lib/platformAdminUsageHistory.ts`, `lib/usageReconciliation.ts`, `components/admin/AdminConsumptionHub.tsx`, `components/admin/AdminGlobalUsagePanel.tsx` e `components/admin/AdminUsageReportsPanel.tsx`. Evitar novos listeners, polling e gravações por evento para essa projeção.

**Próximo executor:** começar por pesquisa de SKUs e preços oficiais e contrato do snapshot real, explicar limitações, definir modelo calculável e testes de precisão/cobertura; solicitar confirmação de escopo somente se surgirem decisões de produto relevantes. Se solicitado implementar, fazê-lo **na mesma branch** com testes, GitHub Actions e novos registros documentais. Não fazer merge/deploy nem tocar a produção sem autorização explícita.

**Para prévia local Windows:** não reutilizar a branch eliminada `feat/admin2-w01-sidebar-local-preview`. Usar clone limpo da `feat/admin-visual-organizacao-base-emprovex` em `$HOME\emprovex-admin-visual` e abrir `http://localhost:3001/admin?tab=consumo`. A rota real /admin executa funcionalidades verdadeiras; durante QA de layout usar somente navegação/consulta, nunca mutações produtivas.

**Handoff padrão:** onde estamos — PR #341 DRAFT, R3 código pronto/CI certificado antes da atualização documental; o que fazemos — decidir próximo estimador financeiro Firestore global; quem faz — sucessor no GitHub; próximo passo — responder viabilidade e preços/contrato para custo diário/semanal/mensal em BRL; quem fará — sucessor após instrução do Fundador e sob restrições de QA/produção.



## COST-FIRESTORE-R1 — estimativa financeira global do Firestore em BRL (19/10/2026)

Solicitação do Fundador executada **somente na branch feat/admin-visual-organizacao-base-emprovex / PR #341 (DRAFT)**. Não houve merge, deploy, alteração de regras ativas, escrita de dados produtivos ou mudança na cobrança.

### O que foi entregue
- Aba **Consumo & Cotas → Estimativa de custos · R$** na Administração original, sem substituir as demais abas.
- Motor puro \`lib/firestoreCostEstimate.mjs\`, com contrato \`.d.mts\`, calcula separadamente **Read Units, Write Units, Realtime Read Units** a partir dos snapshots do Cloud Monitoring e do histórico diário existente; preço em USD por milhão e câmbio USD/BRL fornecidos pelo fundador.
- Cartões: **Hoje (parcial), últimos 7 dias, mês até agora, projeção do mês**. Períodos sem medição são explicitamente incompletos, não tratados como zero. Projeção requer pelo menos três dias passados observados, cobertura histórica de 80% e informação do dia atual; dia atual não é extrapolado como completo.
- Preços editáveis e referenciados à tabela pública **Enterprise, Iowa/us-central1, preços padrão em USD**, consulta em 19/10/2026: Read Units USD 0,05/milhão; Write Units USD 0,26/milhão; atualizações em tempo real USD 0,30/milhão. **Valores são referência, não regionais/contratuais confirmados**. Fonte: https://cloud.google.com/firestore/enterprise/pricing.
- Câmbio é **obrigatoriamente manual** para apresentar números em reais; sem câmbio confirmado a interface mostra “R$ —” e custo parcial em USD. Não há dependência de API de câmbio externa, cotação fictícia ou valor escondido.
- Franquia grátis **desligada por padrão**; usuário opta manualmente só após confirmar elegibilidade do banco. Quando ligada, descontos por limite diário específico de RU, WU e realtime, **não por mês**. Para dia sem limite confiável, custo fica indisponível.
- Somente reutiliza \`loadGlobalUsageHistory\` via consulta limitada aos registros diários entre o início do mês e os últimos sete dias. A aba executa a consulta **apenas ao entrar** e ao clicar em Atualizar; **não** cria listeners, polling, gravações, endpoints nem leitura por UG. O snapshot ao vivo reutiliza as props do painel. Campo opcional \`metricsComplete\` marca o histórico legado sem unidade faturável completa como não calculável.
- **Não é fatura Google Cloud.** Exclusões gerenciadas, eventos, storage, PITR, backup, restauração, rede, impostos, descontos, créditos e serviços externos não entram no valor. Cobrança oficial: https://console.cloud.google.com/billing. Não atribuir valor financeiro a UGs (somente métricas/proxy R3).
- Testes de unidade: \`scripts/firestore-cost-estimate.test.mjs\` integrado ao Application CI para cobrar cálculo por dia, lacunas, tarifas, franquia e condição de projeção.

### Gates, segurança e estado
Application CI, TypeScript/build, Core Protection, Firestore Rules/Emulator e aceite humano precisam ser verificados sobre o **HEAD final**. O código de custo **não depende da migração de Firestore Rules**. Não anunciar PASS de checks até constarem concluídos na GitHub Actions. Não publicar sem comando separado do Fundador. Para QA local: \`http://localhost:3001/admin?tab=consumo\`; usar conta fundadora e modo somente leitura.

### Handoff
**Onde estamos:** PR #341 aberto em DRAFT, módulo de custo R1 implementado no código, sem produção. **O que fazemos:** certificação de testes e conferência visual/financeira. **Quem faz:** executor GitHub/CI. **Próximos passos:** confirmar região, edição, elegibilidade do free tier, taxa cambial aplicada e SKUs efetivos em Cloud Billing; se necessário evoluir integração server-side somente sob autorização adicional. **Quem fará:** Fundador valida parâmetros e aparência; executor corrige problemas apontados e mantém memorial.


## ADMIN-WORLD-HOME-R1 — Bairro digital 3D (19/10/2026)

**Solicitação expressa do Fundador:** criar nova aba **Início** na Administração original, com um bairro digital em perspectiva isométrica 3D: cada conta = uma casa; janelas quentes iluminadas para sessões válidas; ruas, lotes, árvores, jardins, postes de iluminação, telhados e caixas de correio; grande caixa d'água transparente ao fundo representando a ocupação da referência diária de consumo Firestore.

**Implementado exclusivamente no PR #341 (branch \`feat/admin-visual-organizacao-base-emprovex\`; DRAFT; sem merge e sem deploy):**
- \`components/admin/AdminWorldHomePanel.tsx\` e \`.module.css\`: HUD noturno com indicadores, cena responsiva, controles de rotação limitada, zoom, seleção de conta e navegação por quarteirões de 9 residências. Em telas pequenas a maquete admite rolagem horizontal em vez de distorcer ou suprimir casas.
- \`components/admin/AdminWorldScene.tsx\`: composição programática de geometria com coordenadas x/z/altura projetadas em SVG isométrico; casas 3D estilizadas com variação discreta de paleta e iluminação, ruas/faixas, vegetação, postes, caixas de correio, caminhos, reservatório translúcido com nível proporcional. Não usa dependência adicional de Three/WebGL e não carrega assets remotos.
- \`lib/adminNeighborhoodModel.mjs\` + \`.d.mts\`: mapeamento determinístico de uma casa por **conta real única** de \`adminDirectory.directory.accounts\`, incluindo administrador e usuários de setor, sem criar usuários demonstrativos. Para registrar **presença**, cruza sessões existentes por UID vinculado (email apenas como alternativa quando UID da conta não está disponível), exige \`expiresAt > now\`, deduplica múltiplas sessões e deixa contas suspensas sem luz. Falha/ausência dos dados de sessões = \`unknown\`, **não falso offline**. A luz significa **sessão válida**, e não atividade humana em tempo real.
- Caixa d'água: \`billableReadUnits / billingReference.readUnitsDailyLimit\` no snapshot global já carregado; indicador textual preserva valor >100% e altura da água fica limitada ao reservatório. Sem métrica válida, aparece “Sem dados”. Trata-se de referência diária, não limite de interrupção, custo por UG ou fatura.
- Integração: \`app/admin/page.tsx\` transmite \`adminDirectory.directory.accounts\` como prop à \`PlatformAdminView\`; \`PlatformAdminView\` insere \`inicio\` como aba inicial. As oito abas originais (inclusive \`overview\`/Visão Geral) permanecem acessíveis e os handlers operacionais não foram alterados. \`/admin\` abre a nova Início; \`/admin?tab=overview\` mantém a Visão Geral.
- Eficiência: **nenhuma consulta/leitura nova, nenhuma gravação, nenhum listener adicional, nenhum polling de Firestore, nenhuma nova Rules ou endpoint**. Clock local de 60 s apenas revalida a expiração de leases visualmente; renderiza no máximo nove casas por quarteirão.
- Acessibilidade: seleção por teclado, legenda textual, status desconhecido distinto de offline, CSS prefers-reduced-motion e texto acessível para dados do reservatório.
- Testes: \`scripts/admin-world-neighborhood.test.mjs\` (uniqueness, identidade, expiração, fail-closed, paginação, referência sem dados, proibição de consultas), \`scripts/admin-visual-only.test.mjs\` atualizado para preservar as oito abas. Comando \`npm run test:admin-world-neighborhood\` registrado no Application CI.

**Gates:** verificar conclusão **do último HEAD de código**, TypeScript, testes de unidade, build, Core Protection, Recovery, Legal e Application CI. Nunca afirmar PASS de CI ainda em progresso. Não houve QA visual humano, nem merge/deploy/publicação. A validação local não pode acionar botões mutacionais. Sem ajuste de Firestore Rules ativas.

**Como inspecionar sem deploy:** no PowerShell Windows, no checkout da branch do PR #341, \`git pull --ff-only\`, \`npm.cmd ci\` (quando preciso), \`npm.cmd run dev -- --port 3001\` e abrir \`http://localhost:3001/admin\` com a conta fundadora. Para o painel prévio, \`http://localhost:3001/admin?tab=overview\`. Se \`localhost:3001\` já estiver executando uma versão antiga, reiniciar o servidor no checkout atualizado.

**Handoff:** onde estamos — 3D bairro integrado no PR #341 DRAFT; o que fazemos — certificar o HEAD e validar estética no navegador; quem faz — executor GitHub (código e CI), Fundador (aceite visual); a seguir — inspeção visual local, refinamento de detalhes de maquete e confirmação de leitura de sessões/cota; quem fará — Fundador no navegador e executor nas correções, SEM alterar produção.


## ADMIN-WORLD-R1.1 — Nova maquete isométrica fiel à referência (19/10/2026)

**Solicitação:** substituir a aparência esparsa do bairro anterior pela composição da referência visual enviada pelo Fundador: malha de ruas convergente, grande edifício central, vários prédios de fachada branca/vidro azul, coberturas verdes, jardins e árvores densas, passagem de pedestres, postes e caixa-d'água translúcida à esquerda com leitura do consumo Firestore. Tema escuro EMPROVEX permanece no restante da UI.

**Executado apenas na branch do PR #341, sem merge ou deploy:**
- Novo \`components/admin/AdminWorldArchitecture.tsx\` contém geometria projetada 3D de edifícios, fachadas com janelas por pavimento, telhados verdes, hall simbólico da plataforma, árvores detalhadas, luminárias, caixas de correio e reservatório cilíndrico com água interna recortada por clipPath. Sem novas dependências, imagens externas nem WebGL.
- \`AdminWorldScene.tsx\` redesenhado: maquete simétrica de 15 lotes cenográficos, 4 braços viários principais até a praça central, vias secundárias, faixas, calçadas, jardineiras e pedestal com espessura. O edifício central é **marco simbólico EMPROVEX**, não representa conta adicional nem sessão falsa.
- Atribuição a usuários: apenas **até nove prédios identificados** por quarteirão representam contas reais. O restante é cenário urbano **não clicável** e não entra nas contagens; não há nomes/usuários fictícios. Fachadas dos usuários só recebem janelas amarelas iluminadas quando a sessão existente foi validada. Sem sessão ou sem telemetria de presença, respeitar os estados originais.
- Caixa d'água recebe as props existentes \`waterKnown/waterLevel/waterExceeded\`: líquido visível proporcional à referência diária de billableReadUnits, status sem medição e indicação de extrapolação sem cortar a porcentagem textual.
- Textos da nova Início explicam explicitamente a diferença entre prédio identificado e construção de cenário; mantêm legenda, painel de conta, navegação por quarteirões, zoom, rotação suave e acessibilidade por teclado.
- Testes do bairro atualizados para separar a geometria \`AdminWorldArchitecture.tsx\` da cena e garantir continuação da ausência de consultas/alterações Firestore. O CI e guardrails devem ser certificados sobre o último HEAD.
- Edição estética foi feita exclusivamente na nova Início (sem alterar as oito abas originais, stores, Rules, billing, workspaces ou produção).

**Aceite pendente:** abrir \`http://localhost:3001/admin\` com a conta fundadora depois de atualizar o checkout do PR #341; validar estética/densidade, leitura das janelas por conta, proporção do reservatório, zoom e navegação. Não anunciar inspeção de navegador realizada sem evidência do Fundador. Evitar merge/deploy até solicitação expressa.

**Handoff:** onde estamos — R1.1 implementada no PR #341 DRAFT; o que fazemos — certificação de CI e validação estética humana; quem faz — executor GitHub (código, checks, memorial), Fundador (navegador); a seguir — revisar screenshot real da nova Início e ajustar a geometria conforme feedback; responsável — executor somente após aceite/correções solicitadas.


## ADMIN-WORLD-R1.2 — Lotes vazios, conta fundadora central e legendas nos telhados (19/10/2026)

**Pedido do Fundador:** manter os lotes urbanos visualmente vazios enquanto não houver conta associada; reservar o prédio central exclusivamente à conta fundadora APROV HGeSM; mover as etiquetas das contas para **acima dos edifícios**.

**Alterações implementadas no PR #341, branch \`feat/admin-visual-organizacao-base-emprovex\`, ainda em DRAFT:**
- Identidade fundadora comprovada no contrato existente: \`HGESM_SECTOR_EMAIL = aprov1hgesm@gmail.com\`, workspace \`hgesm-aprov\`. O cadastro fundador usa \`accountType='sector'\` com privilégio administrativo resolvido em seu contexto, **não cria segunda conta de administrador**. \`partitionNeighborhoodResidents\` usa esse e-mail normalizado, retira a conta dos lotes laterais e a associa exclusivamente à construção central.
- \`components/admin/AdminWorldHomePanel.tsx\`: a contagem mantém todas as contas reais (incluindo fundadora), mas a paginação de nove casas é restrita às demais contas. O edifício central é selecionável como os demais e usa presença baseada exclusivamente na sessão de identidade real. Se a conta ainda não estiver carregada, o prédio central mantém identificação de lugar reservado, sem acender nem criar sessão fictícia.
- \`AdminWorldScene.tsx\`: edifícios laterais só são instanciados **quando existe usuário real correspondente**. Lotes sem usuário mostram somente piso e marca de parcela disponível, sem prédio nem caixa de correio. Os slots se preenchem automaticamente quando o diretório existente enviar novas contas, respeitando os quarteirões. Nenhuma conta é representada duas vezes.
- \`AdminWorldArchitecture.tsx\`: \`CityBuildingLabel\` renderiza as legendas **no último passe SVG, sobre os telhados**, evitando sua ocultação por fachadas, jardins e construções. Prédio fundador rotulado **APROV HGeSM** acima do edifício. Indicadores de status respeitam online, offline, suspenso e desconhecido. A porta/identidade do edifício central continua refletindo a conta fundadora, não apenas um marco cenográfico.
- UI atualizada para falar em prédios ocupados, prédio selecionado e lotes vazios. Os oito módulos históricos continuam preservados.
- \`scripts/admin-world-neighborhood.test.mjs\`: acrescentados testes de identidade fundadora, não duplicação, paginação lateral e guards estáticos contra prédios cenográficos, com verificação de etiquetas e slots.
- **Sem Firestore reads/writes adicionais, sem novos listeners, sem deploy, sem merge e sem modificação em produção.** Tests/CI/Legal/Recovery/Core devem ser certificados **no HEAD final**, e a aparência permanece sujeita a aceite humano.

**Handoff:** Onde estamos — R1.2 com slots vazios, torre fundadora e legendas acima das construções no PR #341 DRAFT. O que estamos fazendo — certificação de CI e atualização da prévia local. Quem faz — executor no GitHub; Fundador na inspeção visual. Próximo passo — usar \`git pull --ff-only\` na branch do PR #341, reiniciar \`npm.cmd run dev -- --port 3001\` e abrir \`http://localhost:3001/admin\`. Quem fará — Fundador valida; executor corrige refinamentos apontados.
