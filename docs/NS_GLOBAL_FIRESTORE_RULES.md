# Bloco 5 — Hardening global das Firestore Rules para NS

## Objetivo

Resolver o GAP-005 do contrato de integridade:

> impedir que qualquer cliente autorizado do workspace grave, troque, remova ou preserve uma NS de forma incompatível com o lock correspondente.

Até o Bloco 4, os serviços oficiais já preservavam a coerência. Porém, a coleção operacional de NFs ainda possuía `allow read, write: if canAccessWorkspace(workspaceId)`, permitindo que um cliente modificado tentasse contornar a camada de serviço.

## Regra global

A coleção `/workspaces/{workspaceId}/invoices/{id}` agora possui regras distintas de:

- `create`;
- `update`;
- `delete`.

Não existe mais `allow write` genérico.

### NF sem NS

Uma NF sem `numeroNS` continua podendo ser criada e atualizada pelos fluxos normais do sistema.

### NF com NS

Se o estado final da NF possui `numeroNS`, as Rules exigem:

- formato canônico `AAAANSNNNNNN`;
- `recordKey` igual ao ID físico do documento;
- CNPJ em forma canônica oficial de 14 posições (12 alfanuméricas + 2 DVs numéricos);
- para identidades canônicas, `nsUg` com 6 dígitos;
- lock `sagNsLock_<UG>_<numeroNS>` existente no estado final;
- lock com mesmo workspace;
- lock com a mesma UG e a mesma NS;
- lock apontando para o mesmo `recordKey`;
- mesmo `invoiceId`;
- mesmo `empenhoId`;
- mesmo `supplierCnpj`.

Quando a NS é atribuída pela primeira vez ou quando a identidade da NF muda, o empenho também é relido e precisa confirmar o mesmo CNPJ.

## Troca de NS

Se uma NF muda de NS:

1. o novo lock precisa existir e apontar para a NF final;
2. o lock antigo precisa desaparecer ou deixar de apontar para a identidade antiga.

Uma simples escrita `updateDoc(invoice, { numeroNS: outraNs })` deixa de ser suficiente.

## Remoção de NS

A remoção de `numeroNS` só é aceita se o lock anterior também for liberado no estado final da mesma operação.

## Exclusão da NF

Uma NF com lock ativo não pode ser excluída isoladamente.

A exclusão só passa quando o lock correspondente:

- é removido; ou
- é migrado legitimamente para outra identidade de NF.

Isso preserva os fluxos de mudança de `recordKey` e migração de CNPJ implementados nos Blocos 3 e 4.

## Hardening do lock

A criação ou atualização de um lock agora exige que a NF alvo exista no estado final e confirme todos os metadados do lock.

Desde o Bloco 7, o ID físico canônico do lock é derivado da UG emitente e da NS:

`sagNsLock_<UG>_<numeroNS>`.

Locks históricos `sagNsLock_<numeroNS>` continuam reconhecidos somente em compatibilidade controlada, sem permitir novas reservas legadas. Assim, não é possível criar lock órfão, inventar UG para histórico ou usar um ID que não corresponda à identidade da NS.

## Compatibilidade com atualizações comuns

Atualizações que não alteram NS ou identidade continuam permitidas quando o lock existente permanece coerente.

Exemplo:

`localizacaoAtual: APROVISIONAMENTO → COMISSAO`

não exige recriar o lock.

## Orçamento de access calls

As Firestore Rules possuem limite oficial de chamadas `get()`, `exists()` e `getAfter()` por operação atômica.

Como o Bloco 5 passa a validar documentos cruzados, o serviço central agora aplica tetos conservadores:

- até **6 mutações de NS** por transação central;
- até **8 NFs com NS** numa exclusão em lote;
- até **5 NFs com NS** numa migração de CNPJ.

NFs sem NS continuam sujeitas apenas aos limites gerais já existentes.

Esses tetos evitam que um lote válido do ponto de vista de negócio falhe posteriormente com `permission-denied` por exceder o orçamento interno das Rules.

## Emulator

A suíte de segurança agora demonstra que:

- gravação direta de NS sem lock é negada;
- criação de NF já com NS sem lock é negada;
- formato inválido de NS é negado;
- lock órfão é negado;
- transação coerente NF + lock continua permitida;
- alteração comum da NF continua permitida;
- troca direta de NS é negada;
- remoção direta da NS é negada;
- exclusão direta da NF com lock ativo é negada.

## Resultado

Depois deste bloco, a integridade NS não depende apenas de o frontend chamar a função correta.

Mesmo um cliente modificado autenticado no workspace precisa produzir um estado final coerente entre NF e lock para que o Firestore aceite a escrita.

## Fora do escopo

Permanecem fora deste bloco:

- validação matemática dos dígitos verificadores do CNPJ é implementada pelo Bloco 6 no domínio TypeScript; as Rules mantêm a validação estrutural e relacional;
- a migração da identidade física do lock para incluir UG foi concluída no Bloco 7, com compatibilidade controlada para históricos sem UG;
- trilha histórica imutável de mutações;
- teste Emulator usando diretamente o serviço de persistência de produção em vez do helper conceitual.
