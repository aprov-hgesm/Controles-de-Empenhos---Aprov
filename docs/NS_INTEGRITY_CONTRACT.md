# EMPROVEX — Contrato de Integridade de NS v1

## Status

**Congelado no Bloco 0.**

Este documento define os invariantes que todos os próximos blocos devem respeitar. O Bloco 0 **não altera o comportamento operacional**, não migra dados, não modifica Firestore Rules e não altera o formato atual dos locks.

A fonte estruturada deste contrato é `ops/ns-integrity-contract.json`.

## Decisão de identidade

A identidade canônica futura de uma Nota de Sistema será:

```text
workspaceId + UG emitente + numeroNS
```

O número da NS continua normalizado no formato:

```text
AAAANSNNNNNN
```

A UG deve ser normalizada em 6 dígitos.

### Compatibilidade atual

O lock existente continua, temporariamente, com a identidade:

```text
workspaceId + numeroNS
```

e com o documento:

```text
workspaces/{workspaceId}/settings/sagNsLock_{NS}
```

Isso é uma compatibilidade legada deliberada. A inclusão da UG no lock exige migração própria e não será feita silenciosamente neste bloco.

## Invariantes congelados

| ID | Invariante | Regra |
| --- | --- | --- |
| NS-001 | Identidade canônica | NS = workspace + UG emitente + número normalizado |
| NS-002 | Proprietário único | Uma identidade de NS pertence a no máximo uma NF ativa no workspace |
| NS-003 | Coerência NF-lock | NF com NS controlada deve ter lock coerente; lock ativo deve apontar para NF existente |
| NS-004 | Mutação atômica | NF e lock mudam na mesma unidade atômica |
| NS-005 | Idempotência | Reaplicar a mesma NS à mesma NF é no-op material |
| NS-006 | Sem bypass por origem | Manual, SAG, migração e sistema usam a mesma integridade |
| NS-007 | Ciclo de vida do lock | Exclusão ou migração da NF remove/migra o lock |
| NS-008 | Coerência CNPJ-NF | CNPJ, recordKey, NF e empenho não podem divergir silenciosamente |
| NS-009 | Multi-tenant | Operações não cruzam workspaces |
| NS-010 | Falha fechada | Ambiguidade/conflito bloqueia; o sistema não escolhe sozinho |
| NS-011 | Rastreabilidade | A origem lógica da mutação deve ser preservada para auditoria |

## Matriz de operações

| Operação | Permitida | NF + lock atômicos | Resultado obrigatório |
| --- | :---: | :---: | --- |
| Atribuir NS | Sim | Sim | NF recebe NS e lock aponta para ela |
| Trocar NS | Sim | Sim | lock antigo liberado, novo lock adquirido, NF atualizada |
| Remover NS | Sim | Sim | NS removida e lock liberado |
| Migrar recordKey da NF | Sim | Sim | NF e proprietário do lock migram juntos |
| Excluir NF | Sim | Sim | NF e lock associado são removidos |
| Excluir NFs em lote | Sim | Sim | nenhum lock órfão permanece |
| Alterar CNPJ do empenho | Sim | Sim | NFs, recordKeys e locks permanecem coerentes |
| Importar SAG | Sim | Sim | apenas vínculos determinísticos e confirmados são gravados |
| Gravar `numeroNS` diretamente sem serviço de integridade | **Não** | — | operação proibida |
| Apagar lock sem transição do proprietário | **Não** | — | operação proibida |

## Regras por origem

### SAG

O SAG continua exigindo seu contrato próprio, conciliação determinística, prévia, confirmação humana, fingerprint e revalidação transacional. O contrato de integridade de NS é uma camada inferior: o SAG não recebe uma exceção às regras gerais.

### Manual

A edição manual poderá continuar existindo, porém deverá usar a mesma reserva, troca e liberação de lock utilizada pelo restante do sistema.

### Migração

Rotinas de migração podem alterar identidade, CNPJ, recordKey ou UG, mas nunca devem deixar NF e lock em estados intermediários incoerentes.

### Sistema

Rotinas internas e automações também não podem gravar `numeroNS` diretamente.

## Estados que devem falhar fechados

A operação deve ser recusada quando houver:

- mesma NS pertencendo a outra NF;
- lock apontando para outra NF;
- lock órfão sem explicação de migração;
- NF inexistente;
- empenho inexistente;
- CNPJ incompatível;
- recordKey divergente;
- identidade obsoleta desde a prévia;
- ambiguidade de NF;
- tentativa cross-tenant.

## Lacunas reconhecidas no estado atual

O congelamento do contrato não afirma que o código atual já satisfaz todos os invariantes.

As lacunas conhecidas são:

1. edição manual de NS ainda pode gravar sem lock central;
2. exclusão de NF ainda pode deixar lock órfão;
3. alteração do `recordKey` ainda pode deixar lock apontando para a identidade antiga;
4. alteração de CNPJ do empenho ainda não migra NFs e locks;
5. as Firestore Rules não impõem em toda escrita de invoice a coerência NS-lock;
6. o Emulator ainda usa um helper conceitual para o lock em vez de executar `commitSagNsImport` real;
7. o lock legado ainda não inclui UG.

Essas lacunas estão declaradas no manifesto para impedir que sejam confundidas com garantias já entregues.

## Não objetivos do Bloco 0

Este bloco não:

- cria um novo serviço de persistência;
- altera `handleSaveNumeroNS`;
- altera exclusão de NF;
- migra recordKeys;
- altera CNPJ em cascata;
- modifica Firestore Rules;
- muda o ID físico dos locks;
- adiciona UG ao tipo `Invoice`;
- cria trilha de auditoria;
- migra dados históricos.

Essas mudanças pertencem aos blocos seguintes.

## Critério de aceite

O Bloco 0 está concluído quando:

1. existe uma fonte estruturada e versionada dos invariantes;
2. a matriz de operações está documentada;
3. os gaps atuais estão explicitamente registrados;
4. testes validam consistência interna do contrato;
5. o CI impede remoção acidental dos invariantes;
6. nenhum arquivo de runtime precisa mudar para entregar este bloco.
