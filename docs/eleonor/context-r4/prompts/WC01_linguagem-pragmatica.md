# /goal execute — ELEONOR CONTEXTO R4 — WORKER DOCUMENTAL

**Projeto:** EMPROVEX AI — Eleonor
**Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`
**Base documental obrigatória:** PR #471, branch `docs/emprovex-funcionalidades-memorial-r1-20261102`, e versão `main` vigente para comparar implementação real.
**Memorial oficial:** `docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md` (242 funcionalidades F-XX-YYY).
**Anexos existentes:** `docs/EMPROVEX_ELEONOR_ATLAS_LINGUISTICO_R3.md` e `docs/EMPROVEX_ELEONOR_CORPUS_LINGUISTICO_R3.jsonl`.
**Outras referências:** `docs/EMPROVEX_AI_MEMORIAL_OFICIAL.md`, códigos `lib/emprovex-ai/`, `features/`, `app/`, documentos e PRs conforme escopo.
**Diretriz GOV-SIMP-01:** pesquisa profunda, evidência verificável, síntese estruturada e mínimo de burocracia.

## Protocolo de execução obrigatório

1. Use GitHub conectado para ler as fontes diretamente; não suponha que a `main` coincide com a revisão publicada no Cloud Run.
2. Analise criticamente R1/R2/R3, identifique erros, lacunas, pressupostos frágeis, repetições e pontos ainda não comprovados, **não apenas reescreva** conteúdo.
3. Cada novo conhecimento deve ter `featureId` F-XX-YYY quando aplicável, domínio, intenção, origem verificável (arquivo/trecho/rota), restrição de acesso, disponibilidade (MAIN, GATED, PR/PILOTO, PAUSADO ou NÃO VERIFICADO), consequência operacional e grau de certeza.
4. Para cada família de comportamento, inclua exemplos naturais e adversariais (pergunta positiva, negativa, pergunta incompleta, correção, estilo formal e informal), **com expectativa de resposta**. Evite paráfrases artificiais repetitivas e números inventados.
5. **Separação HOWTO/READ/WRITE:** explicar ação de interface não é executá-la; dados reais exigem W3 + autenticação + escopo do workspace; propostas LFM3 são entrada não confiável; não expor dados internos a usuários comuns.
6. Não inserir segredos, CNPJ de cliente real, logs identificáveis, token, e-mail privado, CPF, informações de outras UGs ou conversas privadas no corpus. Exemplos devem ser sintéticos.
7. Não editar o Memorial principal, README, os anexos R3 de outros Workers, `main`, código de produção, banco, regras, IAM, billing ou deploy. Trabalhe **exclusivamente** nos seus arquivos de saída exclusivos.
8. Crie a branch indicada a partir do HEAD mais recente da branch documental #471, abra **PR DRAFT direcionada à branch documental #471**, sem merge. Se outra PR mudou essa base, rebase/reconcilie somente o que afeta seu escopo.
9. Informe quantos itens realmente **distintos, novos e rastreáveis** adicionou, quais lacunas permanecem e o SHA do commit. Qualidade e precisão são mais importantes que número de variações.
10. Se um dado não estiver no código ou não houver validação, sinalize `não verificado` em vez de presumir implementação. O arquivo de exemplos deve distinguir `development` de `evaluation_candidate`; não chamar avaliação visível de holdout cego.

## Saídas esperadas

- Um documento Markdown analítico completo no caminho exclusivo definido nesta missão.
- Um JSONL de exemplos estruturados no caminho exclusivo definido nesta missão, com IDs estáveis, `featureId` quando aplicável, `utterance`, `expectedIntent`, `expectedBehavior`, `source`, `availability` e `visibility` quando necessário.
- Um resumo inicial com **lacunas priorizadas P0/P1/P2**, mapa de cobertura, índice navegável, casos de exceção, critérios de validação e riscos de integração.
- PR DRAFT isolada. **Sem ativar integração à Eleonor nesta missão.**

---
# WORKER WC01 — Linguagem natural, português digital e pragmática R4

## Missão específica
Ampliar criticamente as 135 entradas linguísticas R3 com expressões autênticas e regras contextuais: gírias, regionalismos sem estereótipos, abreviações, homófonos, erros de fala/ASR, correções, siglas, verbos, negação, quantificadores e linguagem formal institucional, mantendo segurança de IDs.

## Escopo inegociável
1. Investigar lexemas e formas reais além de substituições de tokens: abreviações combinadas, sintaxe fragmentada, ausência de sujeito, imperativos misturados com cortesia, enunciados indiretos, oralidade e variação de pontuação.
2. Construir dicionário controlado com léxico, significado candidato, gatilhos contextuais, antiexemplos, exclusões, prioridade sobre siglas, risco de falso positivo, rejeição e evidências linguísticas quando existirem.
3. Auditar falsos cognatos e ambiguidades de contexto: NE/né, NS/'ns', baixa/download, QR/QR Code, fds/interjeição, n/negação/número, c/ e s/, documento/nota, ativo/liberado, valor/quantidade.
4. Incluir variantes formal de ofício, servidor operacional, iniciante, mensagem de WhatsApp, fala com ditado e frustração sem mimetização de agressividade.
5. Definir regras de proteção de NE, CNPJ, números de NF/NS, barcode, lote, datas e R$, reconhecendo referências ambíguas sem completar identificadores.

## Entregas e limites
Criar fichas lexicais com sinônimos condicionais, não equivalências, gramática leve de intenções, conjunto de pares mínimos adversariais e testes de regressão contra linguagem.ts; não alterar código nesta fase.

**Sua branch exclusiva:** `docs/eleonor-context-r4-wc01-linguagem-pragmatica`.
**Seu documento exclusivo:** `docs/eleonor/context-r4/WC01_LINGUAGEM_PRAGMATICA.md`.
**Seu corpus exclusivo:** `docs/eleonor/context-r4/data/WC01_linguagem-pragmatica.jsonl`.
**PR:** DRAFT para `docs/emprovex-funcionalidades-memorial-r1-20261102`; não marcar READY sem auditoria e contagem.
**Regra de isolamento:** não edite os arquivos exclusivos dos outros WC; não acrescente diretamente ao Memorial oficial (a consolidação será centralizada).

## Verificação final
- Conferir todos os links, nomes de módulos e IDs F usados; não inventar telas ou operações.
- Garantir que cada JSONL possa ser validado linha a linha, com `id` único, `source`, `availability`, `visibility`, e teste esperado.
- Informar o que já existia em R3, qual novidade real foi acrescentada e quais perguntas ainda não têm evidência.
- Resumir em até 12 linhas o estado do trabalho, citando branch, PR, commit SHA, quantidade de cartões e de testes.

**Execute agora de ponta a ponta, sem solicitar autorização para criar branch e PR DRAFT documentais. Não realize merge ou publicação.**
