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
| Stable command v2 signature | W4 contract pinned SHA-256 vector | preserve historic v2 hash | Defined; not executed |
| Deterministic movement identity | W4 contract distinct line/workspace | same key = same ID | Defined; not executed |
| Multiline same material/location/expiry | W4 emulator multi | exact movements, consumptions, totals | Defined; not executed |
| Insufficient last line | W4 emulator lastLineFails | rollback; no stray documents | Defined; not executed |
| Fault at line 2 | W4 emulator fault | full rollback | Defined; not executed |
| Confirmed exact replay | W4 emulator multi | no new debit | Defined; not executed |
| Divergent replay | W4 mutated quantity | reject, no stock drift | Defined; not executed |
| HTTP answer lost after commit | W4 emulator afterCommit | recover without second debit | Defined; not executed |
| Same command concurrent | W4 emulator sameId | one logical debit | Defined; not executed |
| Different commands competing | W4 contenderA / contenderB | one debit, never negative | Defined; not executed |
| Null reference bypass | W4 emulator nullBypass | cannot debit attributed stock | Defined; not executed |
| Expired expiry reference | W4 emulator expired | reject without writes | Defined; not executed |
| Access from Firebase Auth token | W4 signed emulator credential | UID/UG/workspace derived from session | Defined; not executed |
| Forged or missing bearer token | W4 verifyWarehouseRequest | deny | Defined; not executed |
| Wrong UG/material/path | W4 adversarial inputs | deny without effects | Defined; not executed |
| Duplicate lines and line ceiling | W4 repeatedLines / overflow | reject | Defined; not executed |
| v2 fabricated FINALIZED | W4 forged negative control | reject without ledger records | **Suspected FAIL**; execution pending |
| Historical v1 interrupted writes | Existing manual-entry emulator | six recovery cut points | Prior coverage; W4 re-run pending |
| Historical phantom FINALIZED | Existing emulator + legacy audit | safe block, read-only findings | Prior coverage; W4 re-run pending |
| Mutable material/destination labels | Further W4 scenario | confirmed replay survives label changes | Pending |
| Multiple expiry records/conversion | Existing domain tests | totals and tracking retained | Independent E2E pending |
| v3 identity + v2 migration | Worker 1 contract not yet received | explicit version pin, no silent hash rewrite | BLOCKED |
| NF, NS and NE concurrent operations | Worker 3 owns service | scope-specific identity, locks, dependencies | BLOCKED |
| PR #370 authorization | PR #370 remains Draft on another base | provider, UID, suspension, unknown command | BLOCKED |
| Fast CI mutation negatives | Worker 2 owns CI selector | syntax, contracts, auth, isolation and unclassified file | PENDING |

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
