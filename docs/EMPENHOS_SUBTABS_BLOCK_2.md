# EMPROVEX — Bloco 2: Subabas de Empenhos

## Objetivo

Eliminar os modais extensos usados para **Cadastrar Empenho** e **Configurar Classes** e transformar essas funções em superfícies persistentes dentro da própria aba Empenhos.

A mudança responde a um problema real de layout: os fluxos longos possuíam altura limitada pela viewport, rolagem interna e sobreposição sobre a tela principal. Em telas menores ou com zoom do navegador, isso comprimía o conteúdo e prejudicava a leitura.

## Nova arquitetura de navegação

A aba **Empenhos** passa a possuir três subabas:

1. **Visão geral** — filtros, cards, saldos e acesso ao detalhe;
2. **Cadastrar Empenho** — cadastro manual, importação JSON e revisão;
3. **Configurar Classes** — edição das classes, regra de TR e inclusão de novas classes.

A navegação usa semântica de tabs:

- `role="tablist"`;
- `role="tab"`;
- `aria-selected`;
- `aria-controls`;
- painéis com `role="tabpanel"` e `aria-labelledby`.

## Cadastro de Empenho

O fluxo existente foi preservado:

- cadastro manual;
- validações atuais;
- seleção de classe;
- cadastro por JSON;
- download/cópia do prompt;
- processamento do JSON;
- revisão dos dados importados;
- edição dos itens;
- confirmação final;
- persistência existente;
- abertura automática do detalhe após cadastro bem-sucedido.

O estado legado `showNewEmpenhoModal` continua temporariamente no orquestrador porque os handlers de domínio usam esse sinal para fechar o fluxo após uma gravação confirmada. Na interface ele **não representa mais um modal**: apenas acompanha a abertura/fechamento da subaba de cadastro.

## Configuração das Classes

A configuração deixou de usar overlay de tela inteira.

Agora:

- cada classe aparece em card persistente;
- em telas largas os cards podem ocupar duas colunas;
- descrição e regra de TR continuam editáveis;
- inclusão de nova classe permanece no mesmo painel;
- nenhuma regra de persistência de classes foi alterada.

## Regra de UX

Superfícies de trabalho extensas não devem usar modal de tela inteira quando exigem:

- múltiplos campos;
- revisão de grande volume de dados;
- tabelas;
- rolagem longa;
- edição contínua.

Modais continuam adequados para ações breves e focadas, como confirmação de exclusão ou confirmação final de gravação.

Por isso o pequeno modal **Confirmar Cadastro** foi preservado: ele não contém o fluxo de trabalho, apenas a decisão final.

## Responsividade

O bloco remove:

- `max-height` dependente da viewport nos dois fluxos principais;
- rolagem vertical interna dos antigos modais;
- backdrop dos fluxos principais;
- duas camadas simultâneas de scroll.

A tabela de revisão JSON passa a utilizar `overflow-x-auto` para não deformar os campos no mobile.

As subabas são horizontalmente roláveis em telas estreitas e permanecem com alvos de toque adequados.

## Segurança e persistência

Este bloco não altera:

- Firebase Auth;
- Firestore Rules;
- isolamento multi-tenant;
- formato dos empenhos;
- validação de CNPJ;
- integridade de NS;
- persistência de classes;
- persistência de empenhos;
- lógica de exclusão;
- documentos no Google Drive.

## Critérios de aceite

O bloco está concluído quando:

1. existem as três subabas;
2. Configurar Classes não usa overlay;
3. Cadastrar Empenho não usa overlay;
4. cadastro manual e JSON continuam funcionais;
5. o detalhe do empenho continua independente da subnavegação;
6. confirmação curta pode continuar modal;
7. TypeScript e build passam;
8. existe guard permanente no CI.
