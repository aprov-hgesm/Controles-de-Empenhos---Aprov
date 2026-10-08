# WAREHOUSE-MOBILE-WRITE-EVIDENCE-01

## Identidade

- Repositório: `aprov-hgesm/Controles-de-Empenhos---Aprov`
- Branch: `warehouse-mobile-write-evidence-01`
- HEAD inicial validado por comparação GitHub: `3369d614a425728104eea6170188672de9d6875b` (0 ahead / 0 behind)
- Base de Production auditada na forensics anterior: `main@97556bb8eb04af070016f9e58ddc2d9cca36bb35`
- Comparação desta branch com a base auditada antes deste documento: 1 commit ahead, 0 behind, contendo apenas os três arquivos forensics
- Rules hash principal informado na auditoria anterior: `bc91185f34bcdcb4437a4de1078d1089a09292ba`
- Rules hash warehouse informado na auditoria anterior: `6e1f1050005314db4e17cb3136409abbddb0ee91`
- Memorial canônico mais recente referido pelo Coordenador: `feat/saas-r1-commercializacao@2abe6784585ed6b0b5bed00772f0fe9631435343`
- O Memorial presente na branch de evidência é histórico: não foi sobrescrito.

## Estado herdado

`WAREHOUSE-MOBILE-WRITE-FORENSICS-01` = **PARCIAL — CAUSA NÃO ISOLADA**.

F05: `WAREHOUSE_FAST_PATH_UNAVAILABLE`, erro subjacente server-side não preservado.
F06: transferência sem escrita real confirmada; input técnico não preservado.
F09: `FIRESTORE_PERMISSION_DENIED`; replay idempotente falhou e não houve baixa quantitativa, segundo leitura física independente anteriormente documentada.

Material âncora apenas F09: `mat_272f2d996ee65ed3530ad2d7e27b66d7`, workspace `hgesm-aprov`; aggregate histórico 445 L, physical 440 L, legado UNASSIGNED 5 L. Não atribuir esses dados a F06.

## Leitura Production executada nesta frente

- HTTP requests Firestore REST: **0**
- Document reads Firestore: **0**
- Collections enumeradas ao vivo: **0**
- Document paths lidos ao vivo: **nenhum**
- Cobertura completa: **NÃO**
- COLLECTION_CAPPED: **unknown / não executado**

Motivo: não há `WAREHOUSE_AUDIT_ACCESS_TOKEN` autorizado disponível neste ambiente. A conexão GitHub permite leitura de código, não acesso automático ao Firestore. Não foram pedidos, copiados, impressos ou armazenados tokens.

O coletor herdado está no caminho `scripts/warehouse-mobile-write-forensics-readonly.mjs`. Na revisão textual dos arquivos via GitHub, o script usa `fetch` com método GET e cabeçalho Bearer a partir de variável de ambiente; coleta material e balance exatos, e lista locationBalances, lots e barcodes. Ele usa cap 200 por coleção e expõe a presença de `nextPageToken` via `capped`. **O script não foi executado nesta frente**, e não há alegação de execução de testes Node.

### Procedimento local PowerShell de leitura, SEM revelar token

Executar somente em PowerShell local já autenticado no projeto Google correto, após conferir pessoalmente o conteúdo do script e o branch:

```powershell
git fetch origin
git switch warehouse-mobile-write-evidence-01
git status --short
git rev-parse HEAD

$Gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
if (-not (Test-Path $Gcloud)) { throw "gcloud nao encontrado no caminho esperado" }
try {
  $env:WAREHOUSE_AUDIT_ACCESS_TOKEN = (& $Gcloud auth print-access-token).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($env:WAREHOUSE_AUDIT_ACCESS_TOKEN)) {
    throw "falha ao obter access token"
  }
  node scripts/warehouse-mobile-write-forensics-readonly.mjs --material=mat_272f2d996ee65ed3530ad2d7e27b66d7
} finally {
  Remove-Item Env:WAREHOUSE_AUDIT_ACCESS_TOKEN -ErrorAction SilentlyContinue
}
```

**Cuidado:** o JSON emitido pelo coletor pode incluir dados operacionais. Revise-o localmente antes de compartilhá-lo; sanitize PII e nunca inclua tokens. O comando não imprime o access token. O coletor atual pode ser incompleto por paginação: `capped=true` impede qualquer conclusão de cobertura total. Este comando não coleta identidade F06 nem logs F05.

## Raw documents F09

**NÃO COLETADOS**. Não é possível afirmar `BARCODE_SHAPE_MISMATCH=true/false` ou `LOT_SHAPE_MISMATCH=true/false` sem documentos RAW reais.

