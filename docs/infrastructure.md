# ADSO AI-First Reviewer Infrastructure

## Recommended baseline

Use managed, replaceable primitives behind a container boundary. The baseline is intentionally provider-neutral and suitable for local development, a staging pilot, and production.

| Layer | Baseline | Responsibility |
|---|---|---|
| Web/API | Containerized application | Browser-facing review workspace and authenticated HTTP API; session/CSRF or equivalent request protection; server-side authorization for every workspace, role, source, URL, evidence, report, and history operation |
| Worker | Containerized worker pool | Extraction, specialist jobs, orchestration, retries |
| Database | Managed PostgreSQL-compatible service | Transactional state, snapshots, audit metadata |
| Queue | Durable managed queue | At-least-once job delivery and delayed retries |
| Object storage | S3-compatible bucket | Original sources, derived artifacts, generated reports |
| Cache/coordination | Optional Redis-compatible service | Rate limits and short-lived progress fan-out, never canonical state |
| Model access | Internal AI gateway | Ollama Cloud is the initial approved infrastructure adapter; the gateway owns policy, usage/provenance, redaction, and structured-output validation |
| Observability | OpenTelemetry-compatible metrics/logs/traces | Correlation, latency, failures, cost, queue health |

## Environments

### Local
Docker Compose may provide PostgreSQL, an S3-compatible emulator, a queue emulator, and a fake AI gateway. Use synthetic sources only. Local mode must work without external model credentials and can roll back from Ollama Cloud behavior to the deterministic fake gateway.

### Staging
Use isolated workspace and buckets, masked/synthetic data, real migration and backup paths, a deterministic fake model for CI, and Ollama Cloud only through the approved gateway adapter for explicitly authorized non-production exploratory runs. Provider credentials are injected from environment-specific secret management; they are never committed or copied into configuration files.

### Production
Use private networking where available, managed database backups and point-in-time recovery, versioned object buckets, least-privilege service identities, secret-manager integration, malware scanning, WAF/rate limiting, and separate model credentials per environment. Inject the Ollama Cloud API key at runtime through the environment's secret manager or protected environment variables; never place it in source control, prompts, reports, fixtures, or logs.

## Deployment topology

```text
Browser -> Internet -> CDN/WAF -> Web/API (N replicas)
                                  |-> PostgreSQL (private)
                                  |-> Queue -> Worker autoscaling (N replicas)
                                  |-> Object storage (private, signed access)
                                  |-> Server-side URL retrieval boundary
                                  |-> AI gateway -> approved provider or institution endpoint
```

The browser is an untrusted client and never receives broad storage or workspace authority. The Web/API authenticates each request, authorizes it against workspace membership and role, and issues only short-lived, scoped access where needed. The API accepts commands quickly and returns a review/job identifier. Workers own long-running work. Health checks distinguish process health, dependency readiness, and queue liveness.

## Data and lifecycle controls

- Store source bytes and generated artifacts in versioned, workspace-prefixed object keys.
- Store only metadata and provenance in PostgreSQL; never put large files in rows.
- Run migrations forward and make them backward-compatible for one deployment window.
- Encrypt database, buckets, backups, and queue payloads where supported.
- Apply configurable retention by workspace. Deletion is an asynchronous, auditable workflow that removes original sources, source versions, extracted evidence, agent artifacts, findings, reports, indexes, and other derived objects before closing.
- Back up the database daily with point-in-time recovery; test restore quarterly. Object storage version retention follows the workspace policy.
- Queue messages contain IDs and approved references, not secrets or unnecessary source contents.

## Secure HTTPS and Notion source retrieval

The MVP accepts public HTTPS sources, including public Notion pages. Retrieval is a server-side capability of the source service, never a browser-side fetch and never an unrestricted worker network call.

- Maintain an explicit host allow-list for supported public sources; require HTTPS and reject credentials, unsupported schemes, malformed URLs, and unsafe ports.
- Resolve DNS and reject loopback, link-local, multicast, private, reserved, and otherwise non-public address ranges. Re-check the destination after redirects; cap redirect count and do not allow a redirect to widen the approved host/network boundary.
- Enforce connection, header, download, and total fetch timeouts plus bounded response size. Abort safely when limits are exceeded; do not parse unbounded responses.
- Validate content type and parser support, scan downloaded content as applicable, and isolate parsers from broad network access.
- Store canonical URL, redirect chain, retrieval time, response status/content type, content hash, source version, and limitations as queryable provenance. Store only a non-secret reference to any authorized integration.
- An unreadable, inaccessible, unverifiable, or limit-exceeding source becomes `needs_review`; retain the failure reason and do not invent evidence.
- Public-page access does not imply private-page access. A private Notion page requires explicit user/workspace OAuth or integration authorization with least-privilege scopes, secure server-side token storage, revocation handling, and auditable consent. Credentials and tokens must never appear in URLs, prompts, logs, reports, fixtures, or source control.

