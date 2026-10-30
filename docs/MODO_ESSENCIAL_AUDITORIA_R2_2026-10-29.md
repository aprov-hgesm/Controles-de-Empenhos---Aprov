# EMPROVEX — Auditoria R2 de Simplificação, Minimalismo e Desempenho (29/10/2026)

> **Natureza:** segunda auditoria **estática dirigida** da branch `feat/visual-mode-r1-session-navigation`, pós-implementação do seletor e da simplificação decorativa R1. Este documento **não** afirma que houve compilação, execução em navegador, benchmark CPU/GPU/RAM ou teste funcional autenticado. É uma fila técnica de intervenções baseada no código efetivamente inspecionado.
>
> **Estado:** somente análise e documentação. Nenhum arquivo de runtime alterado por esta auditoria; produção, banco, regras, identidades, faturas e deploy intocados.
>
> **Contrato canônico:** [MODO_ESSENCIAL_MEMORIAL_OFICIAL.md](./MODO_ESSENCIAL_MEMORIAL_OFICIAL.md) §0. O modo é escolhido **por sessão**; Normal preserva os visuais; Essencial simplifica apresentação e processamento **sem perder nenhuma funcionalidade**. **Central de Depósitos 3D absolutamente intocável**, em renderizador, câmera, rótulos, zoom, qualidade, estruturas, valores e comportamentos. CSS da casca pode ser diferente, mas nunca a cena/experiência 3D.

## 1. Escopo e evidências diretamente verificadas

Arquivos da branch examinados: `features/dashboard/components/DashboardView.tsx`, `features/operational/components/OperationalWorkspace.tsx`, `hooks/useOperationalData.ts`, `hooks/useOperationalRealtimeCollections.ts`, `lib/operationalSubscriptionPlan.ts`, `features/inicio/hooks/useInicioOperationalSnapshot.ts`, `components/admin/PlatformAdminView.tsx`, `components/auth/EmprovexLogin.tsx`, `components/auth/LoginAtmosphere.tsx`, `components/visual/EmprovexBorderBeam.tsx`, `components/layout/AppHeader.tsx`, `components/layout/WorkspaceDriveControl.tsx`, `hooks/useWorkspaceDriveStorage.ts`, `hooks/useWorkspaceBillingAccount.ts`, `hooks/usePlatformBranding.ts`, `components/layout/AppBackground.tsx`, `features/warehouse/components/WarehouseSectionContent.tsx`, `features/warehouse/components/WarehouseModuleShell.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/visual-mode-essential.css`, `lib/pdfToolkit.ts` e hooks de Empenhos, Notas Fiscais, Cronogramas, SAG/NS e Relatórios.

**Contagens de texto-fonte, não métricas de runtime ou tamanhos transferidos:**

| Artefato | Tamanho do código inspecionado | Indício observável |
|---|---:|---|
| `DashboardView.tsx` | 694 linhas / ~41,2 mil caracteres | 21 ocorrências de `.reduce(`, 10 de `.filter(`, **nenhuma** de `useMemo(` |
| `OperationalWorkspace.tsx` | 519 linhas / ~19,3 mil caracteres | Chama hooks dos seis domínios de ação no mesmo componente; views já usam `next/dynamic` |
| `PlatformAdminView.tsx` | 1.283 linhas / ~59 mil caracteres | Só `AdminWorldHomePanel` foi colocado sob `React.lazy` na branch; outros painéis são imports estáticos |
| `EmprovexLogin.tsx` | 542 linhas / ~26,7 mil caracteres | Cena pesada já lazy/condicional; **`motion/react` ainda importado** no componente base |
| `app/globals.css` | 4.708 linhas / ~118,6 mil caracteres | Diversos estilos globais e animações; novas sobrescritas do Essencial **não eliminam os bytes da folha global** |
| `WorkspaceDriveControl.tsx` | 238 linhas / ~9,7 mil caracteres | `WorkspaceBackupSection` é importado estaticamente, embora o diálogo só monte quando `open` |
| `hooks/useWorkspaceDriveStorage.ts` | 168 linhas aprox. | Busca configurações na montagem, mantém estado e sessão Drive; deve permanecer funcional |
| `useOperationalRealtimeCollections.ts` | 431 linhas | **Proteção positiva:** assinaturas Firestore são selecionadas por aba; NÃO desativar indiscriminadamente |

Referência histórica: [MODO_ESSENCIAL_AUDITORIA_2026-10-24.md](./MODO_ESSENCIAL_AUDITORIA_2026-10-24.md), sobretudo DV-09, DV-12, DV-14 e DV-17. Este documento reexamina evidências na **branch atual**, separando pendências reais do que já foi implementado.

