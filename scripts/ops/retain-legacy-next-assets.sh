#!/usr/bin/env bash
# Preserve immutable _next/static resources used by clients with older HTML.
# Protected Cloud Run staging workflow; read-only extraction from older images.
set -euo pipefail
: "${PROJECT:?PROJECT required}" "${REGION:?REGION required}"
: "${SERVICE:?SERVICE required}" "${IMAGE_BASE:?IMAGE_BASE required}"
target_dir="legacy-next-static"
rm -rf -- "$target_dir"
mkdir -p -- "$target_dir"
revisions_json="${RUNNER_TEMP:-/tmp}/emprovex-previous-revisions.json"

gcloud run revisions list --service="$SERVICE" --project="$PROJECT" \
  --region="$REGION" --format=json > "$revisions_json"

mapfile -t images < <(jq -r --arg prefix "${IMAGE_BASE}@sha256:" '
  sort_by(.metadata.creationTimestamp) | reverse |
  [ .[] | select((.metadata.name // "") | startswith("emprovex-cloudrun-candidate-"))
    | (.spec.containers[0].image // empty)
    | select(startswith($prefix))
  ] | .[:16][]
' "$revisions_json")

if (( ${#images[@]} == 0 )); then
  echo "::error::No matching historical Cloud Run container images."
  exit 1
fi

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
found=0
for image in "${images[@]}"; do
  [[ "$image" == "${IMAGE_BASE}@sha256:"* ]] || exit 1
  echo "Preserving immutable Next.js assets from previous Cloud Run revision."
  if ! docker pull "$image" >/dev/null; then
    echo "::warning::Historical image is no longer in Artifact Registry."
    continue
  fi
  cid="$(docker create "$image")"
  tempdir="$(mktemp -d)"
  if docker cp "${cid}:/app/.next/static/." "$tempdir/" >/dev/null 2>&1; then
    # Equal hash paths are immutable; first copy wins.
    cp -a -n -- "$tempdir/." "$target_dir/"
    found=$((found + 1))
  else
    echo "::warning::No static asset directory in a historical image."
  fi
  docker rm "$cid" >/dev/null
  rm -rf -- "$tempdir"
done
(( found >= 1 )) || { echo "::error::No historical extraction succeeded."; exit 1; }

# Exact files from founder's real production DevTools capture, 2026-11-09.
test -s "$target_dir/chunks/app/admin/page-90bf4e32d0dfc3aa.js" || {
  echo "::error::Historical Admin JavaScript chunk was not recovered."
  exit 1
}
test -s "$target_dir/css/3ebef08104e37cca.css" || {
  echo "::error::Historical Admin stylesheet was not recovered."
  exit 1
}
bytes="$(du -sb "$target_dir" | cut -f1)"
if (( bytes > 350000000 )); then
  echo "::error::Historical static exceeds 350 MB. Refuse image bloat."
  exit 1
fi
echo "Previous revision archives imported: $found; static bytes: $bytes"
