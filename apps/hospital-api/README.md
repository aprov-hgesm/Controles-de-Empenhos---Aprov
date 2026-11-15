# API hospitalar independente — Cloud Run

Esta API e parte do novo sistema de dietas hospitalares. Nao utiliza login ou Firestore do EMPROVEX financeiro.

## GOV-SIMP-01

- Suporta **dados clinicos reais** de hospitais, pacientes, leitos, dietas, mapas, producao e distribuicao, sem bloquear por prefixo qa_.
- O primeiro teste publicado usa apenas dados sinteticos, sem travar o sistema para uso pratico futuro.
- Firebase Auth e Firestore exclusivos do projeto cozinha-dietetica. O navegador nao tem acesso direto a escrita clinica.
- Cada operacao valida assinatura do token Firebase, conta ativa, hospital, unidade, perfil e documento.
- Preservar protecoes de alergia, jejum, referencia medica, integridade e auditoria, sem aprovacao nutricional rotineira.

## Compilacao no PowerShell

Na raiz da branch F0 execute:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\ops\hospital-f0-extract-api.ps1
    cd apps/hospital-api
    npm.cmd install
    npm.cmd run build

A extracao produz um servidor independente a partir do codigo hospitalar da PR #554 e nao altera os arquivos originais.

## Cloud Run dedicado

- Projeto: cozinha-dietetica
- Regiao: southamerica-east1
- Servico novo: cozinha-dietetica-api
- Conta runtime planejada: hospital-api-runtime@cozinha-dietetica.iam.gserviceaccount.com
- Receita Docker: apps/hospital-api/Dockerfile
- Receita Cloud Build: ops/hospital-f0-cloudbuild-api.yaml
- Variaveis server-side: apps/hospital-api/.env.example

A origem do Firebase Hosting aponta somente /api/hospital/** para cozinha-dietetica-api, nunca para o servico privado cozinha-dietetica-qa.

Se o novo servico receber trafego HTTPS publico do Hosting, cada chamada clinica continuara protegida por Firebase Bearer e escopo hospitalar no servidor. Antes do deploy verificar 401 sem token, 403 sem vinculo e negacao de leitura entre hospitais.

**Estado:** codigo e build em validacao automatizada; Cloud Run, Firestore real e Firebase Hosting live ainda nao implantados por esta PR. Nao importar pacientes reais durante o provisionamento.
