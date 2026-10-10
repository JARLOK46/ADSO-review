# ADSO AI-First Reviewer Infrastructure

## Recommended baseline

Use managed, replaceable primitives behind a container boundary. The baseline is intentionally provider-neutral and suitable for local development, a staging pilot, and production.

| Layer | Baseline | Responsibility |
|---|---|---|
| Web/API | Containerized application | Authenticated HTTP API, authorization, review commands, report access |
| Worker | Containerized worker pool | Extraction, specialist jobs, orchestration, retries |
| Database | Managed PostgreSQL-compatible service | Transactional state, snapshots, audit metadata |
| Queue | Durable managed queue | At-least-once job delivery and delayed retries |
| Object storage | S3-compatible bucket | Original sources, derived artifacts, generated reports |
| Cache/coordination | Optional Redis-compatible service | Rate limits and short-lived progress fan-out, never canonical state |
| Model access | Internal AI gateway | Provider adapters, policy, usage, redaction, structured output |
| Observability | OpenTelemetry-compatible metrics/logs/traces | Correlation, latency, failures, cost, queue health |

## Environments

### Local
Docker Compose may provide PostgreSQL, an S3-compatible emulator, a queue emulator, and a fake AI gateway. Use synthetic sources only. Local mode must work without external model credentials.

### Staging
Use isolated workspace and buckets, masked/synthetic data, real migration and backup paths, a deterministic fake model for CI, and an explicitly approved non-production provider for exploratory runs.

### Production
Use private networking where available, managed database backups and point-in-time recovery, versioned object buckets, least-privilege service identities, secret-manager integration, malware scanning, WAF/rate limiting, and separate model credentials per environment.

## Deployment topology

```text
Internet -> CDN/WAF -> Web/API (N replicas)
                         |-> PostgreSQL (private)
                         |-> Queue -> Worker autoscaling (N replicas)
                         |-> Object storage (private, signed access)
                         |-> AI gateway -> approved provider or institution endpoint
```

The API accepts commands quickly and returns a review/job identifier. Workers own long-running work. Health checks distinguish process health, dependency readiness, and queue liveness.

## Data and lifecycle controls

- Store source bytes and generated artifacts in versioned, workspace-prefixed object keys.
- Store only metadata and provenance in PostgreSQL; never put large files in rows.
- Run migrations forward and make them backward-compatible for one deployment window.
- Encrypt database, buckets, backups, and queue payloads where supported.
- Apply configurable retention by workspace. Deletion is an asynchronous, auditable workflow that removes original sources, source versions, extracted evidence, agent artifacts, findings, reports, indexes, and other derived objects before closing.
- Back up the database daily with point-in-time recovery; test restore quarterly. Object storage version retention follows the workspace policy.
- Queue messages contain IDs and approved references, not secrets or unnecessary source contents.

## Reliability and cost controls

- At-least-once jobs require idempotent handlers keyed by `review_id`, `agent`, `source_snapshot_id`, and phase.
- Use exponential backoff with a dead-letter queue; classify permanent validation errors separately from transient provider failures.
- Persist checkpoints after each phase and retain partial artifacts for diagnosis.
- Apply per-workspace concurrency, file-size, token, time, and spend budgets.
- Use circuit breakers and provider fallback only when policy permits; a fallback must be visible in the run record.
- Autoscale workers from queue depth and age, with a bounded maximum to protect model budgets.

## Security operations

- SSO/OIDC is preferred for institutions; local credentials are acceptable for the initial pilot with MFA-ready boundaries.
- Roles are enforced server-side: instructor, evaluator, apprentice, coordinator, and administrator.
- Scan uploads before extraction; run parsers in restricted workers with no broad network access.
- Allow-list outbound URL fetching and record fetch time, status, and content hash.
- Redact secrets and personal data before model calls where feasible; block prompts that include credentials.
- Keep audit logs immutable to application identities and alert on cross-workspace access failures, unusual export volume, and repeated provider errors.
- Define incident response, key rotation, access review, and data-subject deletion procedures before production.

## Observability

Every request, job, model call, and report carries a correlation ID and workspace-safe identifiers. Never log source contents, prompts, tokens, signed URLs, or secrets.

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
- [ ] Jobs are retry-safe and resumable from persisted checkpoints.
- [ ] Model/provider policy, budgets, and fallbacks are observable.
- [ ] Retention and deletion cover originals, derivatives, reports, and indexes.

## Explicit assumptions

The first deployment should prefer one region, one relational database, one queue, and one object store over premature multi-region complexity. Cloud vendor selection, Kubernetes adoption, and the first institutional identity/model providers remain open until pilot constraints are known.
