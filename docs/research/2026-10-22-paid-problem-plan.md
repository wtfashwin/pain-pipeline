# Paid problem plan: manual invoice follow-up

**Checked: 2026-10-22. Recommendation: test an overdue-invoice follow-up tracker for freelancers and small agencies before building it.** This is a commercial hypothesis, not validated demand. The evidence does not show a problem faced by most people.

## Context and seller baseline

Scope: everyday manual admin work; three candidates that could fit an eight-hour MVP. Research uses public primary sources only. There is no named customer or active deal. No interviews, price commitments, paying users, or product-specific outcomes were established. A working pipeline would provide execution infrastructure; it would not prove demand for the proposed app.

## Shortlist

| Candidate | Evidence and limitation | Competitive pressure | Decision |
| --- | --- | --- | --- |
| Overdue-invoice follow-up tracker | Government research quantifies business burden; a user reports reminder setup difficulties. Neither establishes demand for another tracker. | Low-cost invoicing software already includes reminders; specialist products automate receivables. | First hypothesis: test a manual review queue for people keeping their existing invoicing workflow. |
| CSV cleanup/import diagnostics | Recent first-person reports show slow import iteration and a reproducible blank-key matching issue. Population prevalence and standalone utility spending remain unknown. | Paid importers already offer validation, mapping, and private processing. | Backup: test a specific destination/schema before building a generic cleaner. |
| Job-application follow-up tracker | No sufficiently reliable independent first-person timing complaint was established in this bounded search. | Teal provides unlimited job tracking for free; its paid tier bundles broader career tools. | Defer a tracker-only paid product. |

## Evidence of pain and frequency

The UK government's July 2025 report estimates that **28% of UK businesses** were affected by late payment and **22%** used staff time to pursue unpaid invoices. Its estimate is **86 hours annually per affected business**. The survey had 1,455 responses and ran in January–February 2025, asking about the previous year. These are UK business estimates, not global freelancer prevalence or evidence that this app improves collection. [Government publication](https://www.gov.uk/government/publications/late-payments-research-impact-on-the-uk-economy), [full report, printed page 8 and methodology](https://assets.publishing.service.gov.uk/media/688a089a6478525675738ff9/late_payments_research_impact_on_uk_economy.pdf).

First-person public evidence is directional:

