# EMPROVEX Empresas — Worker W11 | Mapas, rotas e handoff ao W9/W10

Data: 06/11/2026. Branch isolada: `feat/empresas-w11-maps-routing-r1m-20261106`.
Base certificada: W10 PR #520, SHA `46af306ea67e2c5d45f8a2af922ef2781e154212`.
Origem funcional: Memorial Oficial Empresas da PR #510 e contrato W10
`lib/company/integration/deliveryRoutingContract.ts`.
Estado: **Draft, NÃO mesclado, NÃO publicado; piloto continua desativado**.

## Entregue — código real

1. `lib/company/geo/core.mjs`: valida candidatos de entregas W9,
   coordenadas explicitamente confirmadas, origem, janelas, carga e veículos;
   rota manual determinística para múltiplos veículos com atribuição e paradas não alocadas.
   Reordenação por operador, aprovação humana explícita e CAS de revisão.
   Sem ETA, distância ou trânsito inferido no modo manual.
2. `lib/company/geo/providerTransport.mjs` + `lib/company/routing/providers.ts`:
   HTTP server-side opcional para VROOM e matriz OSRM, timeout de 4,5 s,
   quota local, circuit breaker, payload limitado, sem redirects, sem URL fornecida
   por cliente e sem conversão automática para solução paga.
   Só são transmitidas coordenadas, durações, capacidades e janelas; nada de
   NE/NF, endereço completo, ID de empresa, token, contato ou dados financeiros.
   Falha do serviço não bloqueia a construção manual.
   **Os endpoints permanecem OFF quando as variáveis não estão configuradas.**
3. `lib/company/routing/store.ts` + `http.ts` + `app/api/company/routing/**`:
   CRUD restrito de rascunhos de rotas e veículos, prévia, aprovação e
   reordenação, leitura paginada; Firestore apenas sob
   `supplierCompanyWorkspaces/{companyId}/deliveryRoutes|vehicles`.
   `requireCompanyContext` obrigatório em cada endpoint, verificando ação
   específica `deliveryRoutes:read/write` ou `vehicles:read/write`, membership
   live e piloto W0. A operação recusa o uso de `company:write` como atalho.
   CAS de `updateTime`, revisão, idempotência por chave/UID/empresa/ação
   e auditoria no mesmo commit; não usa ledger, Warehouse, Rules ou billing militar.
   Snapshot de parada inclui identidade de workspace, origem, carga, janela, hash
   e revisão. Nenhuma ação W11 registra entrega, despacho ou atesto.
4. `features/company/routing/MapLibreView.tsx`:
   componente isolado MapLibre com carregamento **por escolha do usuário**, bundle
   self-hosted aprovado, estilo/tiles configurável e atribuição de dados.
   Modo Essencial / WebGL sem suporte / tiles indisponíveis → lista acessível.
   Bundle e CSS não foram adicionados: `package-lock.json` e arquivos globais
   são reservados ao integrador. Até montagem e configuração W10, a lista é
   o fallback funcional; não anunciar mapa cartográfico publicado.
5. `features/company/routing/RoutingWorkspace.tsx`:
   destino e veículo informados e confirmados pelo operador, filtros de rotas
   por situação/data/motorista/endereço (região textual)/mínimo de destinos,
   ordenação drag-and-drop + teclado (botões ↑↓), seleção por parada de veículo, pausas, prévia de paradas inviáveis,
   URLs de Waze e Google Maps apenas com coordenadas confirmadas, salvamento de
   rascunho e aprovação separada. Requer `getIdToken` da sessão existente;
   W9 deve fornecer candidatos persistidos e verificados para pilotar expedição.

## Limites e segurança

- Ativação positiva `EMPROVEX_COMPANY_PILOT_ENABLED=1` somente após gate W10; OFF padrão.
- Nenhuma API VROOM/OSRM é habilitada sem configuração administrativa HTTPS.
- Capacidade não confirmada **não é inventada**; VROOM exige dimensões
  informadas. Manual mantém explicitamente trânsito/janelas não verificados.
- Geocodificação automática, GPS contínuo, rastreamento, telemetria e
  confirmação da entrega estão fora deste Worker.
- Os candidatos W9 recebidos por UI são **rascunhos**; mesmo companyId válido
  enviado pelo cliente não prova a existência do pedido/entrega. O W10/W9 deve
  vincular os dados a documentos empresariais verificados, com checks de revisão,
  antes de usar o plano para expedição. Sem isso, plano aprovado tem efeito
  **apenas no planejamento**.
