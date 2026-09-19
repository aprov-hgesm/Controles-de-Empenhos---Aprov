# Bloco 9 — Conciliação determinística de NS do SAG

O Bloco 9 introduz o motor de leitura que relaciona um payload `emprovex_sag_ns_v1` já validado às Notas Fiscais cadastradas no EMPROVEX.

## Regra central

A conciliação automática usa somente:

`CNPJ selecionado → empenhos do CNPJ → número normalizado da NF → NF/NE cadastrada`

A data da NF é informação de conferência. Ela nunca é usada para escolher entre duas candidatas e nunca transforma uma correspondência aproximada em vínculo automático.

A normalização do número reutiliza `normalizeInvoiceNumber`, portanto uma NF do SAG como `01234` pode corresponder à NF `1234` cadastrada, sem alterar o valor bruto extraído do relatório.

## Estados

- `matched`: uma única NF do CNPJ possui o mesmo número normalizado e ainda não possui NS.
- `already_registered`: a NF já possui exatamente a mesma NS.
- `conflict_existing_ns`: a NF possui uma NS diferente.
- `conflict_ns_reused`: a NS do SAG já aparece em outra NF do mesmo fornecedor.
- `ambiguous_invoice`: mais de uma NF do CNPJ possui o mesmo número normalizado.
- `not_found`: nenhuma NF do CNPJ possui o número informado.
- `missing_nf_reference`: o SAG não trouxe número de NF explícito.
- `data_conflict`: a NF está vinculada a um empenho do CNPJ selecionado, mas a própria NF possui outro CNPJ cadastrado.

## Compatibilidade legada

Uma NF antiga sem `supplierCnpj` ainda pode ser considerada quando seu `empenhoId` pertence inequivocamente a um empenho do CNPJ selecionado. Já uma NF com CNPJ preenchido e divergente é bloqueada como conflito de dados.

## Regras de segurança

O motor:

- não faz fuzzy matching;
- não usa data para desempatar;
- não procura NF fora do CNPJ selecionado;
- não altera `numeroNS`;
- não executa `setDoc`, `updateDoc` ou `addDoc`;
- não persiste qualquer resultado.

O resultado deste bloco é diagnóstico. A aplicação das mudanças exige a prévia e a confirmação humana previstas nos blocos seguintes.
