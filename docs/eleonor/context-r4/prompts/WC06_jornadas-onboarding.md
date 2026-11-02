# /goal execute — ELEONOR CONTEXTO R4 — WORKER DOCUMENTAL

**Projeto:** EMPROVEX AI — Eleonor
**Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`
**Base obrigatória:** PR #471, branch `docs/emprovex-funcionalidades-memorial-r1-20261102`, e `main` vigente para conferir o código.
**Fontes fundamentais:** `docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md` (242 F), `docs/EMPROVEX_ELEONOR_ATLAS_LINGUISTICO_R3.md`, `docs/EMPROVEX_ELEONOR_CORPUS_LINGUISTICO_R3.jsonl`, `docs/EMPROVEX_AI_MEMORIAL_OFICIAL.md`, `lib/emprovex-ai/` e componentes relevantes.
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
# WORKER WC06 — Jornadas do usuário, onboarding e uso orientado por objetivos

## Missão e critérios de profundidade

Traduzir as funcionalidades de login, administração, assinaturas, ajuda e experiência do usuário em jornadas completas para perfis diferentes, sem reimplementar tutoriais financeiros/logísticos dos WC03 e WC04.

## Escopo específico e evidências

1. Auditar fluxos F-01 (acesso/conta), F-14 (Admin), F-15 (assinatura/suporte) e F-16 (interface Eleonor); F-18 (Empresas) deve permanecer suspenso.
2. Modelar 15–30 objetivos reais em sequências de tarefas: 'acabei de entrar, como cadastrar NE?', 'comecei como novo operador móvel', 'perdi acesso', 'troquei de responsável do setor', 'quero iniciar o trial', 'quero conferir suporte'.
3. Separar personas de interface, não inferir dados pessoais/psicológicos: setor com permissão padrão, administrador da plataforma, operador móvel, usuário iniciante e responsável técnico; não presumir acesso de um perfil a outro.
4. Para cada jornada mapear requisito de entrada, telas reais, ordem, dependências, pontos de decisão, sucesso observável, falha, retorno ao fluxo e onde a Eleonor pode orientar versus apenas consultar.
5. Criar estratégias de apresentação em camadas: resposta de uma frase, passos numerados, explicação aprofundada, glossário contextual, adaptação para modo Essencial/celular quando verificada.
6. Definir descoberta progressiva de ajuda e capacidade: quando oferecer tutorial oficial, quando pedir tela e quando encaminhar ao suporte; diferenciar interesse comercial, cadastro setorial, trial e login.

## Entrega principal

Mapa de jornadas ponta-a-ponta com narrativa de usuário, roteiro estruturado, FAQ contextual por perfil e exemplos sintéticos de diálogo por jornada; não inventar botões ou perfis.

**Branch exclusiva:** `docs/eleonor-context-r4-wc06-jornadas-onboarding`.
**Relatório exclusivo:** `docs/eleonor/context-r4/WC06_JORNADAS_ONBOARDING.md`.
**Dados exclusivos:** `docs/eleonor/context-r4/data/WC06_jornadas-onboarding.jsonl`.
**PR:** DRAFT direcionada à branch documental `docs/emprovex-funcionalidades-memorial-r1-20261102`; sem merge ou deploy.

### Checklist final
- Quantos elementos semânticos e testes **não redundantes** foram realmente produzidos?
- Quais lacunas do corpus R3 permanecem, e quais limitações do código invalidam promessas de funcionalidade?
- Para cada afirmação importante, há fonte de código ou documento atual? O status de produção foi confirmado ou continua `não verificado`?
- Os outputs podem ser integrados sem vazamento de dados, sem acesso cruzado entre workspaces e sem dependência do modelo generativo para autorizar consultas?
- Foram preservadas as fronteiras de outros Workers e entregue PR DRAFT isolada?
- Informe commit SHA, link da PR e 5 descobertas mais relevantes.

**Execute a missão agora até a PR documental DRAFT, sem pedir autorização para alterações documentais não destrutivas. Não publique código ou recursos em produção.**
