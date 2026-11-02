# /goal execute — ELEONOR CONTEXTO R4 — WORKER DOCUMENTAL

**Projeto:** EMPROVEX AI — Eleonor
**Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`
**Base obrigatória:** PR #471, branch `docs/emprovex-funcionalidades-memorial-r1-20261102`, e `main` vigente para conferir o código.
**Fontes fundamentais:** `docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md` (242 F), `docs/EMPROVEX_ELEONOR_ATLAS_LINGUISTICO_R3.md`, `docs/EMPROVEX_ELEONOR_CORPUS_LINGUISTICO_R3.jsonl`, `docs/EMPROVEX_AI_CONVERSATIONAL_ENGINE_R1.md` (disponível na main) e PR #455/memorial de personalidade somente se acessíveis; não inventar arquivo não encontrado, `lib/emprovex-ai/` e componentes relevantes.
**Diretriz:** GOV-SIMP-01: aprofundamento prático, segurança essencial, sem burocracia.

## Regras transversais de execução

1. Acesse as fontes reais no GitHub. Não presuma que `main` é idêntica à revisão em produção do Cloud Run.
2. Faça auditoria crítica do material R1–R3: cobertura, lacunas, duplicações, conteúdo não verificado e riscos. Não replique números artificiais de perguntas.
3. Vincule conteúdo a `featureId` (F-XX-YYY) quando possível, com rota/menu, origem verificável, status (MAIN/GATED/PR/PILOTO/PAUSADO/NÃO VERIFICADO), perfil de autorização, visibilidade (public/sector/admin/internal_only), precondição, conclusão e ressalva.
4. Use exemplos sintéticos. Nunca inclua conversas privadas, valores de clientes, credenciais, tokens, CNPJ real de terceiros, logs privados ou dados de outro workspace.
5. Separe HOWTO (tutorial), READ (consulta autenticada), WRITE (mutação, proibida ao chatbot somente-leitura), ABOUT (institucional) e SOCIAL (casual). O LFM3 não pode contornar W3, autenticação, limites de filtro e autorização.
6. Ao criar exemplos, forneça expectativa verificável, exemplos negativos, correções, perguntas incompletas, linguagem formal/informal e situações adversariais; respeite a resposta `não verificado` quando a fonte não sustentar certeza.
7. Não edite `README.md`, o memorial principal, os anexos R3, arquivos de outros Workers, runtime, APIs, IAM, Firestore, cobrança, automações ou Cloud Run. Somente arquivos exclusivos desta missão.
8. Crie branch individual a partir do HEAD da PR #471 e PR DRAFT tendo como **base a branch documental #471**, sem merge nem deploy. Não marque READY sem revisão.
9. Documente descobertas P0/P1/P2, fontes, lacunas que persistem e número de itens semânticos distintos. Não chame um corpus visível no repo de holdout cego, nem afirme acurácia sem testes.
10. Termine com commit SHA, link de PR, resumo de evidências, quantidade de entradas JSONL realmente distintas e pontos que exigem teste prático.

## Artefatos obrigatórios

- Markdown exaustivo e navegável no caminho único indicado.
- JSONL no caminho indicado, com `id`, `featureId` quando aplicável, `utterance`, `expectedIntent`, `expectedBehavior`, `source`, `availability`, `visibility` e `partition`.
- Matriz de cobertura/limitações e casos de teste suficientemente específicos para futura integração.
- PR DRAFT independente. **Não integrar dados ao motor nem publicar.**

---
# WORKER WC07 — Conversas longas, anáforas, memória contextual e personalidade da Eleonor

## Missão e critérios de profundidade

Aprofundar a matriz R2 e os limites da implementação atual de conversa para projetar como a Eleonor deve manter contexto e responder naturalmente, sem confundir memória técnica com dados persistidos.

## Escopo específico e evidências

1. Auditar W4 `context/engine.ts`, `integration/session.ts`, W7 `conversation/engine.ts`, `knowledge.ts`, `orchestrator.ts`, e documentos de personalidade/memória; registrar a realidade de TTL, sessão e workspace.
2. Modelar diálogo de 3–10 turnos com correções, pronomes, elipses, interrupções, mudança de módulo, mudança de perfil, perguntas compostas, contexto expirado e pedidos para lembrar informações.
3. Investigar contraste de gírias com tom profissional: adaptação sem caricatura, humor discreto, cordialidade, iniciativa responsável, explicação sem repetição robótica, reconhecer frustração e limitações.
4. Definir memória permitida, contexto efêmero, histórico de conversa (se realmente implementado) e condutas de exclusão/privacidade; não prometer retenção, recuperação ou eliminação sem fonte do runtime.
5. Desenhar mecanismos de esclarecimento mínimo, retomada de assunto e recusa contextual; uma referência antiga, contraditória ou de outra conta não deve ser recuperada.
6. Construir scripts de simulação bons e ruins, com resposta esperada por turno, anotação de onde deve usar o determinístico, tutorial documental ou resposta casual e condição de falta de fonte.

## Entrega principal

Matriz de atos conversacionais, mapa de estado e transições, exemplos multi-turn curados, respostas gold por turno, regras de tom e fronteiras da memória com evidência.

**Branch exclusiva:** `docs/eleonor-context-r4-wc07-dialogo-memoria-personalidade`.
**Relatório exclusivo:** `docs/eleonor/context-r4/WC07_DIALOGO_MEMORIA_PERSONALIDADE.md`.
**Dados exclusivos:** `docs/eleonor/context-r4/data/WC07_dialogo-memoria-personalidade.jsonl`.
**PR:** DRAFT direcionada à branch documental `docs/emprovex-funcionalidades-memorial-r1-20261102`; sem merge ou deploy.

### Checklist final
- Quantos elementos semânticos e testes **não redundantes** foram realmente produzidos?
- Quais lacunas do corpus R3 permanecem, e quais limitações do código invalidam promessas de funcionalidade?
- Para cada afirmação importante, há fonte de código ou documento atual? O status de produção foi confirmado ou continua `não verificado`?
- Os outputs podem ser integrados sem vazamento de dados, sem acesso cruzado entre workspaces e sem dependência do modelo generativo para autorizar consultas?
- Foram preservadas as fronteiras de outros Workers e entregue PR DRAFT isolada?
- Informe commit SHA, link da PR e 5 descobertas mais relevantes.

**Execute a missão agora até a PR documental DRAFT, sem pedir autorização para alterações documentais não destrutivas. Não publique código ou recursos em produção.**
