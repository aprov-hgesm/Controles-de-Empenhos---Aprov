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

## Proteção obrigatória antes do `copy`

A ferramenta `scripts/migrate-hgesm-workspace.mjs` aceita uma de duas proteções:

1. recuperação nativa do Firestore `READY` (PITR + proteção contra exclusão + backup programado + backup pronto); ou
2. fallback gratuito de snapshot local criado por `scripts/firestore-local-snapshot.mjs` e revalidado contra a origem ao vivo imediatamente antes da cópia.

Sem pelo menos uma dessas proteções, o `copy` é bloqueado.

## Fallback gratuito de snapshot

O snapshot fica fora do repositório, por padrão em:

```text
~/emprovex-snapshots/hgesm-<timestamp>/
  manifest.json
  snapshot.json
```

A pasta recebe permissão `0700` e os arquivos `0600`. O conteúdo não deve ser enviado ao GitHub, compartilhado publicamente ou incluído em commits.

O `snapshot.json` preserva os campos no formato tipado da API REST do Firestore. O `manifest.json` contém:

- projeto, banco e workspace esperados;
- data de criação;
- contagens por coleção;
- quantidade total de documentos;
- SHA-256 do arquivo `snapshot.json`;
- SHA-256 lógico do conjunto de dados.

O snapshot cobre as cinco coleções operacionais, `alerts` e o contador `settings/termoRecebimentoCounter` definidos na política de migração.

### Criar snapshot

```bash
npm run snapshot:hgesm:create -- \
  --project=gen-lang-client-0982077967 \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 \
  --workspace=hgesm-aprov
```

Ao terminar, o comando imprime o caminho exato do `manifest.json`. O snapshot só é declarado `READY` se:

- o arquivo gravado passar na verificação de SHA-256;
- as contagens coincidirem com o manifesto;
- o conjunto lógico de dados passar no SHA-256;
- uma segunda leitura da origem ao vivo continuar idêntica ao snapshot.

Se os dados mudarem durante a captura, o comando falha e um novo snapshot deve ser criado em período de baixa atividade.

### Verificar snapshot novamente

```bash
npm run snapshot:hgesm:verify -- \
  --snapshot="$HOME/emprovex-snapshots/hgesm-.../manifest.json" \
  --project=gen-lang-client-0982077967 \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 \
  --workspace=hgesm-aprov \
  --live=true
```

A opção `--live=true` é obrigatória antes de usar o snapshot como proteção de migração, porque prova que a origem ainda não mudou desde a captura.

## Cópia

A cópia não possui atalho npm intencionalmente. Quando o backup nativo não estiver `READY`, informe também o manifesto do snapshot:

```bash
node scripts/migrate-hgesm-workspace.mjs copy \
  --project=gen-lang-client-0982077967 \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 \
  --workspace=hgesm-aprov \
  --snapshot="$HOME/emprovex-snapshots/hgesm-.../manifest.json" \
  --confirm=COPY:gen-lang-client-0982077967:ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1:hgesm-aprov
```

Antes da primeira escrita, o próprio `copy` tenta `recovery:verify`. Se a recuperação nativa não estiver pronta, ele executa a validação local + ao vivo do snapshot. Se o snapshot estiver corrompido, desatualizado ou pertencer a outro alvo, a migração é bloqueada.

A cópia continua sendo idempotente e não destrutiva: fontes legadas não são apagadas; documentos iguais são ignorados; documentos faltantes/desatualizados no destino sombra são sincronizados; documentos extras no destino interrompem a operação e exigem revisão manual.

## Validação pós-cópia

```bash
npm run migration:hgesm:verify
```

`verify` retorna código diferente de zero enquanto IDs, contagens ou campos divergirem entre origem e destino.

Nenhuma troca para os paths do workspace deve ocorrer até o Bloco 10 confirmar a integridade.

## Rollback gratuito das coleções legadas

A migração do Bloco 9 não modifica os dados legados, portanto o rollback normalmente não é necessário neste bloco. Mesmo assim, o snapshot fornece um mecanismo explícito de recuperação para etapas posteriores.

Primeiro gere o plano:

```bash
npm run snapshot:hgesm:rollback-plan -- \
  --snapshot="$HOME/emprovex-snapshots/hgesm-.../manifest.json" \
  --project=gen-lang-client-0982077967 \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 \
  --workspace=hgesm-aprov
```

O plano mostra documentos faltantes, diferentes e extras e imprime a confirmação literal necessária para restaurar.

O rollback:

- restaura somente documentos faltantes ou alterados;
- usa `updateTime`/`exists=false` como precondição contra concorrência;
- nunca apaga automaticamente documentos extras criados depois do snapshot;
- é bloqueado se houver documentos extras, porque excluí-los silenciosamente poderia destruir dados legítimos;
- termina somente quando o SHA-256 lógico da origem coincide novamente com o snapshot.

A execução de rollback não possui atalho npm intencionalmente e exige a confirmação impressa por `rollback-plan`:

```bash
node scripts/firestore-local-snapshot.mjs rollback \
  --snapshot="$HOME/emprovex-snapshots/hgesm-.../manifest.json" \
  --project=gen-lang-client-0982077967 \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 \
  --workspace=hgesm-aprov \
  --confirm=RESTORE_LEGACY:...:<12-primeiros-caracteres-do-hash>
```

## Concorrência

Como o sistema continua lendo/escrevendo as coleções legadas durante o Bloco 9, alterações feitas durante a cópia podem gerar divergência entre origem e destino. Isso não afeta a produção porque `legacyDataMode=true` permanece ativo.

Se a verificação final indicar divergência, crie um snapshot atualizado e execute novamente a cópia em período de baixa atividade. A origem legada continua sendo a fonte de verdade até a troca controlada dos blocos seguintes.
