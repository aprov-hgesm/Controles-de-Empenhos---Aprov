# Bloco 2 — Integridade da edição manual de NS

## Objetivo

Eliminar o `GAP-001` identificado no congelamento do contrato:

> edição manual de `numeroNS` gravando a NF diretamente sem passar pelo lock central.

## Antes

O fluxo manual era:

```text
campo NS
→ handleSaveNumeroNS()
→ saveInvoice()
→ numeroNS
```

Esse caminho não criava, validava, migrava ou removia lock.

## Depois

O fluxo passa a ser:

```text
campo NS
→ handleSaveNumeroNS()
→ commitNsIntegrityMutations()
→ validação NF/NE/CNPJ
→ validação lock
→ runTransaction
→ NF + lock
→ atualização local somente após sucesso
```

## Inclusão

Exemplo:

```text
sem NS → 2026NS000123
```

O serviço:

1. relê a NF;
2. relê o empenho;
3. valida o CNPJ;
4. verifica possíveis proprietários conhecidos da NS;
5. relê o lock;
6. bloqueia se o lock pertencer a outra NF;
7. grava a NS;
8. cria/reserva o lock;
9. conclui tudo atomicamente.

## Troca

Exemplo:

```text
2026NS000123 → 2026NS000456
```

O serviço valida o estado atual esperado, o lock antigo e o novo lock. Na mesma transação:

- a NF recebe a nova NS;
- o lock antigo é liberado quando existente e pertencente à NF;
- o novo lock é adquirido.

## Remoção

Campo vazio passa a significar:

```text
proposedNs = null
```

Na mesma transação:

- `numeroNS` é removido da NF;
- o lock antigo é removido quando existente e pertencente à NF.

## Idempotência e recuperação de lock

Salvar novamente a mesma NS é um no-op material da NF.

O serviço ainda pode reconstruir o lock correspondente quando a NF histórica possui NS mas o lock não existe, desde que não haja conflito conhecido.

## Segurança

A edição manual agora exige:

- sessão Firebase ativa;
- NF existente;
- empenho existente;
- CNPJ normalizado;
- identidade NF/NE estável;
- NS atual igual ao estado esperado;
- lock da nova NS livre ou pertencente à mesma NF.

Conflitos falham fechados e a interface local só é atualizada após o commit.

## Escopo

Este bloco corrige somente a edição manual de NS.

Permanecem para o Bloco 3:

- exclusão de NF removendo seu lock;
- mudança de `recordKey` migrando o proprietário do lock.

Permanecem para blocos posteriores:

- mudança de CNPJ em cascata;
- endurecimento das Firestore Rules;
- UG na identidade física do lock;
- trilha de auditoria persistente.
