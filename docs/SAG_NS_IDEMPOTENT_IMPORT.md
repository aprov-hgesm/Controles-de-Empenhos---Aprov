# Bloco 11 — Persistência idempotente das NS do SAG

O Bloco 11 habilita a gravação das NS conciliadas, mantendo a decisão final sob controle humano e revalidando os dados imediatamente antes da escrita.

## Fluxo de confirmação

1. O JSON é validado pelo contrato SAG.
2. O motor refaz a conciliação CNPJ → NF → NE.
3. A prévia classifica os registros.
4. O operador abre **Revisar gravação**.
5. O EMPROVEX congela um fingerprint da prévia exibida.
6. O operador confere as alterações e marca a autorização explícita.
7. Ao confirmar, o sistema recalcula a conciliação com o estado atual da interface.
8. Se o fingerprint mudou, a gravação é recusada e a prévia precisa ser revisada novamente.
9. A transação Firestore relê os documentos de NF e NE.
10. Somente depois da revalidação transacional as NS elegíveis são gravadas.

## Atomicidade

A gravação usa uma única `runTransaction`. Todas as leituras necessárias ocorrem antes das escritas.

Se qualquer alteração apresentar conflito, a transação é interrompida e nenhuma linha do lote é confirmada parcialmente.

## Idempotência

A transação compara a NS atual no Firestore com a NS proposta:

- NF sem NS e estado igual à prévia → grava;
- NF já com exatamente a NS proposta → no-op idempotente;
- NF com outra NS → bloqueia todo o lote.

Isso permite reenviar o mesmo lote sem duplicar efeitos.

## Revalidações

Antes do commit são conferidos:

- `recordKey` da NF;
- número da NF;
- `empenhoId`;
- existência da NF;
- existência da NE;
- CNPJ atual da NE;
- CNPJ explícito da NF, quando existente;
- NS atual;
- reutilização da NS em outra NF conhecida no escopo;
- lock transacional determinístico da NS no workspace;
- duplicidade de NF ou de NS dentro do próprio lote.

## Proteções adicionais

- máximo de 100 alterações por transação;
- itens `unchanged`, `ignored` e `blocked` nunca viram operação de escrita;
- a interface não acessa Firestore diretamente;
- o estado local só é atualizado após sucesso da transação;
- qualquer erro mantém a prévia disponível para nova conferência.

## Limite deste bloco

A integridade transacional e a idempotência do fluxo estão implementadas. O Bloco 12 adiciona lock transacional por NS, redução de leituras e cobertura no Firebase Emulator.
