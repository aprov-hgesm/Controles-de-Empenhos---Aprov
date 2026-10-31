#!/usr/bin/env bash
# EMPROVEX R7 — one-time Google Cloud Shell IAM bootstrap, no private keys.
# Run only after reviewing docs/EMPROVEX_CICD_CLOUD_RUN_GITHUB.md.
# Does NOT publish a revision, change traffic, DNS, Hosting, secrets, Firestore or billing.
set -euo pipefail

PROJECT="gen-lang-client-0982077967"
NUMBER="943599311487"
REGION="southamerica-east1"
SERVICE="emprovex-cloudrun-candidate"
RUNTIME="emprovex-run-runtime@${PROJECT}.iam.gserviceaccount.com"
DEPLOYER_ID="emprovex-github-deployer"
DEPLOYER="${DEPLOYER_ID}@${PROJECT}.iam.gserviceaccount.com"
POOL="emprovex-github"
PROVIDER="emprovex-main"
REPOSITORY_ID="1286320615"
OWNER_ID="298800054"
REPO="aprov-hgesm/Controles-de-Empenhos---Aprov"
STAGE_REF="${REPO}/.github/workflows/emprovex-cloud-run-stage.yml@refs/heads/main"
PROMOTE_REF="${REPO}/.github/workflows/emprovex-cloud-run-promote.yml@refs/heads/main"
MAPPING="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref,attribute.workflow_ref=assertion.workflow_ref"
CONDITION="assertion.repository_id=='${REPOSITORY_ID}' && assertion.repository_owner_id=='${OWNER_ID}' && assertion.ref=='refs/heads/main' && (assertion.workflow_ref=='${STAGE_REF}' || assertion.workflow_ref=='${PROMOTE_REF}')"
PRINCIPAL="principalSet://iam.googleapis.com/projects/${NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository_id/${REPOSITORY_ID}"

echo "Projeto: ${PROJECT} (numero ${NUMBER}); GitHub repository ID: ${REPOSITORY_ID}"
echo "Nenhuma chave JSON sera gerada e nenhum deploy sera executado."
[[ "$(gcloud projects describe "${PROJECT}" --format='value(projectNumber)')" == "${NUMBER}" ]] || { echo "Projeto incorreto."; exit 1; }
gcloud run services describe "${SERVICE}" --project="${PROJECT}" --region="${REGION}" --format=json > /tmp/emprovex-run-pre-iam.json
jq -e --arg sa "${RUNTIME}" '.spec.template.spec.serviceAccountName == $sa' /tmp/emprovex-run-pre-iam.json >/dev/null || {
  echo "Identidade Cloud Run alterada; IAM nao sera modificado."
  exit 1
}
read -r -p "Digite CONFIGURAR-WIF para autorizar criacao de identidade e permissoes: " confirmation
[[ "${confirmation}" == "CONFIGURAR-WIF" ]] || exit 1

gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  artifactregistry.googleapis.com run.googleapis.com --project="${PROJECT}"

if ! gcloud iam service-accounts describe "${DEPLOYER}" --project="${PROJECT}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${DEPLOYER_ID}" --project="${PROJECT}" \
    --display-name="EMPROVEX GitHub OIDC deploy (sem chave)"
fi

if ! gcloud artifacts repositories describe emprovex --project="${PROJECT}" --location="${REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create emprovex --project="${PROJECT}" \
    --repository-format=docker --location="${REGION}" \
    --description="EMPROVEX main immutable images"
fi
[[ "$(gcloud artifacts repositories describe emprovex --project="${PROJECT}" --location="${REGION}" --format='value(format)')" == "DOCKER" ]] || exit 1

if ! gcloud iam workload-identity-pools describe "${POOL}" --project="${PROJECT}" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "${POOL}" --project="${PROJECT}" \
    --location=global --display-name="EMPROVEX GitHub Actions"
fi

if ! gcloud iam workload-identity-pools providers describe "${PROVIDER}" \
  --project="${PROJECT}" --location=global --workload-identity-pool="${POOL}" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "${PROVIDER}" \
    --project="${PROJECT}" --location=global --workload-identity-pool="${POOL}" \
    --display-name="EMPROVEX only two main workflows" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="${MAPPING}" --attribute-condition="${CONDITION}"
fi

gcloud iam workload-identity-pools providers describe "${PROVIDER}" \
  --project="${PROJECT}" --location=global --workload-identity-pool="${POOL}" \
  --format=json > /tmp/emprovex-wif-provider.json
jq -e --arg condition "${CONDITION}" \
  '.attributeCondition == $condition and .state == "ACTIVE" and
   .oidc.issuerUri == "https://token.actions.githubusercontent.com" and
   .attributeMapping["attribute.repository_id"] == "assertion.repository_id" and
   .attributeMapping["attribute.workflow_ref"] == "assertion.workflow_ref"' \
  /tmp/emprovex-wif-provider.json >/dev/null || {
    echo "Provider existente diverge da politica estrita; nao conceder acessos."
    exit 1
  }

gcloud iam service-accounts add-iam-policy-binding "${DEPLOYER}" \
  --project="${PROJECT}" --role=roles/iam.workloadIdentityUser --member="${PRINCIPAL}"

gcloud artifacts repositories add-iam-policy-binding emprovex \
  --project="${PROJECT}" --location="${REGION}" \
  --member="serviceAccount:${DEPLOYER}" --role=roles/artifactregistry.writer

gcloud run services add-iam-policy-binding "${SERVICE}" \
  --project="${PROJECT}" --region="${REGION}" \
  --member="serviceAccount:${DEPLOYER}" --role=roles/run.developer

gcloud iam service-accounts add-iam-policy-binding "${RUNTIME}" \
  --project="${PROJECT}" --member="serviceAccount:${DEPLOYER}" \
  --role=roles/iam.serviceAccountUser

echo "WIF pronto: projects/${NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
echo "Identidade do deploy: ${DEPLOYER}. Identidade de runtime PRESERVADA: ${RUNTIME}."
echo "Nenhuma chave criada; nenhuma revisao Cloud Run criada; trafego inalterado."
echo "Proximo passo: configurar reviewers obrigatorios em Settings > Environments > emprovex-production no GitHub."
