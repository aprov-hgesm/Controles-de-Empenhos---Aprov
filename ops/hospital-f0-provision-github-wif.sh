#!/usr/bin/env bash
# Executar uma vez no Google Cloud Shell. Escopo: Firebase Hosting do projeto hospitalar.
# Nao cria chave JSON e nao modifica Firestore, contas, Cloud Run ou EMPROVEX.
set -Eeuo pipefail
PROJECT=cozinha-dietetica
NUMBER_EXPECTED=947369899527
REPO=aprov-hgesm/Controles-de-Empenhos---Aprov
REPO_ID=1286320615
OWNER_ID=298800054
BRANCH=feat/cozinha-dietetica-f0-firebase-hosting-20261115
POOL=hospital-github
PROVIDER=hosting-promotion
SA_ID=hospital-hosting-deployer
SA="$SA_ID@$PROJECT.iam.gserviceaccount.com"
WORKFLOW="$REPO/.github/workflows/hospital-f0-hosting-promote.yml@"
fail(){ printf '\nERRO: %s\n' "$*" >&2; exit 1; }
command -v gcloud >/dev/null || fail "gcloud ausente"
command -v python3 >/dev/null || fail "python3 ausente"
NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
[[ "$NUMBER" = "$NUMBER_EXPECTED" ]] || fail "Numero do projeto inesperado; nenhuma alteracao executada."
printf '1/5 — APIs necessarias à identidade temporaria...\n'
gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project="$PROJECT" --quiet
printf '2/5 — Conta exclusiva do publicador hospitalar...\n'
if ! gcloud iam service-accounts describe "$SA" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_ID" --project="$PROJECT" \
    --display-name="Cozinha Dietetica - publicacao Hosting" \
    --description="GitHub OIDC: apenas frontend do sistema hospitalar"
fi
printf '3/5 — GitHub OIDC restrito por IDs, workflow e branch...\n'
if ! gcloud iam workload-identity-pools describe "$POOL" --project="$PROJECT" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL" --project="$PROJECT" --location=global \
    --display-name="GitHub exclusivo da Cozinha Dietetica"
fi
CONDITION="assertion.repository_id=='$REPO_ID' && assertion.repository_owner_id=='$OWNER_ID' && (assertion.ref=='refs/heads/$BRANCH' || assertion.ref=='refs/heads/main') && assertion.event_name=='push' && assertion.workflow_ref=='$WORKFLOW'+assertion.ref"
MAPPING="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref"
CHECK="$(mktemp)"
trap 'rm -f "$CHECK"' EXIT
if gcloud iam workload-identity-pools providers describe "$PROVIDER" \
  --project="$PROJECT" --location=global --workload-identity-pool="$POOL" --format=json >"$CHECK" 2>/dev/null; then
  export CONDITION MAPPING CHECK
  python3 - <<'PY'
import os,json
with open(os.environ["CHECK"],encoding="utf-8") as f: p=json.load(f)
required=dict(part.split("=",1) for part in os.environ["MAPPING"].split(","))
if p.get("disabled") or p.get("attributeCondition")!=os.environ["CONDITION"]:
    raise SystemExit("Provider existente divergente/desabilitado; nenhuma permissao sera ampliada automaticamente.")
if any(p.get("attributeMapping",{}).get(k)!=v for k,v in required.items()):
    raise SystemExit("Mapeamento do provider divergente; verificacao manual necessaria.")
print("PASS: provider ja existente tem as restricoes corretas.")
PY
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --project="$PROJECT" --location=global --workload-identity-pool="$POOL" \
    --issuer-uri=https://token.actions.githubusercontent.com \
    --attribute-mapping="$MAPPING" --attribute-condition="$CONDITION" \
    --display-name="Promocao autorizada do Hosting hospitalar"
fi
printf '4/5 — Autorizacao temporaria apenas para o repo e roles de Hosting...\n'
POOL_NAME="projects/$NUMBER/locations/global/workloadIdentityPools/$POOL"
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project="$PROJECT" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/$POOL_NAME/attribute.repository_id/$REPO_ID" --quiet >/dev/null
for ROLE in roles/firebasehosting.admin roles/serviceusage.apiKeysViewer roles/run.viewer; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:$SA" --role="$ROLE" --quiet >/dev/null
  printf '  PASS: %s\n' "$ROLE"
done
printf '5/5 — Verificacao final (somente leitura)...\n'
gcloud iam workload-identity-pools providers describe "$PROVIDER" \
  --project="$PROJECT" --location=global --workload-identity-pool="$POOL" \
  --format='value(name)'
gcloud iam service-accounts get-iam-policy "$SA" --project="$PROJECT" \
  --format='table(bindings.role,bindings.members)'
printf '\nSUCESSO: identidade de publicacao configurada.\n'
printf 'Conta: %s\n' "$SA"
printf 'Provider: %s/providers/%s\n' "$POOL_NAME" "$PROVIDER"
printf 'Sem chaves privadas, sem alteração da API e sem publicação automática agora.\n'
