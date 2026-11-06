# EMPROVEX Empresas — W13 | Conector fiscal WLG — handoff (06/11/2026)

**Branch:** feat/empresas-w13-wlg-fiscal-connector-20261106  
**Base congelada:** W10 PR #520 em 46af306ea67e2c5d45f8a2af922ef2781e154212  
**Normativo:** PR #510, Memorial Oficial, plano multi-CNPJ W12–W15 e W10 handoff.  
**Estado:** PR Draft, SEM merge, deploy, ativação de piloto ou emissão real. Parecer **GO somente para análise técnica de contrato/mock; NO-GO para integração operacional, homologação WLG real e produção**.

## Arquivos de ownership W13

- lib/company/fiscal/wlg/index.mjs — adaptador WLG server-only e binding por workspace/CNPJ.
- lib/company/fiscal/wlg/index.d.mts — contratos WlgConnection, FiscalProvider, WlgSecretSelector, WlgActor.
- lib/company/fiscal/wlg/w13.test.mjs — cenários mock sem network.
- app/api/company/fiscal/connections/route.ts — GET protegido e mutations fechadas (503), sem inventar conexão.
- Este documento (handoff próprio no namespace W13).

Nenhuma alteração em W0, W3, W5, sessão, permissões, IAM, Rules, scripts CI, UI empresarial, outros Workers, núcleo setorial/militar, serviços reais ou dados de clientes.

## Modelo fiscal e isolamento

- WlgConnection associa companyId=workspaceId, CNPJ com dígitos verificadores, providerEmpresaId opaco, ambiente, status, credentialRef servidor, versão de credencial, verificação prévia de emitente/empresaId/versão, datas e revisão. O modelo é contrato; **nenhuma conexão é persistida pelo W13**.
- Toda chamada do adapter recebe **WlgActor vindo exclusivamente do guard W10**, nunca do navegador, e passa assertBoundConnection. Troca A→B exige nova autorização live e uma connection B; referência B sob actor A retorna 403.
- SecretResolver é injetado pelo servidor e recebe companyId/workspaceId/ambiente/versão; NÃO existe implementação com segredos reais. Nada é armazenado em Firestore puro ou no código. Tokens Bearer ficam temporariamente somente na memória do processo (cache por tenant/ambiente/versão), com invalidação explícita para rotação/revogação.
- publicConnection expõe exclusivamente status/ambiente/CNPJ verificado/versão e **nunca** referência de segredo, clientId, clientSecret, token ou empresaId.
- A verificação de emitente de connection é uma **afirmação que W10 ainda precisa construir com prova externa independente do browser**. Na ausência dela, o adapter falha com WLG_ISSUER_UNVERIFIED. O test harness injeta apenas dados demo explícitos.
- Revogação, suspension, alteração de papel/UID e seleção de perfil dependem de W10/W12: nunca confiar no actor de navegador nem chamar esse módulo sem requireCompanyContext.

## Fluxos WLG que a fonte pública realmente confirma

Documentação pública: https://wlgsistemas.com.br/api-emissao-nfe

1. POST /api/v1/auth/token (clientId/clientSecret), Bearer expiresIn.
2. POST /api/v1/nfe com empresaId e tipoAmbiente=2 apenas em homologação; HTTP 202 PROCESSANDO é **não autorizada**.
3. GET /api/v1/operacoes/{operationId}, retornos PROCESSANDO / SUCCESSO / ERRO conforme exemplos públicos. SUCCESSO é convertido em provider_success_unverified até W14 verificar XML, chave, assinatura, protocolo e CNPJ.
4. GET /api/v1/nfe/{chave}/xml. Apenas XML do emitente esperado é devolvido; validação lexical do CNPJ NÃO substitui a verificação criptográfica/fiscal W14.

Host HTTPS é fixo em código, com redirects bloqueados, IDs/path validados, timeout, limitação simples de cadência, cache por tenant, resposta de tamanho limitado, 401 com refresh apenas para GET, backoff curto em GET 429/5xx e **nunca retry automático de POST fiscal**. Timeout/incerteza após POST resulta em WLG_SUBMISSION_UNCERTAIN para reconciliação W14; sem reemissão cega.

**Swagger:** https://fiscal.wlgsistemas.com.br/swagger e caminhos alternativos foram tentados nesta execução, mas a documentação não ficou acessível ao agente. Portanto cancelamento, CC-e, webhooks, prova do emitente, limites, idempotência e modelos exatos continuam **PENDENTES**, sem endpoint inventado. O adapter só cobre caminhos publicados na página pública. Nenhuma chamada real WLG foi enviada.

## Gates e proteções