- Lista W11 é paginada, até 50 registros por consulta; filtros operam
  na página carregada. Não afirmar cobertura de todo histórico sem paginação.
- Throttle/circuit breaker são por processo: requisito antes de produção é
  implantar rate limiting distribuído, revisar custos e contratos de fornecedores.
- Não se instalaram pacotes, binários, credenciais, serviços, IAM, Rules,
  API paga, nem alteração no Cloud Run ou deploy.

## Matriz de licenças e custo (verificar contrato vigente antes de ligar)

| Tecnologia | Licença/uso identificado | Custos e bloqueios |
|---|---|---|
| MapLibre GL JS | BSD-3-Clause, biblioteca de renderização | Bundle próprio e CSS/atribuições; tiles são serviço distinto, podem ser pagos |
| VROOM | BSD-2-Clause para solver open source | Infra/hosting/operador podem custar; VROOM Premium separado e OFF |
| OSRM | Implementação open source, consultar LICENSE do release | Servidor, dados, operações e infraestrutura precisam de capacidade |
| Dados OpenStreetMap | ODbL e atribuição conforme fontes | `tile.openstreetmap.org` não pode ser fonte de uso comercial pesado nem cache offline |
| Waze Deep Links | URL externa documentada | Abre app ou site; não necessita presumir instalação |
| Google Maps URLs | URLs documentadas; não exige chave para abrir link | API de otimização paga é outro produto, não usada |

Referências: https://maplibre.org/maplibre-gl-js/docs/ ;
https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt ;
https://github.com/VROOM-Project/vroom ;
https://github.com/Project-OSRM/osrm-backend ;
https://operations.osmfoundation.org/policies/tiles/ ;
https://developers.google.com/waze/deeplinks/ ;
https://developers.google.com/maps/documentation/urls/get-started .

## Contrato W9 e patch de integração reservado a W10

- W9 entrega **`DeliveryCandidate[]` do servidor** com vínculo de pedido/linha/
  entrega, endereço humano-confirmado, janela e carga. A W11 produz
  `RouteProposal` (manual ou VROOM), paradas inviáveis visíveis e
  `RoutePlan` aprovado isolado. W9 conserva despacho, romaneio, realização,
  prova e atualização de cronograma. Aprovação não altera prazo prometido.
- O W10 integra `RoutingWorkspace getIdToken={getIdToken}` ao shell W4
  somente após W9. Manter rota `/empresa/entregas` e menu sem edição do W11.
  O W10 deve ativar o componente MapLibre em pacote/bundle local auditado,
  stylesheet CSS e tiles licenciados, sem usar OSM tiles públicos por padrão.
- O W10 confirma permissões granulares já incluídas na PR #520, fiação com
  identidade/tenant, vínculo servidor de candidatos W9, revisões/IDOR e limites;
  não requer patch de subcoleções/ações, pois já constam na base.
- Testar em integração Firebase Auth/Firestore Emulator (contas A/B e motorista
  somente leitura), CAS concorrente e idempotência, de ponta a ponta com W9,
  Playwright mobile/desktop, acessibilidade com teclado, carga realista e
  fallback MapLibre/OSRM/VROOM. Reavaliar rota quando endereço/carga/prazo mudam,
  **sem mutar cronograma automaticamente**.

## Evidência executável e GO/NO-GO

Testes locais puros no workflow dedicado
`.github/workflows/emprovex-empresas-w11.yml`:
`node --test lib/company/routing/routing.test.mjs` (17 cenários, incluindo
5 OMs/2 veículos, janela, capacidade, tenant A/B, aprovação, URL segura, provider
mock com falha, quota e circuit breaker).
CI também executa `npm ci`, `npm run typecheck` e `npm run build`.
Resultados finais devem ser consultados **no HEAD da PR**, não inferidos do código
ou de runs antigos: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions .
Não executados neste Worker: testes de credenciais de terceiros, solver VROOM real,
rotas OSRM reais, E2E W11 com Auth real de motorista, browser E2E, mapa com tiles
licenciados e jornada W9 completa.

**GO somente para revisão técnica e incorporação controlada pelo W10 quando CI
verde. NO-GO para merge, deploy, piloto e uso operacional real**, até vínculo W9,
E2E, mapa licenciado, revisão de privacidade/custos e autorização separada.

Rollback: descartar a branch/PR W11; nenhum efeito em main, Firestore produtivo,
Cloud Run, IAM, Rules, dados militares ou faturamento.
