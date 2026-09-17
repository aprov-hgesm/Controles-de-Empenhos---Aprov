# EMPROVEX — Interface administrativa separada

## Status atual

A interface administrativa permanece na rota:

```text
/admin
```

Desde o Bloco 6.1, a conta institucional fundadora `aprov1hgesm@gmail.com` possui dois modos de interface na mesma sessão Firebase:

- **Aprovisionamento HGeSM** — perfil operacional padrão;
- **Administração EMPROVEX** — perfil administrativo.

A troca para Administração ocorre pelo seletor de perfil no cabeçalho. O retorno ao HGeSM ocorre pelo comando `Voltar ao HGeSM`, sem novo login.

## Isolamento operacional

Quando o perfil administrativo está ativo:

- `workspaceContext.status = platformAdmin`;
- `canLoadOperationalData = false`;
- o painel administrativo não abre subscriptions das coleções operacionais;
- empenhos, notas fiscais, comissões, cronogramas e alertas não são carregados pelo ambiente administrativo.

Ao voltar para o perfil operacional:

- `workspaceContext.status = sector`;
- `workspaceId = hgesm-aprov`;
- `legacyDataMode = true` enquanto a migração das coleções globais ainda não tiver ocorrido.

## Conteúdo do painel

O painel administrativo apresenta:

- identificação da conta institucional fundadora;
- quantidade de setores reconhecidos;
- estado de isolamento operacional;
- listagem dos workspaces cadastrados;
- cadastro de novos setores quando as Firestore Rules administrativas estiverem publicadas.

## Compatibilidade

A alternância de perfil não move dados, não altera PDFs existentes e não muda o contador de TR. Ela apenas altera o contexto de interface usado pela mesma sessão autenticada.
