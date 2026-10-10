# ADSO AI-First Reviewer Architecture

## Decision
Build a modular web platform around a provider-neutral review domain. The first release uses a web API, a relational system of record, object storage, a durable job queue, and an AI gateway that exposes structured contracts instead of vendor SDKs. The evaluator remains the decision authority.

## MVP boundary

### In scope
- Workspaces, roles, projects, members, and review history.
- A web review workspace where authorized users inspect sources, evidence, findings, review progress, decisions, reports, and prior history.
- Versioned source intake for documents, code, media, presentations, and HTTPS URLs; the MVP assumes public HTTPS pages, including public Notion pages.
- Versioned ADSO rubrics and criteria.
- Asynchronous, resumable review runs with partial progress.
- Specialized evidence extraction and cross-checking.
- Traceable findings and prioritized feedback.
- Human accept/edit/discard actions and final decisions.
- Downloadable reports and audit history.

### Out of scope
- Automatic academic decisions without evaluator confirmation.
- Plagiarism verdicts, guaranteed code correctness, or instructor replacement.
- LMS/institutional integrations, batch analytics, collaboration, and oral-review tooling.

## System context

```text
Browser
  -> Web/API application
       -> Review domain + authorization
       -> Source service -> Object storage
       -> Review orchestrator -> Durable queue -> Worker pool
                                  |-> AI gateway -> Ollama Cloud adapter (initially approved)
                                  |                  -> deterministic fake gateway (local/CI)
                                  |-> Evidence extraction adapters
       -> Relational database + audit log
       -> Report renderer
  <- status/events and reports
```

The browser is a client of the web/API application; it never authorizes itself or accesses another workspace's data directly. The web/API authenticates the user, checks workspace and role authorization on every read and write (including URL registration, source retrieval, evidence, reports, and history), and returns only authorized data. Browser-to-server calls use the application's session/CSRF or equivalent request protections; object storage remains private and is exposed only through short-lived, authorization-checked access. The API and workers are stateless. The database is the source of truth for state transitions; object storage is the immutable source/artifact store; the queue is transport, not business state.

## Bounded contexts

| Context | Responsibility | Must not decide |
|---|---|---|
| Identity and tenancy | Users, roles, workspace isolation, sessions | Academic outcomes |
| Project intake | Projects, members, source metadata, immutable source versions | Finding severity |
| Rubric | Rubric versions, phases, criteria, criticality | Evidence truth |
| Review execution | Runs, jobs, retries, checkpoints, orchestration | Human final decision |
| Evidence | Extracted text/regions/lines, provenance, limitations | Whether a criterion passes |
| Findings | Structured findings, citations, confidence, lifecycle | Authorization |
| Decision and feedback | Human actions, final decision, prioritized actions | New evidence |
| Audit and learning | Append-only changes, model/config provenance, aggregates | Mutable review state |

## Review lifecycle

1. An authorized user opens the web review workspace, creates a project and review snapshot, and sees only the workspace data allowed by their role.
2. Register immutable source versions and a rubric version.
3. For an HTTPS source, validate the URL and authorization boundary before retrieval. The MVP permits public HTTPS sources such as public Notion pages; private Notion pages require an explicit, separately configured OAuth/integration authorization and are not made accessible by placing credentials or tokens in the URL.
4. Retrieve accepted URLs through the server-side source service, not from the browser or workers with unrestricted network access. Enforce an outbound host allow-list, HTTPS-only transport, redirect revalidation, DNS resolution checks that reject loopback, link-local, multicast, and private/reserved networks, and bounded response size and fetch time. Record the canonical URL, redirect chain, retrieval timestamp, response metadata, content hash, authorization/integration reference (never its secret), and any limitations as source provenance.
5. Validate file type, size, access, malware status, and URL reachability.
6. If a URL or file is unreadable, inaccessible, exceeds a limit, or cannot be verified, preserve the failure and mark the relevant source/evidence as `needs_review`; never invent content. Classify and extract evidence with provenance and limitations.
7. Run specialists in parallel where dependencies allow.
8. Cross-check requirements, design, implementation, tests, and deployment.
9. Apply rubric criteria and produce findings; missing or unreadable evidence becomes `needs_review`.
10. Generate feedback and an AI recommendation.
11. Present blockers first; the evaluator accepts, edits, or discards findings.
12. Record the human decision and render the report without overwriting prior runs.

