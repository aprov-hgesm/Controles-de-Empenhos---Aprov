# EMPROVEX — Memorial de continuidade / Onda R2 (17/10/2026)

> **ESTADO VIGENTE.** Este documento reúne a conversa de implementação, aceitação e preparação da segunda onda. Leia em conjunto com `docs/EMPROVEX_MEMORIAL_OFICIAL.md` e as evidências dos PRs. As informações históricas que sugerem usar prebuild na Vercel Hobby foram superadas pelo deploy remoto por fonte. **O R2 ainda NÃO está publicado.**

## 1. Onde estamos

- **Produção observada pelo Fundador:** `https://emprovex.com.br`, release R1 de 16/10/2026, promovida com sucesso do deployment **`dpl_Ctj6MSdG32oARc2uLomEVQmT37Yd`** (`controles-de-empenhos-aprov-6s8k8i3qg-aprov-hgesms-projects.vercel.app`). O Fundador acessou o site e confirmou a atualização. **Usar este deployment como rollback da R2**; inspecionar aliases atuais antes de promover qualquer outra versão.
- **R1 Git:** PR #330 DRAFT, branch `release/emprovex-consolidada-20261016`, SHA **`6033905f435414bf2f7fbd5dd8a2d7fd7e880308`**. A R1 inclui alterações anteriores de cadastro de depósitos, NE manual/PDF, NF/recebimento, frigoríficos, croqui 3D etc. A R1 foi publicada por CLI com código exportado sem `.git`, sem merge.
- **`main` intocada nesta onda:** `2b1241fe3abd96c67766caf065d24a4b2a223b98` (conferido no GitHub em 17/10).
- **Snapshot inicial da R2 (QUATRO melhorias):** branch `release/emprovex-r2-consolidada-20261017`, SHA **`78b550e2c2a7da351fde891376c591cfbf2864d6`**. Esse snapshot foi congelado após aprovação do Fundador e 5/5 gates PASS, **mas está SUPERADO como candidato a publicar** após a quinta correção solicitada.
- **Candidato R2 com QUINTA correção:** PR **#335** DRAFT, branch **`feat/warehouse-add-location-existing-depot-r2`**, em cima da branch de release acima. SHA funcional testado **`807a45c280514a812363b7b8ed12631b7d22adde`**: **5/5 workflows SUCCESS**, inclusive teste novo, teste antigo reconciliado, build de produção e TypeScript, no GitHub Actions. Este é o último SHA **funcional** certificado antes das atualizações documentais deste memorial. Conferir novamente o SHA HEAD e respectivos gates antes de publicar.
- **R2 não implantada na Vercel.** Nenhum dos PRs #331–#335 foi merged ou publicado nesta onda. **Não afirmar que `emprovex.com.br` contém a R2 antes de deployment, smoke e promoção efetivos.**

## 2. O que foi implementado e aprovado

