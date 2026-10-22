# Complaint to MVP pipeline

A local pipeline for collecting authorized complaint evidence, ranking problems, recording a human choice, validating demand, and handing a tested MVP to a deployment operator. **The included demonstration uses fixtures. This repository does not establish real demand, paying users, or a deployed customer app.**

[Verification and known limits](docs/verification.md) · [Public problem research](docs/research/2026-10-22-paid-problem-plan.md) · [Research brief](evidence/paid-problem-brief.html)

## Run it

Requires Node 24 and npm. Dependencies are pinned in the lockfile.

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run demo
npm start -- help
```

`demo` creates a fresh `runs/demo-...` directory. Six synthetic source records become three ranked problems after deduplication. The run stops at human selection because fixture evidence cannot qualify for a live build. Repeat runs preserve earlier runs. Use `npm start -- status --run <printed-run-path>` to inspect a run.

## Stages and gates

| Stage | What runs | Required next evidence |
| --- | --- | --- |
| Collect | Authorized TOON imports; policy-gated official HN API | Source provenance and permission reference for live imports |
| Cluster and rank | ID/URL/copy dedupe; conservative token similarity; score = mentions × pain | Human annotations, <=8-hour scope, no regulated/hardware work, human choice |
| Validate and spec | Five distinct real demand records; strict model-output import; PRD and build handoff | Choice-matching TOON with 5–8 acceptance-test features and completed response |
| Build and release | Operator uses Codex/Claude; local argv test runner; reviewed red test, green checks | Same command, current app revision, explicit release authority and provider receipt |
| Learn | Append-only problems, apps, failures and outcome events | Actual usage, retention, negative feedback and payment receipts, if any |

The pipeline executes deterministic stages and test commands. It creates the Codex/Claude handoff instead of silently calling a paid model or executing generated instructions. `deployment-record` records an operator-reported deployment; it does not deploy or independently health-check a service.

## First live run

Review [source policy](docs/source-policy.md) first. Source collection defaults to disabled without a policy record. Official API availability is separate from permission for the proposed use. Reddit, App Store, GitHub and forum data currently use authorized imports; no raw scraper or credentials workaround is included.

```sh
npm start -- import --run runs/first-live --file /absolute/path/authorized-complaints.toon --permission-ref 'actual permission receipt'
npm start -- rank --run runs/first-live
```

Raw complaint fields are `id,text,source,url,collected_at,kind`. `source` is `hn`, `reddit`, `appstore`, `forum` or `github`; `kind` is `live` or `fixture`. IDs use 1–128 letters, digits, underscores, periods, colons or hyphens. Evidence URLs must use HTTPS without credentials, and collection times must be valid ISO timestamps. See [fixture syntax](examples/complaints.toon). Do not relabel fixtures as live records. Imports should omit usernames, contact details and sensitive text. A permission reference is an operator attestation, not an automated legal check.

After ranking, annotate the actual generated problem IDs using this TOON shape:

```text
assessments[1]{id,pain,wtp,gap,hours,regulated,hardware,basis}:
  p_REPLACE,8,null,null,4,false,false,"Actual evidence references and scope review"
