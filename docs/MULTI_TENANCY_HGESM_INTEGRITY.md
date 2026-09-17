# EMPROVEX — Bloco 10: auditoria profunda de integridade do HGeSM

## Objetivo

O Bloco 10 valida a cópia criada no Bloco 9 antes de qualquer troca do runtime para os paths por workspace.

A auditoria é estritamente somente leitura. Ela não altera `legacyDataMode`, não grava documentos e não remove dados.

## Comando

```bash
npm run audit:hgesm:integrity
```

A ferramenta usa a identidade já autenticada no Google Cloud Shell e consulta diretamente o banco Firestore configurado em `ops/firestore-recovery.json`.

## Camada 1 — identidade física da migração

A auditoria relê legado e workspace e valida novamente:

- contagem por coleção;
- IDs faltantes;
- documentos extras;
- igualdade exata dos campos tipados do Firestore;
- `settings/termoRecebimentoCounter`;
- SHA-256 lógico independente do dataset legado e do dataset do workspace.

Qualquer divergência nessa camada é bloqueante.

## Camada 2 — integridade estrutural e referencial

São bloqueantes, entre outros:

- campo `id` incompatível com o ID do documento;
- NF que referencia empenho inexistente;
- item de NF que não existe no empenho correspondente;
- cronograma que referencia empenho inexistente;
- distribuição de cronograma para item ou coluna inexistente;
- números de TR duplicados;
- contador de TR inválido ou inferior ao maior `termoNumero` já atribuído;
- tipos/valores numéricos estruturalmente inválidos;
- tipos de status/alerta fora dos valores suportados;
- mês de comissão inválido ou duplicado.

## Camada 3 — coerência de negócio

A ferramenta também emite avisos não bloqueantes para situações que podem ser históricas e não necessariamente foram produzidas pela migração, por exemplo:

- fornecedor da NF diferente do fornecedor cadastrado no empenho;
- subtotal da NF diferente de quantidade × preço;
- total da NF diferente da soma dos subtotais;
- `received` do item diferente da soma das quantidades registradas nas NFs;
- quantidade programada no cronograma acima da quantidade empenhada;
- composição incomum de comissão;
- termo numerado sem data de emissão.

Avisos precisam ser conhecidos, mas não significam por si só que a migração falhou. A decisão do Bloco 10 é baseada em erros bloqueantes.

## Critério de aprovação

O Bloco 10 está apto a ser encerrado quando a execução termina com:

```text
Erros bloqueantes: 0
INTEGRIDADE SEMÂNTICA: READY
```

Avisos podem existir e devem ser registrados para saneamento posterior, desde que não representem perda, órfão referencial ou divergência entre legado e workspace.

## Segurança

Durante todo o Bloco 10:

- o HGeSM continua em `legacyDataMode=true`;
- as coleções legadas continuam sendo a fonte de verdade;
- o workspace continua como cópia sombra;
- o snapshot gratuito criado no Bloco 9 permanece como mecanismo de recuperação;
- nenhuma exclusão ou migração destrutiva é executada.

A troca do runtime para o workspace pertence aos blocos posteriores e não deve ocorrer enquanto esta auditoria apresentar erro bloqueante.
