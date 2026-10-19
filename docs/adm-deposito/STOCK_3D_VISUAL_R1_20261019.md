# WAREHOUSE-STOCK-3D-R1 — Ocupação, empilhamento e validade (19/10/2026)

## Auditoria do comportamento anterior

O croqui 3D em `WarehouseIsometricPreview` já reconhecia ocupação positiva através de saldos físicos e mostrava cubos genéricos nos paletes/estantes/mesas; as geladeiras/freezers recebiam `occupied` mas não uma mudança branca claramente dependente do conteúdo. A posição anterior dos cubos era predominantemente derivada de deslocamentos no plano de tela. A validade não participava do renderer. O domínio logístico possuía `WarehouseLot.expiresOn`, atribuição física por local/subposição e alerta geral de 30 dias, não o pedido visual de 14 dias.

## Resultado funcional na branch

- **Geladeira/freezer:** `occupied=true` apenas quando o local ligado ao croqui possui saldo físico positivo, incluindo subposições. Uma faixa e reflexo branco discreto aparecem nas superfícies externas em todas as vistas; nenhum material é falsamente exibido do lado de fora. Para lote próximo do vencimento/vencido, aparece indicador compacto na parte superior externa (amarelo/vermelho).
- **Paletes e bancadas:** caixas virtuais sobre a superfície superior, organizadas em posições repetíveis e camadas superpostas, nunca em deslocamentos aleatórios na tela. A quantidade de caixas é representação de ocupação, não unidade material, peso nem promessa de capacidade.
- **Estantes:** subposições ativas ordenadas por código de localização. Saldo em uma subposição aparece em sua prateleira; saldo do local sem subposição aparece no primeiro nível. Os níveis podem exibir caixas empilhadas dentro da folga vertical; número de níveis representáveis até 8.
- **Validade:** amarelo do dia do vencimento até **14 dias inclusive**; vermelho se já venceu. Data em formato canônico YYYY-MM-DD; comparação em dia UTC, sem erros por hora local. Sem lote válido ou sem saldo por posição: cor normal, sem presumir validade.
- **Vínculo estrito:** lote ativo e com quantidade positiva **deve corresponder ao mesmo material e mesma posição** de um saldo positivo. Saldo em outro depósito/local/subposição não acende alerta incorreto. O status do local é agregação da gravidade de suas subposições; cor das caixas na estante segue a prateleira específica.
- **Leituras Firestore:** em `WarehouseCroquisR1Operational`, consulta de lotes acontece somente ao abrir a prévia 3D, uma vez por ciclo de carregamento/depósito, sem `onSnapshot`, com limite de 500 registros. Não há escrita, nova coleção ou alteração de Rules. Caso o limite seja alcançado, aviso informa que os sinais de validade podem ser incompletos; a consulta de estoque e suas fontes de verdade permanecem disponíveis.

**Atenção:** o alerta visual de 14 dias **não altera** a regra geral de alerta/FEFO de 30 dias existente no domínio.

## Superfícies integradas

Além da prévia do editor de croquis, a tela principal **Meus Depósitos** (`WarehouseHomeOperational`) também utiliza o renderizador 3D. Ela agora busca o conjunto de lotes apenas quando existe croqui ativo para o depósito selecionado. A leitura ampla serve também de cache para a pesquisa de um material, evitando consulta adicional enquanto o resultado não estiver no limite de 500 lotes. A checagem de TypeScript/CI protege ambas as chamadas do componente.

## Arquivos e testes

- `lib/warehouse/stockVisual.ts` — estado da validade por posição e geometria de empilhamento pura.
- `features/warehouse/components/WarehouseIsometricPreview.tsx` — posicionamento dos cubos, cores, legenda.
- `features/warehouse/components/WarehouseColdAppliance3D.tsx` — reflexo branco somente quando ocupado.
- `features/warehouse/components/WarehouseCroquisR1Operational.tsx` — carregamento sob demanda.
- `features/warehouse/components/WarehouseHomeOperational.tsx` — visualização principal e reaproveitamento dos lotes previamente consultados.
- `scripts/warehouse-3d-stock-visual.test.mjs` — fronteiras 14/15 dias, vencidos, saldo zero, lote inativo, local incorreto, multicamada e contratos.
- `package.json` e `.github/workflows/application-ci.yml` — suíte integrada ao Application CI.

## Aceite antes de publicar

1. Acessar **Central de Depósitos → Controle de Depósitos → Croquis → Prévia 3D**, conferir vistas Frente, Direita, Trás e Esquerda.
2. Local vazio: sem cubos, equipamento sem reflexo branco; local ocupado: estrutura correspondente iluminada/contendo cubos.
3. Palete/bancada ocupados: cubos apoiados e empilhados; estante ocupada em SUBPOSITION: cubos na prateleira correta.
4. Lote no dia +14: cubo amarelo; +15: normal; vencido: vermelho; material em outro local: sem sinal.
5. Verificar tempo de abertura e leituras Firestore (consulta bounded on demand), sem alteração de dados nem permissões.
6. Não publicar até validação humana e Application CI/Core Protection PASS.

## Handoff

- **Onde estamos:** desenvolvimento isolado em `feat/warehouse-3d-occupancy-stacking-expiry-14d` (PR #344 DRAFT), produção preservada.
- **O que estamos fazendo:** concluir testes e obter validação visual.
- **Quem está fazendo:** executor no GitHub/CI; Fundador no navegador.
- **O que fazer a seguir:** aguardar CI e abrir preview no `localhost:3001`; verificar material real em posições de teste e aceitar ou ajustar.
- **Quem fará:** executor corrige testes; Fundador realiza smoke e aprova; coordenador integra após autorização.
