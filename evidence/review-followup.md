> **Historical follow-up — residual issues resolved.** All eight original findings and the two residual issues below now have fixes and regression coverage. See [final verification and remaining limits](../docs/verification.md). The original observations, including the concurrent in-progress test failure, are preserved; they describe the earlier reviewed revision.

# Scoped review follow-up

Verified 2026-10-22. Scope: only the eight defects in independent-review.md and the changes addressing them. No whole-project re-audit, product/test edits, external calls, sends, paid use or deployment. Reproductions ran in temporary directories and were cleaned up. Local deployment-record calls only exercised gates against synthetic HTTPS receipts.

## Result

Six original defects are closed by source inspection plus local reproduction. The seventh (mutable installed dependencies) is closed for regular files but the fix introduces an important ordinary-npm compatibility regression. The eighth (CLI missing failure receipts) is fixed for a single invocation but remains reproducible when another writer appends an unrelated event.

## Remaining actionable items

### P2 — Ordinary npm .bin symlinks prevent registering/checking an app

Source: src/runner.ts:47–54, src/workflow.ts:98.

Including node_modules correctly fixes the dependency-byte omission. fingerprintTree still rejects every symlink, so a normal installed package exposing a CLI causes the whole app to fail fingerprinting. This affects common TypeScript/Vite and other npm projects.

Local reproduction:
1. Create an otherwise valid app and regular node_modules/package/bin.cjs.
2. Create node_modules/.bin/package -> ../package/bin.cjs (the ordinary npm internal bin-link layout).
3. fingerprintTree(app) throws "App fingerprint refuses symbolic links"; app registration cannot succeed.

The dependency mutation fix should remain. Handle symlinks whose fully resolved targets remain within the app, hash link identity plus resolved target contents, and reject escapes/cycles; or explicitly constrain supported apps and supply a usable verified artifact path. This is a compatibility regression in the reviewed dependency fix, not a demand for a general symlink feature.

### P2 — CLI failure receipt deduplication still drops errors under concurrency

Source: src/cli.ts:29, 65–66.

The CLI records an error only when the ledger length is unchanged from invocation start. An unrelated append is incorrectly treated as proof that this command's failure was recorded.

Actual subprocess reproduction on the current code:
1. Start user --run <temporary run> --file <FIFO>.
2. While the CLI blocks reading the FIFO after saving its before length, append unrelated.event with another Pipeline.
3. Write "{" to the FIFO, causing JSON.parse to fail.
4. The CLI exits 1, but no operation.failed exists and status.failures is 0.

Actual output:
    {"exit":1,"failures":0,"error":"SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)"}

Use an invocation-specific indication that Pipeline.guard recorded this particular error, or record the CLI error independently. Ledger length only identifies activity, not ownership or successful error recording.

## Verification of the eight original paths

| Original issue | Current evidence | Disposition |
| --- | --- | --- |
| Stale ranking accepted after concurrent import | Actual child-process race with 2,401 live complaints and an intervening fixture import now rejects with stale conditional append. Gate remains rank_problems; stale selection fails; fresh rerank is mixed/ineligible. | Closed |
| Demand aliases/fixture provenance inflate live count | a/r1,a/r2,b/r2,c/r3,d/r4,e/r5 now counts four and spec acceptance fails. Identical fixture/live identity plus four live people also counts four. | Closed |
| Overlapping checks and attempt cap | Second in-flight green is refused; deployment is blocked while pending; exactly three green starts are permitted and a fourth is rejected. | Closed |
| Post-fingerprint error loses failed check | A failing test leaving a symlink produces check.completed with actual exit_code=1, passed=false and fingerprint_error. After removing generated output, deployment remains blocked. | Closed |
| Mutable node_modules bytes escape fingerprint | Changing the required dependency after green changes fingerprint and recordDeployment rejects the revision change. | Original closed; internal .bin compatibility regression above |
| Retained descendant pipes defeat timeout | Original detached-descendant reproduction with timeoutMs=100 returns failed/timed_out in 101 ms. The escaped one-second descendant was explicitly killed after the probe. | Closed |
| Complete trailing ledger record deletion accepted | Removing the last whole record now makes both read and append reject with checkpoint mismatch; no sequence is reused. | Closed |
| CLI parse/file errors have no receipt | Ordinary malformed JSON now exits 1 and records exactly one failure. Concurrent unrelated append still suppresses its failure, as reproduced above. | Partly closed |

The rank race output:
    {"messages":["ranking",{"success":false,"error":"Error: Ledger changed since the snapshot was read; stale conditional append rejected"}],"after_race_gate":"rank_problems","stale_selection_blocked":true,"new_rank_kind":"mixed","new_rank_eligible":false}

Other local checks:
    DEMAND_ALIAS fixed count=4 spec blocked
    DEMAND_PROVENANCE fixed count=4
    LEDGER_SUFFIX fixed read and append rejected
    CHECK_OVERLAP fixed second rejected, deployment blocked while pending
    POST_FINGERPRINT fixed actual exit1 preserved deployment blocked
    CHECK_ATTEMPT_CAP fixed 3 starts
    DEPENDENCY_MUTATION fixed fingerprint changed deployment blocked
    TIMEOUT fixed elapsed_ms=101
    CLI_PARSE fixed ordinary failure receipt=1

## Test run boundary

I ran npm test against the concurrently changing checkout. It reported 54 tests: 53 passed and one new GitHub-source import test failed with Unknown complaint source. That test is outside this follow-up scope and appears to be in-progress work; it is not evidence of a regression in these eight fixes. The combined npm test && npm run typecheck command did not run typecheck because that test failed. Root was informed immediately. The targeted original regression paths above were verified independently rather than inferred from the suite.

## Residual boundaries

The head checkpoint deliberately fails closed after inconsistent two-file writes and requires reviewed recovery. It does not protect a deliberate coordinated rollback of both ledger and head. The runner remains a local trusted-command runner; bounded return does not prove every independently detached descendant was killed. Arbitrary external executables/data supplied in argv remain outside app-tree identity. Ordinary source permission and demand truth remain operator attestations. No live customer app, paid result or deployed product was established here.
