# EMPROVEX — Central de Depósitos: consulta textual no Modo Essencial (R1)

Data: 03/11/2026. Escopo: `/central-depositos` (Início) e `/central-depositos/meus-depositos`.

## Análise do comportamento anterior

- A aba Início montava `WarehouseLandingOperational`, incluindo uma cena consolidada em SVG e várias prévias `WarehouseIsometricPreview`, além de carregar layouts, dados visuais e configurações.
- A aba Meus Depósitos montava `WarehouseHomeOperational`, que carregava o renderer isométrico e consultava materiais, depósitos, locais, posições, saldos e recursos de validade/layout.
- O Modo Essencial ocultava e redirecionava Início para Controle de Materiais; a aba Meus Depósitos permanecia com a superfície visual.
- Reduzir animações/CSS não remove carga de JavaScript, renderização da cena ou consultas próprias da visualização.

## Correção implementada

1. Em `WarehouseSectionContent`, apenas quando `mode === 'essencial'` e `section` está em `home` ou `overview`, monta-se `WarehouseEssentialLocationLookup` através de um import dinâmico próprio. Não monta `WarehouseLandingOperational` nem `WarehouseHomeOperational`; renderizadores/layouts 3D ficam em chunks alternativos para o Modo Normal.
2. Em `WarehouseModuleShell`, Início volta a ser navegável no Essencial; o shell claro e leve substitui o enquadramento imersivo. A navegação local e links diretos seguem funcionando. Em `WarehouseSidebar`, o Início deixa de ficar oculto.
3. A consulta nova **não busca material, saldos ou posições na montagem**. O usuário informa nome/código/alias e solicita a pesquisa. A primeira busca lê apenas catálogo, depósitos, localizações e saldos físicos positivos — não consulta croquis, layouts, lotes, imagens ou dados de validade visual.
4. O índice `findWarehouseMaterialsAcrossDepots` já existente valida depósito/local/subposição ativos, ignora saldo zero e apresenta endereço e quantidade por posição. Os resultados permanecem **textuais**, com até 30 posições DOM por vez e expansão explícita.
5. Meus Depósitos oferece filtro opcional por depósito. A pesquisa seguinte reutiliza os dados já consultados na mesma superfície; há botão explícito para atualizar saldos.
6. A consulta é estritamente **read-only**, usando os repositórios Firestore existentes e o acesso por workspace da sessão. Não altera dados, permissões, Rules, inventário ou 3D do Modo Normal.

## Limites e integridade

- Limites por consulta: 1.000 materiais, 250 depósitos, 500 locais e 500 posições físicas positivas. Caso qualquer limite seja atingido, a interface informa expressamente que os resultados **podem estar incompletos**, sem afirmar localização definitiva de itens fora dos registros consultados.
- A busca mostra exclusivamente **saldos físicos positivos em posições válidas**, não o saldo contábil geral, lote/validade ou registros não alocados.
- Não existe assinatura Firestore adicional, polling, pré-download de histórico ou busca automática por tecla. Saldos podem mudar entre duas consultas; o botão Atualizar consulta novamente.
- A melhoria reduz substancialmente o custo da renderização 3D **nas duas abas específicas**, sobretudo sem realizar a pesquisa. Não elimina os módulos de croqui e edição das demais abas nem mede, por si só, o ganho em FPS, CPU ou Ethernet no computador do usuário.

## Aceitação

- Modo Essencial: abrir diretamente ambas as URLs e navegar pelo menu sem 3D; pesquisar item com subposição; filtrar depósito; verificar mensagem de truncamento e atualização manual.
- Modo Normal: Início e Meus Depósitos continuam funcionando com suas visualizações originais.
- Contratos automatizados: `scripts/warehouse-essential-text-lookup.test.mjs`, `scripts/warehouse-global-material-search.test.mjs`, `scripts/warehouse-react-tab-navigation.test.mjs`, TypeScript e Application CI.
