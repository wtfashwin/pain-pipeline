# Verification

Final local QA ran on **2026-10-22**, using Node **24.19.0** and npm **11.17.0**. These checks establish the tested local behavior. They do not establish customer demand, paid outcomes, source reuse rights or a deployed customer app.

## Checks

| Command or check | Observed result |
| --- | --- |
| `npm ci --ignore-scripts` | Passed; five packages installed; npm reported zero known vulnerabilities at that time. This is not a security audit. |
| `npm test` | **56 tests passed, zero failed, zero skipped.** All tests run without API credentials or paid calls. |
| `npm run typecheck` | Passed. |
| `npm run demo` | Passed in a fresh run directory. Six fixture records produced three problems with five deduplicated mentions. Every problem remained ineligible. |
| Fresh demo ledger read | Five events and a matching durable head checkpoint; zero live records, zero real users, no selection, spec, app, check or deployment. Next gate: `human_selection`. |
| `hn-probe` | Passed at **2026-10-22T15:35:49.985Z** against `https://hacker-news.firebaseio.com/v0`; item ID **50193416**, type **story**, `ok: true`. Only connectivity/schema metadata was retained. |
| Git whitespace check | `git diff --check` and `git diff --cached --check` passed before publication. |
| Public file scan | Filename-only scans found no credential-shaped values, private user records, local home paths or employer email in the publication set. Ignored local logs and runs were excluded. |

The API probe is separate from the offline suite. It fetched an ID list and one item in memory, discarded content and author data, and persisted only the metadata above. It does not prove complaint relevance, ongoing availability or permission for commercial reuse. No live complaint collection ran during final QA.

The fresh fixture demo and metadata probe have current checkpoints. Earlier local runs without a checkpoint remain preserved locally and are not silently migrated. Run directories, helper scripts and raw failure/review logs are ignored by Git. This document records bounded metadata; it contains no copied live complaint bodies or private demand records.

## Review findings and regression coverage

The [initial independent review](../evidence/independent-review.md) found eight defects. Its [scoped follow-up](../evidence/review-followup.md) found two residual issues in the first fixes. Both documents preserve the earlier observations and now link here. All ten paths have fixes and regression coverage in the final passing suite:

| Finding | Final behavior and regression coverage |
| --- | --- |
| Stale ranking after concurrent import | Conditional append rejects decisions computed from an outdated ledger head. Covered by ledger snapshot/conditional-append tests. |
| Demand aliases and fixture relabelling inflate real users | Connected ID/reference aliases are counted once and fixture provenance blocks the whole identity component. Covered by demand gate and transitive-alias tests. |
| Concurrent checks finish out of order or bypass the attempt budget | A check reserves a start record and exclusive check lock; pending checks block release; green starts are capped at three. Covered by overlapping acceptance/attempt tests. |
| A post-check fingerprint error loses the failed runner result | The actual result is retained with a failed check and fingerprint error; an older pass cannot authorize release. Covered by the post-check fingerprint regression. |
| Mutable installed dependencies escape the fingerprint | Installed dependency bytes are hashed and a change invalidates the app revision. Covered by the dependency mutation test. |
| Detached descendants hold output pipes beyond timeout | The deadline closes pipes and returns a failed result. Covered by the retained-pipe descendant test; escaped descendants remain outside sandbox guarantees. |
| Complete final ledger events can disappear unnoticed | A durable head checkpoint rejects suffix loss, missing/empty event streams and stale or corrupt checkpoints. Covered by ledger truncation/checkpoint tests. |
| CLI file/JSON errors lack failure receipts | Known operation dispatch records failures, including malformed input. Covered by CLI parsing tests. |
| Normal npm `.bin` links prevent app checks | Contained links work; escaping and broken links are refused. Link identity and target-tree bytes affect the fingerprint. Covered by the contained npm-bin-link regression. |
| An unrelated writer suppresses a CLI error receipt | An invocation-specific recorded-error marker replaces event-count inference. Covered by the concurrent FIFO/CLI parsing regression. |

The suite also covers strict TOON schemas and completion envelopes, GitHub issue provenance imports, conservative clustering, fixture/mixed eligibility, stale selection/spec behavior, nonzero exits, output bounds and source policy gates. Earlier failing checks remain in ignored local logs rather than being overwritten or presented as successful runs.

## Remaining limits

- Evidence, permissions, real-user attestations, red-test reviews and deployment receipts come from the operator. The tool does not independently audit their truth. Five demand records are a workflow gate, not a representative market sample.
- Token clustering is heuristic. New evidence can change a representative problem ID and require fresh annotations and selection. Mentions are evidence records, not unique buyers.
- The runner executes trusted local argv as the current user. It is not a sandbox. App fingerprints include installed dependency bytes, but external binaries, configuration, data, services and independently detached descendants remain outside that boundary.
- The ledger detects damage and suffix loss while its checkpoint remains intact. Rewriting or rolling back both files, or deleting the entire run directory, defeats that protection. A crash between event and checkpoint writes needs reviewed recovery.
- Accepted handoff files are created without overwriting earlier artifacts, but remain editable local files. Status does not verify their delivered file bytes. A failed append may leave unreferenced artifact files to inspect.
- Retention and source-removal compliance are manual. There is no paid model loop, automatic outreach, customer-app builder daemon, source scraper or deployment executor. GitHub, Reddit, App Store and forum records use authorized imports.
- The public research plan and HTML brief are dated hypotheses with source links. They establish no interviews, committed buyers, payment or product usage.

Repository CI runs the same install, typecheck, tests and fixture demo on Node 24. Consult the workflow run for its actual remote result; local checks alone do not prove CI passed.