| Ordem | PR / branch | Resultado | Aceitação |
|---|---|---|---|
| 1 | [#331](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/331) `feat/warehouse-location-hover-report-r2` | Em **Meus Depósitos / Croquis / prévia 3D**, destacar local no hover, mostrar materiais por prateleira com quantidade e validade; clique abre detalhamento e PDF por local | **Aprovada visualmente** pelo Fundador |
| 2 | [#332](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/332) `feat/warehouse-global-material-search-r2` | Pesquisa de item em todos os depósitos do workspace; resultados mostram depósito, local, subposição, quantidade/unidade; selecionar resultado navega ao croqui correspondente com destaque. Reutiliza dados carregados, sem leitura por tecla; avisa se consulta for parcial | **Aprovada visualmente** |
| 3 | [#333](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/333) `feat/warehouse-expiry-14d-highlight-r2` | Local 3D levemente amarelo se existir lote ativo com saldo positivo vencendo **entre hoje e 14 dias inclusive**, excluindo lotes vencidos. Azul da busca/hover prevalece. Uma consulta de lotes ao abrir a prévia, reutilizada pelo detalhamento | **Aprovada visualmente** |
| 4 | [#334](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/334) `feat/warehouse-refrigerator-long-face-front-r2` | Geladeira industrial: **maior lado da base sempre é frente/portas**, nas quatro vistas. Retém dimensões, geometria, posição e vínculos persistidos. Freezers continuam iguais | **Aprovada visualmente** |
| 5 | [#335](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/335) `feat/warehouse-add-location-existing-depot-r2` | Em **Controle de Depósitos → Estrutura**, adicionar novo local a depósito ativo existente, inclusive depósito vazio; adicionar subposição a local existente; código sugerido no depósito/pai correto; formulário reaproveitado, sem recriar depósito, preservando estoque. Local cadastrado pode ser posicionado depois em Croquis | **Solicitada pelo Fundador; implementação e CI PASS.** Não há aceite visual explícito registrado após essa correção; fazer smoke antes da promoção. |

### PR #335 — detalhes operacionais e incidente resolvido

A subaba `Estrutura` já tinha a lógica de `createWarehouseLocation` e formulários, mas o acesso por botões `openPanel('location')`/`openPanel('subposition')` havia sido retirado; por isso só parecia possível cadastrar locais via `Cadastramento de Depósito`.

O PR #335 restabelece botões de **Adicionar local / Adicionar primeiro local / Adicionar subposição**, com rolagem até o formulário, tipo (estante, palete, geladeira, freezer, bancada, outros), descrição, número de prateleiras, seleção do depósito, códigos livres sugeridos sem leituras extras do Firestore, fechamento de formulário ao trocar de depósito/local, e aviso de falha parcial quando estante foi salva mas suas subposições não foram todas criadas.

Na **primeira tentativa de CI do PR #335**, o teste histórico `scripts/warehouse-depot-registration-r1.test.mjs` falhou porque **proibia os botões que agora são requisito**, embora a implementação estivesse correta. O contrato do teste foi atualizado no commit `807a45c280514a812363b7b8ed12631b7d22adde`, preservando a proibição de criar depósitos fora da aba própria e de criar locais via Croquis. **Na segunda rodada (commit `807a45...`), 5/5 workflows SUCCESS**, inclusive `Warehouse depot registration R1`, `Warehouse existing depot new location tests`, Production build e Final TypeScript validation. Evidências no [PR #335](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/335) e no GitHub Actions.

### Prévia / smoke local

Prévia de #331: `http://localhost:3005/visual-lab/inspecao-locais`.

Prévia de #332: `http://localhost:3005/visual-lab/busca-global`.

Prévia de #333: `http://localhost:3005/visual-lab/alerta-vencimento-14d`.

Prévia de #334: `http://localhost:3005/visual-lab/frigorificos`.

Todas as URLs acima são laboratórios **somente `NODE_ENV=development`**, com dados fictícios. Não assumem dados reais da produção.

**PR #335:** validar a **tela real** `Controle de Depósitos → Estrutura` em ambiente de homologação ou com workspace de teste autorizado; conferir fluxo de depósito já existente e vazio, inclusão de estante e prateleiras, código único, atualização visual da lista e inserção futura no Croquis. Nunca cadastrar material fictício em workspace de usuário real. Os quatro PRs anteriores tiveram aceite humano; o quinto ainda precisa de smoke, não de novo produto separado.

## 3. Vercel — restrições, incidentes e método que comprovadamente funcionou

**Projeto e conta corretos:** equipe Vercel `aprov-hgesms-projects`, projeto `controles-de-empenhos-aprov`, domínio `emprovex.com.br`. Conta CLI administrativa `aprov-hgesm`, autenticada no **PowerShell Windows** do Fundador. O conector Vercel do ChatGPT nesta conversa apontava outra equipe/escopo e devolveu **403** ao tentar ler o projeto. **Não interpretar isso como erro no site e não tentar gerir a equipe com escopo estranho.** O GitHub é acessível via conector; a Vercel administrativa deve ser operada por CLI local do Fundador ou outra conexão expressamente autorizada.

- Política vigente para economia de cota: `vercel.json` contém `git.deploymentEnabled = false`, sem deploy GitHub automático, inclusive `main`. GitHub Actions serve para QA; publicar manualmente **um único deployment** ao fechar a onda.
- Tentativa antiga de artefato pré-construído (`vercel build --standalone` e `vercel deploy --prebuilt`) gerou **108 diretórios `.func`** e falhou no Hobby pela limitação de **12 Serverless Functions**. **Não repetir prebuild/standalone para esta publicação.**
- Método **comprovadamente exitoso na R1**: exportar SHA exato com `git archive --format=zip` para **nova pasta isolada sem `.git` nem `.vercel/output`**; copiar `.vercel/project.json` legítimo; enviar o **código-fonte** com `vercel.cmd deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects`. Isso acionou um build **remoto** na Vercel e terminou `Ready`, sem restrição de 12 funções do prebuild.
- Deploy R1 único bem-sucedido: `dpl_Ctj6MSdG32oARc2uLomEVQmT37Yd`; `vercel.cmd curl /api/health --deployment <URL> --scope aprov-hgesms-projects` retornou `{"status":"ok", ...}`; `vercel.cmd promote <URL> --yes --scope aprov-hgesms-projects` promoveu **o mesmo deployment** para produção, sem outro build. O Fundador confirmou em navegador.
- `--skip-domain` protege inicialmente o domínio principal, embora o deploy use variáveis de `production`. Antes de promover, checar URL individual e o alias público existente com `vercel.cmd inspect`.
- **Rollback:** deployment R1 acima; só executá-lo se necessário e autorizado. Não mexer em Firestore, Rules, autenticação, dados/logística, DNS ou domínio durante preparação e testes da release.

### Sequência recomendada quando continuar a publicação

1. **Reconciliar HEAD do PR #335** com o snapshot R2 já congelado. Este memorial/documentos podem adicionar commits sem mudança funcional; verifique `git rev-parse`, diff real e **gates 5/5 no HEAD final**, não apenas no `807a45...`.
2. Criar/fixar **novo snapshot único de release R2 que inclua PR #335** (por exemplo `release/emprovex-r2-consolidada-20261017-v2`) apontando ao commit final. **Não usar o snapshot anterior** `78b550e2...` para publicar, pois não inclui o quinto ajuste.
3. Em PowerShell, preferir repo local `$HOME\emprovex-cadastro-localhost`. `git fetch origin <branch-r2-final>`; `git rev-parse FETCH_HEAD` deve casar **exatamente** com o SHA certificado. `git archive` para pasta **nova e isolada** `$HOME\emprovex-release-r2-final-<sha-curto>`. Copiar arquivo de vínculo do projeto anterior `$HOME\emprovex-release-remota-6033905f\.vercel\project.json`. Verificar `orgId`, `projectId` e `projectName`. Não sobrescrever pasta ou usar working tree com código divergente.
4. No diretório de fonte exportada, rodar **uma única vez**: `vercel.cmd deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects` **(sem `--prebuilt`)**. Falha implica abortar; não imprimir PASS se `$LASTEXITCODE -ne 0`.
5. Inspecionar `vercel.cmd inspect <URL-R2> --scope aprov-hgesms-projects` e `vercel.cmd curl /api/health --deployment <URL-R2> --scope aprov-hgesms-projects`. Testar autenticação/navegação e fluxos principais sem criar ou modificar dados reais de terceiros.
6. Verificar que o `https://emprovex.com.br` ainda aponta para R1 e promover **o mesmo deployment R2** com `vercel.cmd promote <URL-R2> --yes --scope aprov-hgesms-projects`. Confirmar `vercel.cmd inspect https://emprovex.com.br --scope aprov-hgesms-projects` e smoke humano do Fundador. Nenhum segundo deploy é necessário.
7. Se surgir uma falha de CI por `next/font`/Google Fonts, já houve uma ocorrência **transitória** na primeira tentativa de build do PR #334; a reexecução **sem alteração de código** passou. Conferir logs e distinguir problema de rede de defeito real antes de modificar a aplicação.

**ATENÇÃO:** em conversa anterior foi entregue ao Fundador um script PowerShell de publicação da R2 apontando ao SHA `78b550e2...`. Ele **não deve ser usado após a quinta correção**. Atualizar SHA + branch + caminho de destino para snapshot final que inclui PR #335.

## 4. Governança e invariantes

- **Não fazer merges na `main` automaticamente**; desde a R1 o deploy usa código exportado de branch certificada, sem Git metadata. Todos os PRs #330–#335 estão DRAFT/abertos no momento deste memorial.
- R2 precisa conter **todos os cinco PRs**, não apenas #331–#334.
- O fluxo adicional de cadastro #335 usa API existente `createWarehouseLocation`, garante depósito ativo, pai correto para `SUBPOSITION` e evita recriar o depósito. Não exige migração ou alteração de `firestore.warehouse.rules`. Nenhum dado real foi alterado nesta onda.
- **Economia Firestore**: busca global em memória após carga, lotes para validade consultados uma vez ao abrir a prévia, sugestão de códigos em memória; não consultar a cada hover/digitação.
- **Custo Vercel:** não publicar a cada PR, nem promover automaticamente; uma publicação manual controlada com rollback disponível.
- Founder aprovou visualmente #331–#334, solicitou #335 e autorizou concluir/publicar onda R2 em uma só publicação **após a correção**, com validação técnica e teste operacional.

## 5. Handoff no formato oficial

**Onde estamos:** cinco melhorias implementadas na árvore do PR #335; antes dos commits documentais, SHA funcional `807a45...`, 5/5 CI PASS. Produção R1 ainda publicada; snapshot R2 de quatro melhorias superado.

**O que estamos fazendo:** atualizar o memorial e preparar a **release consolidada única R2 final** com o quinto ajuste, preservando custos e integridade.

**Quem está fazendo:** ChatGPT com GitHub para código, testes, memorial e congelamento; Fundador com PowerShell/CLI Vercel para upload, smoke e promoção sob orientação; Fundador valida visualmente.

**O que fazer a seguir:** conferir HEAD/CI depois destas notas documentais; registrar conclusão do PR #335, congelar nova release R2 incluindo as cinco melhorias, executar **um** deploy remoto de fonte na Vercel, testar URL e promover esse mesmo deploy; inspecionar a versão pública e atualizar memorial com ID de deployment final.

**Quem fará:** próximo Coordenador EMPROVEX valida GitHub e prepara comandos; Fundador executa PowerShell Vercel da conta autorizada, compartilha retorno e valida o site. **Não declarar R2 publicada antecipadamente.**
