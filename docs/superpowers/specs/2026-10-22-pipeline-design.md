# Complaint to MVP pipeline

Ashwin delegated the supplied four-stage pipeline as a goal. Build the reusable local pipeline first. A new customer app remains gated by a human choice, actual demand evidence, a passing acceptance suite and a separately authorized deployment. There is no existing project to modify.

Builder decisions: Node 24, TypeScript, the pinned official TOON SDK, Node's test runner, local files and a hash-chained append-only ledger. No paid model or hosting calls. TOON carries flat homogeneous stage lists; JSON carries nested operational records. The CLI is the first interface. This keeps the workflow inspectable and usable by either Codex or Claude Code.

## Required behavior

1. Import validated complaints with source URLs and live/fixture provenance. HN collection uses its official API, explicit policy acknowledgement, bounded requests, timeouts and no author profiles. Reddit, App Store and forums require authorized exports or future approved API adapters; credentials or access are never guessed. Collection failures are recorded. Source terms and commercial reuse remain an operator responsibility.
2. Deduplicate repeated IDs/URLs and exact normalized copies, then conservatively group token-similar complaints. Count deduplicated evidence records as mentions, never users. Rank by mentions*pain; willingness to pay and competitor gap are separate evidence-backed annotations/tiebreakers, never invented. Missing annotations are visible. Exclude regulated, hardware or >8-hour work; unknown scope stays ineligible. A person selects one eligible problem with a reason.
3. Require five distinct real user evidence records before accepting a build-ready spec. Fixture users never qualify. A PRD has one choice, why, 5–8 features with acceptance tests, stack and cuts. Spec TOON uses strict decoding, 2-space indent, exact field validation and a mandatory `complete: true` marker. A model response with a non-success finish reason is rejected. This catches invalid/truncated output while acknowledging no parser can detect every valid-prefix truncation without an envelope.
4. Produce a one-page PRD, TOON spec and Codex/Claude handoff. Handoff requires tests first, observed failing tests, bounded repair attempts, test results bound to a spec/app revision, honest failures and no secrets. Arbitrary model text is never executed as a shell command. An operator can run a local acceptance command as argv without a shell, with timeout and output bounds; failed/timeout results cannot authorize deployment. Deployment records require matching passing checks and explicit authority. Public outreach and deployment are prepared but not performed in this goal without the missing human decisions.
5. Record imported problems, rankings, selection, demand, specs, apps, checks, deployment and failures as immutable events. Verify the hash chain before reads/writes and reject corrupt or truncated ledgers; serialize writers. Do not overwrite artifacts or erase failed checks. Status displays the precise next gate and live versus fixture counts.

## Limits and honest labels

The fixture demonstration proves mechanics, not demand or commercial usefulness. A live API probe proves connectivity, not permission for unrestricted commercial reuse. No claimed users, payment, app release or hosting deployment unless receipts exist. One day means an eight-hour UI/CRUD-sized customer app, not the pipeline's elapsed build time or IRIS-scale work. A source record is evidence of a complaint, not a unique buyer. The workflow deliberately does not autonomously pick for the human or post publicly.

## Acceptance gates

- Malformed, count-mismatched, extra-field, wrong-type, unfinished model outputs fail before state mutation.
- Reimports do not inflate mentions; unknown scope cannot pass selection.
- Four users, duplicate users and any fixture users cannot open the live build gate.
- Changing selection or spec invalidates downstream checks/deployment eligibility.
- A failed/timeout acceptance run is logged and blocks deployment; previous passes cannot hide it.
- Tampered/truncated ledgers and simultaneous writers cannot silently lose events.
- Offline demo and tests run without API credentials, paid calls, sends or public deployment.