## 2. Achados novos e persistentes — ações priorizadas

### A01 · P0 · Dashboard: pré-agregação financeira uma vez por conjunto de dados
**Confirmação no código:** `DashboardView.tsx`, regiões ~55–75, 110–190, 365–380, 480–505, 560–566. Os totais, agrupamentos por classe, RPNP, progresso e subtotais refazem múltiplos percursos da lista, inclusive ao digitar em busca/filtro. Não há `useMemo` no componente.

**Recomendação:** construir modelo de apresentação memoizado a partir de `empenhos` e `empenhoClasses`, com um acumulador por empenho e por classe/RPNP, índices para busca e subtotais, preservando exatamente filtros/valores existentes. Usar `useMemo` com dependências explícitas e não persistir resultados derivados no Firestore. Debounce/deferred apenas da busca informativa, nunca de campos de operação.

**Risco:** médio — domínio financeiro. **Aceite:** totais empenhado, liquidado, saldo, percentuais, classes/RPNP, filtros e documentos idênticos em conjuntos controlados, inclusive arredondamentos e dados vazios. Não trocar regras de cálculo para ganhar velocidade.

### A02 · P0/P1 · Listagem financeira extensa: renderização gradual ou paginação
**Confirmação:** `DashboardView.tsx` ~481–590 chama `filteredClassEmpenhos.map` diretamente e monta uma linha de tabela para cada empenho de cada classe. Isso escala com o tamanho da lista, inclusive quando o usuário só precisa dos KPIs.

**Recomendação:** manter **indicadores calculados sobre todos os dados** e limitar **apenas linhas visíveis** por classe, com `Mostrar mais` progressivo ou paginação simples sem dependência nova. Preservar busca em toda a base, seleção/edição, atalhos, impressão, download/exportações completas e navegação de teclado. Virtualização só quando houver volume real suficiente para justificar.

**Risco:** baixo/moderado para apresentação, médio para foco e acesso aos registros. **Aceite:** zero registros desaparecidos, contagem total correta, todos acessíveis pelo teclado e pesquisa global completa.

### A03 · P1 · Separação das ações operacionais por aba
**Confirmação:** `OperationalWorkspace.tsx` importa e instancia em uma só árvore os hooks `useEmpenhoActions` (~898 linhas), `useNotasFiscaisActions` (~929), `useAvisosActions`, `useSagNsImportActions` (~174), `useDocumentActions` (~928), `useCronogramaActions` (~792), além de classes. Embora os componentes de telas já sejam dinâmicos, o conjunto de código de ações continua alcançável através do workspace principal. Os valores em linhas são de **fontes**, não prova de transferência no mesmo chunk.

**Recomendação:** introduzir presenters/containers específicos de tela com imports de ações por domínio; manter estado de formulários, drafts, callbacks e contexto compartilhado em boundary estável. Alternativa inicial conservadora: isolar ações de relatórios e envio de cronograma, depois medir o custo de primeira visita ao Painel.

**Risco:** médio/alto (ações de NF, empenhos, integridade de NS e cronograma). **Aceite:** exatamente mesmas chamadas, validações, histórico, upload, rollback, emails e PDFs; nenhum estado de formulário perdido ao alternar abas; mesmo controle de identidade.

### A04 · P1 · Administração: lazy-load por subaba
**Confirmação:** `PlatformAdminView.tsx` importa estaticamente `AdminBackupPanel`, `AdminConsumptionHub`, `AdminCreateSectorPanel`, `AdminSecurityPanel`, `AdminBillingPanel`, `AdminAccessRequestsPanel`, `AdminSessionsPanel`, `EditSectorModal`. `AdminWorldHomePanel` já foi convertido para lazy.

**Recomendação:** importar dinamicamente cada painel conforme a aba, com fallback pequeno, mantendo o roteamento por `?tab=`, todos os botões e a autorização atual. Modal de edição pode ser importado apenas na abertura, com preservação do formulário.

**Risco:** baixo/moderado para componentes visuais; maior risco para modais/backup. **Aceite:** acesso a cada aba direto via URL, retorno com histórico, feedback de carregamento e autorização; nenhuma rotina administrativa ausente.

### A05 · P1 · Google Drive: dividir painel fechado de controles que precisam ficar ativos
**Confirmação:** `WorkspaceDriveControl.tsx` importa `WorkspaceBackupSection` antecipadamente, apesar de renderizá-lo apenas em `open && (...)`; `useWorkspaceDriveStorage` consulta configurações e observa mudanças na sessão.

