# Vercel Blob privado — Notas de Empenho

## Objetivo

Armazenar os PDFs das Notas de Empenho fora do Firestore, com leitura restrita ao
usuário Google autorizado. O Firestore recebe somente metadados e o caminho privado
do arquivo.

## Proteções implementadas

- recurso desligado por padrão por `NEXT_PUBLIC_ENABLE_EMPENHO_DOCUMENTS=false`;
- autenticação server-side do Firebase ID Token (assinatura, emissor, audiência e expiração);
- allowlist server-side em `EMPENHO_DOCUMENT_AUTHORIZED_EMAILS`;
- Blob criado obrigatoriamente com acesso `private`;
- upload direto ao Blob, sem expor `BLOB_READ_WRITE_TOKEN` ao navegador;
- limite de 10 MB e tipo `application/pdf` no token temporário de upload;
- segunda validação no servidor pela assinatura binária `%PDF-` antes de gravar metadados;
- caminhos aleatórios e restritos ao prefixo `empenhos/{NUMERO_DO_EMPENHO}/`;
- leitura sempre autenticada, transmitida pelo servidor e com `Cache-Control: private, no-store`;
- nenhuma URL pública é persistida no Firestore;
- até 25 versões recentes permanecem referenciadas no documento do empenho;
- substituição não apaga automaticamente a versão anterior.

## Ativação segura

1. Na Vercel, abra o projeto de produção do EMPROVEX.
2. Em **Storage**, crie um Blob Store e selecione **Private**. O modo de acesso não
   pode ser alterado depois da criação.
3. Conecte o store ao projeto para os ambientes **Preview** e **Production**. A Vercel
   injeta `BLOB_READ_WRITE_TOKEN`; nunca copie esse valor para o GitHub.
4. Configure `EMPENHO_DOCUMENT_AUTHORIZED_EMAILS=aprov1hgesm@gmail.com` em Preview e
   Production.
5. Configure `NEXT_PUBLIC_ENABLE_EMPENHO_DOCUMENTS=true` somente em Preview e gere
   uma nova implantação.
6. Valide em Preview: anexar PDF, visualizar, imprimir, baixar, substituir e confirmar
   que uma conta não autorizada recebe HTTP 403.
7. Somente após a validação, replique a feature flag `true` em Production e promova a
   implantação aprovada.

## Reversão sem impacto

Defina `NEXT_PUBLIC_ENABLE_EMPENHO_DOCUMENTS=false` e faça nova implantação. Os botões
desaparecem e os fluxos atuais de empenhos, itens e notas fiscais continuam funcionando.
Os PDFs já armazenados não são apagados.

## Estrutura dos dados

No documento existente em `empenhos/{id}` são acrescentados somente os campos opcionais:

- `notaEmpenhoPdf`: metadados da versão ativa;
- `notaEmpenhoPdfVersions`: metadados das últimas 25 versões.

Os PDFs não são armazenados no Firestore, no repositório GitHub ou em `localStorage`.

## Limites operacionais

- tamanho máximo por arquivo: 10 MB;
- formato aceito: PDF;
- uma versão ativa por empenho;
- versões anteriores são preservadas no Blob;
- no plano Hobby, ao atingir a franquia do Blob a Vercel pode bloquear temporariamente
  novos acessos. O consumo deve ser acompanhado no painel da Vercel.
