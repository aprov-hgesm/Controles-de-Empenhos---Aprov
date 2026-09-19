# EMPROVEX — Bloco 13 — Concorrência segura de empenhos

## Objetivo

Impedir **lost updates** quando duas sessões trabalham sobre o mesmo empenho.

Antes do Bloco 13, uma sessão podia carregar um empenho, outra sessão alterá-lo
e, em seguida, a primeira salvar o objeto antigo por inteiro. O último write
poderia sobrescrever silenciosamente mudanças já confirmadas.

## Identidade concorrencial

Cada documento de empenho passa a possuir:

- `revision`: inteiro monotônico;
- `updatedAt`: instante ISO da última mutação;
- `updatedBy`: UID que confirmou a mutação.

Novos empenhos nascem em `revision = 1`.

Documentos históricos sem `revision` são tratados como revisão lógica `0`.
A primeira mutação válida faz a migração conservadora `0 → 1`.

## Escrita normal

Criação e atualização são operações diferentes:

- `commitEmpenhoCreate()` exige que o documento ainda não exista;
- `commitEmpenhoUpdate()` lê o documento em transação e compara a
  `revision` persistida com a revisão observada pela interface.

Se as revisões divergirem, a operação falha com `stale_revision`. O sistema
não tenta mesclar nem escolher silenciosamente qual versão deve prevalecer.

## Firestore Rules

As Rules exigem:

- create: `revision == 1`;
- update: `revision == revisão atual + 1`;
- `updatedAt` preenchido;
- `updatedBy == request.auth.uid`.

Isso impede writes comuns que ignorem o protocolo de versionamento.

## Lifecycles críticos

O mesmo controle é aplicado a operações que também modificam empenhos:

- cadastro/edição de NF e atualização de quantidades recebidas;
- exclusão individual de NF;
- exclusão em lote de NFs;
- migração de CNPJ do fornecedor;
- exclusão protegida do empenho.

Cada lifecycle valida a revisão observada antes de alterar o saldo ou os dados
do empenho e devolve à interface a nova revisão confirmada.

## Exclusão

O Bloco 12 continua responsável pelo lock de exclusão. No Bloco 13, o lock só
pode ser adquirido se a revisão atual ainda coincidir com a revisão observada
pelo operador. Assim, uma tela desatualizada não pode apagar alterações recentes
de outra sessão.

## Compatibilidade legada

Não há migração destrutiva em massa. Empenhos antigos continuam legíveis e só
recebem os novos metadados quando sofrerem a primeira alteração válida.

## Comportamento diante de conflito

Quando outra sessão já confirmou uma mudança:

1. a tentativa obsoleta é rejeitada;
2. nenhuma alteração persistida é sobrescrita;
3. o operador recebe mensagem para atualizar os dados;
4. o `onSnapshot` continua sendo a fonte de verdade e entrega a versão recente.

O sistema não implementa merge automático de alterações concorrentes, pois isso
poderia combinar saldos, itens ou identidades sem intenção explícita.

## Critério de aceite

O Bloco 13 está concluído quando:

1. novos empenhos nascem em revisão 1;
2. atualizações avançam exatamente +1;
3. documento legado migra de 0 para 1;
4. write com revisão repetida ou pulada é negado pelas Rules;
5. duas sessões com a mesma revisão esperada não geram lost update;
6. lifecycles de NF/CNPJ validam revisão;
7. delete valida revisão antes do lock;
8. UI recebe a revisão confirmada imediatamente;
9. Emulator, E2E, build e TypeScript permanecem verdes.
