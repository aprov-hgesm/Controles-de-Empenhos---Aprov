# EMPROVEX AI — ELEONOR R4 | PLANO OFICIAL DE WORKERS PARALELOS

**Data:** 02/11/2026 (Brasília). **Estado:** prompts preparados; Workers externos **não foram iniciados automaticamente**. **Objetivo:** pesquisa profunda, enriquecimento de contexto e documentação verificável, sem tocar no runtime até a fase de integração autorizada.

**Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`. **Base comum para todos:** `docs/emprovex-funcionalidades-memorial-r1-20261102` (PR #471, DRAFT). **Regra:** cada Worker cria sua branch a partir da HEAD atual dessa branch e propõe uma PR DRAFT com base na mesma branch; não direcionar as PRs isoladas à `main`.

## 1. Por que a fase R4 é diferente da R2/R3

- **R1:** 242 procedimentos catalogados e classificados por implantação.
- **R2:** 4.114 perguntas de procedimento + 175 casos operacionais + 41 conversas com 123 mensagens (4.412 registros/mensagens).
- **R3:** atlas de 135 entradas lexicais/449 grafias e corpus estruturado de 2.169 exemplos contextuais. **R2+R3: 6.581 registros documentais**, não 6.581 acertos observados.
- **R4:** mudar o foco de quantidade para profundidade: **resposta canônica, entidade, intenção, pré-condição, passo verificado, prova de resultado, falha conhecida, contexto de segurança e disponibilidade**. O mesmo pedido pode precisar de dados diferentes conforme módulo, perfil, status, revisão e filtros.
- **Limitação de implantação:** nenhum dos documentos foi automaticamente ingerido por W3/W4/W7, e não há fine-tuning executado; estas missões são preparatórias.

## 2. Iniciar os dez chats

Para cada Worker, abra **uma conversa independente**, preferencialmente em um modo capaz de consultar e editar o GitHub conectado; copie **o texto integral** do seu arquivo de prompt e envie-o como primeira mensagem do chat. A inclusão dos arquivos neste repositório não inicia outras conversas nem executa trabalho em segundo plano. Pode disparar vários chats sem aguardar os demais, pois a base e os caminhos são isolados.

| Worker | Foco/entrega distinta | Prioridade | Prompt para copiar | Saída Markdown exclusiva |
|---|---|---|---|---|
| **WC01** | **Linguagem natural e pragmática.** Léxico contexto-dependente, abreviações, gírias, sotaques sem estereótipos, erros, negação e contrastes HOWTO/WRITE | P0 | [Prompt WC01](prompts/WC01_linguagem-pragmatica.md) | `WC01_LINGUAGEM_PRAGMATICA.md` |
| **WC02** | **Ontologia e conceitos operacionais.** Entidades, relações, estados, siglas, saldos e transições entre financeiro e físico | P0 | [Prompt WC02](prompts/WC02_ontologia-semantica.md) | `WC02_ONTOLOGIA_SEMANTICA.md` |
| **WC03** | **Procedimentos financeiros.** F-02 a F-08: NE, NF, NS, cronogramas, relatórios, SAG, fornecedores e avisos | P0 | [Prompt WC03](prompts/WC03_funcionalidades-financeiras.md) | `WC03_FUNCIONALIDADES_FINANCEIRAS.md` |
| **WC04** | **Procedimentos logísticos.** F-09 a F-13 e F-17: Depósitos, saldo, inventário, móvel, SISCOFIS e Almox piloto | P0 | [Prompt WC04](prompts/WC04_funcionalidades-logisticas.md) | `WC04_FUNCIONALIDADES_LOGISTICAS.md` |
| **WC05** | **Suporte e diagnóstico.** Sintomas, erros verificáveis, triagem, soluções seguras, tutoriais e escalonamento | P0 | [Prompt WC05](prompts/WC05_suporte-troubleshooting.md) | `WC05_SUPORTE_TROUBLESHOOTING.md` |
| **WC06** | **Jornadas e onboarding.** F-01, F-14 a F-16; F-18 pausado: perfis, tarefas, menus, sucesso e dificuldades | P1 | [Prompt WC06](prompts/WC06_jornadas-onboarding.md) | `WC06_JORNADAS_ONBOARDING.md` |
| **WC07** | **Conversas, memória e personalidade.** Anáforas, retomadas, múltiplos turnos, correções, voz da Eleonor e limites reais do contexto | P0 | [Prompt WC07](prompts/WC07_dialogo-memoria-personalidade.md) | `WC07_DIALOGO_MEMORIA_PERSONALIDADE.md` |
| **WC08** | **Permissões e disponibilidade.** Roles, workspaces, feature flags, classificação de divulgação e estado de release | P0 | [Prompt WC08](prompts/WC08_autorizacao-escopo-release.md) | `WC08_AUTORIZACAO_ESCOPO_RELEASE.md` |
| **WC09** | **Avaliação independente.** Gold answers, regressões, cobertura real, antiexemplos, holdout honesto e falhas P0 | P0 | [Prompt WC09](prompts/WC09_avaliacao-rigorosa.md) | `WC09_AVALIACAO_RIGOROSA.md` |
| **WC10** | **Arquitetura de recuperação.** Catálogo aprovado, índice de procedimentos, escopo, custo, cache, fontes e integração futura sem implementação | P1 | [Prompt WC10](prompts/WC10_arquitetura-conhecimento-rag.md) | `WC10_ARQUITETURA_CONHECIMENTO_RAG.md` |

## 3. Mapa de responsabilidades para evitar colisões

- WC01 cuida de **forma e significado linguístico**; WC02 cuida de **significado operacional/ontologia**. Não devem editar os mesmos arquivos e não devem extrapolar palavras ambíguas para ações.
- WC03 cuida dos detalhes de telas e fluxos **financeiros**; WC04 de detalhes **logísticos**; WC06 apenas de jornadas, onboarding e experiência transversal, não copia os procedimentos dos WC03/04.
- WC05 identifica **sintomas e procedimentos de suporte**; WC08 define **o que pode ser acessado/divulgado**, independentemente do tom ou da forma da pergunta.
- WC07 projeta **continuidade de conversa e personalidade**; WC09 avalia **fidelidade e novos casos**, incluindo tudo que os outros acham que já sabem; WC10 constrói **estratégia futura de recuperação** sem integrar nenhum motor.
- Cada PR só altera seus caminhos `docs/eleonor/context-r4/WCXX_*.md` e `docs/eleonor/context-r4/data/WCXX_*.jsonl`. Não modificar o Memorial principal, README, arquivos W3/W4/W7 ou arquivos de outro Worker. O plano e os prompts devem permanecer estáveis durante a rodada.
- Ordem de execução: WC01–WC08 e WC10 podem operar em paralelo. WC09 pode começar com R2/R3 desde já, mas sua **revisão final** deve avaliar também os achados dos outros Workers e citar a revisão de referência.

## 4. Estrutura de conhecimento recomendada aos Workers

Para todo objeto de conhecimento orientado ao usuário, produzir sempre que possível:

```json
{
  "knowledgeId": "eleonor.feature.F-04-007.howto.v1",
  "featureId": "F-04-007",
  "title": "Cadastrar NF",
  "domain": "notas_fiscais",
  "intention": "HOWTO",
  "visibility": "sector",
  "availability": "MAIN",
  "source": "arquivo/rota e evidência verificados",
  "versionOrSha": "sha-verificado",
  "preconditions": ["sessão autorizada", "NE e dados documentais válidos"],
  "steps": ["instruções conferidas na UI auditada"],
  "verification": "como reconhecer gravação efetiva sem inventar resultado",
  "commonErrors": ["somente sintomas e mensagens comprovadas no código"],
  "doNotClaim": ["NF cadastrada sem prova de gravação"],
  "aliases": ["lançar nota fiscal", "cadastrar NF"],
  "escalation": "suporte quando o procedimento não resolver"
}
```

**Este JSON é apenas um exemplo de schema**, com campos semânticos; não é uma NF real, nem prova de uma rota implantada. O Worker deve validar a informação correspondente no código antes de publicar o cartão definitivo. Se algum campo não puder ser comprovado, utilizar `unknown`/`not_verified`.

Cada exemplo do JSONL deve especificar `id`, `utterance`, `expectedIntent`, `expectedBehavior`, `source`, `availability`, `visibility`, `partition` e `featureId` quando aplicável. Uma categoria `evaluation_candidate` **não** equivale a teste de holdout cego se publicada abertamente no repositório.

## 5. Padrões de qualidade (GO/NO-GO)

| Critério | Resultado esperado |
|---|---|
| Fidelidade | Toda afirmação operacional importante vinculada a componente, API, rota ou fonte documental identificada |
| Precisão | NE/NF/NS, saldos, unidades, temporalidade, importação, emissão, envio e baixa não se tornam equivalentes por semelhança textual |
| Utilidade | Resposta canônica inclui passos, decisão de próximo passo, limite de permissão e como verificar conclusão |
| Diversidade | Exemplos adversariais e reais de contexto, não simples troca mecânica de substantivos |
| Segurança | Documento classificado por visibilidade e estado do recurso, sem ação destrutiva/credencial/dados de outra conta |
| Exaustividade honesta | Listar funcionalidades e questões não verificadas, sem afirmar 100% de cobertura de produção |
| Entrega | Caminhos exclusivos, JSONL válido, IDs distintos, PR DRAFT e relatório de descobertas |

**NO-GO:** promessas falsas de implantação, token/segredo em dataset, omissão de 'não/sem/exceto', confusão de mapa com pedido, execução fictícia, PR que edite arquivo comum ou dados reais e casos sem resposta esperada verificável.

## 6. Consolidação após os Workers

1. Conferir o estado das dez PRs e registrar suas referências (branch, SHA, número, arquivos).
2. Fazer inspeção de duplicações semânticas e contradições; priorizar evidência atual de implementação sobre suposições dos textos.
3. Incorporar cartões confiáveis ao Memorial Oficial ou a catálogo associado; corrigir as entradas F e a classificação de visibilidade/estado antes de expor ao usuário.
4. Conservar exemplos de avaliação independentes das futuras regras de parsing e do conjunto de treinamento do indexador.
5. Preparar uma **integração separada**, com critérios de rollback, métricas reais de acerto e autorização explícita antes de publicar mudanças de runtime.

**Integrador previsto:** chat coordenador humano/ChatGPT iniciado **após** os Workers. Não iniciar integração à Eleonor nem mesclar automaticamente esta PR em `main` na etapa R4.

## 7. Comando padrão de handoff para o coordenador

> Audite o programa ELEONOR CONTEXTO R4 em `docs/eleonor/context-r4/PLANO_WORKERS_PARALELOS.md`, leia os PRs DRAFT WC01–WC10 direcionados à branch documental #471 e faça uma auditoria independente de consistência, evidências, status, visibilidade e não redundância. Produza relatório GO/NO-GO de consolidação documental. Não altere código, não faça merge e não publique até autorização.

## 8. Estado inicial verificado

- Em 02/11/2026, a PR #471 está aberta em DRAFT e contém o Memorial R3 e seu atlas/corpus.
- Os prompts WC01–WC10 foram adicionados à **branch documental #471**; apenas os prompts, não o trabalho realizado pelos dez Workers.
- A criação de arquivos não cria novos chats ou Workers ativos; é necessário iniciar cada conversa no aplicativo e enviar o prompt específico.
- Conferir o estado real de `main`/PR/Cloud Run no momento de cada auditoria; esta documentação é referência de início, não certificado de produção.
