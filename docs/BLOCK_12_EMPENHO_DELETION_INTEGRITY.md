# EMPROVEX — Bloco 12 — Integridade da exclusão de empenho

## Objetivo

Eliminar o risco de estado parcial ao excluir um empenho que possua Notas Fiscais,
NS, locks, alertas estruturadamente vinculados ou cronogramas.

Antes deste bloco, o frontend removia o empenho primeiro e depois tentava remover
as NFs em chamadas independentes. Uma NF com NS podia ser recusada pelas Rules
porque o lock continuava ativo, deixando o Firestore em estado inconsistente.

## Contrato

A exclusão de empenho passa a usar exclusivamente:

```text
commitEmpenhoDeletionLifecycle()
```

O frontend não remove estado local antes da confirmação do lifecycle.

## Lock técnico

Antes da descoberta autoritativa dos vínculos, o serviço cria:

```text
workspaces/{workspaceId}/settings/empenhoDelete_{empenhoId}
```

com:

- workspaceId;
- empenhoId;
- correlationId;
- createdAt;
- createdBy;
- type = empenho-deletion-lock.

Enquanto esse lock existe:

- o empenho não pode ser atualizado;
- uma nova NF não pode ser criada para o empenho;
- alertas estruturados com `empenhoId` não podem ser criados/alterados;
- cronogramas do empenho não podem ser criados/alterados;
- o empenho não pode ser apagado diretamente mantendo o lock.

Isso fecha a janela entre “consultar vínculos” e “apagar”.

## Transação final

Depois do lock, o serviço redescobre os vínculos e abre uma única transação que:

1. relê o empenho;
2. relê o lock técnico;
3. relê todas as NFs descobertas;
4. relê alertas estruturados e cronogramas;
5. descobre e relê os locks de NS;
6. valida ownership de cada lock NS;
7. apaga NFs;
8. apaga locks NS existentes;
9. apaga alertas estruturados;
10. apaga cronogramas;
11. apaga o empenho;
12. apaga o lock técnico;
13. grava o evento imutável `empenho.delete`.

Se qualquer leitura ou validação divergir, a transação inteira falha.

## Falha e retry

Se a transação não concluir, o serviço tenta liberar o lock técnico antes de
propagar o erro. Como a transação final é atômica, não existe caminho normal em
que metade dos documentos seja removida.

O operador pode tentar a exclusão novamente após atualizar a tela.

## Limites conservadores

O Bloco 12 mantém limites explícitos:

- até 120 NFs vinculadas;
- até 350 documentos vinculados descobertos;
- até 8 locks de NS na mesma exclusão;
- até 450 writes na transação final.

Empenhos que excedam esses limites são bloqueados antes da exclusão destrutiva e
devem ser tratados por um fluxo futuro de exclusão resumível, não por aumento
cego de limites.

## Alertas legados

Alertas antigos que não possuem `empenhoId` não são apagados por heurística.
A partir deste bloco, novos alertas de cadastro de empenho persistem
`empenhoId`, permitindo limpeza segura e determinística.

## Arquivos Google Drive

A exclusão do empenho continua sem apagar automaticamente arquivos no Google
Drive. O Bloco 12 preserva o comportamento existente para evitar perda documental
não solicitada.

## Firestore Rules

As Rules passam a exigir lifecycle protegido para delete de empenho e bloqueiam
novos vínculos críticos enquanto o lock técnico estiver ativo.

O Emulator prova:

- criação válida do lock técnico;
- bloqueio de update do empenho durante exclusão;
- bloqueio de nova NF;
- bloqueio de novo alerta estruturado;
- bloqueio de novo cronograma;
- bloqueio de delete isolado do empenho;
- delete conjunto de empenho + NF + NS lock + vínculos + lock técnico;
- criação do evento `empenho.delete`.

## Critério de aceite

O Bloco 12 está concluído quando:

1. o hook não chama `removeInvoice` ou `removeAlert` durante exclusão de empenho;
2. estado local só é removido depois do lifecycle;
3. `removeEmpenho` delega ao serviço central;
4. Rules impedem delete isolado;
5. Rules fecham a corrida de criação de NF;
6. Emulator comprova o lifecycle;
7. auditoria `empenho.delete` é append-only;
8. TypeScript, build e E2E existentes permanecem verdes.