```

Pain is 1–10; willingness to pay (`wtp`) and competitor gap (`gap`) are 0–10 or `null`. Unknown scope values are `null` and block selection. Scores need a real basis; no model infers willingness to pay. `mentions` counts deduplicated source evidence, not unique people. WTP and gap break score ties. Token clustering is conservative and heuristic; review merges before selection. New evidence can change representative IDs, so rerank and refresh annotations when needed.

```sh
npm start -- assess --run runs/first-live --file /absolute/path/assessments.toon
npm start -- rank --run runs/first-live
npm start -- select --run runs/first-live --id p_REPLACE --by 'human reviewer' --reason 'actual scope and demand review'
```

Record five real people using separate evidence files shaped like [user.json](examples/user.json). Keep stable pseudonyms and evidence references; do not put contact details in the ledger. Only `kind: live` records count, and duplicate IDs/references count once. This is human-attested evidence of confirmed pain, a committed trial or prototype use, not independently verified payment or five active users.

```sh
npm start -- user --run runs/first-live --file /absolute/path/actual-person.json
npm start -- prompt --run runs/first-live
npm start -- spec --run runs/first-live --file /absolute/path/model-response.toon --finish-reason stop
```

The prompt keeps the human's selection. It requests `choice`, `why`, `features`, `stack`, `cuts`, then `complete: true` as the final line. Only successful `stop` responses are accepted. Strict TOON decoding catches count/indentation errors; exact schemas, feature counts, finish reason and the completion marker reject incomplete envelopes. No format can prove that every syntactically complete response contains all intended reasoning. No token-savings claim is made; the [official TOON API](https://toonformat.dev/reference/api) supplies the encoder/decoder.

Accepted specs write new, non-overwritten `artifacts/<id>/spec.toon`, `PRD.md` and `BUILD.md` files. They remain ordinary local files: edits to those delivered files are not verified by status. The ledger binds downstream checks to the accepted decoded spec. Use the files in an existing authorized Codex or Claude Code session. Read the [build handoff](docs/build-handoff-template.md).

## Build checks and release receipt

Create a mapping JSON list such as `[{"feature":"Exact feature name","test":"acceptance.test.js"}]`, with one entry per spec feature. All mapped test files must exist inside the app folder. Map real tests, then inspect their coverage; a passing command alone cannot prove feature completeness.

```sh
npm start -- app --run runs/first-live --cwd /absolute/path/customer-app --mapping /absolute/path/mapping.json --by 'human test reviewer'
npm start -- check --run runs/first-live --phase red --argv '["node","--test","acceptance.test.js"]'
npm start -- review-red --run runs/first-live --id RED_EVENT_ID --by 'human reviewer' --reason 'Actual assertion failure review'
npm start -- check --run runs/first-live --phase green --argv '["node","--test","acceptance.test.js"]'
```

The initial red check intentionally exits nonzero. Review the saved output: import errors, syntax errors and infrastructure failures do not establish missing behavior. Green requires the same command as a reviewed red failure. At most three green attempts are reserved per app registration, and overlapping checks are rejected. Pending or failed checks block release. The runner caps output, enforces a deadline and attempts to kill the process group. An independently detached descendant can escape cleanup; the runner still returns a failed result by its deadline. It executes argv without a shell and provides a small environment, but **it is not a sandbox**. Run only reviewed local code; it still has the current user's filesystem and network permissions. Never include secrets in test output.

Checks fingerprint app, test, lockfile and installed dependency bytes, including `node_modules`; Git internals and Finder metadata are excluded. Contained symlinks such as npm `.bin` links are accepted and their identity is hashed, while their target files are covered by the tree walk. Broken links and links outside the included app tree are refused. Sources changing during/after checks invalidate a pass. Use a reproducible lockfile/install: hashing bytes does not prove a dependency safe or bind external runtimes, data, configuration or services. Apps are limited to 2,000 regular files, 64 MiB total and 5 MiB/file. Keep generated caches/output outside the fingerprinted app or make the suite clean them before exit. Replacing the spec or selection invalidates downstream records. Failed checks remain visible, including actual runner results when the post-check fingerprint fails.

After an authorized operator actually deploys the exact passing revision:

```sh
npm start -- deployment-record --run runs/first-live --url https://actual-app.example --authority 'explicit release authorization reference' --receipt 'actual provider deployment id'
npm start -- outcome --run runs/first-live --result 'Observed result' --evidence 'actual metric/interview/receipt reference'
```

## Evidence storage and limits

Each run has private `events.jsonl` and `head.json` files with sequence numbers, timestamps, IDs, a SHA-256 chain, a durable expected-head checkpoint and an exclusive writer lock. Reads/writes reject damaged records, missing complete trailing events, and mismatched checkpoints. Workflow decisions use conditional append against the input head, so an intervening writer cannot silently make a stale decision current. An operator can deliberately rewrite both files or roll back a whole run directory; this is integrity detection, not tamperproof storage. A crash between event and checkpoint writes fails closed and needs reviewed recovery. Preserve both files and any locks before recovery. Never delete a live writer's `.ledger.lock` or `.check.lock`.

Known CLI operation failures create receipts, including file/JSON parsing failures. An invocation-specific marker avoids double-recording errors already captured by the workflow; unrelated writer activity does not suppress a receipt. Recording remains best-effort if the ledger is already damaged or locked, and the CLI still exits nonzero. Keep the damaged ledger and terminal output. Help and unknown commands do not create runs. Older runs without a head checkpoint require reviewed migration and are preserved rather than silently upgraded. Source `retention_days` is metadata: automatic deletion and source-removal compliance are not implemented, so the operator must enforce retention before collecting real data. Do not publish run directories or private evidence.

Current limits: no paid model calls, automatic customer-app builder daemon, public outreach, Reddit/App Store live adapters, hosted service or automatic deployment. Human input is intentional at source permission, problem selection, demand validation, red-test review and release authority.
