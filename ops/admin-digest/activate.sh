#!/usr/bin/env bash
set -euo pipefail
project=gen-lang-client-0982077967
region=southamerica-east1
service=emprovex-cloudrun-candidate
runtime_sa=emprovex-run-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com
client_id=943599311487-mv0lmhgrb2s5ah1uln5ula5u5i9hafc0.apps.googleusercontent.com
sender=marcoa.r.aquino@gmail.com
recipient=codex.martis.dev@gmail.com
audience=https://emprovex.com.br/api/cron/admin-digest
image_base=southamerica-east1-docker.pkg.dev/gen-lang-client-0982077967/emprovex/emprovex
daily_job=emprovex-admin-digest-r1
test_job=emprovex-admin-digest-r2-test-once
request=ops/admin-digest/activation-request.json
before="$GITHUB_EVENT_BEFORE"
[[ "$GITHUB_REPOSITORY_ID" == 1286320615 && "$GITHUB_ACTOR" == Moriark ]] || exit 1
[[ "$(git rev-parse HEAD^)" == "$before" ]] || exit 1
[[ "$(git diff --name-only HEAD^ HEAD)" == "$request" ]] || exit 1
jq -e '.schemaVersion==1 and .authorizationMode=="explicit_chat_request" and .authorizedBy=="Moriark" and .sendTestNow==true and .activateDaily18h==true and .from=="marcoa.r.aquino@gmail.com" and .to=="codex.martis.dev@gmail.com" and (.sourceSha|test("^[0-9a-f]{40}$"))' "$request" >/dev/null
source_sha="$(jq -r .sourceSha "$request")"
git merge-base --is-ancestor "$source_sha" HEAD
[[ "$(git ls-remote origin refs/heads/main | cut -f1)" == "$(git rev-parse HEAD)" ]] || exit 1
short_sha="$(echo "$source_sha" | cut -c1-12)"
echo "Starting authorized digest activation for source $short_sha"
gcloud run services describe "$service" --region="$region" --project="$project" --format=json > "$RUNNER_TEMP/before.json"
jq -e --arg sa "$runtime_sa" '.spec.template.spec.serviceAccountName==$sa' "$RUNNER_TEMP/before.json" >/dev/null
old="$(jq -r '[.status.traffic[]? | select(.percent==100) | .revisionName] | if length==1 then .[0] else empty end' "$RUNNER_TEMP/before.json")"
[[ -n "$old" ]] || { echo "::error::Require exactly one active revision at 100%"; exit 1; }
# Preserve existing IAM. Cloud Run verifies the runtime account can access both secrets during deploy.
# If IAM is insufficient, stop before traffic changes rather than broadening permissions here.
digest="$(gcloud artifacts docker images describe "$image_base:$source_sha" --project="$project" --format='value(image_summary.digest)')"
[[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || exit 1
suffix="d$short_sha-$GITHUB_RUN_NUMBER"
gcloud run deploy "$service" --project="$project" --region="$region" --image="$image_base@$digest" \
  --service-account="$runtime_sa" --revision-suffix="$suffix" --no-traffic --tag="digest-$short_sha" \
  --update-env-vars="EMPROVEX_ADMIN_DIGEST_ENABLED=1,EMPROVEX_ADMIN_DIGEST_GMAIL_CLIENT_ID=$client_id,EMPROVEX_ADMIN_DIGEST_GMAIL_FROM=$sender,EMPROVEX_ADMIN_DIGEST_TO=$recipient,EMPROVEX_ADMIN_DIGEST_SCHEDULER_EMAIL=$runtime_sa,EMPROVEX_ADMIN_DIGEST_OIDC_AUDIENCE=$audience" \
  --update-secrets="EMPROVEX_ADMIN_DIGEST_GMAIL_CLIENT_SECRET=emprovex-admin-digest-gmail-client-secret:1,EMPROVEX_ADMIN_DIGEST_GMAIL_REFRESH_TOKEN=emprovex-admin-digest-gmail-refresh-token:1" --quiet
gcloud run services describe "$service" --project="$project" --region="$region" --format=json > "$RUNNER_TEMP/staged.json"
revision="$(jq -r .status.latestCreatedRevisionName "$RUNNER_TEMP/staged.json")"
[[ "$revision" == "$service-$suffix" ]] || exit 1
jq -e --arg rev "$revision" '[.status.traffic[]? | select(.revisionName==$rev and (.percent//0)>0)]|length==0' "$RUNNER_TEMP/staged.json" >/dev/null
jq -e --arg old "$old" '[.status.traffic[]?|select(.revisionName==$old and .percent==100)]|length==1' "$RUNNER_TEMP/staged.json" >/dev/null
preview="$(jq -r --arg tag "digest-$short_sha" '.status.traffic[]?|select(.tag==$tag)|.url//empty' "$RUNNER_TEMP/staged.json" | head -1)"
[[ "$preview" == https://* ]] || exit 1
curl --fail --silent --show-error --max-time 20 "$preview/api/health" >/dev/null
status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST "$preview/api/cron/admin-digest")"
[[ "$status" == 401 ]] || { echo "::error::Expected 401 without OIDC, got HTTP $status"; exit 1; }
# Temporary authenticated test job: manual trigger only; no recurring test.
if gcloud scheduler jobs describe "$test_job" --project="$project" --location="$region" >/dev/null 2>&1; then
  echo "::error::Existing test job; stop to avoid duplicates."; exit 1
fi
gcloud scheduler jobs create http "$test_job" --project="$project" --location="$region" \
  --schedule="0 0 1 1 *" --time-zone="America/Sao_Paulo" --http-method=POST \
  --uri="$preview/api/cron/admin-digest?mode=test" \
  --oidc-service-account-email="$runtime_sa" --oidc-token-audience="$audience" \
  --max-retry-attempts=0 --attempt-deadline=180s --quiet
cleanup_test() {
  gcloud scheduler jobs delete "$test_job" --project="$project" --location="$region" --quiet >/dev/null 2>&1 || true
}
trap cleanup_test EXIT
gcloud scheduler jobs run "$test_job" --project="$project" --location="$region" --quiet
success=0
for attempt in $(seq 1 24); do
  sleep 5
  gcloud scheduler jobs describe "$test_job" --project="$project" --location="$region" --format=json > "$RUNNER_TEMP/test.json"
  last="$(jq -r '.lastAttemptTime//empty' "$RUNNER_TEMP/test.json")"
  code="$(jq -r '.status.code//empty' "$RUNNER_TEMP/test.json")"
  if [[ -n "$last" && ( -z "$code" || "$code" == 0 ) ]]; then
    success=1; break
  fi
  if [[ -n "$last" && "$code" != 14 && "$code" != 0 ]]; then
    echo "::error::Scheduler test delivery failed with code $code"; exit 1
  fi
done
[[ "$success" == 1 ]] || { echo "::error::Unable to verify HTTP test delivery"; exit 1; }
gcloud scheduler jobs delete "$test_job" --project="$project" --location="$region" --quiet
trap - EXIT
# Only promote after the test HTTP target reports success.
finished=0
rollback() {
  rc=$?
  trap - EXIT
  if [[ "$finished" != 1 ]]; then
    echo "::error::Activation incomplete; restoring previous production revision"
    gcloud run services update-traffic "$service" --project="$project" --region="$region" --to-revisions="$old=100" --quiet || true
  fi
  exit "$rc"
}
trap rollback EXIT
gcloud run services update-traffic "$service" --project="$project" --region="$region" --to-revisions="$revision=100" --quiet
curl --fail --silent --show-error --retry 3 --retry-delay 3 --max-time 20 https://emprovex.com.br/api/health >/dev/null
if gcloud scheduler jobs describe "$daily_job" --project="$project" --location="$region" --format=json > "$RUNNER_TEMP/daily.json" 2>/dev/null; then
  jq -e --arg sa "$runtime_sa" --arg uri "$audience" '.schedule=="0 18 * * *" and .timeZone=="America/Sao_Paulo" and .httpTarget.uri==$uri and .httpTarget.oidcToken.serviceAccountEmail==$sa and .httpTarget.oidcToken.audience==$uri' "$RUNNER_TEMP/daily.json" >/dev/null
else
  gcloud scheduler jobs create http "$daily_job" --project="$project" --location="$region" \
    --schedule="0 18 * * *" --time-zone="America/Sao_Paulo" --http-method=POST \
    --uri="$audience" --oidc-service-account-email="$runtime_sa" --oidc-token-audience="$audience" \
    --max-retry-attempts=1 --attempt-deadline=180s --quiet
fi
gcloud scheduler jobs describe "$daily_job" --project="$project" --location="$region" --format=json > "$RUNNER_TEMP/daily-verified.json"
jq -e --arg uri "$audience" '.schedule=="0 18 * * *" and .timeZone=="America/Sao_Paulo" and .httpTarget.uri==$uri and .state=="ENABLED"' "$RUNNER_TEMP/daily-verified.json" >/dev/null
finished=1
trap - EXIT
echo "## EMPROVEX — daily digest activated" >> "$GITHUB_STEP_SUMMARY"
echo "Authorized test delivery HTTP success, Gmail inbox receipt requires confirmation." >> "$GITHUB_STEP_SUMMARY"
echo "Active revision: $revision at 100% traffic" >> "$GITHUB_STEP_SUMMARY"
echo "Daily schedule: 18h America/Sao_Paulo" >> "$GITHUB_STEP_SUMMARY"
echo "From $sender to $recipient" >> "$GITHUB_STEP_SUMMARY"