Every step has an idempotency key, a persisted checkpoint, a bounded retry policy, and an explicit failure state. A run can resume from the last successful job.

## AI orchestration

The orchestrator owns phase ordering, context minimization, dependency checks, cost/time limits, retries, and consolidation. Specialists return structured observations; they do not write directly to the final decision.

- `document-reviewer`: extracts claims and evidence from text documents and authorized public pages.
- `code-reviewer`: inspects repository snapshots, configuration, tests, and basic security signals.
- `media-reviewer`: describes diagrams, screenshots, prototypes, and presentation evidence with limitations.
- `rubric-judge`: maps corroborated evidence to criteria and severity.
- `feedback-writer`: converts accepted findings into prioritized, actionable feedback.

The AI gateway adapts model providers and records model, version, parameters, safety policy, and usage provenance for every call. Domain and application code remain provider-neutral and depend only on gateway interfaces; Ollama Cloud is an infrastructure adapter, not a domain dependency. A provider outage is represented as an explicit retryable failure or `needs_review` outcome, and an invalid or non-conforming structured response is rejected explicitly rather than treated as evidence.

### Agent result contract

```json
{
  "run_id": "review-run-123",
  "agent": "document-reviewer",
  "status": "completed",
  "observations": [
    {
      "id": "obs-1",
      "kind": "fact",
      "claim": "The requirements document defines three user roles.",
      "confidence": "high",
      "citations": [{"source_id": "src-7", "locator": "page 4, section 2"}],
      "limitations": []
    }
  ],
  "open_questions": [],
  "usage": {"model": "configured-provider-model", "input_tokens": 0, "output_tokens": 0},
  "schema_version": "1.0"
}
```

A finding must reference one or more citations and distinguish `fact`, `inference`, and `open_question`. A missing citation or unverifiable source cannot produce a blocking finding.

## Initial data model

- `User`, `Workspace`, `WorkspaceMember`, `Role`
- `Project`, `ProjectMember`
- `Review`, `ReviewSourceSnapshot`, `ReviewRubricSnapshot`
- `Source`, `SourceVersion`, `EvidenceFragment`
- `Rubric`, `RubricVersion`, `Criterion`
- `AgentRun`, `AgentArtifact`, `Finding`, `FindingCitation`
- `Feedback`, `Decision`, `AuditEvent`, `RetentionRequest`

All business records have IDs, created/updated timestamps, and workspace ownership where applicable. Source, rubric, and review snapshots are immutable. `Finding` stores AI recommendation and human disposition separately. `AuditEvent` is append-only and records actor, action, target, timestamp, and before/after references.

## Security and governance invariants

- Every request is authorized against workspace membership and role.
- Storage keys and database queries are workspace-scoped; object access uses short-lived signed URLs.
- Encryption is required in transit and at rest. Secrets live in a secret manager, never in prompts, logs, reports, or source control.
- Untrusted files and URLs are sandboxed, size-limited, malware-scanned, and time-limited. URL retrieval is server-side and restricted to an HTTPS host allow-list; redirects are revalidated, DNS/private-network targets are rejected, and content hashes plus retrieval provenance are retained.
- Public HTTPS/Notion pages are the MVP URL assumption. Access to private Notion pages is an explicit OAuth/integration authorization owned by the workspace/user boundary; credentials and tokens never appear in URLs, prompts, logs, reports, fixtures, or source control.
- The browser is an untrusted client: all workspace, role, source, URL, evidence, report, and history authorization is enforced server-side, with private object storage and short-lived authorized access.
- External model providers are opt-in per workspace and receive only minimized, approved context.
- Human decisions are explicit, attributable, reversible through a new action, and never silently replaced by AI output.
- Retention and deletion erase original sources, source versions, extracted evidence, agent artifacts, findings, reports, indexes, and other derived objects according to a documented policy; audit records retain only the minimum lawful metadata.

