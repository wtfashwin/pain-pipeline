> **Historical review — findings resolved.** All eight initial issues and both residual issues from the scoped follow-up now have fixes and regression coverage. See [final verification and remaining limits](../docs/verification.md). The original review below is preserved as the record of what failed before those fixes; its completion assessment describes that earlier revision.

# Independent whole-project review

Reviewed 2026-10-22. Scope: the local complaint-to-MVP pipeline, design spec, all src/*.ts and tests. Read-only source review plus isolated temporary local reproductions; no code changes, source collection, sends, paid calls, or deployment. Local deployment-record reproductions only wrote synthetic operator-reported receipts to temporary ledgers. CodeRabbit was not run because its API step conflicts with the local/no-external-actions review scope.

The existing 42 passing tests and typecheck establish their tested paths. The following untested paths break release/demand/freshness guarantees and should be fixed before calling the reusable pipeline complete.

## Important defects

### 1. P1 — A ranking computed from stale input becomes fresh if an import completes during ranking

Source: src/workflow.ts:26–38, 57–59; src/ledger.ts:108–142.

The workflow reads inputs, computes ranking outside the ledger lock, and then appends. Freshness only compares the ranking event sequence with the latest import sequence. A concurrent import can therefore precede the append even though the computation never saw it. The old result is treated as fresh and can be selected.

Observed with a real child process: started ranking 2,401 live complaints, imported a fixture copy of the original complaint while it ranked, then let ranking finish. The fixture import was seq 5 and the stale ranking seq 6. The original problem remained kind live, eligible true, and selection succeeded. An immediate rerank correctly made it mixed and ineligible.

Reproduction outline:
1. Import one live complaint, rank, and assess its pain=8/hours=4/regulated=false/hardware=false.
2. Import 2,400 distinct live complaints to make ranking long enough for overlap.
3. Fork a Node process that sends an IPC signal immediately before pipeline.rank().
4. On that signal, use another Pipeline on the same run to import the original complaint as fixture.
5. Await the child and select the original problem from its stale ranking.

Actual output:
    {"latest_import_seq":5,"rank_seq":6,"stale_rank_kind":"live","stale_rank_eligible":true,"selection":"p_133560839201aef2","actual_kind_after_rerank":"mixed"}

Fix direction: bind rankings to an immutable input head/hash and verify that head under the append lock, retrying/rejecting on change. Serializing event appends alone does not serialize workflow transactions. Apply the same compare-and-append discipline to other gate decisions.

### 2. P1 — Demand aliases and conflicting fixture provenance can unlock five-user gate

Source: src/workflow.ts:42–44, 67–74.

The greedy count only adds IDs/references for records it counts. It forgets aliases from skipped records, and it discards all fixture observations before deduplication. This both inflates connected identities and allows a known synthetic identity to be relabelled live.

Observed alias reproduction after a valid human selection:
    a/r1 live, a/r2 live, b/r2 live, c/r3 live, d/r4 live, e/r5 live
The second record is skipped; r2 is never registered, so b/r2 counts. There are four connected ID/reference components but status reports five and acceptSpec succeeds.

Actual output:
    {"count":5,"accepted":"spec.accepted","distinct_alias_components":4}

Observed provenance reproduction:
1. Add id fixture-user/reference fixture:known-synthetic-person as fixture.
2. Add the identical record with kind live.
3. Add four other distinct live records.
Status reports real_users=5 and next_gate=accept_spec.

Fix direction: union records sharing either normalized ID or reference, including aliases from otherwise duplicate records. Carry provenance across the whole connected component; conflicting fixture/live identity must remain ineligible unless an explicit reviewed correction mechanism resolves it. This is deterministic deduplication, not an independent audit that a real human exists.

### 3. P1 — Overlapping acceptance runs finish out of order and bypass attempt budget

Source: src/workflow.ts:91–103, 112–114, 124–130.

Checks reserve no start event or in-flight state. The three-attempt count only sees completed greens, and the latest check is chosen by completion order. An older slow passing run can overwrite a newer failed run's gate. Deployment can also be recorded while another run is active, based on a previous pass.

Observed with the same argv and unchanged app bytes, using a temporary external control file so the first run passed slowly and the second failed quickly:
    older started 2026-10-22T15:17:11.511Z
    newer started 2026-10-22T15:17:11.614Z
    newer failed true
    older passed true
The older result appended last and deployment.recorded succeeded. Separately, Promise.all of five green checks recorded all five although the bound is three.

Fix direction: reserve an attempt/start event atomically before launch; count reserved attempts; serialize acceptance checks per app/spec or explicitly supersede older runs. Block release while a check is active, and do not let an older run's late completion clear a later failure.

### 4. P1 — Post-run fingerprint failure loses the actual failed check and revives an old pass

Source: src/workflow.ts:100–104, 112–114.

The result is not persisted until after fingerprintTree succeeds. If the command leaves an unsupported output (for example a generated symlink), fingerprintTree throws. Only operation.failed is saved; the executed command's argv/output/exit status are lost, and deployment considers the old passing check current.

Observed:
1. Record a reviewed red and passing green.
2. Run the identical argv again; it creates generated-link -> test.cjs and exits 1.
3. check rejects with "App fingerprint refuses symbolic links".
4. Remove that generated output, restoring the exact prior app bytes.
5. recordDeployment succeeds based on the old pass.

Actual output:
    {"error":"Error: App fingerprint refuses symbolic links","check_count":2,"operation_failure":{"operation":"check","error":"Error: App fingerprint refuses symbolic links"},"release":"deployment.recorded"}

Fix direction: save the launched attempt and actual runner result even when revision collection/postprocessing fails. Such a result must fail closed and invalidate release eligibility. A check failure must not be represented solely as an unrelated generic error.

### 5. P2 — Mutable installed dependencies are outside the release fingerprint

Source: src/runner.ts:39–55; src/workflow.ts:100–114.

Every node_modules directory is ignored. The passing check binds only to app/test/lockfile bytes, while the command actually executes mutable dependency bytes. Changing installed runtime code after a pass is invisible to status and deployment recording.

Observed with test.cjs executing require("./node_modules/state.cjs"):
1. state.cjs exports 1 for reviewed red.
2. Change it to 0 and record passing green.
3. Change it back to 1.
The fingerprint remains identical and deployment.recorded succeeds although the same command would now fail.

Actual output:
    {"fingerprint_unchanged":true,"next_gate":"measure_outcomes","deployment":"deployment.recorded"}

Fix direction: bind evidence to the executed dependency environment (for example an immutable verified install/build artifact), or verify an appropriate dependency tree digest before release. If intentionally out of scope, narrow "exact app revision" and release claims and require an explicit environment validation gate. App-tree hashing also cannot bind arbitrary external executables/data supplied in argv; this needs a stated trust boundary.

### 6. P2 — Timeout does not bound the runner if a descendant retains its pipes

Source: src/runner.ts:20–34.

The timeout kills the original process group but waits exclusively for child close, which waits for inherited stdout/stderr to close. A detached descendant can outlive that process group and hold those pipes open, leaving the promise unresolved beyond timeout.

Observed argv:
    [node, "-e", "const {spawn}=require('node:child_process');spawn(process.execPath,['-e','setTimeout(()=>{},1000)'],{detached:true,stdio:['ignore',1,2]}).unref();"]
With timeoutMs=50, runAcceptance returned after 1,051 ms with timed_out=true. An indefinitely running detached descendant makes the runner wait indefinitely. This reproduction used a one-second child, so no live process remained.

Fix direction: enforce a bounded post-timeout cleanup deadline, close/destroy pipe streams and settle a failed result after it; use the strongest feasible process-tree cleanup. Preserve honest cleanup/descendant limitations because this runner is explicitly not a sandbox.

### 7. P2 — Whole-record suffix truncation is silently accepted

Source: src/ledger.ts:69–105, 119–140.

The hash chain rejects modified records and missing middle records, but has no independent expected head/length. Removing complete trailing newline-terminated records leaves a valid prefix; an empty/deleted ledger is also accepted as a new run. This can silently erase a last failed acceptance result and revive an earlier pass.

Observed: append events one and two, rewrite events.jsonl with only the first whole line, call read(), then append three:
    {"read_count":1,"append_seq":2}

Fix direction: add a durable expected-head/checkpoint outside the append stream with a defined crash recovery protocol if full-record truncation detection is required. Otherwise explicitly narrow the design/README claims: a standalone hash chain cannot detect rollback to a valid prefix. This is distinct from protection against a deliberate full rewrite, which the code already disclaims.

### 8. P2 — CLI argument/file parsing failures bypass the failure ledger

Source: src/cli.ts:40, 49–56, 64–66.

File reads, JSON parsing and several required-option lookups occur before entering Pipeline.guard. The CLI catch only records HN failures. A known workflow command can fail without any operation.failed receipt, leaving status.failures unchanged.

Observed:
    node src/cli.ts user --run <existing temporary run> --file <file containing "{">
Exit status is 1, stderr reports SyntaxError, but pipeline.status().failures is 0. The same shape applies to malformed --argv JSON, missing mappings and missing files.

Fix direction: wrap known command dispatch in a shared CLI failure recorder (avoid double-recording Pipeline.guard failures), preserving operation and sanitized cause. Help/unknown-command behavior can remain non-mutating.

## Minor limits and confirmed boundaries

- Accepted artifact files are created with wx and unique directories, so this implementation does not overwrite them. They are ordinary editable files, not cryptographically verified immutable artifacts: status does not detect edited/deleted spec.toon, PRD.md or BUILD.md, and the ledger's spec_hash hashes decoded JSON rather than delivered file bytes. At minimum describe this accurately; stronger artifact verification would improve consistency.
- A failed spec append can leave unreferenced artifact files because files are written before the ledger event. No existing accepted artifact is overwritten, but recovery/inspection should distinguish an orphan from an accepted handoff.
- Source policy is operator-attested. collectHN validates policy before requests; manual import only requires a nonempty permission reference and does not independently prove authorization, retention or source ownership. That matches an authorized-export interface if clearly labelled; it is not rights verification.
- The spec parser correctly requires strict TOON, exact fields, 5–8 distinct feature names, a final complete:true marker and finishReason stop. The CLI lets the operator supply the reason; this is a contract boundary rather than verified provider metadata. No local parser can prove every semantically truncated but syntactically valid response complete.
- Acceptance mapping validates file existence and feature coverage, but a human review still owns whether the files and chosen command actually test the intended behavior. The command runner is not a sandbox; tests can use external mutable inputs and perform side effects.
- HN collection gathers Ask HN candidates, not automatically validated complaints. The CLI receipt correctly says relevance review remains necessary.
- No real demand, buyer, payment, app release or remote deployment was established by this review.

## Completion assessment

The reusable local pipeline exists and its basic fixture/strict-parser/gate paths work. It is not ready to call complete against its own freshness, distinct-demand, bounded-runner and failure-preservation guarantees until the important defects above are resolved or the unsupported guarantees are explicitly narrowed.

A live customer app remains a separate outcome. It still requires a human-selected eligible problem, source permission for the concrete use, at least five distinct real demand records, a reviewed spec and app, genuine passing acceptance evidence for the release artifact/environment, explicit deployment authority and a real provider receipt. An offline demo or local synthetic workflow test establishes none of those live outcomes.
