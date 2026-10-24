# EMPROVEX CORE LEAN R2 — W4 Independent Assurance

**Owner:** Worker 4 (domain/adversarial tests only).  
**Isolation:** branch test/core-lean-r2-w4-assurance; Firebase Auth + Firestore named database emulators; demo project only.  
**Production:** no deploy, no merge, no production Rules changes, no live credentials.  
**Gate:** FAIL remains FAIL. A workflow definition, static review, or pending run is NOT certification.

## Execution (Auth + Firestore)

The separate workflow .github/workflows/core-lean-r2-w4-assurance.yml is triggered even
for a **draft** PR, independently of Application CI's draft skip.

1. npm ci
2. npx --yes tsx --test scripts/core-lean-r2-w4-contract.test.ts
3. NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID=demo-emprovex-security npx --yes firebase-tools emulators:exec --config firebase.warehouse-security-test.json --project demo-emprovex-security --only auth,firestore "npx --yes tsx scripts/core-lean-r2-w4-assurance-emulator.ts"

The emulator executable fails closed if the hosts/project differ from its
isolated test topology.

## Traceability matrix (test definitions; NOT pass/fail results)

| Property / risk | Executable scenario | Expected assurance | Status before GitHub Actions |
| --- | --- | --- | --- |
| Stable command v2 signature | W4 contract pinned SHA-256 vector | preserve historic v2 hash | 15 scenarios plus 4 contract tests executed PASS where applicable; see evidence section |
| Deterministic movement identity | W4 contract distinct line/workspace | same key = same ID | 15 scenarios plus 4 contract tests executed PASS where applicable; see evidence section |
| Multiline same material/location/expiry | W4 emulator multi | exact movements, consumptions, totals | 15 scenarios plus 4 contract tests executed PASS where applicable; see evidence section |
| Insufficient last line | W4 emulator lastLineFails | rollback; no stray documents | 15 scenarios plus 4 contract tests executed PASS where applicable; see evidence section |
| Fault at line 2 | W4 emulator fault | full rollback | 15 scenarios plus 4 contract tests executed PASS where applicable; see evidence section |
| Confirmed exact replay | W4 emulator multi | no new debit | 15 scenarios plus 4 contract tests executed PASS where applicable; see evidence section |
| Divergent replay | W4 mutated quantity | reject, no stock drift | 15 scenarios plus 4 contract tests executed PASS where applicable; see evidence section |
| HTTP answer lost after commit | W4 emulator afterCommit | recover without second debit | 15 scenarios plus 4 contract tests executed PASS where applicable; see evidence section |
| Same command concurrent | W4 emulator sameId | one logical debit | 15 scenarios plus 4 contract tests executed PASS where applicable; see evidence section |
| Different commands competing | W4 contenderA / contenderB | one debit, never negative | 15 scenarios plus 4 contract tests executed PASS where applicable; see evidence section |
| Null reference bypass | W4 emulator nullBypass | cannot debit attributed stock | 15 scenarios plus 4 contract tests executed PASS where applicable; see evidence section |
| Expired expiry reference | W4 emulator expired | reject without writes | 15 scenarios plus 4 contract tests executed PASS where applicable; see evidence section |
| Access from Firebase Auth token | W4 signed emulator credential | UID/UG/workspace derived from session | 15 scenarios plus 4 contract tests executed PASS where applicable; see evidence section |
| Forged or missing bearer token | W4 verifyWarehouseRequest | deny | 15 scenarios plus 4 contract tests executed PASS where applicable; see evidence section |
| Wrong UG/material/path | W4 adversarial inputs | deny without effects | 15 scenarios plus 4 contract tests executed PASS where applicable; see evidence section |
| Duplicate lines and line ceiling | W4 repeatedLines / overflow | reject | 15 scenarios plus 4 contract tests executed PASS where applicable; see evidence section |
| v2 fabricated FINALIZED | W4 forged negative control | reject without ledger records | **FAIL reproduced** in GitHub Actions run 40135063573 |
| Historical v1 interrupted writes | Existing manual-entry emulator | six recovery cut points | Executed PASS in W4 GitHub Actions historical baseline |
| Historical phantom FINALIZED | Existing emulator + legacy audit | safe block, read-only findings | Prior coverage; W4 re-run pending |
| Mutable material/destination labels | Further W4 scenario | confirmed replay survives label changes | Pending |
| Multiple expiry records/conversion | Existing domain tests | totals and tracking retained | Two expiry / conversion E2E scenarios PASS |
| v3 identity + v2 migration | Worker 1 contract not yet received | explicit version pin, no silent hash rewrite | BLOCKED |
| NF, NS and NE concurrent operations | Worker 3 owns service | scope-specific identity, locks, dependencies | BLOCKED |
| PR #370 authorization | PR #370 remains Draft on another base | provider, UID, suspension, unknown command | BLOCKED |
| Fast CI mutation negatives | Worker 2 owns CI selector | syntax, contracts, auth, isolation and unclassified file | PENDING |

