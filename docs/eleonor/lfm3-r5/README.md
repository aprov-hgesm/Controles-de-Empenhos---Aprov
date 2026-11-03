# ELEONOR — R5 | Saneamento do corpus para futuro fine-tuning LFM3-1.7B

**Estado:** preparação documental e estrutural, **não treinado** e **não ingerido pelo runtime**.  
**Fonte:** Memorial de Funcionalidades R2/R3 — PR #471; Workers WC01–WC10 — PRs #479, #480, #481, #482, #483, #485, #486, #487, #488 e #489.  
**Data:** 02/11/2026 (Brasília).  
**Meta:** organizar as fontes para que o LFM3 compreenda linguagem, intenção, diálogo e limites do EMPROVEX, sem decorar dados dinâmicos de clientes ou ultrapassar o motor determinístico W3.

## 1. Resultados do saneamento

| Camada | Registros normalizados | Utilidade | Situação para fine-tuning |
|---|---:|---|---|
| **R2** | **4.412** | 4.114 perguntas vinculadas às 242 funcionalidades, 175 cenários com comportamento esperado, 123 turnos de conversa | Prompts e critérios de avaliação. **Sem respostas completas verificadas por pergunta**, não enviar diretamente para SFT |
| **R3** | **2.169** | Gírias, abreviações, ambiguidades, pares mínimos, 1.936 paráfrases | Exemplos de interpretação e recuperação, não respostas de assistente |
| **R4** | **1.811** | Dez Workers: semântica, tutoriais, suporte, permissões, jornadas, diálogo, avaliação e arquitetura | **45 cartões de ontologia sem utterance**, 1.766 casos com enunciado; rotas e comportamentos propostos requerem validação |
| **Total** | **8.392** | Biblioteca rastreável de registros documentais | **Não equivale a 8.392 pares de treino supervisionado** |
| **SFT separado (subconjunto R4)** | **112 candidatos** | 110 respostas propostas pelo WC07 + 2 respostas de referência do WC09 | 90 candidatos para treino; 22 para validação visível; **0 aprovados e 0 treinados** |

Os 112 candidatos são **subconjunto** dos 1.811 R4, não devem ser somados aos 8.392 como conteúdo novo. Os 45 cartões de ontologia não foram transformados artificialmente em perguntas. A contagem de frases únicas não é sinônimo de cobertura de intenções: podem existir sinônimos equivalentes.

## 2. O que foi corrigido nas fontes

- **WC03 / PR #479:** 726 linhas JSONL agora têm `partition` separada de `visibility`; 356 `development` e 370 `evaluation_candidate`. A visibilidade foi marcada conservadoramente como `internal_only` até a revisão editorial e de permissão; não pressupor que todo procedimento financeiro deva aparecer para qualquer usuário.
- **WC04 / PR #486:** 24 registros experimentais `pilot_only` foram marcados como `visibility: internal_only`, com `availability: PR/PILOTO` preservada. Isso **não altera** a disponibilidade do Almoxarifado.
- **Formato comum R5:** `id`, `origin`, `recordType`, `featureId` quando conhecido, `utterance` quando houver, `expectedIntent`, `expectedBehavior`, `visibility`, `availability`, rastreabilidade de origem e estado de aprovação.
- **Esquema de tipos:** cartões de relações `knowledge_relation` ficam em via de referência; sondas e perguntas são `intent/test only`; mensagens com resposta proposta entram somente na via candidata SFT.
- **Preservação:** todos os arquivos brutos R2/R3/R4 e documentos originais permanecem em suas PRs; a transformação não sobrescreve a fonte de verdade.

## 3. Estrutura de arquivos

- [`manifest.json`](manifest.json): contagens, origem, versão, política de segurança, nomes exatos dos fragmentos e limitações.
- [`data/`](data/): **17 partes JSONL** com todos os 8.392 registros normalizados: 6 partes R2, 5 partes R3 e 6 partes R4.
- [`sft/train-candidates.jsonl`](sft/train-candidates.jsonl): 90 exemplos de conversa com campo `messages` e proveniência.
- [`sft/validation-visible-candidates.jsonl`](sft/validation-visible-candidates.jsonl): 22 exemplos de validação *visível*, com agrupamento por roteiro/assunto para reduzir vazamento direto.
- [`validate_and_export.py`](validate_and_export.py): validação com Python padrão e exportação **apenas dos IDs explicitamente aprovados**.

**Regra:** `development`/`evaluation_candidate` representam origem do teste, não visibilidade de acesso; `internal_only`/ `sector`/ `admin`/ `public` representam classificação editorial de conteúdo, não autorização real no backend.

## 4. Por que nem todas as 8.392 entradas podem virar treino

O fine-tuning supervisionado (SFT) precisa de uma entrada e de uma saída desejada **correta e verificável**. Uma pergunta como “quais notas pendentes?” seguida do comentário “deve preservar filtros” é um **critério de avaliação**, não a resposta que o modelo deve aprender a produzir. Treinar essa observação como resposta provocaria linguagem mecânica e alucinação de procedimentos.

Usar os dados por função:

