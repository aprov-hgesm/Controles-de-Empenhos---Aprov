# Central de Avisos — contrato funcional

## Nome e propósito

A superfície operacional chama-se **Central de Avisos**. O nome substitui “Alertas” na interface porque a coleção reúne dois tipos de comunicação:

- eventos **informativos**, que registram fatos concluídos;
- ocorrências de **atenção/críticas**, que exigem acompanhamento do operador.

O identificador técnico da coleção continua `alerts` para preservar compatibilidade e evitar migração destrutiva.

## Acesso

A Central é acessada pela **Sidebar** através do item “Central de Avisos”.

O planeta da Home permanece exclusivamente informativo. Ele não possui clique nem navegação e mostra somente a quantidade de avisos pendentes relevantes.

## Categorias

- **Informativo** — confirmação de operações concluídas, como cadastro de empenho ou recebimento de NF;
- **Atenção** — situação que precisa ser acompanhada;
- **Crítico** — situação prioritária, incluindo Estoque Zerado.

Registros históricos que eram gravados como ATENÇÃO apesar de representarem sucesso são reconhecidos como informativos por compatibilidade.

## Ciclo de vida

Cada aviso pode assumir:

- `NOVO`;
- `LIDO`;
- `RESOLVIDO`;
- `ARQUIVADO`.

Avisos legados sem campo `status` são interpretados como `NOVO` sem migração em massa.

## Gestão

A tela oferece:

- busca por texto, empenho, fornecedor ou CNPJ;
- filtros por categoria e situação;
- marcar aviso como lido;
- marcar todos os novos como lidos;
- resolver ocorrências acionáveis;
- arquivar;
- reabrir;
- abrir o empenho vinculado.

Não há exclusão destrutiva pela interface da Central; o histórico é preservado por arquivamento.

## Home e contador

O `homeSnapshot` não usa mais `alerts.length` como sinônimo de “ativos”.

O planeta e o contador consideram somente ocorrências:

- não informativas;
- não resolvidas;
- não arquivadas.

Assim, confirmações antigas e histórico resolvido deixam de inflar o indicador da Home.

## Realtime e custo

A Central usa o perfil:

```
Central de Avisos
→ empenhos: realtime
→ alerts: realtime
→ invoices: off
→ comissoes: off
→ cronogramas: off
```

São duas coleções operacionais em tempo real. A Central também pode publicar o `homeSnapshot` porque já possui Empenhos + Avisos carregados, sem abrir coleções adicionais.

## Segurança

A coleção continua em:

`workspaces/{workspaceId}/alerts/{id}`

As Rules existentes mantêm:

- isolamento por workspace;
- autenticação setorial;
- proteção contra gravação vinculada a empenho em processo de exclusão.

Nenhuma permissão adicional foi aberta para implementar a Central.