- Nenhum endpoint produtivo de emissão existe neste Worker. submitHomologation só opera com EMPROVEX_COMPANY_WLG_HOMOLOGATION_ENABLED=1 **e** EMPROVEX_COMPANY_PILOT_ENABLED=1, em connection de homologação, com confirmação do revisor, UID, ID de intenção e reserva idempotente fornecidos pelo futuro W14. Em produção é sempre bloqueado pelo W13, mesmo com flags ligadas.
- API GET /api/company/fiscal/connections usa requireCompanyContext accountsReceivable:read (owner/admin/finance pelas permissões W3 atuais), mas retorna 503 INTEGRATION_PENDING até o W10 conectar metadados reais. POST/PUT/DELETE exigem members:write (owner/admin) e retornam 503 CONFIGURATION_DISABLED sem escrita. Essas actions atuais são apenas **guarda transitória**, não substituem ações fiscais W10.
- Nenhuma connection/certificado/PFX/senha API real foi criada, carregada ou modificada. A WLG guarda o certificado A1 em sua plataforma conforme os termos; EMPROVEX não o recebe.
- Antes de qualquer chamada fiscal real: autorização comercial por escrito para EMPROVEX SaaS multi-cliente, confirmar escopo clientId/clientSecret/empresaId/CNPJ, prova de emitente, assinatura XML, retenção, taxas, limites, schemas Swagger e suporte de idempotência.
- Termos oficiais (01/11/2026, §12): https://wlgsistemas.com.br/termos-de-uso — proibição de disponibilização/revenda sem autorização expressa; anúncio de API gratuita não substitui licença.

## Evidência de execução (não converter em E2E)

- **Testes mock — 18/18 PASS**: em 06/11/2026 o código exato de index.mjs e os 18 callbacks de w13.test.mjs foram recuperados da branch GitHub e executados no avaliador JS V8 isolado, com substitutos mínimos de Response/AbortController/TextEncoder/asserções. Primeiro ciclo encontrou falha real de regex do operationId com letra maiúscula (17/18); corrigida no commit dc1ae69c94786a147cf4b0f3571a4eaf67d266b8, segundo ciclo 18/18.
- Cobertura mock: CNPJ válido/inválido, UID em dois CNPJs, bypass A→B, suspensão/revogação/versão, redaction, tokens distintos por tenant, expiração, concorrência de refresh, 401/403, 429, tentativa de URL forjada, SUCCESSO não autorizado, CNPJ remoto divergente, PROCESSANDO longo/ERRO, bloqueio prod, flags OFF, review e idempotência, HTTP 202, POST sem retry e timeout incerto, XML divergente, revogação cache e timeout GET.
- **Node 24 node --test, npm run typecheck, npm run build, Auth/Firestore Emulator, browser E2E e WLG homologação REAL:** ainda não certificados por essa evidência. Conferir checks no HEAD da PR; na CI W10, w13.test.mjs NÃO é chamado automaticamente. Nunca declarar PASS se não executado.

## Handoff para W10, W12 e W14

W10 (integrador exclusivo): incluir fiscalConnections (metadados sem secrets) no namespace do CNPJ, autorização live fiscal:read/fiscal:configure/fiscal:issue com papéis W3 ajustados e suspensão, migração aditiva multi-CNPJ W12, Secret Manager com credenciais/versionamento e capacidade de comprovar remotamente empresaId↔CNPJ/emitente, writer server-only com audit e CAS. Trocar guarda transitória da rota por ações fiscais próprias. Garantir csrf quando usar cookie e revalidação de UID/workspace a cada request; limpar estado e caches ao alternar perfil. Não persistir tokens, PFX ou segredo no Firestore ou HTML. Invalidação de tokens em revogação/rotação.

W12: fornecer contexto do perfil ativo verificado no servidor, sem atualizar platformAccounts singular ou índices militares; o WLG adapter toma a conexão do companyId autorizado após a troca, nunca da querystring.

W14: criar intenção/reserva idempotente DURÁVEL, aprovação humana real e revisão fiscal; chamar submitHomologation somente em gate de QA autorizado, nunca repetir POST após timeout ambíguo. Fazer polling limitado via getOperation. Tratar provider_success_unverified como intermediário, baixar XML privado, validar XML assinado, emitente, chave de 44 dígitos, protocolo, ambiente e integridade antes de marcar autorizada. Persistir XML/DANFE via W5 após contrato formal; sem baixar DANFE da WLG sem vínculo a XML autorizado. W8 continua dono financeiro; sem criar título automaticamente.

**Parecer W13: GO técnico parcial (adapter + mocks), NO-GO integração/QA real/produção** até check CI Node/TypeScript/build, W10/W12/W14, autorização escrita WLG e E2E fiscal próprio.