## Specification traceability

| Specification concern | Architecture response |
|---|---|
| Human-supervised decisions | Evaluator confirmation is required; AI recommendation and human decision are separate. |
| Evidence-backed findings | Citations, locators, confidence, limitations, and `needs_review` are mandatory. |
| AI-first specialist workflow | Orchestrator coordinates document, code, media, rubric, and feedback specialists through structured contracts. |
| Provider independence | Domain code calls an internal AI gateway with replaceable adapters; OpenCode is not a dependency. |
| History and versioning | Source, rubric, review, agent, finding, decision, and audit records preserve snapshots and revisions. |
| Async and resumable execution | Durable jobs, checkpoints, idempotency keys, retries, dead-letter handling, and partial artifacts are defined. |
| Security and governance | Workspace authorization, encryption, secret isolation, retention/deletion, audit, and human accountability are invariants. |
| MVP usability | Intake, progress, findings, evidence navigation, decisions, reports, and history are staged as vertical slices. |

The matrix is derived from sections 3–13 of the product specification. The DOCX remains the external product source until its approved copy is added to repository documentation.

## Architectural decisions and open questions

| Decision | Initial choice | Reversible? |
|---|---|---|
| API style | REST/JSON plus polling; event stream later | Yes |
| System of record | PostgreSQL-compatible relational database | Yes |
| Async execution | Durable queue with worker jobs | Yes |
| File store | S3-compatible object storage | Yes |
| Frontend | Web review workspace; server-rendered or SPA selected during UX spike | Yes |
| URL intake | Public HTTPS sources, including public Notion pages, for MVP; private Notion requires explicit OAuth/integration authorization | Yes |
| Model access | Internal AI gateway with replaceable adapters; Ollama Cloud is the initial approved provider and the deterministic fake gateway remains the local/CI fallback | Yes |
| Deployment | Containerized services, managed primitives first | Yes |

Open product decisions: institutional identity provider, supported maximum source sizes, retention duration by role/institution, rubric ownership/approval flow, the exact public-host allow-list and URL limits, and the model/provider configuration and operating limits for future providers. The private Notion OAuth/integration flow, scopes, token storage, consent UX, and revocation behavior must be approved before implementation. Ollama Cloud is the initial approved provider decision; its adapter remains replaceable, and no provider endpoint or model identifier is fixed by this document. Do not implement integrations until their configuration and operational constraints are validated.

## Initial implementation baseline

To make the first vertical slice executable without locking the product to a UI or cloud vendor, the repository will start as a TypeScript package targeting Node.js 22+ with strict types and Vitest for deterministic tests. The first slice is a framework-independent domain/application core; HTTP, PostgreSQL, object storage, and queue adapters are added at their boundaries in later slices. This is a reversible implementation choice and is not a commitment to a particular frontend framework.

## Delivery stages

1. Documentation and architecture approval.
2. Vertical slice: workspace, project, source upload, immutable snapshot, and status UI.
3. Rubric and document-reviewer with traceable findings and a deterministic fake AI gateway.
4. Human finding workflow, decision, report, audit, and history.
5. Code/media specialists and cross-check orchestration.
6. Production hardening, provider approvals, retention automation, and pilot validation.

## Acceptance checklist

- [ ] Every finding can reach a source citation.
- [ ] AI recommendation and human decision are separate fields and screens.
- [ ] A failed job can resume without duplicating artifacts.
- [ ] Provider adapters can be replaced without changing the review domain.
- [ ] Tenant boundaries, retention, and audit events are tested before pilot use.
