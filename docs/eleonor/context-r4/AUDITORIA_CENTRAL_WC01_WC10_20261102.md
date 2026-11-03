# ELEONOR — AUDITORIA CENTRAL DE CONSOLIDAÇÃO R4 (WC01–WC10)

**Revisão:** 02/11/2026 (Brasília) · **Escopo:** PRs documentais #479, #480, #481, #482, #483, #485, #486, #487, #488 e #489, todas PR DRAFT direcionadas à PR documental #471.
**Base de implementação declarada nos Workers:** `main@57a55b172790865bdb9b9beffaaa55b6a19c1a28`; a main evoluiu depois para pelo menos `9715ca2bb02fe040a113a2951b251915c06b1c40` (árvore consultada durante esta auditoria). **Produção Cloud Run não foi certificada.**
**Tipo de revisão:** GitHub estático + análise estrutural automática dos dez JSONL + leitura crítica dos relatórios e fontes de PRs específicas. **Não** foram executados E2E, fluxos autenticados, testes de inferência ou validação de respostas reais da Eleonor.

## Veredito

- **GO DOCUMENTAL CONDICIONAL:** 10/10 Workers entregaram 20 arquivos exclusivos, todos em PRs abertas DRAFT, sem merge, e sem alteração de código nos respectivos diffs. Base adequada para consolidar documentação depois de ajustes leves.
- **NO-GO PARA INGESTÃO BRUTA NO MOTOR OU PUBLICAÇÃO DE CONTEÚDO INTERNO:** corrigir principalmente `visibility`/`partition`, separar schema de cartões de relação e perguntas, padronizar `availability`, aprovar respostas canônicas e ACLs antes de expor documentos a usuários ou ao LFM3.
- **Não é um teste de sucesso da Eleonor:** 1.811 exemplos/cartões R4 não são 1.811 acertos; nenhum Worker demonstrou testes funcionais autenticados contra Cloud Run. Os `evaluation_candidate` são visíveis e não formam holdout cego.

## Inventário efetivo de entregas

