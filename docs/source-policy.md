# Source policy

Checked against the primary sources below on **2026-10-22**. This records implementation constraints and unresolved rights questions; it provides no legal clearance. An official API does not automatically grant permission for commercial mining, redistribution, AI training, or indefinite retention.

## Supported paths

| Source | Current path | Required evidence |
| --- | --- | --- |
| Hacker News | Live adapter, disabled until the operator records a policy review | Purpose, terms URL and review date, operator acknowledgment, retention period, and any permission required for that use |
| Reddit | Authorized import only | Approval covering the use case and data, lawful provenance, permitted processing and retention |
| App Store reviews | Authorized import only | App owner or authorized team access, permitted processing and retention |
| GitHub issues/discussions | Authorized import only | A documented API/export or manual research path, permission for the proposed downstream use, source URL, collection time, and permitted retention |
| Forums | Authorized import only | The particular forum's terms, API/export permission, and permitted processing and retention |
| Synthetic fixtures | Local demonstration | Mark every record as synthetic; never count it as demand or measured market evidence |

An operator acknowledgment records a review; it does not override source terms or establish rights. Keep source text private unless redistribution is independently authorized. Importing a file does not remove the source's restrictions.

`github` is an accepted provenance value, not an included live collector. Public issue links in the research documents are bounded supporting anecdotes. They do not prove current defects, unique buyers, willingness to pay, or permission to contact authors. Do not copy full issue bodies or personal data into this public repository.

## Hacker News

The [official HN API](https://github.com/HackerNews/API) exposes public data at `https://hacker-news.firebaseio.com/v0/`. `askstories.json` returns up to 200 recent Ask HN IDs; `item/{id}.json` returns an item. The API documentation currently states no rate limit. Fetching comments requires separate calls. Handle missing, deleted, and dead items; treat returned HTML as untrusted text.

[YC Terms of Use](https://www.ycombinator.com/legal/) cover subdomains. The “Commercial Use” section restricts commercial copying and exploitation without express authorization. “Intellectual Property Rights” restricts copying, scraping, derivatives, and data mining. The public API documentation does not expressly resolve commercial content reuse. Keep that question open for the proposed purpose; do not claim that a policy toggle clears it.

Use bounded requests, timeouts, and backoff. Do not bypass blocks or rate limits. A connectivity/schema smoke can discard content in memory and retain only endpoint, status, timestamp, item ID, and item type.

## Reddit and Apple

Reddit's [Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy) requires explicit approval before API access and written approval for commercial use. Its [Data API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki) requires OAuth and warns that legacy guidance may be outdated. Apply the [Data API Terms](https://redditinc.com/policies/data-api-terms). Public JSON endpoints are not an approval substitute.

Apple's [Customer Reviews API](https://developer.apple.com/documentation/appstoreconnectapi/customer-reviews) is for apps accessible through the operator's App Store Connect account. It is not a general competitor review feed. [Listing reviews](https://developer.apple.com/documentation/appstoreconnectapi/get-v1-apps-_id_-customerreviews) supports a maximum page size of 200 and `links.next` pagination. [API access](https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api) requires signed JWTs and appropriate roles. [Rate limits](https://developer.apple.com/documentation/appstoreconnectapi/identifying-rate-limits) vary by key; read the response header and stop or requeue on HTTP 429. Do not hardcode Apple's example hourly limit as an entitlement.

## Provenance and retention

Record source ID and URL, collection/import time, source policy evidence, data mode, extraction version, and `retention_days`. Preserve the distinction between source text and an inferred problem or score. Omit usernames, profiles, contact details, and unnecessary personal information; review complaint text for embedded sensitive data before import.

**Automatic retention deletion is not implemented.** Recording `retention_days` does not schedule or prove deletion. The operator owns retention enforcement, source removal/deletion compliance, and removal of related exports and backups. Review those obligations before collecting data. Keep failed collection and policy-gate outcomes in the run log without retaining unnecessary content.
