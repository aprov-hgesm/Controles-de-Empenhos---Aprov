# Bloco 1 — Serviço único de identidade e lock de NS

## Objetivo

O Bloco 1 cria a camada central de integridade de NS definida pelo contrato `emprovex_ns_integrity_v1`.

A partir deste bloco, a persistência do SAG deixa de possuir implementação própria de transação/lock e passa a delegar para o serviço compartilhado.

## Arquitetura

### Domínio puro

Arquivo:

`lib/nsIntegrity.ts`

Responsabilidades:

- normalizar e validar número de NS;
- construir a identidade física legada do lock;
- representar uma mutação de NS independente da origem;
- validar identidade NF/NE/CNPJ;
- validar estado atual esperado;
- detectar reutilização conhecida de NS;
- detectar duplicidades dentro do lote;
- classificar escrita versus no-op idempotente;
- validar propriedade de lock;
- construir o documento de lock.

As origens aceitas são:

```text
sag
manual
migration
system
```

A origem é parte do domínio da operação, embora a trilha histórica persistente fique reservada ao bloco de auditoria.

### Serviço transacional

Arquivo:

`lib/nsIntegrityService.ts`

Responsabilidades:

1. resolver o workspace da sessão atual;
2. reler NFs e NEs dentro da transação;
3. executar a validação pura;
4. reler todos os locks envolvidos antes da primeira escrita;
5. bloquear lock pertencente a outra NF;
6. atualizar ou remover `numeroNS`;
7. liberar o lock antigo em troca/remoção;
8. adquirir ou reconstruir o lock novo;
9. concluir tudo em uma única `runTransaction`;
10. retornar o estado final das NFs somente após commit bem-sucedido.

## Operações suportadas pelo núcleo

### Atribuir

```text
sem NS → 2026NS000001
```

Resultado:

- NF recebe a NS;
- lock é criado/adquirido.

### Reaplicar

```text
2026NS000001 → 2026NS000001
```

Resultado material:

- no-op idempotente;
- lock pode ser confirmado/reconstruído se necessário.

### Trocar

```text
2026NS000001 → 2026NS000002
```

Resultado:

- antigo lock é validado;
- novo lock é validado;
- NF recebe a nova NS;
- lock antigo é removido;
- novo lock é criado;
- tudo ocorre na mesma transação.

### Remover

```text
2026NS000001 → null
```

Resultado:

- `numeroNS` é removido da NF;
- lock antigo, quando existente e pertencente à NF, é removido;
- tudo ocorre na mesma transação.

## Compatibilidade do lock

O documento físico continua neste bloco como:

```text
workspaces/{workspaceId}/settings/sagNsLock_{NS}
```

e mantém:

```text
type = sag-ns-lock
```

Isso é deliberado para não exigir migração de dados ou mudança de Rules neste momento.

A identidade canônica futura `workspace + UG + NS`, congelada no Bloco 0, permanece planejada para o bloco específico de UG/migração.

## SAG como adaptador

`lib/sagNsPersistence.ts` agora:

- não importa Firestore;
- não abre transação;
- não lê locks;
- não cria locks;
- converte `SagNsPersistenceChange` para `NsIntegrityMutation`;
- delega para `commitNsIntegrityMutations()`;
- mantém o contrato de retorno esperado pela interface SAG.

A revalidação pura SAG também reutiliza `validateNsIntegritySnapshot()`.

## Limites de segurança mantidos

O núcleo preserva:

- máximo de 100 mutações por transação;
- máximo de 200 proprietários conhecidos relidos;
- todas as leituras de NF/NE/lock antes das escritas;
- falha fechada em identidade obsoleta;
- falha fechada em CNPJ divergente;
- falha fechada em lock divergente;
- isolamento pelo workspace resolvido pela sessão;
- idempotência.

## O que ainda não muda

O Bloco 1 **não conecta ainda a edição manual ao novo serviço**.

`handleSaveNumeroNS()` continua sendo o gap `GAP-001` congelado no Bloco 0 e será migrado no Bloco 2.

Também permanecem para blocos posteriores:

- exclusão de NF com liberação de lock;
- migração de recordKey;
- mudança de CNPJ em cascata;
- endurecimento adicional das Firestore Rules;
- identidade física com UG;
- trilha de auditoria persistente;
- Emulator chamando diretamente o serviço real.

## Critério de aceite

O Bloco 1 está concluído quando:

1. existe um domínio genérico de integridade de NS;
2. existe um único serviço transacional para NF + lock;
3. SAG delega a esse serviço;
4. a validação SAG reutiliza a camada central;
5. atribuição, idempotência, troca e remoção possuem testes puros;
6. guardrails impedem o retorno de uma implementação Firestore própria dentro do SAG;
7. toda a CI anterior permanece verde.