## Reliability and cost controls

- At-least-once jobs require idempotent handlers keyed by `review_id`, `agent`, `source_snapshot_id`, and phase.
- Use bounded request timeouts for provider calls and exponential backoff with a dead-letter queue; classify permanent validation errors, invalid structured responses, and transient provider failures separately.
- Persist checkpoints after each phase and retain partial artifacts for diagnosis.
- Apply per-workspace concurrency, file-size, token, time, and spend budgets.
- Use circuit breakers around provider calls. On an Ollama Cloud outage or open circuit, return an explicit retryable failure or `needs_review` according to the run policy rather than inventing evidence; record the provider failure and any fallback in the run record.
- Autoscale workers from queue depth and age, with a bounded maximum to protect model budgets.
- Keep the deterministic fake gateway as the rollback path for local and CI execution, so provider configuration can be disabled without changing domain or application code.

## Security operations

- SSO/OIDC is preferred for institutions; local credentials are acceptable for the initial pilot with MFA-ready boundaries.
- Roles are enforced server-side: instructor, evaluator, apprentice, coordinator, and administrator. The browser cannot bypass these checks by calling APIs, object storage, URL intake, reports, or history endpoints directly.
- Use secure session cookies or an equivalent authenticated browser session, CSRF protection for state-changing browser requests, strict origin/CORS policy, and short-lived scoped object access.
- Scan uploads before extraction; run parsers in restricted workers with no broad network access.
- Public URL retrieval uses the dedicated HTTPS boundary described above: host allow-list, HTTPS-only, redirect revalidation, DNS/private-network protections, response size/time limits, and provenance hashing.
- Private Notion retrieval is disabled unless an explicit OAuth/integration authorization exists for the relevant workspace/user and source; protect and rotate tokens through secret management, and record consent/revocation events without recording token values.
- Redact secrets and personal data before model calls where feasible; block prompts that include credentials.
- Keep audit logs immutable to application identities and alert on cross-workspace access failures, unusual export volume, and repeated provider errors.
- Define incident response, key rotation, access review, and data-subject deletion procedures before production.

## Observability

Every request, job, model call, and report carries a correlation ID and workspace-safe identifiers. Never log source contents, prompts, tokens, signed URLs, API keys, or other secrets. Secret values must not appear in source control, fixtures, reports, or diagnostic output.

Track:
- API latency/error rate and authorization denials.
- Queue depth, oldest job age, retry/dead-letter counts, and phase duration.
- Source extraction success and unreadable/unsupported rates.
- Model latency, failure rate, token/cost usage, fallback rate, and structured-output validation failures.
- Review completion rate, partial-result rate, and human correction frequency.
- Storage growth, deletion backlog, backup age, and restore test result.

Alert on stuck reviews, growing queue age, database saturation, repeated provider failure, audit write failure, and retention SLA breaches.

## Infrastructure acceptance checklist

- [ ] Local development works with emulators and a fake AI gateway.
- [ ] Staging is isolated from production data and credentials.
- [ ] Production has backups, restore evidence, secret management, and private data paths.
- [ ] Browser/API authorization is tested server-side for workspace, role, source, URL, report, and history boundaries.
- [ ] Public HTTPS retrieval enforces allow-listing, HTTPS, redirect/DNS/private-network protections, size/time limits, hashing, provenance, and `needs_review` failures.
- [ ] Jobs are retry-safe and resumable from persisted checkpoints.
- [ ] Model/provider policy, budgets, and fallbacks are observable.
- [ ] Retention and deletion cover originals, derivatives, reports, and indexes.

## Explicit assumptions

The first deployment should prefer one region, one relational database, one queue, and one object store over premature multi-region complexity. Cloud vendor selection, Kubernetes adoption, and the first institutional identity/model providers remain open until pilot constraints are known.
