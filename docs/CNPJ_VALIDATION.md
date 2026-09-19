# Bloco 6 — Validação oficial de CNPJ

## Contexto regulatório

Desde julho de 2026 o CNPJ brasileiro também pode ser alfanumérico para novas inscrições. Os CNPJs numéricos existentes continuam válidos e não são convertidos.

A Receita Federal gerou o primeiro CNPJ alfanumérico em 31/07/2026:

`00.000.000/E08G-12`

O formato atual possui:

- 12 posições alfanuméricas;
- 2 dígitos verificadores numéricos;
- total canônico de 14 posições.

Referências oficiais:

- Receita Federal — CNPJ Alfanumérico:
  https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico/cnpj-alfa
- Receita Federal / Serpro — cálculo do DV:
  https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj
- Receita Federal — primeiro CNPJ alfanumérico:
  https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/julho/receita-federal-gera-o-primeiro-cnpj-em-formato-alfanumerico

## Separação entre forma e validade

O EMPROVEX agora separa duas responsabilidades.

### Normalização estrutural

`normalizeSupplierCnpj()`

Aceita:

- CNPJ numérico legado;
- CNPJ alfanumérico;
- entrada formatada ou canônica;
- letras minúsculas, convertidas para maiúsculas.

Retorna somente a forma canônica quando a estrutura é:

`[0-9A-Z]{12}[0-9]{2}`

Ela **não valida o DV**.

Essa separação é deliberada: um registro histórico com 14 posições e DV incorreto ainda precisa continuar localizável para auditoria e correção, em vez de desaparecer de relatórios e migrações.

### Validade matemática

`isValidSupplierCnpj()`

Valida:

1. forma canônica;
2. os dois dígitos verificadores;
3. bloqueia o identificador nulo `00000000000000`.

## Algoritmo oficial

Para cada uma das 12 primeiras posições:

`valor = código ASCII - 48`

Assim:

- `0 → 0`
- `9 → 9`
- `A → 17`
- `B → 18`
- ...
- `Z → 42`

### Primeiro DV

Pesos:

`5 4 3 2 9 8 7 6 5 4 3 2`

Calcula-se a soma ponderada e o resto por 11.

- resto 0 ou 1 → DV = 0;
- demais casos → DV = 11 - resto.

### Segundo DV

O primeiro DV é acrescentado às 12 posições.

Pesos:

`6 5 4 3 2 9 8 7 6 5 4 3 2`

Repete-se a mesma regra de módulo 11.

## Casos oficiais testados

O CI valida:

- `02.483.088/0001-75` → válido;
- `00.000.000/E08G-12` → válido;
- `12.ABC.345/01DE-35` → válido;
- alterações no DV → inválidas.

## Pontos de aplicação

A validação matemática passou a proteger:

- criação de empenho;
- edição do CNPJ do fornecedor;
- revisão de empenho extraído por IA;
- recebimento/edição de NF quando existe CNPJ;
- atribuição, troca e persistência de NS;
- migração de CNPJ;
- contrato JSON SAG;
- geração do prompt SAG;
- conciliação SAG.

## Relatórios e histórico

O relatório por fornecedor não remove silenciosamente um CNPJ histórico apenas porque o DV é inválido.

Quando a estrutura ainda é reconhecível, o fornecedor continua consolidado, mas recebe:

`cnpjValid = false`

A interface exibe:

- contador de CNPJs históricos inválidos;
- aviso de saneamento;
- badge de DV inválido no fornecedor.

Registros com conteúdo que nem sequer possui a estrutura de CNPJ continuam fora da consolidação por chave, mas são contados como inválidos na interface quando o campo está preenchido.

## Interface alfanumérica

Os inputs de CNPJ deixaram de usar teclado exclusivamente numérico.

O placeholder passou a usar o exemplo oficial:

`00.000.000/E08G-12`

O prompt de extração de empenhos também orienta a IA a preservar letras e zeros à esquerda.

## Firestore Rules

As Rules agora reconhecem a forma oficial:

`^[0-9A-Z]{12}[0-9]{2}$`

Isso vale para:

- CNPJ de empenho em criação/alteração;
- CNPJ de NF que participa da coerência NF ↔ lock;
- CNPJ armazenado no lock de NS.

Para compatibilidade histórica, uma atualização não relacionada pode preservar um CNPJ antigo estruturalmente inválido sem ser bloqueada. A troca por um novo valor inválido é rejeitada.

### Limite deliberado das Rules

O cálculo completo do DV fica no domínio TypeScript.

As Firestore Rules garantem a forma canônica e as invariantes relacionais, mas não replicam a tabela ASCII-48 + módulo 11. Reproduzir o algoritmo inteiro nas Rules aumentaria muito a complexidade e a superfície de erro.

Os serviços oficiais do EMPROVEX fazem a validação matemática antes das operações protegidas.

## Compatibilidade

O `recordKey` continua:

`nf_<CNPJ_CANONICO>_<NF_NORMALIZADA>`

Por isso o CNPJ alfanumérico não exige novo schema de documento.

Exemplo:

`nf_00000000E08G12_1234`

A identidade histórica numérica continua inalterada.

## Resultado do Bloco 6

O sistema deixa de interpretar “CNPJ válido” como “tem 14 dígitos” e passa a aplicar o padrão efetivamente vigente em 2026, sem quebrar CNPJs numéricos existentes e sem ocultar inconsistências históricas.