## Raw vs canonical F09

**NÃO EXECUTADO COM DADOS REAIS.** A auditoria anterior demonstrou somente mecanismos sintéticos:
- `presentation.raw={code:"l"}` vs `presentation.canonical={code:"l",label:null}`
- `position.raw` sem `subpositionId` vs projection com `subpositionId:null`.

Estes são exemplos candidatos, não documentos reais F09.

## Emulator F09

**NÃO EXECUTADO.** Falta fixture RAW 1:1 e input completo da tentativa OUTBOUND. Não foi fabricada fixture física.

## Primeira condição DENY F09

**NÃO IDENTIFICADA.** Inspecionar conjuntamente source barcode, lote, balance aggregate, locationBalance, revision, lastMovementId, posição, quantidade, UG e workspace antes de isolar a primeira Rule falsa.

## Identidade F06

`F06_INPUT_IDENTITY_RECOVERED=false`. Não foram obtidos material, quantidade, origem, destino, lote ou erro técnico completo. Material de F09 não foi usado como substituto.

## Raw documents F06

**NÃO COLETADOS.**

## Emulator F06

**NÃO EXECUTADO**, por falta de identidade de input.

## Diagnóstico Runtime F05

Consulta de acesso ao conector Vercel:
- list_teams: apenas time `codexmartisdevs-projects` acessível à conexão presente.
- list_projects pesquisando `emprovex`: resultado vazio.
- `VERCEL_RUNTIME_LOG_ACCESS=false` para o projeto EMPROVEX Production neste contexto; nenhum log de Production foi consultado.
- `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON_STATUS=UNKNOWN`: valor e presença não consultados.
- Classificação: `UNKNOWN`; causa: **não provada**.

Não inferir secret ausente a partir da ausência de visibilidade do projeto nesta conta.

## Causas provadas

Nenhuma causa individual dos blockers F05/F06/F09 provada nesta execução.

## Causas ainda não provadas

- F05: condição server-side por trás de `WAREHOUSE_FAST_PATH_UNAVAILABLE`.
- F06: primeira condição Rule rejeitada e identidade da tentativa.
- F09: primeira condição Rule rejeitada, shape RAW vs runtime de barcode/lote, revisions e balances.

## Fix ownership recomendado

**Ainda indeterminado.** Só atribuir a runtime, Rules, environment ou repair/migração após comprovação causal 1:1 com raw, write previsto e Emulator (quando aplicável). Nenhuma alteração de segurança deve ser relaxada para contornar o DENY.

## Próximo passo

1. Coordenador executar **somente** coleta GET-only local autenticada e compartilhar saída sanitizada, incluindo contagens e status de paginação.
2. Recuperar evidência pré-existente de F06; se não houver, manter causa F06 não provada.
3. Obter acesso autorizado ao log F05 da Production Vercel, sem exibir secrets.
4. Em ambiente apropriado, construir fixture mínima baseada em RAW real e demonstrar DENY → alteração de um campo → ALLOW no Emulator; identificar a primeira condição falsa.
5. Só então recomendar owner de eventual fix.

## Gates

- GitHub comparação inicial de branch: **PASS**
- Inspeção textual estática do coletor e teste herdados: **realizada, sem execução**
- `node --check`: **NOT RUN**
- `node --test`: **NOT RUN**
- Rules Emulator: **NOT RUN**
- `git diff --check`: **NOT RUN**
- CI HEAD final: **não verificado neste checkpoint**

## Classificação final

**BLOCKER — ACESSO À EVIDÊNCIA IMPEDIDO** (causas continuam não isoladas).

```text
F05_CAUSE_PROVEN=false
F06_CAUSE_PROVEN=false
F09_CAUSE_PROVEN=false
F06_INPUT_IDENTITY_RECOVERED=false
BARCODE_SHAPE_MISMATCH=unknown
LOT_SHAPE_MISMATCH=unknown
repairRequired=false
rulesChangeRequired=false
runtimeChangeRequired=false
environmentChangeRequired=false
```

Os últimos quatro `false` significam “mudança não provada necessária”, jamais “mudança descartada”.

## O que NÃO foi executado

- nenhuma transferência real
- nenhuma saída real
- nenhuma alocação real
- nenhuma escrita Firestore
- nenhum repair
- nenhum Rules deploy
- nenhum app deploy
- nenhum main merge
- nenhuma repetição Production de F05/F06/F09
- nenhuma leitura de token, secret ou log de Production
- nenhuma simulação Emulator reivindicada sem dados reais

Retornar ao Coordenador. NÃO CORRIGIR. NÃO MERGEAR. NÃO PUBLICAR.
