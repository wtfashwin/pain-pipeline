# Security boundaries

This is a local workflow tool. The acceptance runner executes reviewed argv as the current user; it is not a sandbox and cannot contain hostile app code, external mutable inputs, network activity or detached descendants. Use an isolated environment for code you do not trust. The deadline returns a failed result even if a detached descendant escapes process-group cleanup.

Keep credentials and private complaint/demand records outside the repository. Do not put secrets in model prompts, command arguments or test output. Runs are private local files and are ignored by Git. Operator-supplied policy, user evidence, test mapping, model finish reason and deployment receipts are attestations, not independent verification.

The ledger uses a hash chain and durable head checkpoint to detect accidental corruption, suffix loss and stale writes. It does not stop an operator from rewriting both files, rolling back the entire run directory, or deleting it. A crash between event and checkpoint writes fails closed and requires reviewed recovery. Preserve both files before recovery; do not erase failed evidence or remove a live writer's lock.

Application fingerprints cover files and contained symlink targets inside the application tree, including installed dependencies, except Git internals and Finder metadata. Runtime binaries, external configuration/data/services and the operator's commands remain outside that fingerprint. Review them separately before release.

Source retention and deletion are operator-owned; no automatic retention job is installed. Public API access does not grant unlimited downstream rights. Report security concerns without including secrets or private user data in a public issue.
