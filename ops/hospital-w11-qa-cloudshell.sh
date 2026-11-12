#!/usr/bin/env bash
# Run in Google Cloud Shell by an authorized operator, NOT in GitHub CI.
# NEVER creates service-account keys; only targets cozinha-dietetica.
set -Eeuo pipefail

PROJECT='cozinha-dietetica'
REGION='southamerica-east1'
SERVICE='cozinha-dietetica-qa'
SA='hospital-qa-runtime@cozinha-dietetica.iam.gserviceaccount.com'
COMMAND="${1:-plan}"

fail() { echo "NO-GO: $*" >&2; exit 1; }
command -v gcloud >/dev/null || fail 'gcloud unavailable'
CURRENT="$(gcloud config get-value project 2>/dev/null)"
[[ "$CURRENT" == "$PROJECT" ]] || fail "Select $PROJECT first with: gcloud config set project $PROJECT"
gcloud projects describe "$PROJECT" --format='value(projectId)' | grep -Fxq "$PROJECT" || fail 'Project inaccessible'
gcloud firestore databases describe --database='(default)' --project="$PROJECT" >/dev/null || fail 'Firestore (default) not accessible'

billing() {
  local active
  active="$(gcloud billing projects describe "$PROJECT" --format='value(billingEnabled)' 2>/dev/null)" || fail 'Check billing in Google Cloud console'
  [[ "${active,,}" == 'true' ]] || fail 'Cloud Run needs billing enabled (Firebase Blaze) in THIS project only'
}
check_private() {
  if gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
    local config ingress account policy
    config="$(gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" --format=json)" || fail 'Cannot inspect Cloud Run'
    ingress="$(printf '%s' "$config" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("metadata",{}).get("annotations",{}).get("run.googleapis.com/ingress", d.get("ingress","")))')"
    account="$(printf '%s' "$config" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("spec",{}).get("template",{}).get("spec",{}).get("serviceAccountName", d.get("template",{}).get("serviceAccount","")))')"
    [[ "$ingress" == internal && "$account" == "$SA" ]] || fail 'Service is not private or has wrong service account'
    policy="$(gcloud run services get-iam-policy "$SERVICE" --region="$REGION" --project="$PROJECT" --format=json)" || fail 'Cannot inspect IAM'
    ! grep -Eq '"allUsers"|"allAuthenticatedUsers"' <<< "$policy" || fail 'Public invoker detected'
    echo 'Private Cloud Run IAM and service identity verified.'
  else echo 'Private Cloud Run not yet deployed.'; fi
}
case "$COMMAND" in
  plan)
    echo "PROJECT=$PROJECT DATABASE=(default) REGION=$REGION SERVICE=$SERVICE SA=$SA"
    gcloud iam service-accounts list --project="$PROJECT" --filter="email=$SA" --format='value(email)'
    gcloud billing projects describe "$PROJECT" --format='value(billingEnabled)' 2>/dev/null || true
    check_private
    echo 'PLAN ONLY: no cloud resources modified.'
    ;;
  setup-iam)
    billing
    existing="$(gcloud iam service-accounts list --project="$PROJECT" --filter="email=$SA" --format='value(email)')"
    if [[ -z "$existing" ]]; then
      gcloud iam service-accounts create hospital-qa-runtime --project="$PROJECT" --display-name='Hospital QA runtime'
    else [[ "$existing" == "$SA" ]] || fail 'Unexpected service account'; fi
    gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role=roles/datastore.user --condition=None --quiet >/dev/null
    gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role=roles/firebaseauth.viewer --condition=None --quiet >/dev/null
    gcloud services enable run.googleapis.com --project="$PROJECT" --quiet
    echo 'Hospital IAM created. No Cloud Run deployed; no Firestore documents written.'
    ;;
  deploy-private)
    billing
    image="${2:-}"
    [[ "$image" =~ ^southamerica-east1-docker\.pkg\.dev/cozinha-dietetica/hospital-qa/[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$ ]] || fail 'Pass reviewed hospital-only Artifact Registry image by SHA256 digest'
    gcloud iam service-accounts describe "$SA" --project="$PROJECT" >/dev/null || fail 'Run setup-iam first'
    check_private
    gcloud run deploy "$SERVICE" --project="$PROJECT" --region="$REGION" \
      --image="$image" --service-account="$SA" --platform=managed \
      --ingress=internal --no-allow-unauthenticated --min-instances=0 \
      --max-instances=1 --concurrency=10 --cpu=1 --memory=512Mi \
      --set-env-vars="HOSPITAL_GCP_QA_ENABLED=1,HOSPITAL_GCP_QA_PRIVATE=1,HOSPITAL_FIRESTORE_QA_ENABLED=1,HOSPITAL_FIRESTORE_PROJECT_ID=$PROJECT,HOSPITAL_FIRESTORE_SERVICE_ACCOUNT_EMAIL=$SA,GOOGLE_CLOUD_PROJECT=$PROJECT" \
      --quiet
    check_private
    echo 'Private QA service ready; authenticated internal smoke tests are still required.'
    ;;
  *) fail 'Usage: script plan | setup-iam | deploy-private SHA256_IMAGE_DIGEST' ;;
esac
