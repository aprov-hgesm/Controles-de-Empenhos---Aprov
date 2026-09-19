# EMPROVEX — NS Integrity Block 7 — identidade por UG

## Objetivo

O Bloco 7 evolui a identidade operacional de Nota de Sistema de `workspaceId + numeroNS` para a identidade canônica congelada no contrato v1:

```text
workspaceId + UG emitente + numeroNS
```

A UG é normalizada em seis dígitos e o número da NS permanece no formato `AAAANSNNNNNN`.

## Persistência

NFs com NS canônica passam a persistir `nsUg`. O lock físico canônico usa:

```text
sagNsLock_<UG>_<NS>
```

Exemplo:

```text
sagNsLock_160416_2026NS000001
```

O documento de lock também registra `ug`, permitindo validar a identidade sem inferência externa.

## Compatibilidade legada

Locks antigos no formato `sagNsLock_<NS>` continuam reconhecíveis exclusivamente para leitura, validação de propriedade, migração e remoção segura. Uma nova reserva de NS exige UG válida. Um registro histórico com NS mas sem UG é tratado como legado e bloqueia reutilização ambígua do mesmo número até ser saneado.

Isso evita atribuir silenciosamente uma UG a dados históricos.

## SAG

O SAG já possui `ug` no contrato de importação. O Bloco 7 propaga essa UG pela reconciliação, prévia, plano de persistência e serviço transacional. A escrita persiste `numeroNS + nsUg` atomicamente.

## Edição manual

A edição manual passa a trabalhar com o par UG + NS. A UG deve conter exatamente seis dígitos para uma nova identidade controlada.

## Invariantes

- o mesmo número de NS pode existir em UGs diferentes;
- a mesma combinação UG + NS não pode pertencer a duas NFs no mesmo workspace;
- NS nova sem UG falha fechada;
- remover NS remove também `nsUg`;
- trocar UG ou NS é uma troca de identidade e migra o lock atomicamente;
- registros legados sem UG não são reinterpretados automaticamente;
- CNPJ, NF, empenho, UG, NS e lock permanecem coerentes durante migrações.

## Migração progressiva

O bloco não executa uma migração cega dos históricos. Registros que já possuem informação confiável de UG podem ser convertidos para o lock canônico quando passam por uma operação controlada. Históricos sem UG permanecem explicitamente legados e devem ser diagnosticados/saneados em fluxo próprio.

## Critério de aceite

O bloco está pronto para integração quando testes de domínio, SAG, regras globais, guards existentes, TypeScript e build de produção permanecerem verdes, e a CI possuir um guard permanente específico para a identidade UG + NS.
