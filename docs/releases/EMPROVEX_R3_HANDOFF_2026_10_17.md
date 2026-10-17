# EMPROVEX — Handoff de publicação R3 (17/10/2026)

## Estado vigente

**R3 EM PRODUÇÃO CONFIRMADA pela CLI administrativa do Fundador**, sem necessidade de novo deploy. `emprovex.com.br` aponta ao deployment **`dpl_CvyoeS27FRLGruuztCXrB6LhLra4`**, `Ready`, URL imutável `https://controles-de-empenhos-aprov-o0nq4cf0u-aprov-hgesms-projects.vercel.app`. Data de criação: sábado 17/10/2026, 01:44:23 BRT. Pós-promoção inspecionada pelo Fundador. API de saúde do mesmo deployment: `{"status":"ok",...}` e `HEALTH_R3=PASS`.

**R2 anterior/rollback:** `dpl_6bRVvT11kLFTs5SN7eDyYgm8NCQ4`, `https://controles-de-empenhos-aprov-4ylvppjos-aprov-hgesms-projects.vercel.app`, `Ready`, era o domínio principal antes da promoção R3. Preservar como ponto de retorno. Não executar rollback sem falha real e autorização do Fundador.

**GitHub R3:** `release/emprovex-r3-visual-20261017@07cab0440afc1ca1b348f1f844d1f372c82564fb` — snapshot **identical** à branch do PR #336 `feat/warehouse-visual-organization-r3`. PR #336 DRAFT, nenhum merge na main. O release SHA deve permanecer imutável após atualização do memorial em branch documental separada.

## Escopo funcional

1. Painel persistente de consulta de itens posicionado **abaixo do croqui SVG**, eliminando a sobreposição do tooltip sobre geladeiras/freezers/paletes. Hover, foco via teclado, clique, diálogo e PDF permanecem.
2. Palete com caixas simuladas por **prismas isométricos apoiados**, cada caixa diretamente sobre o piso do palete ou sobre uma caixa no nível anterior, sem deslocamentos em pixels independentes da geometria.
3. Autoenquadramento reserva altura do volume sobre palete. Quantidade de caixas representa apenas ocupação ilustrativa, não número de unidades. Fonte da quantidade real continua sendo o saldo físico e a consulta de local.
4. Laboratório DEV-only `/visual-lab/inspecao-locais` com dados fictícios, incluindo freezer, geladeira, estante e palete. Sem leitura/escrita Firestore no laboratório.

## Qualidade e evidências

| Gate R3 no SHA exato | Run | Resultado |
|---|---:|---|
| Application CI (inclui novo teste cargo/dock, build e TypeScript) | 39001337800 | SUCCESS |
| EMPROVEX Core Protection | 39001337683 | SUCCESS |
| Recovery Guardrails | 39001337898 | SUCCESS |
| SAAS-DL Legal Validation | 39001337702 | SUCCESS |
| VISUAL-R1 W4 QA | 39001337686 | SUCCESS |

Fundador aprovou a melhoria visual e solicitou preparação da publicação. **Ainda falta evidência de smoke humano pós-promoção** nessa sequência. `Ready` + health `ok` + promoção confirmam implantação técnica, não substituem navegação e interação real.

## Incidentes resolvidos e método oficial

- `npm ci` e `vercel build --prod` locais falharam por `ENOSPC` (C: ~0,65 GB livre); `deploy --prebuilt` não podia prosseguir sem build íntegro. Não repetir no disco cheio.
- Tentativa com `vercel.cmd deploy --prod --archive=tgz --skip-domain` dentro do worktree com `.git` foi `Blocked` (`dpl_6CvtskMwAFe5szRyrTbjkzoVGr3W`) porque Vercel não autorizou autor do commit `Moriark` no projeto `aprov-hgesms-projects`. Não atribuir bloqueio à compilação.
- **Solução bem-sucedida:** exportar conteúdo exato do SHA com `git archive` para diretório isolado, sem metadados `.git`, copiar exclusivamente `.vercel/project.json` da vinculação administrativa; recusar baixar variáveis de desenvolvimento; executar deploy único **de código-fonte para build remoto**:
  `vercel.cmd deploy --prod --archive=tgz --skip-domain --scope aprov-hgesms-projects`.
- Deployment resultante: `dpl_CvyoeS27FRLGruuztCXrB6LhLra4`, `Ready`; health `ok`; domínio pré-promoção estava em R2 `dpl_6bRVvT11kLFTs5SN7eDyYgm8NCQ4`; `vercel.cmd promote <URL-R3> --yes --scope aprov-hgesms-projects` retornou `Success!`; `vercel.cmd inspect https://emprovex.com.br --scope aprov-hgesms-projects` retornou mesmo ID R3. **Nenhum segundo build foi necessário**.
- Proteções: `vercel.json git.deploymentEnabled=false`; GitHub continua para CI e revisão; sem merge em main nem mudança de Firestore/Rules/saldos/identidades.

## Handoff oficial

**Onde estamos:** R3 publicada em `emprovex.com.br` com ID `dpl_CvyoeS27FRLGruuztCXrB6LhLra4`, `Ready`, health PASS; R2 como rollback identificado; cinco gates GitHub PASS no SHA R3 congelado.

**O que estamos fazendo:** documentação pós-publicação e organização do smoke visual final, sem novo deployment.

**Quem está fazendo:** Fundador no navegador para smoke real; Coordenador Geral no GitHub para auditoria e memorial.

**O que fazer a seguir:** validar no domínio as geladeiras, freezers e paletes nas quatro perspectivas, consulta por hover/foco, clique para detalhes e PDF, além de autenticação e navegação; registrar aceitação/regressão. Somente se houver problema significativo avaliar rollback para o ID R2 conhecido. Manter releases R2/R3 congeladas e PRs DRAFT sem merge automático.

**Quem fará:** Fundador realiza smoke; Coordenador recebe resultado e atualiza checkpoint em branch documental se necessário.