## Evidence from GitHub Actions — 2026-10-24

**Tested revision:** `5fd02a4430faf76c1922447d3600ccef3417d29e`.
**Workflow:** https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40135063573

| Gate | Actual result |
| --- | --- |
| Fast CI | **PASS** — https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40135063572 |
| Core Protection | **PASS** — https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40135063578 |
| Application CI | **SKIPPED** (DRAFT); NOT PASS |
| Stable v2 public identity contract | **4/4 PASS** |
| Existing authenticated v1/v2 integration suite | **PASS**; six historical interruption cut-points recovered; forged legacy FINALIZED rejected |
| W4 isolated authenticated adversarial cases | **15 PASS**; two expiries + presentation conversion and inactive validity included |
| W4 fabricated v2 FINALIZED without committed ledger | **FAIL CONFIRMED**, final negative assertion (expected rejection not thrown) |
| Overall assurance | **NO-GO**; a legitimate integrity regression is reproducible |

**Note on counting:** 15 W4 named PASS messages include multiple assertions
each; they are independent test scenarios, not total assertions. The v1/v2
integration suite has many additional PASS messages not included in the 15.
Do not aggregate counters from distinct frameworks into an invented test total.

**Updated cross-worker dependencies (still NO-GO):**
- Worker 1 PR #375 is now open DRAFT with the v3 intent/version contract; review identified
  analogous header-only v3 replay acceptance and potential loss of conversion/barcode
  provenance. Findings communicated on PR #375; **no v3 authenticated Emulator execution
  has been completed by W4**, and no v3 PASS is asserted.
- Worker 3 PR #373 introduced an opt-in financial identity v2 contract, but financial
  writers, transaction locks and Auth Emulator tests are not integrated;
  **no financial operational certification**.
- Worker 2 PR #372 is DRAFT. W4 notified W2 to demonstrate selector
  classification and controlled mutations (authorization, idempotency,
  isolation, financial uniqueness, syntax). These **negative selector tests
  remain to be proven**.
- PR #370 remains DRAFT. No combined authenticated authorization
  certification or production Rules change is included in W4.

**Engine ownership:** the confirmed v2 replay integrity failure belongs to
Worker 1. W4 preserves the red negative test. Closing this issue must
retain atomicity, idempotency and all legacy compatibility evidence.

## Independent finding to reproduce in emulator

The current finalizeWarehouseWithdrawalAtomicServer v2 replay path checks
the saved header fields, including status, atomicVersion, hash, and line
counts, but does not appear to audit corresponding movement/consumption
documents before returning success. A fabricated or damaged FINALIZED
header **without committed ledger evidence must not be considered success**.

The forged adversarial fixture writes ONLY a synthetic header in the
isolated emulator (admin REST endpoint) and expects the real server
function to reject reconciliation. A failed assertion is an **integrity
FAIL**, not a test defect to suppress. Fix owner: Worker 1 / warehouse
withdrawal engine. W4 must not patch or bypass this motor.

A safe remedy cannot re-debit a command simply because ledger evidence
is missing. Preserve identity and require proven repair/intervention.

## Worker 2 negative mutation obligations

Use throwaway checkouts and demonstrate that each of these fails:
- SyntaxError in affected executable.
- Violation of NF/NS/NE uniqueness.
- Missing Warehouse authorization.
- Non-idempotent command replay.
- Cross-workspace data access.
- Unclassified newly introduced file under the fast selector.

Revert each mutation afterwards. A selector based on filenames only,
with no safe fallback, is insufficient. Integrate W4 behavior tests
without rewriting Worker 2's workflow from this branch.

## Evidence protocol

Record PR commit SHA, GitHub Actions run URL, conclusion, executed test count
and reproducibility command. Never claim PASS from source review alone.
Legacy Application CI and Warehouse Smoke may skip drafts; W4 workflow
must still run for draft branches.
