# EMPROVEX — HGeSM como workspace fundador (Bloco 3)

## Objetivo

O Bloco 3 registra formalmente o HGeSM como o primeiro workspace operacional da futura arquitetura multi-setor, sem alterar o funcionamento atual do sistema.

## Identidade definida

```text
workspaceId: hgesm-aprov
nome: Aprovisionamento HGeSM
conta operacional: aprov1hgesm@gmail.com
status: active
legacyWorkspace: true
```

A conta `aprov1hgesm@gmail.com` continua representando o setor operacional do HGeSM. O marcador `legacyWorkspace` existe apenas para apoiar a futura migração conservadora das coleções globais para paths por workspace.

## Perfil institucional preservado

O workspace fundador registra os valores institucionais já utilizados pelo EMPROVEX:

- Hospital Geral de Santa Maria;
- HGeSM;
- Seção de Aprovisionamento;
- cabeçalho `MINISTÉRIO DA DEFESA / EXÉRCITO BRASILEIRO / HOSPITAL GERAL DE SANTA MARIA`;
- local padrão `Almoxarifado Geral / Seção de Aprovisionamento - HGeSM`;
- função padrão `Fiscal de Contrato / Seção de Aprovisionamento - HGeSM`.

Esses valores permitirão, nos blocos posteriores, substituir textos hardcoded por configuração de workspace sem modificar os documentos do HGeSM.

## Compatibilidade preservada

O Bloco 3 é deliberadamente declarativo. Ele NÃO:

1. move documentos Firestore;
2. cria novas coleções em produção;
3. altera `firestore.rules`;
4. altera o login Google atual;
5. altera `useOperationalData` ou suas subscriptions;
6. altera o contador global de TR;
7. altera caminhos atuais do Vercel Blob;
8. autoriza novas contas operacionais;
9. muda GitHub, Vercel ou projeto Firebase.

## Contratos criados

O arquivo `lib/hgesmWorkspace.ts` exporta:

- `HGESM_WORKSPACE_ID`;
- `HGESM_SECTOR_EMAIL`;
- `HGESM_INSTITUTIONAL_PROFILE`;
- `createHgesmFoundingWorkspace()`;
- `createHgesmSectorAccount()`.

Nenhum desses contratos é consumido pelo runtime operacional no Bloco 3.

## Próximo passo

O Bloco 4 introduzirá a camada de resolução de contexto da plataforma (`platformAdmin` versus `sector` e `workspaceId`) antes do carregamento de dados operacionais. Essa camada deve ser implementada de forma compatível com o HGeSM atual e sem liberar o administrador para as coleções globais existentes.
