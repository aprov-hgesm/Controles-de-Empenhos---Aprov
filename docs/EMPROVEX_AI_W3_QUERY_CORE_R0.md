# EMPROVEX AI W3 — Data Query Core R0 (DRAFT)

Base: main 657a2b4f49e4a43383fda51fffdfece88b94c62c.

Integração exclusivamente ao W4 via POST /api/emprovex-ai/query.
**Não publicado. Não é interface de chat. Não escreve dados nem executa comandos livres.**

Formato de entrada: version=emprovex.ai.query.v1, intent, params. Cabeçalho Authorization: Bearer Firebase ID token. Resposta version=emprovex.ai.response.v1: status, contrato, dados, filtros, evidências, cobertura, limitações, data de referência, paginação e métricas.

Intenções: supplier_contact_find, commitment_get, commitment_total_balance, commitment_previous_open_list, schedule_sent_history_list, invoice_registration_period_list, warehouse_stock_get, warehouse_material_locations_list.

Períodos: start/endExclusive YYYY-MM-DD ou kind=relative e value=today/yesterday/last_week/last_month, etc. Fuso America/Sao_Paulo. Identidades de workspace e UG vêm exclusivamente da sessão validada no servidor.

Cursor: configure EMPROVEX_AI_CURSOR_SECRET com ao menos 32 caracteres para gerar cursores HMAC por usuário, tenant, filtro e contrato, expirando em 10 minutos. Sem segredo, respostas truncadas não emitem cursores.

Controles: autenticação Firebase, autorização setorial read-only, IAM no servidor, caminhos e coleções fechados, limite local de oito execuções simultâneas por instância, parâmetros tipados e rejeição de propriedades inesperadas. Não é rate limit global serverless.

Limitações: busca por nome/alias é limitada e não prova ausência com catálogo truncado; C04 lê no máximo 201 empenhos por consulta e não confirma RPNP no SIAFI; C05 não comprova entrega/leitura de Gmail; C06 depende de registeredAt ISO (legados sem data não são inventados); C08 examina no máximo 101 posições por material. Na dúvida o status é partial/ambiguous, não saldo zero.

Validação local: node --test scripts/emprovex-ai-w3.test.mjs; npm run typecheck. Branch e PR DRAFT; nenhuma alteração de Firestore Rules, migração, índices, políticas financeiras, credenciais ou produção. Requer auditoria independente.
