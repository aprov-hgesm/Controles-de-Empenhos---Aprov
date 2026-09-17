# EMPROVEX — POC Google Drive por setor

## Objetivo

Validar o Google Drive como armazenamento documental distribuído por workspace, sem alterar o provedor oficial dos documentos atuais.

Nesta POC:

- o Vercel Blob continua sendo o armazenamento oficial de NE/NF de produção;
- nenhum PDF existente é migrado;
- nenhum refresh token é armazenado;
- o token OAuth do Drive existe somente em memória enquanto a página `/drive-poc` estiver aberta;
- o escopo solicitado é somente `https://www.googleapis.com/auth/drive.file`;
- a POC usa apenas PDFs fictícios;
- a pasta criada no Drive chama-se `EMPROVEX-TESTE`.

## Fluxo experimental

1. Usuário entra normalmente no EMPROVEX usando Firebase Authentication.
2. Usuário acessa `/drive-poc`.
3. Clica em `Conectar Google Drive`.
4. O Firebase executa reautenticação Google com o escopo adicional `drive.file`.
5. O sistema exige a mesma Conta Google que já está autenticada no EMPROVEX.
6. O access token temporário fica somente no estado React da página.
7. A POC procura uma pasta `EMPROVEX-TESTE` criada pelo próprio aplicativo; se não existir, cria.
8. O usuário pode enviar PDF fictício, listar, visualizar, imprimir, baixar e excluir.
9. Ao recarregar a página ou clicar em desconectar, o token em memória é descartado.

## Pré-requisito Google Cloud

A Google Drive API precisa estar habilitada no mesmo projeto Google Cloud usado pelo login Google/Firebase do EMPROVEX.

Projeto atual do Firebase:

```text
gen-lang-client-0982077967
```

A POC não adiciona client secret ao frontend e não exige variável de ambiente nova.

## Segurança

O escopo `drive.file` foi escolhido para evitar acesso amplo ao Drive. O objetivo é permitir ao EMPROVEX trabalhar somente com arquivos criados/utilizados pelo próprio aplicativo.

A POC não usa:

- `https://www.googleapis.com/auth/drive`;
- `drive.readonly`;
- refresh token persistente;
- localStorage para token;
- sessionStorage para token;
- Firestore para token;
- cookies próprios para token do Drive.

## Validação estática

Execute:

```bash
npm run verify:drive-poc
```

Resultado esperado:

```text
DRIVE POC SAFETY: READY
```

## Validação de compilação

```bash
npm run typecheck
npm run build
```

## Teste funcional

Depois de publicar a POC em ambiente controlado:

1. entrar normalmente no EMPROVEX;
2. abrir `/drive-poc`;
3. conectar a mesma Conta Google;
4. confirmar a tela de consentimento para `drive.file`;
5. confirmar criação/localização de `EMPROVEX-TESTE`;
6. enviar um PDF fictício pequeno;
7. confirmar que o arquivo aparece no Google Drive da conta;
8. visualizar o PDF pelo EMPROVEX;
9. imprimir pelo EMPROVEX;
10. baixar pelo EMPROVEX;
11. excluir pela POC e confirmar que desaparece do Drive;
12. recarregar `/drive-poc` e confirmar que a conexão temporária foi perdida;
13. reconectar e confirmar que a pasta criada anteriormente é reutilizada.

## Critério de aprovação da POC

A POC será considerada tecnicamente aprovada quando:

- OAuth `drive.file` funcionar com a mesma conta do setor;
- a Drive API criar/reutilizar a pasta experimental;
- upload, listagem, visualização, impressão, download e exclusão funcionarem;
- reload exigir nova autorização do Drive, sem derrubar a sessão principal do EMPROVEX;
- nenhum token persistente for armazenado;
- Vercel Blob continuar intocado para documentos reais.

## Fora do escopo desta etapa

Ainda não implementar:

- armazenamento definitivo de NE/NF no Drive;
- metadados do Drive no Firestore operacional;
- políticas de retenção por empenho;
- exclusão de documentos reais;
- refresh tokens;
- cotas por workspace;
- migração Vercel Blob -> Drive;
- acesso administrativo a documentos de outro setor.

Esses itens só serão projetados depois da validação funcional da POC.
