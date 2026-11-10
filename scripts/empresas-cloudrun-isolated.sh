#!/usr/bin/env bash
# Provision ONLY the separate EMPROVEX Empresas Cloud Run workload.
# Default is plan-only. Never modifies institutional Cloud Run, IAM or Firestore.
set -Eeuo pipefail

MODE="${1:---plan}"
if [[ "$MODE" != "--plan" && "$MODE" != "--apply" ]]; then
  echo "Use --plan or --apply" >&2; exit 2
fi
: "${HOST_PROJECT_ID:?Define HOST_PROJECT_ID (existing billed GCP project; Cloud Run HOST ONLY)}"
COMPANY_PROJECT_ID=emprovex-empresas
SERVICE=emprovex-empresas
SA_ID=emprovex-empresas-runtime
SA="${SA_ID}@${HOST_PROJECT_ID}.iam.gserviceaccount.com"
REGION=southamerica-east1
SECRET=emprovex-company-profile-hmac
: "${COMPANY_IMAGE:?Define COMPANY_IMAGE as an immutable container image @sha256 digest for the current tested company branch}"
if [[ "$COMPANY_IMAGE" != *@sha256:* || "$HOST_PROJECT_ID" == *[!a-z0-9-]* ]]; then
  echo "HOST_PROJECT_ID invalid or COMPANY_IMAGE must use @sha256 immutable digest." >&2; exit 2
fi
if [[ "$HOST_PROJECT_ID" == "$COMPANY_PROJECT_ID" ]]; then
  echo "HOST_PROJECT_ID must be separate from Spark Firebase project unless billing migration is explicitly designed." >&2
  exit 2
fi

echo "EMPRESAS PLAN: host=$HOST_PROJECT_ID, Firebase=$COMPANY_PROJECT_ID, region=$REGION, service=$SERVICE, identity=$SA"
echo "No service, binding, account, revision, secret or military resource changes in --plan mode."
echo "Planned IAM: datastore.user on $COMPANY_PROJECT_ID ONLY; secretAccessor on one $SECRET in HOST only."
echo "Planned deployment: separate Cloud Run $SERVICE, private invocation, pilot OFF, dedicated service account."
if [[ "$MODE" == "--plan" ]]; then exit 0; fi

command -v gcloud >/dev/null || { echo "gcloud CLI required" >&2; exit 2; }
command -v openssl >/dev/null || { echo "openssl required" >&2; exit 2; }
# Refuse to take control of an already-existing service in any circumstance.
if gcloud run services describe "$SERVICE" --region="$REGION" --project="$HOST_PROJECT_ID" >/dev/null 2>&1; then
  echo "STOP: company Cloud Run service already exists. Manual reconciliation needed; not overwriting." >&2
  exit 3
fi
gcloud projects describe "$HOST_PROJECT_ID" >/dev/null
gcloud projects describe "$COMPANY_PROJECT_ID" >/dev/null
# Show region and edition before accessing the separate, existing database.
gcloud firestore databases describe --database='(default)' --project="$COMPANY_PROJECT_ID" \
  --format='table(name,locationId,type)' >&2

if ! gcloud iam service-accounts describe "$SA" --project="$HOST_PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_ID" --project="$HOST_PROJECT_ID" \
    --display-name="EMPROVEX Empresas Cloud Run - Firestore separado"
fi
# Role granted exclusively in the distinct Firebase project, never in the main project.
gcloud projects add-iam-policy-binding "$COMPANY_PROJECT_ID" \
  --member="serviceAccount:$SA" --role="roles/datastore.user" --condition=None --quiet >/dev/null

# One isolated secret is provisioned with a random value, never logged or checked into Git.
if ! gcloud secrets describe "$SECRET" --project="$HOST_PROJECT_ID" >/dev/null 2>&1; then
  openssl rand -hex 32 | gcloud secrets create "$SECRET" \
    --project="$HOST_PROJECT_ID" --replication-policy=automatic --data-file=- >/dev/null
fi
gcloud secrets add-iam-policy-binding "$SECRET" --project="$HOST_PROJECT_ID" \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor" --quiet >/dev/null

# The shared main deployment is never referenced or updated.
# The business service is PRIVATE until separate E2E, origin, IAM and quota checks pass.
gcloud run deploy "$SERVICE" --project="$HOST_PROJECT_ID" --region="$REGION" \
  --image="$COMPANY_IMAGE" --service-account="$SA" \
  --ingress=all --no-allow-unauthenticated --min-instances=0 --max-instances=1 \
  --memory=1Gi --cpu=1 --concurrency=20 \
  --set-env-vars="EMPROVEX_COMPANY_ISOLATED_RUNTIME=1,EMPROVEX_COMPANY_RUNTIME_PROJECT_ID=$COMPANY_PROJECT_ID,EMPROVEX_COMPANY_SERVICE_ACCOUNT_EMAIL=$SA,EMPROVEX_COMPANY_PILOT_ENABLED=0,EMPROVEX_DISABLE_COMPANY_PROVISIONING=1,EMPROVEX_DISABLE_ADMIN_MUTATIONS=1" \
  --set-secrets="EMPROVEX_COMPANY_PROFILE_HMAC_SECRET=$SECRET:latest" --quiet
echo "Private company revision deployed. Pilot still OFF. Run security verification before enabling users."