- An Invoice Ninja user reported in February 2026 that configured reminder rules produced no messages or useful log evidence. This is an unverified user report about setup/reliability, not proof of a current reproducible defect or switching intent. [Discussion #11636](https://github.com/invoiceninja/invoiceninja/discussions/11636).
- A Grist user described repeated waits while changing CSV import options in September 2026. [Issue #2556](https://github.com/gristlabs/grist-core/issues/2556).
- A Grist report describes repeated CSV merges creating extra records when matching columns contain blanks; a maintainer reproduced the behavior in August 2024. This supports a narrow diagnostic use case, not a broad cleanup market claim. [Issue #1162](https://github.com/gristlabs/grist-core/issues/1162).

These reports are not interview participants, demand records, or permission to contact their authors. No full source bodies are retained here.

## Competitor snapshots

Prices below are the official offers visible on the checked date, in the displayed currencies. Taxes, eligibility, and checkout totals were not verified. Posted prices demonstrate category monetization attempts; this research does not establish customer counts or willingness to pay for our proposal.

| Product | Confirmed public offer | Buyer appeal / where it is stronger in scope | Testable response and landmine |
| --- | --- | --- | --- |
| [CSVbox](https://csvbox.io/pricing/) | Startup: **$16/month billed yearly**, 1,000 imports/month and 10,000 rows/import; mapping and validation are advertised. | An embedded importer with delivery integrations addresses SaaS onboarding. | A local diagnostic utility serves a different job. Do not call privacy or validation an absent competitor feature. |
| [Dromo](https://dromo.io/pricing) | Professional: **$599/month**, 250 production imports included, then $3/import; validation and private mode are advertised. | Developer integration and configurable import workflows extend beyond a one-day utility. | Test destination-specific diagnostics; do not equate its price with utility-buyer willingness to pay or assert a security gap. |
| [Invoice Ninja](https://invoiceninja.com/pricing-plans/) | Pro: **$14/month billed monthly**, including automated late-payment reminders. A five-client free tier is available. | Invoicing, client records, payments, and reminders share a system. | Test whether users want an external manual queue without migration. Do not claim reminders are unavailable or require an expensive specialist service. |
| [Chaser](https://www.chaserhq.com/chaser-pricing) | Compact: **from £199/month**, UK monthly display; four users and automated receivables workflows are listed. | Its receivables automation is broader than a manual tracker. | Ask whether automation is wanted; if yes, our manual scope may lose. Do not claim equivalent capability at a lower price. |
| [Teal](https://www.tealhq.com/pricing) | Teal+: **$29 per 30 days**; unlimited job tracking is included in the free offer too. | Free tracking plus a paid resume/career bundle raises the bar for a paid standalone tracker. | A follow-up niche needs direct price evidence. Do not attribute Teal+ spending to job tracking alone. |

There is no verified unmet competitor gap. The proposed separation is **human control, an explicit next-action record, and no migration from existing invoices**. Whether those are useful enough to pay for is the question to test.

## Five-user demand test before implementation

Recruit five actual freelancers or small agency operators who issue invoices and personally manage follow-ups. This plan does not authorize outreach or any network send. Keep research participation and contact details private.

For each person, record a participant ID, date, evidence reference, recent example, current workflow, invoice volume band, minutes spent, consequences, existing software, and a negative response if given. Use redacted examples; do not collect client identities, bank details, or invoice documents unnecessarily.

1. Ask them to walk through their most recent overdue invoice, not rate the idea. Identify missed next actions separately from a customer's inability or refusal to pay.
2. Show a paper/local mock queue and manually complete one review cycle with their redacted example. Check whether the due action is correct and understandable.
3. Ask why their current invoicing tool or spreadsheet is insufficient. If existing software solves it, record that outcome.
4. Test **US$5/month as a proposed price**, or one explicitly recorded local-currency equivalent chosen before the interview. This is an experiment price, not market evidence. Ask whether they would commit to a two-week pilot at that price; do not charge them without separate authority.
5. Obtain five real records and a human selection decision. Proceed only if at least three describe recurring follow-up admin pain and at least two give explicit, recorded interest in the priced pilot. These thresholds are proposed decision rules, not validated conversion benchmarks. Product demand remains unverified until actual use and outcomes are observed.

**Kill or revise the hypothesis** if those thresholds fail; if the main problem is cash shortage/disputes rather than forgotten admin; if users need accounting sync, payment processing, automatic sending, legal escalation, or multi-user access to get value; or if manual entry duplicates more work than it saves. Five interviews are directional and cannot estimate market prevalence.

## Proposed eight-hour MVP after the gate

One local browser app for a single operator. Deterministic templates are sufficient; no model calls are required. Store only synthetic data during development. No payment execution, interest calculation, tax/legal advice, accounting integration, automatic emails, scraping, or production deployment.

| Feature | Priority | Observable acceptance test |
| --- | --- | --- |
| Bounded CSV import | Must | A UTF-8 file with invoice ID, client alias, amount in minor units, currency, due date, and state imports; missing fields, duplicates, malformed dates, and files over the agreed limit show row-specific errors without committing a partial import. |
| Manual invoice entry/edit | Must | Create a valid invoice, edit its due date, reload, and see the exact saved values; invalid amounts cannot be saved. |
| Overdue review queue | Must | With an explicit test date, unpaid invoices before that date appear; invoices due today, future invoices, paid invoices, and archived items are excluded. |
| Next action and history | Must | Record a follow-up date and action; reload and see both the next action and timestamped history. Editing history is not presented as proof that a message was sent. |
| Human-reviewed reminder draft | Must | An explicit click creates an editable draft with the correct invoice details; copying it records only a copy action and triggers no network send. |
| Settled/disputed controls | Must | Mark an invoice settled and it leaves the follow-up queue. A disputed invoice is visibly held for human review and never gets a stronger draft automatically. |
| Export and clear | Must | Export and reimport a fixture without losing values; after confirmed local clear and reload, the saved invoice list is empty. No secrets or invoice contents appear in diagnostic logs. |

Suggested timebox: 1 hour for schema and red acceptance tests; 2 hours for import/persistence; 2 hours for the queue, actions, and drafts; 1 hour for export/clear; 2 hours for accessibility, regression checks, and a local demo. This is an estimate. Stop after three repair attempts for an unresolved failure, preserve the failed checks, and cut scope with human review instead of weakening tests.

## Response strategy and proof

Say: the tool helps an operator decide which invoice needs a manual follow-up and retain the next action. Clarify whether that admin task is actually painful enough to pay for. Prove correct queue behavior and measured time to finish a review using redacted examples. Do not promise faster payment, recovered revenue, universal demand, a security certification, or validated savings.

Next action: complete the five-user evidence test and human choice before turning this proposal into an app repository/build. Repository publishing and all GitHub writes belong to the verified `wtfashwin` identity; this research performed no external writes.

## Confidence, source posture, and gaps

Public official pricing and UK business burden are well grounded. Proposed positioning, price, workflow fit, and eight-hour effort are hypotheses. GitHub anecdotes are limited and may reflect historical or configuration-specific behavior. No representative CSV/job-tracking frequency estimate or direct willingness-to-pay evidence for any proposed product was established.

Used: user-specified workflow categories, official vendor pages, government research, and public first-person GitHub reports. CRM, internal messaging, meeting transcripts, sales-intelligence enrichment, private customer data, and outreach were not used because this is public category research. No connector limitation is implied. No user data, sources' full content, or private credentials should be added to the repository.
