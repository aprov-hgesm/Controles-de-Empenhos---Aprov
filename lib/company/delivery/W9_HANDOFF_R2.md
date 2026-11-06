# EMPROVEX Empresas — Worker W9: cronograma, expedição e provas

**Base congelada:** W10 Etapa I PR #520, SHA 46af306ea67e2c5d45f8a2af922ef2781e154212.  
**Escopo exclusivo:** lib/company/delivery/**, features/company/schedule/**, features/company/delivery/**, app/api/company/deliveries/**, app/api/company/schedule/**. Não alterados core militar, Warehouse, Firestore Rules, IAM, login, W7/W8, manifestos compartilhados.

## Código entregue
- Motor puro domain.mjs: conversão exata em milésimos (BigInt), datas com origem conhecida, riscos de prazo, aprovação humana, fluxo planned → collected → departed → delivered/partial/refused/damaged → returned e provas. Nunca grava atesto, liquidação, pagamento ou GPS.
- W9Store: Firestore REST por workspace, verificação de integridade, commit com precondições updateTime (CAS), replay idempotente por UID+ação+chave+hash, auditoria imutável e limite de payload/tempo; demo Emulator com bloqueio de ambiente produtivo.
- POST /api/company/deliveries: ordem manual com W1 customerOrder+linha e W7 order_projection, source_link, estoque expedido; dois agregados transacionais de cotas evitam superar dispatch disponível ou atribuir duas vezes. Entrega direta exige evento W7 direct_dispatch e confirmação de W6, sem inventar stock onHand na empresa. Doados de origem e W7 são verificados no mesmo commit. Sem mover estoque.
- PATCH /api/company/deliveries/[id]: atribuição de rota já aprovada e contendo a entrega, ou fatos de coleta, saída, entrega parcial, recusa, avaria e retorno com PDF/imagem de prova W5 do mesmo tenant. Devolução de estoque exige antes evento W7 return/return_converted. Revisão e idempotência obrigatórias.
- GET /api/company/schedule: une linhas W1, promessas inbound W6 e fato de expedição W7 sem produzir previsão de trajeto ou alteração automática da promessa. Paginação e indicação de cobertura parcial W6 quando >50 compras.
- POST /api/company/schedule: grava promessa alterada SOMENTE com confirmação humana, justificativa e documento W5 tipo proof. Evento não edita o pedido W1 original, nem faz renegociação automática. Fato aprovado fica separado.
- GET /api/company/deliveries/[id]/packing-list: reusa o PDF W5, mas passa pela checagem de motorista atribuído W9 antes do download; sem enviar e-mail/WhatsApp.
- Telas isoladas: CompanyScheduleWorkspace e CompanyDeliveryWorkspace recebem getIdToken do shell W10; não modificar app/empresa/** sem integrador. Listas, estados, riscos, formulário de aprovação e romaneio PDF.

## Contratos para W10 / W11
1. W10 monta os dois componentes nos slugs cronogramas e entregas e atualiza menu/activeModules. Nenhum PR de worker altera este contrato compartilhado.
2. W11 fornece RoutePlan persistido em deliveryRoutes, status EXPLICITAMENTE approved, paradas contendo candidateDeliveryId==delivery.id e sequence positiva. W9 apenas anexa plano já aprovado. W9 não roteiriza, não edita vehicles/routeStops, não calcula distância/ETA; erro de mapa mantém sequência manual.
3. DeliveryCandidate W10: companyId, workspaceId, deliveryId, customerOrderId, customerOrderLineId, endereço confirmado, janela, quantity; peso/volume somente quando informados. W9 expõe registros após criação; W10/W11 adaptam consumidores sem presumir geocodificação.
4. W7: precisa expedir antes de criar romaneio (reserve → dispatch, ou plan_purchase → direct_dispatch); W9 nunca chama ledger. W9 documenta quotas próprias em deliveries; não confundir quotas com reservas físicas.
5. W5: provas devem ser documento do tipo proof, tenant validado. Não confundir PDF romaneio com confirmação de entrega. Rever em W10 Etapa II a rota genérica preexistente /api/company/documents/export/packing-list/[id], que ainda permite leitura apenas com deliveries:read sem a regra de motorista atribuída.
6. W8 permanece intocado; nenhum pagamento é disparado por fato de entrega. W1 fulfilledQuantity/fulfillmentState não é atualizado por W9 para evitar concorrência/transação transversal: W10 deverá decidir sincronização reversível e auditada.

## Testes e gates
- Testes unitários no namespace: lib/company/delivery/domain.test.mjs, executáveis via node --test. O Worker executou 7 casos por avaliador V8 com carregamento do mesmo código-fonte e funções de asserção; **isso não é npm/node --test, TypeScript, build, Firestore E2E ou navegador**.
- Testes restantes a executar no CI integrado W10: node --test lib/company/delivery/domain.test.mjs; npm run typecheck; npm run build; Node Core Protection; Auth/Firestore Emulator com 2 fornecedores, 5 OMs, duas empresas A/B, motorista restrito, duas solicitações simultâneas e replay. Validar PDF W5, upload privado de prova, permissões e recusa/avaria em browser.
- Sem concessão de novas actions nem collections; os documentos schedule_plan/delivery_quota residem na subcoleção existente deliveries.
- **NO-GO** até CI/W10 Etapa II real e QA ponta a ponta. Nada foi mesclado ou publicado e nenhuma variável de piloto foi habilitada.
