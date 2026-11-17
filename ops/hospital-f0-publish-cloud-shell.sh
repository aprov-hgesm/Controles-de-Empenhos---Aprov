#!/usr/bin/env bash
# Cozinha Dietetica — publicação do frontend isolado a partir do Google Cloud Shell (Bash).
# Nao altera Cloud Run, Firebase Auth, Firestore nem EMPROVEX.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/apps/hospital-web"
PROJECT="cozinha-dietetica"
APP_ID="1:947369899527:web:d2da054f7b9ce707195ca2"
SITE="cozinha-dietetica-web"

fail() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }
command -v python3 >/dev/null || fail "python3 ausente"
command -v node >/dev/null || fail "Node.js ausente"
command -v npm >/dev/null || fail "npm ausente"
command -v git >/dev/null || fail "git ausente"
[[ -f "$WEB/firebase.json" && -f "$WEB/src/App.tsx" ]] || fail "Projeto hospitalar incompleto; execute a partir do clone do repositorio GitHub."
if command -v firebase >/dev/null 2>&1; then
  FB=(firebase)
else
  command -v npx >/dev/null || fail "npx ausente"
  FB=(npx --yes firebase-tools@14)
fi

printf '1/4 — Preparando modulos hospitalares (sem interface financeira)...\n'
export HOSPITAL_REPO_ROOT="$ROOT"
python3 - <<'PY'
from pathlib import Path
import os, shutil

root = Path(os.environ["HOSPITAL_REPO_ROOT"])
source = root / "features/hospital"
dest = root / "apps/hospital-web/src/features/hospital"
folders = ("core", "patients", "diets", "maps", "production", "distribution",
           "nutrition-audit", "administration", "reporting", "printing")
approved = ("DistributionQueue.tsx", "KitchenMapsBoard.tsx", "MealProgressPair.tsx",
            "TrackingView.tsx", "UnitMapStatusCard.tsx", "OrderProgress.tsx",
            "meal-period.mjs", "navigation.mjs", "order-progress.mjs",
            "order-progress.d.mts", "navigation.d.mts", "hospital-premium.css")
for folder in folders:
    if not (source / folder).is_dir():
        raise SystemExit(f"Modulo ausente: {folder}")
for filename in approved:
    if not (source / "integration" / filename).is_file():
        raise SystemExit(f"Arquivo ausente: {filename}")
if dest.exists():
    shutil.rmtree(dest)
dest.mkdir(parents=True)
for folder in folders:
    shutil.copytree(source / folder, dest / folder)
integration = dest / "integration"
integration.mkdir()
for filename in approved:
    shutil.copy2(source / "integration" / filename, integration / filename)

for path in dest.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in {".tsx", ".ts", ".mjs", ".css", ".md"}:
        continue
    previous = path.read_text(encoding="utf-8")
    updated = previous.replace("EMPROVEX", "COZINHA DIETETICA").replace("Emprovex", "Cozinha Dietetica")
    updated = updated.replace("--emprovex-accent", "--hospital-accent")
    updated = updated.replace("'x-hospital-organization':organizationId",
                              "'x-hospital-organization-id':organizationId")
    if path.name == "AdministrationView.tsx":
        updated = updated.replace("['UNIT','Unidade']", "['UNIT','Unidade Assistencial']")
        updated = updated.replace("['KITCHEN','Cozinha']", "['KITCHEN','Cozinha Dietética']")
        updated = updated.replace("m.roles.join(' / ')",
            "m.roles.map(role=>({UNIT:'Unidade Assistencial',KITCHEN:'Cozinha Dietética',NUTRITION:'Nutrição',HOSPITAL_ADMIN:'Administrador'} as Record<string,string>)[role]??role).join(' / ')")
    if updated != previous:
        path.write_text(updated, encoding="utf-8")
admin = (dest / "administration/AdministrationView.tsx").read_text(encoding="utf-8")
if "'x-hospital-organization-id':organizationId" not in admin or "'x-hospital-organization':organizationId" in admin:
    raise SystemExit("Cabecalho hospitalar da administracao incorreto.")
for forbidden in ("HospitalShell.tsx", "access.ts"):
    if (integration / forbidden).exists():
        raise SystemExit(f"Dependencia indevida: {forbidden}")
print(f"OK: {sum(1 for p in dest.rglob('*') if p.is_file())} arquivos hospitalares extraidos.")
PY

cd "$WEB"
printf '2/4 — Obtendo configuracao publica do Firebase Web...\n'
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
if ! "${FB[@]}" apps:sdkconfig WEB "$APP_ID" --project "$PROJECT" --out "$TMP"; then
  printf '\nAutentique o Firebase CLI neste Cloud Shell e repita:\n  %s login --no-localhost\n' "${FB[*]}" >&2
  exit 1
fi
python3 - "$TMP" "$WEB/.env.local" "$APP_ID" "$PROJECT" <<'PY'
from pathlib import Path
import json, sys
sdk=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
out=Path(sys.argv[2])
expected_app=sys.argv[3]; expected_project=sys.argv[4]
if sdk.get("appId")!=expected_app or sdk.get("projectId")!=expected_project or not sdk.get("apiKey"):
    raise SystemExit("Projeto, app ou chave publica divergente; compilacao interrompida.")
out.write_text("# Configuracao publica do Firebase Web. Nunca adicionar credenciais IAM.\n"
    + "VITE_HOSPITAL_FIREBASE_PROJECT_ID="+expected_project+"\n"
    + "VITE_HOSPITAL_FIREBASE_API_KEY="+sdk["apiKey"]+"\n"
    + "VITE_HOSPITAL_FIREBASE_APP_ID="+expected_app+"\n"
    + "VITE_HOSPITAL_ORGANIZATION_ID=hgesm\n", encoding="utf-8")
print("OK: projeto cozinha-dietetica / hospital hgesm configurados.")
PY

printf '3/4 — Compilando somente o portal hospitalar...\n'
npm install --no-audit --no-fund
npm run build
[[ -s dist/index.html && -s dist/emblema-nutricao.webp ]] || fail "Compilacao sem HTML ou emblema hospitalar."

printf '4/4 — Publicando exclusivamente o Hosting hospital-web...\n'
"${FB[@]}" target:apply hosting hospital-web "$SITE" --project "$PROJECT"
"${FB[@]}" deploy --only hosting:hospital-web --project "$PROJECT" --non-interactive

printf '\nSUCESSO: https://%s.web.app\n' "$SITE"
printf 'API, contas, Firestore e EMPROVEX nao foram modificados por este script.\n'
