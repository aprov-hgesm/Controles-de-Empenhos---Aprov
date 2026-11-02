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
# WORKER WC10 — Arquitetura de conhecimento, recuperação documental e integração futura

## Missão e critérios de profundidade

Planejar uma integração enxuta, de baixo custo, entre as centenas de procedimentos e o roteamento determinístico/generativo, sem criar novas autoridades nem acoplar o LFM3 diretamente aos dados internos.

## Escopo específico e evidências

1. Auditar `lib/emprovex-ai/context`, `conversation/knowledge.ts`, `integration/orchestrator.ts`, cliente LFM3/Ollama e contratos W3; explicar limites da arquitetura implementada e caminhos permitidos.
2. Propor unidades canônicas de conhecimento: `featureId`, `title`, `steps`, `preconditions`, `guards`, `availability`, `role`, `visibility`, `source`, `version`, `lastVerified`, `aliases`, `questions`, `expectedReply`.
3. Definir recuperação de procedimentos HOWTO a partir de documentação estruturada aprovada; comparar índice lexical/FTS, BM25 e, somente se justificável, embeddings/RAG sem obrigar infraestrutura extra.
4. Prever atualização incremental por SHA/revisão, deduplicação, custos, auditoria de fonte, cache com escopo seguro, limites de contexto, respostas com origem e fallback de baixa confiança.
5. Separar pipeline de perguntas sobre uso (documental), dados reais (W3 autenticado), comandos de escrita (bloqueados), curiosidades institucionais (catálogo público verificado) e perguntas fora do escopo.
6. Descrever plano mínimo de integração faseado com rollback, testes contratuais, ausência de modificações transacionais e instrumentos de revisão humana antes de deploy.

## Entrega principal

ADR/blueprint técnico de integração R4, schema proposto do catálogo, ranking de estratégias por custo/risco, pseudofluxo de autorização e plano de implantação futura; **não implementar nem ligar automaticamente**.

**Branch exclusiva:** `docs/eleonor-context-r4-wc10-arquitetura-conhecimento-rag`.
**Relatório exclusivo:** `docs/eleonor/context-r4/WC10_ARQUITETURA_CONHECIMENTO_RAG.md`.
**Dados exclusivos:** `docs/eleonor/context-r4/data/WC10_arquitetura-conhecimento-rag.jsonl`.
**PR:** DRAFT direcionada à branch documental `docs/emprovex-funcionalidades-memorial-r1-20261102`; sem merge ou deploy.

### Checklist final
- Quantos elementos semânticos e testes **não redundantes** foram realmente produzidos?
- Quais lacunas do corpus R3 permanecem, e quais limitações do código invalidam promessas de funcionalidade?
- Para cada afirmação importante, há fonte de código ou documento atual? O status de produção foi confirmado ou continua `não verificado`?
- Os outputs podem ser integrados sem vazamento de dados, sem acesso cruzado entre workspaces e sem dependência do modelo generativo para autorizar consultas?
- Foram preservadas as fronteiras de outros Workers e entregue PR DRAFT isolada?
- Informe commit SHA, link da PR e 5 descobertas mais relevantes.

**Execute a missão agora até a PR documental DRAFT, sem pedir autorização para alterações documentais não destrutivas. Não publique código ou recursos em produção.**
