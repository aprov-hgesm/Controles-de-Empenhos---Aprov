# ELEONOR R3 — Roteamento Ollama-first e histórico de conversas

**Status:** em implementação na PR #478 (base PR #477); **não publicar sem homologar modelo, identidade e armazenamento**.

## 1. Contrato de execução
1. Validar identidade Firebase, workspace, setor, UG e assinatura (mesmo autorizador W3).
2. Restaurar o token de contexto W5 para o próprio usuário e workspace.
3. Com gate explícito `EMPROVEX_AI_R3_MODEL_FIRST_ENABLED=1`, chamar o LFM3 privado do Ollama (Cloud Run IAM) **antes** do interpretador W4. O modelo devolve JSON tipado `kind=operational|conversation|unsupported`, `intent`, `params`, `answer`.
4. Se W4 já consegue executar consulta determinística, usar W3 sem delegar a autorização ao modelo.
5. Se a consulta for operacional e W4 não tiver contrato determinístico, aceitar uma proposta do LFM3 **somente** com validação W5, auditoria de filtros, W3 e escopo autenticado. Caso inexequível, esclarecer a limitação; nunca responder inventando saldos, notas, pagamentos ou estoques.
6. Para conversa geral segura (sem sinal operacional ou restrições de segurança), permitir resposta generativa do LFM3. Segurança W4/W7 tem precedência.
7. Se o Ollama falhar, usar fallback determinístico/templated existente **sem segunda chamada duplicada**. Modelo não recebe histórico completo, Firebase token, credenciais Google, resultados W3, dados de outros usuários ou poderes de escrita.

## 2. Histórico
- Gate independente `EMPROVEX_AI_HISTORY_ENABLED=1` e `aiProductionPilotEnabled()`. Padrão fechado até conferência IAM. Sem criação de contas ou bancos novos.
- Persistência em Firestore Core, via servidor e OAuth gerenciado: `eleonorHistory/{sha256(workspaceId + NUL + firebaseUid)}/threads/{uuid}`.
- Os clientes não possuem Rules de leitura ou escrita para esse namespace. O servidor só monta o caminho a partir da identidade verificada, nunca de parâmetros de workspace enviados pela interface.
- Campos: título, UID, workspaceId, timestamps e até 120 mensagens (texto, data, papel, status e rota). Até 50 conversas por usuário/setor. Criação no primeiro envio; não há gravação em texto puro nos logs.
- Interface: listar, retomar, nova conversa, renomear e excluir com confirmação. Exclusão remove integralmente o documento que contém todas as mensagens e exige precondição updateTime. A exclusão não apaga eventuais logs técnicos previamente retidos por outras políticas de infraestrutura.
- Retomar uma conversa não restaura o token W5 antigo. O usuário vê as mensagens anteriores, mas contexto de dados operacionais precisa ser novamente validado por sessão/expiração. Isso impede reutilizar referências de outra sessão.
- Não disponibilizar leitura de conversas de outros usuários para administradores sem uma política formal de acesso, ciência dos titulares, auditoria e base legal. Histórico inicial é **privado por usuário**, para transparência e inspeção das próprias solicitações.
- Histórico existente antes da liberação não pode ser recuperado retroativamente.
- Sem opção de arquivamento ou busca textual nesta primeira iteração; ações fundamentais são listar, criar, retomar, renomear e excluir.

## 3. Limites e teste real
- Verificar se a identidade runtime atual possui permissão mínima de **escrita somente no namespace** do Firestore Core ou equivalente. Não conceder IAM amplo só para passar o teste.
- Realizar em sessão fundadora 1 conversa generativa, 1 consulta W3, 1 sessão nova, retomada, renomeação e exclusão; testar que outro UID/workspace não visualiza os registros e que um ID excluído retorna 404.
- Confirmar `MODEL_ELIGIBLE` e `metrics.modelOutcome`, observando se LFM3 entrega JSON válido. O modelo LFM3 1.7B pode não produzir qualidade suficiente; comparações reais e fixtures de usuário ainda serão necessárias.
- Testar recuperação em falha Ollama, carga simultânea, uso em celular e fallback ao modo sem histórico quando flag estiver desligada.
- Não misturar a implementação com Almoxarifado, EMPRESAS, novos contratos financeiros ou mudanças nas Rules produtivas. Não ativar flags nem publicar main sem revisões.

## 4. Rollback
`EMPROVEX_AI_R3_MODEL_FIRST_ENABLED=0` retorna ao roteamento W4-first; `EMPROVEX_AI_HISTORY_ENABLED=0` impede novas consultas/escritas no histórico, sem apagar documentos existentes. Revisão Cloud Run anterior disponível para rollback.
