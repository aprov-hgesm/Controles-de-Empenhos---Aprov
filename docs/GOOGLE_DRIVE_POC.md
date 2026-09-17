# EMPROVEX — POC Google Drive por setor

## Status

**CONCLUÍDA E HOMOLOGADA.**

Esta POC validou a arquitetura que posteriormente se tornou o armazenamento documental oficial do EMPROVEX.

## Objetivo validado

A prova de conceito confirmou que cada workspace pode operar com sua própria Conta Google e com acesso restrito ao escopo:

```text
https://www.googleapis.com/auth/drive.file
```

A sessão OAuth do Drive permanece somente em memória e precisa ser restabelecida após recarregar a aplicação.

## Resultados validados

Foram testados com sucesso:

- reautenticação explícita da mesma Conta Google do workspace;
- criação e reutilização de pasta controlada pelo aplicativo;
- upload de PDF;
- listagem de arquivos;
- visualização;
- impressão;
- download;
- exclusão;
- descarte do token após reload;
- reconexão sem perda da sessão principal do EMPROVEX.

## Segurança

A implementação não usa:

- escopo amplo `https://www.googleapis.com/auth/drive`;
- `drive.readonly`;
- refresh token persistente;
- localStorage para token;
- sessionStorage para token;
- Firestore para token;
- cookies próprios para token do Drive.

## Evolução para produção

Após a homologação da POC, a arquitetura foi promovida para o fluxo oficial por workspace.

O estado atual de produção está documentado em:

```text
docs/DOCUMENT_STORAGE_PROVIDER.md
```

A aplicação utiliza Google Drive como provider documental oficial para Notas de Empenho e Notas Fiscais, com metadata de workspace e verificação SHA-256.

## Gate histórico ainda disponível

A POC continua protegida por um gate estático enquanto a rota experimental permanecer no repositório:

```bash
npm run verify:drive-poc
```

Resultado esperado:

```text
DRIVE POC SAFETY: READY
```

A rota `/drive-poc` é experimental e não deve ser usada com documentos operacionais reais.
