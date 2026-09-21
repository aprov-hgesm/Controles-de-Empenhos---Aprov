# EMPROVEX — NS Integrity Block 7 — identidade organizacional por UG

## Objetivo

O Bloco 7 evolui a identidade operacional de Nota de Sistema de `workspaceId + numeroNS` para a identidade canônica:

```text
workspaceId + UG emitente + numeroNS
```

A UG também passa a integrar a identidade organizacional do setor que utiliza o EMPROVEX. Cada workspace operacional representa um setor de Aprovisionamento de uma Organização Militar e possui uma UG vinculada. Para novos usuários/setores, essa UG é obrigatória no cadastro e é persistida de forma coerente no `Workspace` e no `SectorAccount`.

A UG é normalizada em seis dígitos e o número da NS permanece no formato `AAAANSNNNNNN`.

## Identidade do usuário e da unidade

Para um setor externo, a resolução segura de identidade passa a considerar:

```text
e-mail + Firebase UID + workspaceId + UG
```

O workspace e a conta operacional devem apontar para a mesma UG. Divergência de UG bloqueia o acesso operacional em modo fail-closed.

A UG já vinculada é imutável no fluxo administrativo comum. Cadastros legados em que workspace e conta ainda não possuem UG podem receber esse identificador uma única vez pelo administrador.

O provisionamento mantém um índice reservado por UG:

```text
platformUgIndex/<UG>
```

Isso impede que dois setores distintos sejam cadastrados com a mesma UG. O provisionamento também usa lock por UG para proteger concorrência durante criação simultânea.

### Workspace fundador

O Hospital Geral de Santa Maria possui:

```text
UG 160416
```

Essa UG integra o contexto fundador do HGeSM. Como o workspace fundador já existia antes deste bloco, as Rules possuem uma compatibilidade explícita e restrita para `hgesm-aprov + 160416` caso os documentos históricos do diretório ainda não tenham o campo `ug` materializado. Essa exceção não se aplica a novos setores.

## Persistência de NS

NFs com NS canônica persistem `nsUg`. O lock físico usa:

```text
sagNsLock_<UG>_<NS>
```

Exemplo:

```text
sagNsLock_160416_2026NS000001
```

O documento de lock também registra `ug`.

A UG usada na gravação não é escolhida pelo operador: ela é derivada do contexto autenticado do workspace. O serviço transacional central rejeita qualquer tentativa de gravar uma NS com UG diferente da UG vinculada àquele usuário/setor.

## Compatibilidade legada

Locks antigos no formato `sagNsLock_<NS>` continuam reconhecíveis para validação, migração e remoção segura. Uma nova reserva de NS exige que o usuário possua uma UG organizacional válida.

A política operacional foi refinada para os fluxos de saneamento controlado: quando uma NF histórica com NS sem `nsUg` é alcançada por uma migração segura de CNPJ, a UG ausente é preenchida automaticamente com a UG do workspace autenticado. No HGeSM, o valor aplicado é `160416`.

Esse backfill não é uma escolha livre do operador. A origem é sempre a identidade institucional da sessão. Quando a NS histórica estiver em formato abreviado, o número completo precisa ser confirmado pelo usuário antes da conversão; somente a UG é inferida automaticamente.

## SAG

O SAG já possui `ug` em seu contrato de importação. A UG do workspace é a referência autoritativa.

- se o SAG omitir a UG, o EMPROVEX utiliza a UG do usuário/setor;
- se o SAG informar a mesma UG, o fluxo segue normalmente;
- se o SAG informar uma UG diferente, a importação é bloqueada;
- o operador não digita nem escolhe uma UG no assistente SAG.

## Edição manual

Na edição manual, o operador informa apenas o número da NS. A interface mostra a UG da unidade como informação de identidade, mas não oferece campo editável.

Ao gravar, o serviço obtém a UG diretamente do contexto operacional autenticado. Se a UG ainda não estiver configurada para um cadastro legado, a nova NS é bloqueada até que o administrador complete o vínculo da unidade.

## Invariantes

- cada novo setor/workspace possui exatamente uma UG organizacional válida;
- workspace e conta operacional devem possuir a mesma UG;
- uma UG cadastrada não pode pertencer a dois setores da plataforma;
- a UG vinculada não pode ser alterada casualmente depois do cadastro;
- uma NS nova só pode usar a UG do workspace autenticado;
- a mesma combinação UG + NS não pode pertencer a duas NFs no mesmo workspace;
- remover NS remove também `nsUg`;
- registros históricos sem UG podem receber backfill automático somente em fluxo controlado, usando a UG do workspace autenticado;
- números de NS abreviados não recebem ano inventado silenciosamente: a forma completa exige confirmação humana;
- CNPJ, NF, empenho, UG, NS e lock permanecem coerentes nas mutações controladas.

## Experiência do operador

A UG passa a funcionar como dado de identidade, não como campo operacional repetitivo.

O operador normalmente:

1. entra com sua conta;
2. o EMPROVEX resolve workspace e UG;
3. informa ou importa a NS;
4. o sistema aplica automaticamente a UG da unidade.

Assim, um usuário do HGeSM trabalha automaticamente no contexto da UG `160416`, enquanto um usuário de outra OM trabalha no contexto da UG cadastrada para aquela organização.

## Migração progressiva

O bloco não executa migração cega em massa dos históricos. Cadastros legados de setor sem UG continuam exigindo backfill administrativo explícito da identidade da unidade.

Para NFs históricas, o saneamento pode ocorrer progressivamente quando um fluxo transacional seguro precisar tocar o registro. Na migração de CNPJ, uma NS sem `nsUg` recebe a UG do workspace autenticado e o lock legado é substituído pelo lock canônico na mesma transação. Isso evita deixar dados parcialmente migrados.

## Critério de aceite

O bloco está pronto para integração quando cadastro, autenticação, lifecycle, SAG, NS manual, Firestore Rules, Emulator, guards permanentes, TypeScript e build de produção permanecerem verdes.
