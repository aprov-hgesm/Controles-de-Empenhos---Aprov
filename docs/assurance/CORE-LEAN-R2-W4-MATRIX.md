# CORE LEAN R2 — Worker 4 independent assurance and certification matrix

**Technical verdict: NO-GO for full integration** until the exact final composition is certified, including AuthZ #370, CI selection and remaining external paths. All runs below are from disposable Firebase Auth / Firestore Emulators or pure domain tests; no real workspaces, Rules production, merges or deploys were touched.

## Independent v3 technical GO on exact composite SHA

At composite **b401f935165de756b8f8b7ac3b5a16461b23c577** (PR #379), GitHub Actions [run 40158808874](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40158808874) completed **SUCCESS** on W4 independent v3 Auth+Firestore with **17 named adversarial scenarios PASS**, including the previously failing canonical barcode item and its exact movement/consumption/manifest provenance, 1-unit race between different IDs, v2-on-v3 ID rejection, inactive material and location without writes, missing movements, missing consumptions and altered manifest. The same run includes **5/5 W1 v3 contract, 14/14 W3 fiscal opt-in, 5/5 W4 independent fiscal** tests. **No v3 engine FAIL remains in those 17 executed scenarios.** This technical GO is strictly scope/SHA-bound, not a release GO.

Other exact-composition checks: [Fast CI run 40158808855](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40158808855) **PASS**, Core Protection and Recovery PASS. Historical W4 v2 Auth+Firestore **PASS** in [run 40158808820](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40158808820) at **the identical SHA b401f935**: historical v1 six recovery cut points, v2 immutable hash 4 tests, W4 15 adversarial scenarios including rejection of a false FINALIZED header. Therefore **Warehouse v2 and v3 both have technical GO on the exact tested composition**.

**Global CORE LEAN R2 stays NO-GO** because PR #370 AuthZ central policy is 16/17 FAIL (missing WITHDRAWAL_FINALIZE_MOBILE allowlist), the migration still has unmigrated client paths, W2 needs to compose the independent v3/finance tests into final CI selectors, and the coordinator must certify and approve the official final composition. An in-scope Warehouse PASS must not be reported as final release certification.

## Frozen evidence: immutable versions, no inherited PASS

| Source | SHA | Role |
| --- | --- | --- |
| main at initial analysis | afe163139089a1af8ffc81804464429d4d0f9528 | unchanged |
| W1 Warehouse source, first cross-cert | 58388a78cdab810db676a6f9d93d4dc677389b9b | PR #375, v2 replay integrity fix |
| W3 first opt-in fiscal identity contract | 939b8cb5a88ab6bcc0b43cb02f4d85d08d21a3db | PR #373 |
| W4 first cross-cert scripts | 1a31b88f30f47344ab4c9f005ac1254282a2cb98 | PR #374 |
| First composition | ef71fd75809e33bafc011634f66c5cb1117f668f | disposable PR #376 |
| v3 forensic follow-up composition | f1a2ecbb67491937ad9f4d602ee669db66f3c3af | PR #376; barcode negative |
| W3 strengthened fiscal PDF attestation | 64bd70072def5b0898ffbe57d969476ab630ad37 | PDF is unattested without server-proven document + storage identity |
| W1 barcode source fix and strict fixture correction | 7a271c51f86f83a58a6b5cf149cf5e3ed8bf57fe | PR #375, source tree overlaid in PR #379 |
| W4 AuthZ scripts | 316b5c92340483374ebcf449809ffd04c6c14f29 | pure additional policy tests |
| AuthZ engine | bc4b6592d1442dead22dd01886e165cacbcbd031 | PR #370 |
| AuthZ forensic composition | 226bd6238ce9c360e7f5e2ae5fb67f1435dc216e | PR #378 |
| W2 CI selector and negative mutation run | eda0c651b67650b25c6bd7249a497f200320347e | PR #372 |
| W1/W3/W4 corrected barcode and PDF test composition | cb32935fafbc5c22420ee8be4f167fa4cfd31f2b | PR #379 prior to inactive-location fixture fix |
| W4 updated v3 fixture (Emulator owner REST only) | 684276ac1b98cafc4c0ee32b8f3987e287f00442 | PR #374 W4 code |
| Latest isolated corrected composite at report writing | b401f935165de756b8f8b7ac3b5a16461b23c577 | PR #379, W1 source 7a271c5, W3 64bd700, W4 latest tests, status must be verified separately |

A run PASS is valid **only for its recorded SHA**. Newer Worker 1 commits may include unrelated script changes; final integration requires running these suites again.

## Executed PASS / FAIL

| Property / domain | Result, exact provenance | Run |
| --- | --- | --- |
| W4 original v2 forged FINALIZED previously accepted | **FIX REVALIDATED PASS**: replay now rejects missing ledger evidence; 15 W4 v2 cases PASS including rollback, idempotency, concurrent same/different identities, post-commit response loss and no residual writes; SHA ef71fd7 | https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40157472250 |
| Historical v1 interrupted withdrawals | **PASS** including six cut points, orphan finalized and read-only reconciliation; SHA ef71fd7 | same run 40157472250 |
| v2 hash pinned and deterministic movement IDs | **4/4 PASS**; SHA ef71fd7 | same run 40157472250 |
| Fast CI + Core Protection in initial W1 composite | **PASS**, SHA ef71fd7 | https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40157472228 |
| W1 v3 command parser/hash/split contract | **5/5 PASS**, SHA ef71fd7 | https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40157472308 |
| W3 initial identity tests | **10/10 PASS**, W3 939b8cb and composition ef71fd7 | same run 40157472308 |
| W4 independent fiscal tests on initial W3 | **5/5 PASS**, W3 939b8cb and composition ef71fd7 | same run 40157472308 |
| W3 strengthened identity tests | **14/14 PASS** in W3 64bd700 / composite 3991d08 | https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40158391177 |
| W4 v3 before barcode correction | **14 named behavioral scenarios PASS**, **barcode item FAIL**; W1 58388a7, composition f1a2ecb. Missing movement, missing consumption, corrupted effectManifestHash all correctly rejected without re-debit. | https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40157990902 |
| W4 v3 after barcode correction | Barcode movement/consumption/manifest **PASS**, true one-unit contention **PASS**, v2-on-v3 ID **PASS**; run then stopped on W4 fixture trying direct SDK local-state write, correctly denied by server-only Rules. Composition cb32935f. | https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40158609313 |
| W4 newer fiscal PDF case | Initial test expected legacy verified but W3 requires server attestation. W4 test corrected to assert unattested without trusted keys and verified ONLY with server-known documentId+objectKey; renewed execution at cb32935f **5/5 PASS**. | 40158609313 |
| W4 signed AuthZ negative controls | **4/4 PASS**, PR370 bc4b659 | https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40158064082 |
| PR370 existing AuthZ policy suite | **16/17 PASS, 1 FAIL**: WITHDRAWAL_FINALIZE_MOBILE in dispatcher but not allowlist; fix belongs to PR370 | same run 40158064082 |
| Signed Firebase Auth + Firestore authorization | **PASS**: active, suspended, provider mismatch, UID forgeries, tenant, UG, authorship, unknown ledger, core endpoints; PR370 bc4b659 | same run 40158064082 |
| Server-only Firestore Rules on emulator | **PASS** direct client writes forbidden, cross-workspace reads forbidden; PR370 bc4b659 | same run 40158064082 |
| Worker 2 controlled CI mutations and conservative selector | **11 mutation tests PASS** in W2 eda0c65 Fast CI; including syntax failure, auth, idempotency, tenant, finance, new unclassified file fallback. | https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40157862322 |
| W2 Domain & Application on uncomposed main | Warehouse **FAIL** legitimately detects unpatched v2 replay in its old baseline; other selected domains PASS. Not evidence against updated W1. | https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40157502115 |
| Same-SHA W4 v2 and historical recovery at b401f935 | **PASS:** 4 v2 contracts, 15 W4 adversarial Warehouse scenarios and six legacy interruption recovery cut points; evidence and headers checked, no duplication. | https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40158808820 |
| Corrected W1/W3/W4 composite after Emulator admin-fixture fix | **17/17 W4 v3 adversarial PASS** plus **5 W1 v3 + 14 W3 financial + 5 W4 financial PASS**, SHA b401f935. Exact same-SHA v2 and v1 also PASS. | https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40158808874 |

Counts of PASS messages are not counts of individual assertions. A skipped Application CI on a DRAFT PR is SKIPPED, never PASS.

## Behavioral coverage versus gap

| Invariant | Coverage |
| --- | --- |
| v1/v2 immutable historical hash/replay, success and negative control | W4 v2 audited actual persisted balance, location, movements, consumptions, historical six fault injection points; PASS on W1 58388a7 |
| v3 minimal normalized intent, hash and deterministic splits, v2/v3 isolation | W4 black-box v3, W1 parser contract; PASS in prior runs |
| v3 atomic multiline across expiries, attributed plus untracked, idempotency & response-loss | Passed and compared exact persisted quantities plus manifest, ledger, session actor |
| v3 corruption detection | Missing movement, missing consumption, incorrect effectManifestHash individually rejected; PASS no second debit |
| v3 real barcode item | Initially reproducible domain FAIL; after W1 fix barcode movement/consumption/manifest PASS at cb32935f. Re-run at b401f935 pending |
| v3 presentation | Original operator request 1 box with base 2 KG preserved as separate documentary fields, PASS |
| v3 same ID/different ID concurrency | PASS; includes fresh material one unit for two concurrent different commands |
| v3 forged actor, UG, workspace, identity, no residual writes | Signed session identity on W4 emulator; foreign material and UG reject |
| v3 inactive material and location | New W4 cases seeded via isolated administrative emulator API; must re-execute after fixture correction |
| v3 transaction upper bound | >40 command lines fail closed; true 450-document boundary NOT TESTED |
| Mobile location barcode | UI route/scanner integration NOT independently browser-tested; item barcode E2E server only |
| PDF output after conversion | Document metadata checked, PDF renderer NOT E2E tested |
| Financial fiscal identity and PDF attestation | W3 opt-in 14 tests and W4 5 independent assertions; actual transactional NF/NS writers/locks NOT migrated/certified |
| AuthZ migration | PR370 implemented routes signed-token E2E PASS; old/unmigrated client paths are NOT certified as server-only |
| CI selector | W2 11 mutations PASS; W2 planner at eda0c65 did not yet explicitly select new W4 v3 / independent finance tests, integration ownership W2 |

## Defects / owner / exact recovery contract

**Worker 1, PR #375:** v2 false finalized header FIXED and independently PASS; v3 barcode originally FAILED movement validation because source was tagged MANUAL_SEARCH with a canonical barcodeId. Corrected barcode v3 PASS at exact composite cb32935f. W1 added TS test fixture guards in 7a271c5 to fix four TS18047 errors observed on 3991d08 Fast CI. Latest W4 composite b401f935 PASS: inactive location/material, v2/v3 distinction, conversion, contention, corrupted manifest and full historical recovery. Do not relax movement validator or silent replay.

**AuthZ owner PR #370:** existing policy test fails on missing WITHDRAWAL_FINALIZE_MOBILE operation central positive list. W4 documented reproduction on PR370 and did not touch its engine or rules. Must reconcile Mobile Trust with central authorized command semantics; then re-run Auth Emulator and client Rules test. Additional unmigrated routes remain NO-GO.

**Worker 2 PR #372:** mutation selector test PASS, but W4 new v3 signed Auth+Firestore and W4 independent financial suite should enter the right domain selection when material/ledger/financial identities change. No CI workflow was altered by W4 in W2 PR. Release gates must be checked in final integration.

**Worker 3 PR #373:** fiscal identity module is opt-in and read-only; no persisted IDs changed. New document+storage attestation requires trusted server-known keys; W4 now explicitly verifies that untrusted metadata cannot be classified verified.

## Run commands

- W4 v2 + historical: npm ci; NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID=demo-emprovex-security npx --yes firebase-tools emulators:exec --config firebase.warehouse-security-test.json --project demo-emprovex-security --only auth,firestore "npx --yes tsx scripts/warehouse-server-manual-entry-emulator.ts && npx --yes tsx scripts/core-lean-r2-w4-assurance-emulator.ts"
- W4 v3: NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID=demo-emprovex-security npx --yes firebase-tools emulators:exec --config firebase.warehouse-security-test.json --project demo-emprovex-security --only auth,firestore "npx --yes tsx scripts/core-lean-r2-w4-v3-emulator.mjs"
- W3 plus W4 financial: node --experimental-vm-modules --test scripts/financial-identity-v2.test.mjs scripts/core-lean-r2-w4-financial.test.mjs
- Auth policy: node --test scripts/core-lean-r2-w4-authz.test.mjs && npm run test:server-authorization
- Auth Emulator: npx --yes firebase-tools emulators:exec --config firebase.security-test.json --project demo-emprovex-security --only auth,firestore "npx --yes tsx scripts/server-authorization-emulator.ts"
- Warehouse Rules Emulator: npx --yes firebase-tools emulators:exec --config firebase.warehouse-server-only-test.json --project demo-emprovex-security --only auth,firestore "node scripts/warehouse-server-only-rules.test.mjs"

Only run scripts against their own isolated matching branch/composition; v3 server module and W3 financial module do not exist in the uncomposed main.

## Gate

**NO-GO for final composition as of this report.** Release remains blocked until current exact SHA has complete green independent Auth+Firestore Warehouse v2/v3, central AuthZ policy, approved financial contracts, CI mutation/selector, final full release gates, and no unaddressed critical findings. The Coordinator alone manages official composition and promotion.

## 25 October 2026 — W4 resumed final-HEAD evidence and cross-worker certification

### Exact sources, scope and audit trail

The current W1 HEAD afa0deba94905156a63bb636ae4ebcbb7452967d differs from W1 source 7a271c51f86f83a58a6b5cf149cf5e3ed8bf57fe used in the fully successful earlier composition only by a W1 documentation change. W3 contracts are at 64bd70072def5b0898ffbe57d969476ab630ad37. W4 independent suites were pinned at 5e157bec1e1592881207e99dcee3ca1d9626906f for the first five-worker execution. Latest owned W4 additions include a separate signed mobile authorization interoperability test.

The new all-five-workers experimental PR is #380. Initial exact SHA 343801a53bcb0e9522df9d36504eed9b17eb0725 included W1 afa0deba, W2 12769881, W3 64bd7007, W4 5e157bec and W5 d1b5c4b9. The W4 v2/historical suite is PASS in https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40198850400; the W4 v3 Auth+Firestore and financial contracts are PASS in https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40198850378. The independent W2 selector + W5 deterministic compatibility job is PASS in run 40198850449, while the W5 real transaction job is FAIL (fixture). The W5 own historical benchmark is PASS in run 40198850404; Core Protection and Recovery are PASS. Fast CI FAIL in run 40198850352; Legal FAIL trailing whitespace; Application CI and staged Domain CI SKIPPED on DRAFT. No inherited PASS from older SHAs.

The first repair SHA 20d6abe9137c0705e70beac0e85826c7581c7191 changed ONLY tests/docs/workflows: W5 synthetic seed moved to local Emulator Admin REST; W2 legacy Mobile-R1 test changed to preserve server-owned v3 derived IDs, not client-generated IDs; W1 documentation whitespace removed; current W2 workflows included. SHA 211576ebe17a49659487e0ebf3ba9450c9880ee2 corrected an escaped whitespace regex in that test. The Fast CI on that SHA found a SECOND obsolete assertion in scripts/verify-mobile-k-canonical-ops.mjs that expected a client-created lineId. The W5 true transaction probe advanced through 3 samples of multiple v2/v3 cases and failed when a concurrent scenario produced no debit; at least one failure reason was not logged by that earlier fixture. W5 owner subsequently made concurrency rejection diagnostics explicit without weakening exact-once assertions. These findings were forwarded with exact runs to PR #372 and PR #377.

The subsequent composition SHA 37c4dd7a1e855b2ee780b7546eca1c1358fec6e3 incorporates W2 25ad486497aa4eb14dddf681a1f1643f8ce34f69, W5 783f1b68cc37b3a7c52ac41ca864f10771271d32 and a temporary Mobile-K contract correction. Treat its ongoing checks as unverified until GitHub reports final results, not as PASS because of ancestor commits. The official coordinator integration must use current HEADs, check them again and re-run all gates.

### Authorization #370 classification — not a CORE LEAN additive blocker by itself

PR #370 HEAD bc4b6592d1442dead22dd01886e165cacbcbd031 contains no MOBILE alias case, but GitHub synthetic merge db6f33ea26a35b08707fd5dca5e9fa102a5ea7cb combines it with main, which does have the alias. The resulting route calls verifyWarehouseRequest, rejects mismatched workspace, blocks LEDGER_MOVEMENT and invokes assertWarehouseAuthorization BEFORE bindWarehouseMobileTrust or any warehouse mutation. The new positive list includes WITHDRAWAL_FINALIZE but not WITHDRAWAL_FINALIZE_MOBILE; the latter is safely denied HTTP 403 even to an eligible user. The W4 signed API proof executed against Auth+Firestore Emulator is PASS in https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40199218101: canonical command authorization passes, mobile alias is denied HTTP 403, forged workspace and arbitrary ledger commands denied. Overall authorization workflow remains FAIL due to the unchanged central policy regression; owner PR #370 must correct the safe compatibility mapping and revalidate signed behavior. This is NOT an established unauthorized-access bypass. The unfinished general server-only migration must be assessed separately; do not use it to block the additive CORE LEAN if that code adds no AuthZ regression.

### Exact final certification commands

On the approved coordinator integration SHA, execute npm ci and npm run typecheck; then:

- node --test scripts/ci-lean-plan.test.mjs scripts/ci-lean-syntax.test.mjs scripts/ci-lean-domain.test.mjs scripts/ci-lean-guards.test.mjs scripts/ci-lean-mutations.test.mjs scripts/ci-lean-coverage.test.mjs
- node scripts/ci-lean-w1-v3.mjs contract
- node --experimental-vm-modules --test scripts/financial-identity-v2.test.mjs scripts/core-lean-r2-w4-financial.test.mjs
- npx --yes tsx --test scripts/core-lean-r2-w5-historical.test.ts
- node --test scripts/core-lean-r2-w5-profile.test.mjs
- npm run test:core-lean-r2-w4-assurance
- npm run test:core-lean-r2-w4-v3
- npm run test:core-lean-r2-w1-emulator
- W5 real comparison: within named demo Auth and Firestore Emulators only, use EMPROVEX_WAREHOUSE_ADMIN_EMULATOR=1 EMPROVEX_E2E_SERVER_AUTH=1 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID=demo-emprovex-security and npx --yes tsx scripts/core-lean-r2-w5-transactions.mjs
- Check Application CI, Fast CI, staged Domain CI, Legal, Core Protection and legacy required release gates on the SAME exact SHA; SKIPPED is never PASS.

The W4 v3 suite checks committed headers, movements, consumptions, global/local balances, stable IDs, barcode provenance, multiple validity records, rejection of missing movement/consumption/corrupted effect manifest, request-loss replay, one-unit contention with two IDs, same-ID concurrency, inactive location/material and no residual writes. v2/historical suite checks six interruption points, forged FINALIZED rejection and no second debit. W3 is opt-in fiscal identity, not a migration of persistent invoice/NS writers. W5 latency and RPC benchmarks never substitute for ledger/replay integrity. 450-document transactional saturation, browser location-barcode UX and actual generated PDF remain outside the executed complete E2E scope unless separately tested.

### Owner handoff and decision

Worker 1: Warehouse motor W1 source and replay safeguards certified in earlier exact composites; no live writes or Rules changes by W4. Worker 2: align both old mobile verifier tests with server-derived v3 IDs and ensure W4 v3 / finance / W5 deep checks are selected and EXECUTED; negative removal mutations must cause CI FAIL. Worker 3: preserve optional fiscal contracts and trusted PDF attestation without claiming writers integrated. Worker 5: certify benchmark seed and genuine contention with reasoned rejection diagnostics; never drop the debit invariants. PR370 owner: correct Mobile alias allowlist regression before mixing AuthZ migration. Coordinator: combine final SHAs, execute all active release gates and deliver official GO/NO-GO.

**W4 verdict**: GO technical for historical Warehouse v1/v2/v3 and opt-in finance at the recorded successful composite SHA, but NO-GO for full five-worker closure until the current exact integration composite Fast CI + W5 true transaction + Legal and required checks are green. No merge, production deploy, real data access or Rules changes authorized.

## 25 October 2026 — final W4-W5 all-five-worker SHA controls

### Same-SHA previously successful all-five-worker evidence

Experimental PR #380 / **f60445ed226a6edb9bba060c749703d624dcbb79**:
- **PASS W4 historical v1/v2:** https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40200031405
- **PASS W4 17 v3 signed Auth+Firestore adversarial and W3/W4 financial contracts:** https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40200031433
- **PASS W2 mutation planner + W5 historical and W5 actual v2/v3 transactions:** https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40200031348 (both jobs)
- **PASS W5 bounded read/legacy IDs:** https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40200031507
- **PASS Fast CI:** https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40200031472
- **PASS Legal, diff, build:** https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40200031554
- Core Protection and Recovery PASS. Application CI, Domain CI, Browser E2E are SKIPPED due to DRAFT, not PASS. This is GO technical for covered additive contracts, not production GO.

The source W5 SHA then was f71d5f590531c16cf391556e84072bd829b65de1. Later W5 code e2d0ad8c156a34df02ab7ef10109e3ab151960b2 added strict negative controls for 121 validity candidates, missing material and divergent replay with zero writes. Those passed separately in W1+W5 composition https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40200112711. The newest all-five-worker SHA **36a7aa3599e214040650cf26fbba3e28102117a2**, W5 docs c1dc5d9f, must have its own Actions conclusion checked: never transfer PASS across commits.

### Performance and security interpretation

W5 real transactions used three synthetic samples per scenario in the named Firestore/Auth Emulators. v3 was smaller at the HTTP request layer, but used **4 more RPCs** per committed operation than v2 and the same number of document writes. Observed median latency in ms: simple v2/v3 40.985/65.073, multiline 26.253/40.928, 60 validity candidates 12.892/49.646. These are not production SLAs, billed reads, or evidence v3 is faster. Preserve mutex, phantom prevention, balance rechecks and movement+consumption ledger. Propose query optimizations to W1 only after independent W4 invariants remain PASS.

### AuthZ #370 separate precise scope

A synthetic PR370 merge with main db6f33ea26a35b08707fd5dca5e9fa102a5ea7cb includes the mobile withdrawal alias absent from PR370 source. Central authorization executes BEFORE MobileTrust and ledger writes, but the allowlist lacks WITHDRAWAL_FINALIZE_MOBILE. Signed actual HTTP Auth Emulator test PASS for **safe HTTP 403 deny** of mobile alias, canonical allowlist permission and denial of forged workspace/ledger: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40199218101. Existing central policy 16/17 FAIL is a functional integration availability regression of #370, not an established auth bypass. PR370 must fix when integrating its separate unfinished server-only migration, but additive CORE LEAN should not be blocked if it introduces no auth regression.

### Owner handoff

W1 source afa0deba94905156a63bb636ae4ebcbb7452967d is fixed on covered warehouse motors. W3 64bd70072def5b0898ffbe57d969476ab630ad37 remains opt-in fiscal contracts, not persisted writers. W4 suite PR374 certifies documentary ledger v1/v2/v3, adversarial replay, concurrency, barcode, scopes, rollbacks and financial ownership. W2 must sync both legacy mobile verifier scripts to server-derived v3 line-ID behavior (fix applied only on temporary #380), preserving all other checks, and keep fail-closed selecting v3 signed emulator and financial independently. W5 handled Admin Emulator fixture, corrected accidental v2 double-request concurrency, historical invoice movement and new 121-query saturation negatives; do not claim productive speed improvement. Coordinator: compose official final SHA, run W4 v2/v3, W1 v3, W3 financial, W2 all negative mutations and release gates, W5 genuine v2/v3 probes, complete Application CI / Domain CI / Legal, and classify skipped separately. No merge, deploy, Rules modifications or customer data performed by W4.

**W4 verdict at evidence f60445ed: scoped Warehouse + fiscal add-on GO technical; global release / incomplete authorization migration NO-GO until official final-SHA release gates.**