**Recomendação:** lazy-load **somente o corpo do diálogo e o painel de backup**, preservando o estado/indicador do botão e os mecanismos de expiração, autenticação Google e sessão. Se Network provar que `loadWorkspaceDriveSettings` custa caro, avaliar cache por contexto com invalidação; não desligar leitura/capacidades sem entender o fluxo.

**Risco:** baixo/moderado para o bundle do modal; alto para credenciais se houver mudança no hook. **Aceite:** status conectado/desconectado correto, reconexão, upload, pastas, backup, refresh, erro e encerramento de sessão sem regressão.

### A06 · P1 · Minimalismo de cartões, buscas e menus — sem mexer na operação
**Confirmação:** Dashboard e componentes de interface usam múltiplas camadas `backdrop-blur`, sombras, gradientes e cartões com repetição de hierarquia. O novo CSS Essencial já retira efeitos na casca e em certos alvos, mas não elimina automaticamente cada classe Tailwind utilitária do conteúdo.

**Recomendação:** variantes de componente `EssentialSurface`/tokens de apresentação para **cards de KPI, cabeçalhos, filtros, relatórios e tabelas não 3D**. Fundo sólido claro, tipografia consistente, borda 1px, sombra mínima, realce em hover/focus sem blur. Pode compactar legendas redundantes e espaços decorativos, mas **não ocultar colunas/dados essenciais**; detalhamento completo permanece acessível sem novo login/clique escondido.

**Risco:** baixo para cor/fundo; moderado para responsividade, tabelas e legibilidade. **Aceite:** contraste WCAG apropriado, todos os campos e labels existentes, sticky headers e mensagens intactos.

### A07 · P1/P2 · Login Essencial: eliminar dependência residual de animação no caminho leve
**Confirmação:** `EmprovexLogin.tsx` isolou `LoginAtmosphere` e `LoginBrandStage` via lazy e usa palco estático no Essencial; porém mantém `motion.main` com import de `motion/react`. `LoginSuccessTransition` e outros componentes podem carregar o pacote quando utilizados.

**Recomendação:** extrair o wrapper animado da experiência Normal para componente lazy independente, deixando o mesmo formulário/handlers sob wrapper estático no Essencial. **Não bifurcar a autenticação**: o callback de login, recuperação e proteção devem permanecer únicos.

**Risco:** moderado por envolver login. **Aceite:** e-mail/senha, Google, recuperação, campos, validação, toque, teclado e feedback idênticos. Redução de JS só pode ser proclamada após comparar chunks.

### A08 · P2 · CSS global grande: separação por rota, não remoção cega
**Confirmação:** `app/globals.css` tem ~118,6 mil caracteres de fonte e declara regras de login, app shell, motion e Central. `visual-mode-essential.css` sobrepõe estilos, mas **não reduz tamanho de download** do CSS global.

**Recomendação:** mapear regras por escopo e dependência; separar login/admin/operacional em módulos por rota ou componentes quando compatível com Next. **Não remover keyframes por contagem** nem deslocar seletores que vazem para outros módulos; testar depois em produção compilada.

**Risco:** médio/alto (efeitos de cascata, Tailwind, PWA, responsividade, acessibilidade). Adiar até ganhos mais seguros de renderização.

### A09 · P2 · Sessões e assinaturas: não economizar dados às cegas
**Confirmação:** `useOperationalRealtimeCollections` já ativa `empenhos`, `alerts`, `invoices`, `comissoes` e `cronogramas` conforme `operationalSubscriptionPlan`; `useInicioOperationalSnapshot` publica snapshot consolidado quando Empenhos/NF/Avisos estão ativos; `useWorkspaceBillingAccount` mantém `onSnapshot` do status comercial.

**Diretriz:** preservar listeners essenciais e as publicações funcionais do snapshot, que também atende sessões Normais e painéis. Não remover listeners ou alterar esquema de dados sob pretexto de aparência. Se houver excesso de leituras, auditar separadamente com métricas por rota, volume e política de cache, sem enfraquecer a autorização.

**Risco:** alto; fora da etapa de simplificação visual. **Não executar por padrão.**

### A10 · P2 · Marca e fontes: otimizações menores com prova
**Confirmação:** `usePlatformBranding` já usa `sessionStorage` para evitar leituras repetidas, mas aplica favicon com `Image`/Canvas nas montagens; `app/layout.tsx` carrega Inter, JetBrains Mono e Montserrat; `lib/pdfToolkit.ts` já carrega `jspdf` e `jspdf-autotable` via `import()`.

**Recomendação:** **preservar** carregamento PDF sob demanda e cache de marca; verificar se conversão de favicon ou fontes realmente pesam antes de investir. Nenhuma mudança preventiva em fontes se sacrificar tipografia.

