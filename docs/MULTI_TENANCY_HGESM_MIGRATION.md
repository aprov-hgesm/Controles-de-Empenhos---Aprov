# EMPROVEX — Migração segura do HGeSM para workspace (Bloco 9)

## Objetivo

O Bloco 9 materializa uma cópia fiel dos dados operacionais legados do HGeSM sob o workspace fundador `hgesm-aprov`, sem remover as coleções antigas e sem alterar o runtime para consumir os novos paths.

A produção continua em `legacyDataMode=true` durante todo este bloco.

## Origem e destino

```text
/empenhos/{id}       -> /workspaces/hgesm-aprov/empenhos/{id}
/alerts/{id}         -> /workspaces/hgesm-aprov/alerts/{id}
/invoices/{id}       -> /workspaces/hgesm-aprov/invoices/{id}
/comissoes/{id}      -> /workspaces/hgesm-aprov/comissoes/{id}
/cronogramas/{id}    -> /workspaces/hgesm-aprov/cronogramas/{id}
/settings/termoRecebimentoCounter
                       -> /workspaces/hgesm-aprov/settings/termoRecebimentoCounter
```

`/settings/global` não é migrado porque permanece uma configuração global da plataforma.

## Proteções obrigatórias

A ferramenta `scripts/migrate-hgesm-workspace.mjs`:

- nunca apaga documentos das coleções legadas;
- não altera `legacyDataMode`;
- exige que `scripts/firestore-recovery.mjs verify` esteja `READY` antes de qualquer escrita;
- valida o workspace `hgesm-aprov` e a conta `aprov1hgesm@gmail.com` antes da operação;
- exige confirmação literal do projeto, banco e workspace;
- copia os campos Firestore preservando seus tipos;
- pode ser executada novamente para sincronizar documentos faltantes/desatualizados no destino sombra;
- interrompe a operação se detectar documentos extras no destino que não existam na origem;
- compara IDs, contagens e campos para validar integridade.

## Comandos somente leitura

```bash
npm run migration:hgesm:plan
npm run migration:hgesm:status
npm run migration:hgesm:verify
```

`verify` retorna código de saída diferente de zero enquanto houver qualquer divergência.

## Cópia

A cópia não possui atalho npm intencionalmente. Deve ser executada com confirmação completa:

```bash
node scripts/migrate-hgesm-workspace.mjs copy \
  --project=gen-lang-client-0982077967 \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 \
  --workspace=hgesm-aprov \
  --confirm=COPY:gen-lang-client-0982077967:ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1:hgesm-aprov
```

Antes de escrever, o próprio comando executa a verificação de recuperação e se recusa a continuar se PITR, proteção contra exclusão, backup agendado e pelo menos um backup `READY` não estiverem confirmados.

## Concorrência

Como o sistema continua lendo/escrevendo as coleções legadas durante o Bloco 9, alterações feitas enquanto a cópia está em andamento podem gerar divergência entre origem e destino. Isso não afeta a produção.

Se a verificação final indicar divergência, execute novamente a cópia em um período de baixa atividade. O destino é sincronizado a partir da origem, que continua sendo a fonte de verdade.

Nenhuma troca para os paths do workspace deve ocorrer até o Bloco 10 confirmar a integridade.

## Rollback

O Bloco 9 não exige rollback do runtime porque nenhuma leitura ou escrita de produção é redirecionada. Se a cópia precisar ser descartada, basta manter `legacyDataMode=true` e revisar o destino sombra antes de qualquer etapa posterior.

A remoção de dados do destino não faz parte deste script e deve exigir procedimento separado e explícito.
