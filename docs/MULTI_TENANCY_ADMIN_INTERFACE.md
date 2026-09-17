# EMPROVEX — Interface administrativa separada (Bloco 5)

## Objetivo

O Bloco 5 cria uma experiência de administração da plataforma separada do ambiente operacional dos setores.

## Rota administrativa

A administração passa a utilizar a rota:

```text
/admin
```

Somente uma identidade resolvida como `platformAdmin` pode permanecer nessa rota. Qualquer conta de setor, conta não autorizada ou sessão anônima é redirecionada para a raiz da aplicação.

## Administrador bootstrap

A conta bootstrap definida nos blocos anteriores permanece:

```text
codex.martis.dev@gmail.com
```

Quando essa conta autentica a partir da raiz, o contexto é resolvido como `platformAdmin` e o navegador é direcionado para `/admin`.

## Isolamento operacional

O painel administrativo não importa nem consulta:

- empenhos;
- notas fiscais;
- comissões;
- cronogramas;
- alertas;
- PDFs operacionais dos setores.

O `useOperationalData` também continua impedindo subscriptions operacionais quando o contexto não é `sector`.

## Conteúdo atual do painel

O painel administrativo apresenta neste bloco:

- identificação da conta administradora;
- quantidade atual de setores reconhecidos;
- estado de isolamento operacional;
- indicação de preparação para acompanhamento de armazenamento;
- listagem do workspace fundador `hgesm-aprov`;
- indicação de que os dados legados do HGeSM permanecem preservados.

## Cadastro de novos setores

O botão `Cadastrar novo setor` aparece visualmente, mas permanece desabilitado no Bloco 5.

A persistência de novos setores e contas autorizadas será implementada no Bloco 6, depois da preparação administrativa necessária para não depender de edição manual de código.

## Compatibilidade do HGeSM

O Bloco 5 não altera:

- paths das coleções do HGeSM;
- regras atuais do Firestore;
- documentos armazenados no Vercel Blob;
- contador de TR;
- fluxos operacionais do workspace fundador.

## Segurança adicional

Sessões persistidas de contas que não sejam reconhecidas como `platformAdmin` ou `sector` autorizado são encerradas automaticamente na raiz, evitando acesso visual indevido ao ambiente operacional.
