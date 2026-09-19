# Bloco 10 — Prévia visual de aplicação das NS do SAG

O Bloco 10 transforma o resultado determinístico do motor de conciliação em um plano de aplicação legível pelo operador, sem executar qualquer gravação.

## Decisões da prévia

Cada registro validado recebe exatamente uma decisão:

- `change` — **ALTERAR**: existe uma correspondência segura e a NF ainda não possui NS. A prévia mostra a NS atual e a NS proposta.
- `unchanged` — **SEM ALTERAÇÃO**: a NF já possui exatamente a mesma NS.
- `ignored` — **IGNORAR**: não há NF explícita no SAG ou a NF não foi encontrada no CNPJ selecionado.
- `blocked` — **BLOQUEAR**: há ambiguidade ou conflito que impede qualquer escrita automática.

## Regra de avanço

`canAdvanceToPersistenceReview` só é verdadeiro quando:

1. não existe nenhum item bloqueado; e
2. existe pelo menos uma alteração proposta.

Essa sinalização prepara o Bloco 11, mas não grava nada e não habilita qualquer ação de persistência.

## Conteúdo exibido ao operador

A prévia mostra:

- decisão;
- NF;
- NE vinculada;
- NS atual;
- NS proposta;
- efeito esperado;
- alertas;
- bloqueios.

O número bruto da NF extraído do SAG continua preservado para registros sem correspondência no EMPROVEX.

## Segurança

O Bloco 10:

- não altera `numeroNS`;
- não executa `setDoc`, `updateDoc` ou `addDoc`;
- não oferece botão de aplicar;
- não oferece confirmação de gravação;
- não modifica o resultado do motor de conciliação;
- apenas apresenta o plano derivado do Bloco 9.

A persistência permanece reservada ao Bloco 11.
