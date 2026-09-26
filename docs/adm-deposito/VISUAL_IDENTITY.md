# Identidade Visual Operacional do EMPROVEX

Este documento é a referência obrigatória para novas telas, componentes e módulos operacionais do EMPROVEX, inclusive ADM Depósito.

## 1. Princípio geral

O EMPROVEX possui dois contextos visuais distintos:

1. **Superfície operacional padrão** — tema claro. É o padrão para Painel, Empenhos, Notas Fiscais, Relatórios, Cronogramas, Administração operacional e ADM Depósito.
2. **Superfície imersiva da tela Início** — tema escuro/cinematográfico. É uma exceção deliberada e não deve ser copiada para formulários, cadastros, tabelas ou fluxos operacionais.

A regra prática é simples: se a tela contém leitura, cadastro, filtros, formulários, relatórios, importações, tabelas ou ações administrativas, ela deve usar o tema claro operacional.

## 2. Base visual do tema claro

- Fundo da aplicação: gradiente claro frio, aproximadamente `#f0f4f8 → #e8ecf3 → #f4f6fa`.
- Elementos atmosféricos: manchas radiais suaves em azul, índigo, rosa e sky, sempre de baixa opacidade.
- Superfícies principais: branco translúcido, normalmente `bg-white/70` a `bg-white/85`, com `backdrop-blur`.
- Bordas: cinza ou azul muito claro, como `border-gray-200` ou `border-blue-100/80`.
- Sombras: discretas (`shadow-xs`, `shadow-sm`); evitar sombras pesadas em cards operacionais.
- Cantos: predominância de `rounded-xl` e `rounded-2xl`.

## 3. Cores institucionais e hierarquia

- Azul institucional principal: `#00288e`.
- Azul principal é usado em títulos, ícones de contexto, tabs ativas, botões primários e estados selecionados.
- Texto principal: `gray-800/900`.
- Texto secundário: `gray-500/600`.
- Texto auxiliar/metadata: `gray-400/500`.
- Verde: confirmação/sucesso.
- Âmbar: atenção/prioridade.
- Vermelho/rose: erro/risco.
- Violeta/ciano: apenas acentos secundários; não substituem o azul institucional como cor estrutural.

## 4. Cards e painéis

Cards operacionais devem preferir:
- `bg-white/70` ou `bg-white/75`;
- `border border-white/40` ou `border-blue-100/80`;
- `backdrop-blur-md`;
- `rounded-2xl`;
- sombra leve.

Cards escuros não são padrão para o conteúdo operacional. O cabeçalho e a sidebar podem continuar escuros para criar moldura institucional e contraste com o conteúdo claro.

## 5. Formulários

Inputs, selects e textareas:
- fundo branco;
- texto `gray-800`;
- placeholder `gray-400`;
- borda `gray-200`;
- foco azul claro, com referência visual ao `#00288e`;
- nunca usar campo quase preto dentro de um formulário operacional claro.

Botão primário:
- fundo `#00288e`;
- texto branco;
- hover azul mais escuro;
- sombra discreta.

Botão secundário:
- fundo branco ou `blue-50`;
- borda `gray-200` ou `blue-200`;
- texto `gray-600` ou `#00288e`.

## 6. Títulos e navegação interna

- Títulos de página: azul `#00288e`, peso forte.
- Kicker/eyebrow: mono, uppercase, tracking amplo, azul institucional ou cinza.
- Tabs ativas: azul institucional com texto branco.
- Tabs inativas: fundo branco/translúcido, texto cinza, hover azul muito claro.
- Ícones de contexto: azul institucional por padrão.

## 7. Estados e feedback

- Sucesso: `emerald-50` + borda `emerald-200` + texto `emerald-700/800`.
- Aviso: `amber-50` + borda `amber-200` + texto `amber-800/900`.
- Erro: `rose-50` + borda `rose-200` + texto `rose-700/800`.
- Informação: `blue-50` + borda `blue-100/200` + texto `gray-700` ou `#00288e`.

Mensagens devem manter contraste AA razoável; evitar texto cinza muito escuro sobre fundo escuro ou texto claro lavado sobre fundo claro.

## 8. Exceções

Tema escuro é permitido apenas quando:
- a superfície é deliberadamente imersiva/visual, como Início;
- há justificativa registrada;
- não há fluxo denso de formulário/tabela que dependa de legibilidade contínua.

O ADM Depósito é um módulo operacional e, portanto, segue o tema claro. Elementos escuros herdados de fases anteriores devem ser tratados como dívida visual e migrados gradualmente para esta referência.

## 9. Regra de consistência para novas implementações

Antes de criar ou alterar uma tela:
1. comparar com Painel e Relatórios do EMPROVEX;
2. reutilizar o azul `#00288e`, fundos claros, cards translúcidos e tipografia cinza;
3. evitar introduzir um "tema próprio" dentro de um módulo;
4. preservar header/sidebar institucionais;
5. priorizar legibilidade e coerência sobre efeitos visuais.

Esta identidade é parte do contrato de UX do projeto e deve ser consultada junto com README, ROADMAP, DECISIONS e STATUS do ADM Depósito.