1. **Treinar comportamento e idioma:** exemplos aprovados de explicação simples, desambiguação, correção, personalidade e pedidos de esclarecimento.
2. **Treinar roteamento/extração estruturada:** após padronização e revisão dos labels HOWTO/READ/WRITE/CLARIFY e das entidades; nunca permitir que o modelo execute por conta própria.
3. **Avaliar modelos:** pares mínimos e casos adversariais, incluindo negações, permissões, faltas de contexto, estados de release e retenção de referência.
4. **Fornecer conhecimento factual atual:** procedimentos e fluxos via **catálogo versionado e recuperação documental** (modelo responde *a partir da fonte aprovada*), não apenas por memorização dos pesos.
5. **Consultar dados reais:** somente a API W3, autorizada pelo servidor e vinculada à sessão/workspace; o LFM3 propõe interpretações, mas nunca valida saldos, cria NF ou efetua baixa.

## 5. Formato compatível com LFM3-1.7B

A documentação oficial da Liquid AI indica SFT com TRL e recomenda que o **template de conversa seja aplicado pelo tokenizer do modelo**. Os candidatos preservam o formato:

```json
{
  "messages": [
    {"role": "system", "content": "Instruções da Eleonor e limites de acesso"},
    {"role": "user", "content": "O que o usuário perguntou"},
    {"role": "assistant", "content": "Resposta revisada e aprovada"}
  ]
}
```

**Não** escrever `<|im_start|>` ou `<think>` diretamente nos JSONL. Na etapa de treino, usar o tokenizer de **`LiquidAI/LFM3-1.7B`** e `tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False, enable_thinking=False)` se o tokenizer instalado aceitar esse parâmetro. Fixar versões da biblioteca e confirmar a formatação no próprio ambiente de treinamento antes de lançar jobs.

**Atenção à infraestrutura:** a instância Ollama do EMPROVEX utiliza GGUF quantizado `q4_K_M` para **inferência**, não um checkpoint BF16 diretamente treinável. Para fine-tuning, trabalhar com pesos compatíveis no ecossistema Transformers/TRL (por exemplo SFT/LoRA em GPU); **só depois** de avaliar e validar adaptadores/mesclagem, compatibilidade do modelo e conversão/quantização para o formato servido no Ollama. Não alterar o serviço atual até teste e aprovação da nova imagem. O contexto configurado na inferência pode ser menor que o do modelo: avaliar truncamento das conversas longas.

Fontes oficiais: [LiquidAI/LFM3-1.7B](https://huggingface.co/LiquidAI/LFM3-1.7B) e [LFM3-1.7B-Base](https://huggingface.co/LiquidAI/LFM3-1.7B-Base). A versão *post-trained* é a escolha inicial para adaptar comportamento; usar o modelo *Base* apenas se houver motivo técnico para treinamento mais extenso. Verificar termos da licença antes de distribuição comercial ou redistribuição de pesos.

## 6. Validação e exportação depois de revisão

Na raiz do repositório, com Python 3 instalado:

```bash
python docs/eleonor/lfm3-r5/validate_and_export.py
```

O comando valida todas as partes, esquema, contagens, IDs e grupos da divisão visível de SFT. **Não treina nem baixa modelos.**

Somente após revisão manual das respostas:

```json
{"approvedIds": ["WC09-001", "WC09-002"]}
```

Salve esta lista em arquivo de revisão e execute:

```bash
python docs/eleonor/lfm3-r5/validate_and_export.py --export-reviewed approvals.json --out-dir /tmp/eleonor-lfm3-sft
```

O exportador gera arquivos JSONL com **apenas `messages`** dos exemplos aprovados. Sem `approvedIds`, recusa a exportação. Este é um procedimento de revisão de dados, não um *gate* de publicação de aplicativo.

## 7. Próximas ações antes do fine-tuning de fato

1. Revisar editorialmente as 112 respostas candidatas e produzir respostas gold para os cenários R2/R3 e os cartões prioritários do WC03/WC04/WC05. Como o conjunto é sintético, manter variedade sem repetir templates artificiais.
2. Conferir privacidade e visibilidade antes de aprovar cada saída; dados de clientes, IDs reais, contas de terceiros e conteúdo `internal_only` não devem virar fatos públicos memorizados pelo modelo.
3. Congelar um **benchmark independente real** (não visível nas amostras usadas para treino) para comparar o LFM3 atual com o adaptado, usando as mesmas mensagens, permissões e respostas autorizadas.
4. Executar **SFT/LoRA fora do Cloud Run de produção** em checkpoint de treinamento compatível, registrar dataset hash, modelo base, tokenizer, parâmetros e resultado por tipo de erro.
5. Promover um novo modelo somente se houver melhora mensurável em interpretação sem regressão em segurança, filtros, autorização, custo/latência e respostas de suporte.

**Resumo decisório:** **GO para preparação e revisão de dados**, **NO-GO para iniciar fine-tuning automaticamente ou conectar este corpus bruto ao runtime**. A consolidação R5 é reversível e restrita à documentação. Nenhum documento ou dado foi escrito no Firestore ou consumido pelo Ollama.
