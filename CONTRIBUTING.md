# Contributing

Use Node 24 and `npm ci --ignore-scripts`. Run `npm run typecheck` and `npm test` before proposing a change. Tests run offline and should cover observable behavior, particularly provenance, duplicate demand, stale state and failure preservation.

Include a failing behavioral test before fixing a gate bug. Preserve failed-run receipts. Never add tokens, private source records, real contact details or fabricated demand. Keep source adapters inside their official API/export permissions; read docs/source-policy.md.

Changes to model calls, spending, public posting, account access, deployment execution or data retention need an explicit design and operator authority. A passing local command does not establish production behavior or customer demand.
