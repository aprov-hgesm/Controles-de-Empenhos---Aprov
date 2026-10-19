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