**Risco:** baixo/médio; ganho incerto sem medição.

### A11 · Risco de navegação a acompanhar (QA, não otimização imediata)
**Confirmação:** `WarehouseModuleShell.tsx` mantém sincronização entre `usePathname`, `activeSectionId` e `history.pushState/replaceState`; o modo Essencial redireciona a home para Controle. É um fluxo sensível a histórico, rotas diretas, refresh e troca de modo.

**Recomendação:** não refatorar essas rotas para reduzir JS. Na validação final, exercitar F5, voltar/avançar, alternância Normal↔Essencial, links diretos, abas operacionais e entrada no 3D. Corrigir apenas regressões reproduzidas.

**Risco:** médio. **Aceite:** rota correta, nenhuma landing visual Essencial montada, menu ativo correto, nenhum loop nem perda de acesso.

## 3. O que JÁ está bem otimizado — evitar retrabalho

- Normal/Essencial por sessão (`sessionStorage`) já existe na branch; menu e landings ocultos no Essencial.
- Visual do login pesado é lazy e condicional; animação de ambiente `requestAnimationFrame` não monta no Essencial.
- Bordas/efeitos globais de casca estáticos no Essencial; `EmprovexBorderBeam` evita observers desnecessários no Essencial.
- Telas principais do workspace operacional e Warehouse são carregadas por `next/dynamic`, preservando a separação por rota/aba.
- Firestore possui plano de coleções por aba, com validação de identidade/autorização fora do modo visual.
- `usePlatformBranding` já cacheia marca por sessão; pdfToolkit usa imports dinâmicos.
- `WarehouseModuleShell` mantém `immersive=true` para `overview` 3D; `AppBackground` não simplifica sua cena.

## 4. Sequência de desenvolvimento recomendada — sem burocracia, com proteção do usuário

| Fase | Entregas | Risco relativo | Condição objetiva |
|---|---|---|---|
| **R2-A** | Admin lazy por aba; Drive modal lazy; acabamento estático explícito dos cards não 3D | Baixo/moderado | Todos os controles disponíveis, fallbacks e URLs preservados |
| **R2-B** | Paginação/progressivo do detalhamento financeiro; agregações memoizadas e índices | Moderado | Contagens e **valores financeiros rigorosamente idênticos** |
| **R2-C** | Ações do workspace segmentadas por módulo; wrapper Motion isolado no login | Moderado/alto | Mesmos fluxos de NF/NE, documentos, SAG/NS, sessão e identidade |
| **R2-D** | CSS por rota, fontes, tamanho de bundle, otimizações finas confirmadas | Condicional | Somente com evidência de ganho e comparação de compilação |

**Não exigir benchmark completo a cada alteração**, conforme a diretriz do fundador. Em cada commit, conferência curta de imports, tipos e navegação crítica quando ambiente disponível; juntar testes extensos, CI, perfis de hardware e certificação 3D **no fechamento da configuração da R2**. Em áreas financeiras e de segurança, ainda são obrigatórios guardas básicos proporcionais ao risco antes do merge/publicação.

## 5. Contrato do minimalismo funcional

**Pode mudar:** cor, superfície, sombra, efeitos animados, tamanho/margem decorativos, apresentação de cards, forma de paginar linhas, carregamento de subpainéis e índices derivados **sem alterar resultados**.

**Não pode mudar:** NE/NF/NS, valores, saldos, filtros e busca sobre a base completa, histórico, cadastro, edição, exclusão confirmada, operações Warehouse, scanner/barcode, validade, arquivos/Google Drive, relatórios/PDF, envio de cronogramas, avisos críticos, login, assinatura, permissões, 2D e 3D do depósito, auditoria ou restauração. Nenhuma opção pode desaparecer silenciosamente; se houver simplificação de navegação, manter acesso óbvio, nomes previsíveis e teclado funcional.

**Critério de comparação:** operações, números e dados são **iguais nos modos Normal e Essencial**, exceto a preferência visual temporária e o conteúdo estritamente decorativo suprimido. Ganhos prometidos dependem de futura medição (CPU, tarefa longa no main thread, memória, JS por rota, FCP/INP); não atribuir percentuais sem prova.

## 6. Próximo checkpoint, sem alteração de produção

- Documento só nesta branch; **não** cria PR, faz merge, altera Vercel ou executa testes complexos.
- Prioridade prática imediata: **R2-A**. Depois executar **R2-B**, que oferece maior potencial de alívio de CPU em bases com muitos empenhos.
- Manter o contrato original do Memorial Oficial e atualizar o checkpoint por cada frente concluída.
