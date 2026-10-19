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
