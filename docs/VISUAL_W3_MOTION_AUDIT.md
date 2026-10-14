# EMPROVEX VISUAL-R1 — Worker 3 / VISUAL-MOTION-01

Data: 2026-10-14  
Responsável: Worker 3  
Base de trabalho: `main@97556bb8eb04af070016f9e58ddc2d9cca36bb35`  
Branch: `visual-w3-motion-01`  
Escopo: motion e microinterações, sem mudança de regras ou dados. Integração apenas pelo Coordenador VISUAL-R1 e Worker 5.

## Auditoria estática inicial

| Área | Evidência no HEAD base | Decisão |
| --- | --- | --- |
| Modais | `components/admin/CreateSectorModal.tsx` usa diálogo sem animação estrutural; `features/empenhos/components/DeleteEmpenhoModal.tsx` usa `AnimatePresence` | Preservados: ações sensíveis, foco e possíveis dependências do shell |
| Menus e dropdowns | Navegação compartilhada em `components/layout/AppSidebar.tsx` e `AppHeader.tsx`; seletor expansível em `SagSupplierStep.tsx` | Refinar apenas seletor SAG, com montagem/desmontagem imediata |
| Abas e seletores | `RelatoriosView.tsx` usa `transition-all` nos botões; cards SAG usam `transition-all` | Restringir propriedades animadas e reforçar foco visível |
| Toasts e notificações | `components/layout/ToastNotification.tsx` já usa `motion/react`, `AnimatePresence` e `useReducedMotion`; mensagens de erro usam `role=alert` | Não editar componente compartilhado; preservar semântica |
| Indicadores numéricos | Contadores da `CentralAvisosView.tsx` exibidos diretamente; progresso SAG troca número por ícone de conclusão | Evitar contagem fictícia; refinar só a confirmação do passo SAG |
| Sucesso e erro | Toast já distingue `alert`/`status`; telas SAG exibem erros sem alterar o contrato | Não retardar a entrega do feedback nem animar erros críticos |
| Painéis expansíveis | Seletor de fornecedores SAG alterna entre resumo e busca com montagem imediata | Entrada de 250 ms, sem timer e sem saída que prenda o foco |

Foram examinados, ainda, `OperationalSurfaceTransition.tsx`, seu CSS Module, os diálogos administrativos e os guards de relatórios/SAG. Arquivos do shell, Home, carregamentos, autenticação, Rules, RC, Vercel e fluxos de escrita ficam fora do ownership.

## Escolhas e matriz antes/depois

| Componente | Antes | Depois (proposta implementada na branch) | Critério |
| --- | --- | --- | --- |
| `RelatoriosView.tsx` | `transition-all` sem duração/propriedades explícitas; ausência de foco visível estilizado nos botões | 250 ms ease suave apenas para cor, borda e sombra; foco por teclado evidente; `aria-pressed` e troca instantânea de conteúdo preservados | Navegação clara sem mexer na árvore dos relatórios |
| `SagSupplierStep.tsx` | Abrir seletor e mostrar resumo de fornecedor instantaneamente; cards com `transition-all` | Entrada discreta de 8 px/250 ms somente ao montar; 250 ms em borda/cor/sombra dos cards; botão de abrir/fechar 150 ms; feedback de foco; desmontagem sem timer | Feedback suave sem bloquear pesquisa ou seleção por CNPJ |
| `SagImportProgress.tsx` | Cor do indicador com transição genérica e troca brusca entre número e check | 250 ms de transição de cor/borda; check/numeração com entrada curta de 150 ms e escala inicial 0,96; `aria-current=step` mantido | Mostra etapa concluída sem alterar fluxo ou tempo de execução |

Valores baseados na intenção de uso descrita no **Transitions Polish**: `--duration-fast` 250 ms para seleção, `--duration-quick` 150 ms para feedback simples, `--distance-base` 8 px para deslocamentos discretos, `--scale-large` 0,96 para a entrada do ícone e curva suave `cubic-bezier(0.22, 1, 0.36, 1)`. Como não há tokens compartilhados instalados, foram usados valores locais literais; a instalação global da skill foi intencionalmente evitada.

## Segurança de interação e acessibilidade

- A troca de aba e a seleção de fornecedor continuam imediatas; `onClick`, `aria-pressed`, `aria-expanded`, `aria-current` e renderização de conteúdo não mudaram.
- O seletor SAG não usa `setTimeout`, temporizadores, animação de saída ou `AnimatePresence` que mantenha formulários fechados interativos.
- `useReducedMotion` desativa movimento de entrada e escala. `motion-reduce:transition-none` desliga transições de CSS quando o usuário solicita movimento reduzido.
- Propriedades leves: opacidade, transform, cor, borda e sombra; nenhuma animação de dimensões, scroll ou sobreposição. Não há alteração de `z-index`.
- Preservados controles HTML nativos para teclado e `focus-visible` nos botões afetados; a transição não prende o foco.
- Layout responsivo existente preservado; necessário smoke visual real antes de integração.

## Licença, procedência e limites

Referência: <https://github.com/Jakubantalik/transitions.dev> — `LICENSE`, `skills/transitions-polish/SKILL.md`, `skills/transitions-polish/LICENSE.txt`. Em 2026-10-14, a licença publicada permite aplicar e modificar transições/skills gratuitas em projetos comerciais, mas proíbe republicar a coleção como biblioteca concorrente. Transições Pro e Agent pagos possuem condições adicionais. As mudanças deste worker são adaptações pequenas do código do EMPROVEX, informadas por tokens públicos; não foram copiadas receitas Pro, bibliotecas inteiras, website, marca ou skill automatizada. Créditos mantidos neste memorial de worker. Se a licença publicada mudar, o integrador deverá rever antes do uso.

## Qualidade, evidências e handoff

Verificações estáticas: caminhos proibidos não tocados; fluxo de relatórios e SAG preservado; sem mudanças em dependências, Firestore, Rules, segurança, credenciais ou backend. Também foram inspecionados os contratos em `scripts/verify-reports-shell.mjs`, `scripts/verify-sag-ux.mjs` e `scripts/verify-sag-import-assistant.mjs`.

**Ainda necessário certificar no HEAD do PR:** `npm run typecheck`, `npm run build`, `npm run verify:reports-shell`, `npm run verify:sag-ux`, `npm run verify:sag-import-assistant`, `git diff --check` e os gates de Application CI/Core Protection. Qualquer CI pendente/falho impede PASS. Capturas antes/depois em navegador ainda não produzidas: exigir validação em desktop (1440×900, 1366×768) e mobile (390×844, 545×374), com `prefers-reduced-motion`, teclado e foco.

**ONDE ESTAMOS:** Worker 3 em branch isolada derivada de `main`; PR Draft próprio previsto.  
**O QUE ESTAMOS FAZENDO:** três refinamentos localizados, com matriz acima e CI após abertura do PR.  
**QUEM ESTÁ FAZENDO:** Worker 3.  
**O QUE FAZER A SEGUIR:** validar build/testes, coletar screenshots A/B reais e solicitar aceite estético.  
**QUEM FARÁ:** Coordenador VISUAL-R1 e Worker 5. Sem merge, deploy ou atualização do RC.
