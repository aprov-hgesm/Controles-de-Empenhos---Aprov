# Bloco 12 — Hardening da importação de NS do SAG

O Bloco 12 reforça o fluxo de persistência introduzido no Bloco 11 em segurança, concorrência, desempenho e testes com Firebase Emulator.

## Lock transacional por NS

Cada NS importada recebe um documento determinístico em:

`workspaces/{workspaceId}/settings/sagNsLock_{NS}`

O lock é lido dentro da mesma transação que atualiza a NF.

Se duas importações concorrentes tentarem gravar a mesma NS em NFs diferentes:

1. ambas leem o mesmo lock;
2. somente uma transação consegue consolidar o proprietário;
3. a outra transação é repetida pelo Firestore;
4. ao reler o lock, encontra outro proprietário e é cancelada.

Assim, a mesma NS não pode ser conquistada simultaneamente por duas NFs através do fluxo SAG.

## Estrutura protegida pelas Firestore Rules

Locks SAG possuem estrutura fechada e validada:

- id;
- type = `sag-ns-lock`;
- workspaceId;
- numeroNS;
- invoiceRecordKey;
- invoiceId;
- empenhoId;
- supplierCnpj;
- createdAt;
- updatedAt;
- updatedBy.

`updatedBy` deve coincidir com o UID Firebase autenticado.

Após criação, os campos de identidade e propriedade do lock são imutáveis. Outro tenant não pode ler nem alterar o lock.

## Desempenho

O Bloco 11 relia todas as NFs do fornecedor para procurar reutilização de NS.

O Bloco 12 reduz esse custo:

- máximo de 100 alterações por transação;
- o hook identifica somente NFs que já possuem uma das NS propostas;
- somente esses possíveis proprietários, as NFs-alvo, as NEs-alvo e os locks são relidos na transação;
- máximo de 200 possíveis proprietários conhecidos por operação.

O custo deixa de crescer proporcionalmente a todas as NFs históricas do fornecedor e passa a acompanhar principalmente o tamanho real do lote.

## Cobertura no Firebase Emulator

A suíte multi-tenant agora valida também:

- corrida simultânea pela mesma NS;
- apenas uma NF vence a disputa;
- reimportação pelo mesmo proprietário é idempotente;
- isolamento de leitura e escrita entre tenants;
- impossibilidade de trocar posteriormente o proprietário do lock;
- rollback integral quando a criação do lock é rejeitada pelas Rules.

Os testes continuam executados dentro do workflow principal de CI junto com as demais validações de segurança multi-tenant.

## Limite conhecido

Os locks garantem concorrência forte para gravações realizadas pelo fluxo SAG a partir deste bloco.

Registros históricos e edições manuais anteriores podem não possuir lock. Por isso, a revalidação de possíveis proprietários existentes permanece ativa antes da gravação. Uma eventual unificação do salvamento manual de NS com o mesmo índice pode ser tratada em evolução posterior.
