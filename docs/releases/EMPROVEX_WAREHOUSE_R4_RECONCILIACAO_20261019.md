# Release de reconciliação R4 — EMPROVEX Warehouse R2/R3 + 3D premium (19/10/2026)

**Estado:** PR #345 DRAFT; `main`, Vercel e workspaces intactos até gates finais.

## Causa e estratégia

As releases R2/R3 de 17/10 foram publicadas manualmente pela Vercel por arquivo exportado de uma branch sem merge na `main`. Ao publicar `main@2c30a354` em 19/10, a versão visual premium e o novo menu ficaram disponíveis, mas a `main` não continha recursos de hover, PDF por local, busca global, alertas de vencimento e cadastro dos PRs R2/R3. Esta release parte da `main@2c30a354`, incorpora PR #344 e reintegra cuidadosamente a versão histórica certificada `release/emprovex-r3-hotfix-inspecao-20261017@eb1935a981871beb43770b56fa35eb7e157b6aff`. Não aplica merge global daquele snapshot: preserva o código mais recente e as Rules atuais.

## Funcionalidades reconciliadas

| Origem | Entrega |
|---|---|
| PR #331 | Hover/foco com inspeção por local, painel sob o 3D sem cobrir equipamentos, modal acessível e PDF detalhado (material, saldo, lote, subposição, validade). Local vazio apresenta saldo zero corretamente. |
| PR #332 | Pesquisa por item em todos os depósitos do mesmo workspace na prévia 3D de Croquis, com localização/subposição e navegação ao depósito correto, sem reads a cada tecla. |
| PR #333 + PR #344 | Sinalização automática de 14 dias inclusive, mesmo material/posição/lote ativo e saldo positivo; halo amarelo discreto no local e caixas amarelas, vencidos em vermelho. |
| PR #334 + PR #342 | Geladeira sempre frontal no maior lado físico nas quatro vistas, com renderer premium inox; freezer tampa de vidro; brilho branco sutil em aparelho ocupado. |
| PR #335 | Botões para cadastrar local em depósito já existente, acrescentar subposições e formulário de dimensões do depósito; arquivo de local protegido por checagem de saldos e lotes e batch atômico. |
| PR #336 + PR #344 | Caixas ilustrativas apoiadas e empilhadas em paletes/mesas, níveis corretos nas estantes e acesso a inspeção fora do SVG sem sobreposição. |
| PR #338 | Inspeção em Meus Depósitos, inclusive local vazio; suporte a hover, foco, clique e PDF. |
| PR #328 + release atual | No palete de NF, ações em lote continuam disponíveis e acesso à alocação **detalhada por item** é ofertado explicitamente; nenhum comportamento é removido. |
| PR #343 | Navegação agrupada e acesso para setores externos autorizados são preservados sem alterar os gates de segurança. |

## Consumo Firestore

- Croquis: materiais/saldos uma vez por abertura; **apenas lotes que vencem até o 14º dia ou vencidos** via query indexada para o destaque automático. O conjunto integral de até 500 lotes é consultado **somente na primeira inspeção ou refresh explícito**. Hover subsequente e busca por tecla não consultam o servidor.
- Meus Depósitos: leitura de lotes próximos ao vencimento somente com croqui ativo; inspeção completa sob demanda e independente da consulta do material.
- Limite de 500 na leitura exibe aviso de possível incompletude, sem alegar cobertura total. O domínio de FEFO e sua política de vencimento de 30 dias não são alterados.
- Não criar listeners, polling, writes ou queries para cada caixa/ângulo.

## Segurança e release

- Preservar Firestore Rules, índices, autenticação, workspaces, dados e saldos. Evitar aplicar Rules da branch histórica sem análise.
- Rodar Application CI completo, testes históricos reativados, Core Protection, Recovery, Legal e QA visual.
- Smoke autenticado em ambiente isolado com dados de teste: hover local com material e sem material, busca no outro depósito, PDF, cadastro de local e subposição, 14 dias/15 dias/vencido, quatro câmeras, equipamentos e empilhamento.
- A Vercel administrativa não está conectada à ferramenta GitHub. **Após CI PASS e merge autorizado**, o Fundador executa em PowerShell o deploy remoto de **fonte exportada com `git archive` sem `.git`**, `vercel.cmd deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects`, checa `Ready`, `vercel.cmd curl <URL>/api/health`, smoke e `vercel.cmd promote <URL> --yes --scope aprov-hgesms-projects`. `main` só foi promovida em 19/10 depois desse procedimento.
- Não usar `vercel deploy --prebuilt` no plano Hobby (histórico limite de Serverless Functions).

## Handoff

**Onde estamos:** PR #345 isolado, base `main@2c30a354`, integrando PR #344 e módulos da R3 histórica. **O que estamos fazendo:** reconciliação e CI. **Quem está fazendo:** executor do GitHub, validação final do Fundador no navegador. **O que fazer a seguir:** corrigir gates, smoke, consolidar `main` em um squash e publicar uma única vez na Vercel com promoção após saúde. **Quem fará:** GitHub/assistente na integração; Fundador no CLI administrativo Vercel.
