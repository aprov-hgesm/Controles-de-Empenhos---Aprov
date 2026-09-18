# EMPROVEX — Bloco 20 — Testes automatizados de segurança multi-tenant

## Objetivo

Validar as Firestore Rules e os limites de identidade do EMPROVEX com testes executáveis, sem usar dados reais ou alterar produção.

A suíte usa Firebase Authentication Emulator + Cloud Firestore Emulator e carrega o arquivo oficial `firestore.rules` do repositório.

## Ambiente isolado

Projeto de teste:

```text
demo-emprovex-security
```

Configuração:

```text
firebase.security-test.json
Auth Emulator:      127.0.0.1:9099
Firestore Emulator: 127.0.0.1:8080
```

Os workspaces, usuários, documentos e tokens criados durante os testes existem somente no Emulator Suite e são descartados ao fim da execução.

## Cenários obrigatórios

A suíte valida dinamicamente:

- Setor A lê/escreve no próprio workspace;
- Setor B lê/escreve no próprio workspace;
- Setor A não lê nem escreve no Setor B;
- Setor B não lê o Setor A;
- e-mail correto com UID incorreto não acessa dados operacionais;
- conta ainda sem UID pode ler apenas metadados necessários ao bootstrap;
- conta ainda sem UID não acessa coleções operacionais;
- setor suspenso não acessa dados operacionais;
- vínculo adulterado entre conta e workspace é bloqueado;
- administrador fundador acessa HGeSM;
- administrador não possui bypass operacional em tenant externo;
- `documentStorage` é isolado por workspace;
- `documentStorage` rejeita `workspaceId` adulterado;
- `documentStorage` rejeita persistência de `accessToken`;
- `documentStorage` não pode ser excluído pelo setor;
- suspensão unilateral de workspace é rejeitada;
- suspensão workspace + conta em batch é aceita;
- setor perde acesso após suspensão;
- reativação atômica restaura o acesso;
- administrador não pode trocar `firebaseUid`;
- workspace fundador não pode ser alterado pelo lifecycle administrativo.

## Google Drive

A suíte não chama a API real do Google Drive, evitando efeitos externos.

O limite documental é validado em duas camadas:

1. dinamicamente, pelas Rules de `settings/documentStorage`;
2. pelo guard estático, que exige que o cliente Drive continue validando e-mail, UID e `emprovexWorkspaceId`.

Os gates já existentes de Drive continuam sendo executados no CI.

## Execução

Guard da suíte:

```bash
npm run verify:multitenant-security
```

Teste real com emuladores:

```bash
npm run test:security:multitenant
```

Resultados esperados:

```text
MULTI-TENANT SECURITY SUITE: READY
MULTI-TENANT SECURITY: READY
```

## CI

O workflow `.github/workflows/application-ci.yml` prepara Java 21 para o Firestore Emulator e executa os dois comandos acima antes do build de produção.

Qualquer cenário obrigatório removido, Rule enfraquecida ou teste de negação que passe indevidamente bloqueia o pipeline.

## Produção

O Bloco 20 é exclusivamente de teste e documentação. Ele não adiciona coleção, índice ou dado ao Firestore de produção e não exige publicação de novas Firestore Rules.