| Worker | PR / commit verificado | Linhas JSONL válidas | Conteúdo avaliado | Parecer |
|---|---|---:|---|---|
| WC01 — Linguagem e pragmática | [#480](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/480) `7d91a5cb312f` | 180 | 30 fichas léxicas, 180 regressões, prioridade a desambiguação contextual | Aprovável documentalmente |
| WC02 — Ontologia e semântica | [#481](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/481) `c982eff3540b` | 135 | 45 relações + 90 sondas; 45 cartões de relação não são perguntas | Aprovável documentalmente |
| WC03 — Financeiro e documentos | [#479](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/479) `3f4caca8e706` | 726 | 89 cartões; 356 development, 356 evaluation_candidate, 14 cenários X declarados mas sem campo partition | Correção P0 de metadados antes de ingestão |
| WC04 — Logística e Almox | [#486](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/486) `10c2a495d05a` | 150 | 88 cartões de procedimento e 150 testes cobrindo diretamente 25 featureIds; 24 casos do Almox piloto | Correção P0 de classificação de visibilidade |
| WC05 — Suporte e troubleshooting | [#487](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/487) `fa4c562cb91e` | 144 | 24 roteiros de triagem, 14 tutoriais mapeados, 144 testes | Aprovável documentalmente |
| WC06 — Jornadas e onboarding | [#482](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/482) `692053d94894` | 111 | 30 jornadas, 90 testes de jornada e 21 contrastes | Aprovável documentalmente |
| WC07 — Diálogo, memória e personalidade | [#489](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/489) `2985efed5916` | 110 | 16 roteiros com 82 turnos + 28 sondas; 44 itens particionados como review_visible | Normalização P1 de partition |
| WC08 — Autorização e release | [#488](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/488) `914dcbcf01ea` | 124 | 242 F relacionados num índice documental; corpus de 124 casos em 56 IDs | Revisar classificação por item antes de RAG |
| WC09 — Avaliação independente | [#485](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/485) `9ab404caa73d` | 70 | 70 gold labels; revisão crítica de R2/R3, sem teste runtime | Ampliação após integrar achados dos outros WC |
| WC10 — Arquitetura de conhecimento | [#483](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/483) `90bb1ab5d2e5` | 61 | ADR de retrieval lexical + ACL + provenance; 61 testes | Blueprint válido, não implementado |

**Verificações automáticas desta auditoria:**
- **10/10 PRs** abertas em DRAFT, todas com base `docs/emprovex-funcionalidades-memorial-r1-20261102`, mergeabilidade reportada `true` e estado inicialmente `clean`; nenhuma mesclada. Cada PR altera só seu Markdown e seu JSONL próprios.
- **1.811 registros JSONL / 1.811 IDs únicos** nos dez arquivos; nenhum erro de parsing. **45 registros WC02 são cartões de relação sem `utterance`**, não perguntas; dos 1.766 registros com `utterance`, há **1.765 textos distintos após normalização de acento/caixa/espaçamento**, por uma repetição transversal entre WC04 e WC05 (`câmera não abre.`).
- **0 referências `featureId` inválidas** após confrontar os corpus R4 com os 242 `F-XX-YYY` do memorial oficial.
- **0 coincidências textuais normalizadas** entre as frases R4 presentes e os 2.169 registros de expressão R3. Essa contagem **não prova distinção semântica**.
- Nenhum padrão evidente de chave privada/token nos exemplos verificados. A ausência de ocorrência por padrões não é auditoria exaustiva de privacidade.

## Correções prioritárias antes de consolidação

### P0-01 — WC03: schema de avaliação incorreto

**Evidência:** 726/726 linhas de `WC03_funcionalidades-financeiras.jsonl` não possuem `partition`. Em vez disso, `visibility` contém `development` ou `evaluation_candidate`, o que é classificação de **uso do teste** e não visibilidade do conteúdo (public/sector/admin/internal_only). A sequência dos IDs tem 356 sufixos D, 356 E e 14 casos X, mas esta auditoria **não autoriza atribuir visibilidade automaticamente** com base no prefixo. 
**Ação:** acrescentar `partition` e `visibility` separados; revisar visibilidade por feature/papel e os 14 casos X. Preservar IDs e expectativas de teste originais. Os 89 cartões de Markdown permanecem utilizáveis como referência documental após revisão editorial.

### P0-02 — WC04: valor `pilot_only` no campo errado

**Evidência:** 24 registros com `visibility: "pilot_only"`, embora `availability: "PR/PILOTO"` já registre o status. Fontes `lib/almoxarifado/siscofisRequestPdf.ts`, `positionPlanner.ts`, `SeparationSheet.ts` e `app/api/almoxarifado/confirm/route.ts` não estão na main examinada, porém **existem na árvore da PR #463@673eab9d1b7d617a56856e980f1fcf40eb32d7d5**.
**Ação:** reservar `availability` para PR/PILOTO, `visibility` para público/setor/admin/interno, e deixar material experimental interno salvo se houver divulgação aprovada. Não anunciar suporte a PDF real ou baixa oficial com base na PR.

### P0-03 — Respostas de referência precisam ser específicas

**Evidência independente WC09:** 1.936 paráfrases R3 possuem essencialmente a mesma expectativa genérica por funcionalidade; o par mínimo R3 A/B tem label idêntico `DISTINCT_MEANING`, mesmo quando um enunciado pede instrução e outro execução. WC03 reutiliza textos genéricos de segurança em grupos de 89 entradas, embora 42/89 cartões tenham achado pontual verificado e 47 dependam de confirmação mais fina de UI.
**Ação:** usar perguntas R2/R3 como reconhecimento e recuperação, **não como respostas corretas prontas**; exigir `expectedDisposition` específico, `mustMention`, `mustNotClaim`, fonte, disponibilidade/ACL e próximo passo por procedimento. Priorizar inicialmente os procedimentos mais consultados.

### P1-01 — Normalização de partições e recordTypes

- WC07 usa `review_visible` em 44 casos e WC09 `development_review` em 70; mapear esses nomes no integrador ou normalizar para enum editorial, sem declarar holdout cego.
- WC02 mistura 45 `relation_card` (afirmações conceituais, sem `utterance`) e 90 `semantic_probe` (enunciados): definir tipo de registro e validar o schema de acordo com ele; não forçar um `utterance` fictício nos cartões.
- WC08 cria um índice para 242 funcionalidades, mas seus 124 casos amostram 56 IDs; **cobertura do índice não é cobertura de testes nem garantia de autorização individual**.
- WC04 mapeia 88 procedimentos logísticos, mas seu corpus só exercita 25 IDs diretamente. O índice de procedimentos não deve ser apresentado como 88 casos testados.
- Normalizar o vocabulário de `availability`: MAIN (código em main), GATED/MAIN COM GATES, PR/PILOTO, PAUSADO e NÃO VERIFICADO. Vincular a fonte/revisão e verificar produção separadamente.
- Eliminar ou marcar a duplicata `câmera não abre.` entre WC04 e WC05 na etapa de indexação (não uma falha grave).

### P1-02 — Atualização da revisão e fontes

- A documentação R4 usa um snapshot de `main@57a55b...`, mas a branch principal evoluiu depois: fazer uma revisão de diffs relevantes para login, Eleonor, APIs de NF/NE, pagamento e Warehouse antes de consumir os cartões como verdade da aplicação.
- Personalidade WC07 cita `docs/ELEONOR_ATLAS_COMPORTAMENTAL_R2.md`: esse arquivo não está na `main`, mas foi **verificado na árvore da PR #456@b264c5bc8f014af0152ddf3cd7c2f1be13154141**. Manter marca de proveniência de PR, sem sugerir implantação.
- WC02/WC08 identificam **nove contratos W3 na main** versus versão mais antiga de referência do catálogo; não tratar 242 funcionalidades como 242 consultas autorizadas.
- WC05 confirma um catálogo de 14 tutoriais e triagem por sintomas, mas a qualidade de soluções deve depender do estado/rota e da evidência concreta. Sintoma relatado não comprova causa.

## Reaproveitamento recomendado dos dados

1. **Eleonor HOWTO:** cartões WC03, WC04 e WC06 após revisão editorial e de ACL. Recuperação por `featureId`, aliases e fonte; resposta proveniente do material verificado.
2. **Central de Ajuda R2:** WC05 (triagem) + WC06 (jornadas) + WC03/04 (procedimentos), com busca lexical tolerante às abreviações do WC01 e conceitos do WC02. Não publicar documentação `internal_only`.
3. **Academia EMPROVEX:** jornadas WC06 → microlições derivadas de WC03/04, com glossário WC02 e exercícios WC09, sem transformar ações reais de produção em provas.
4. **Qualidade e regressão:** WC09 define esquema gold e critérios P0; WC01/07 geram estresse linguístico e de diálogo; WC08 fornece negativos de permissão. Criar holdout verdadeiro e executar medição real antes de GO.
5. **Arquitetura de conhecimento:** WC10 recomenda índice lexical aprovado + ACL server-side + versionamento por SHA e W3 para dados reais, LFM3 apenas onde estritamente permitido. Começar simples; embeddings/RAG vetorial apenas se a avaliação justificar custo/complexidade.

## Handoff enxuto GOV-SIMP-01

1. Solicitar correção localizada nos corpus das PRs **#479 (WC03)** e **#486 (WC04)**; preservar textos e IDs, corrigir metadados e validar JSONL.
2. Padronizar no integrador nomes de `partition` e os `recordTypes` sem exigir reescrita ampla dos Workers.
3. Produzir um índice unificado de `featureId` + resposta canônica + fonte + revisão + `availability` + `visibility`. Revisar o conjunto de maior uso primeiro; deixar recursos PR/internos fora de publicação.
4. Atualizar WC09 com a revisão dos achados dos demais Workers e manter ao menos uma avaliação independente não publicada.
5. **Apenas depois** planejar integração documental e Central de Ajuda; alterações do W3/W4/W7/Cloud Run em PR própria. Não houve autorização para merge/deploy nesta auditoria.

**Conclusão:** os Workers cumpriram o isolamento e entregaram um acervo sólido e reaproveitável. O conjunto recebe **GO documental condicional** e **NO-GO de ingestão direta**, com duas correções pontuais prioritárias de schema e uma melhoria editorial de gold labels. Não se exige reconstruir 10 PRs ou reiniciar os Workers.
