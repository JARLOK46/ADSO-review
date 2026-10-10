# ADSO AI-First Reviewer Architecture

## Decision
Build a modular web platform around a provider-neutral review domain. The first release uses a web API, a relational system of record, object storage, a durable job queue, and an AI gateway that exposes structured contracts instead of vendor SDKs. The evaluator remains the decision authority.

## MVP boundary

### In scope
- Workspaces, roles, projects, members, and review history.
- Versioned source intake for documents, code, media, presentations, and public URLs.
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
                                  |-> AI gateway -> approved/local model providers
                                  |-> Evidence extraction adapters
       -> Relational database + audit log
       -> Report renderer
  <- status/events and reports
```

The API and workers are stateless. The database is the source of truth for state transitions; object storage is the immutable source/artifact store; the queue is transport, not business state.

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

1. Create a project and review snapshot.
2. Register immutable source versions and a rubric version.
3. Validate file type, size, access, malware status, and URL reachability.
4. Classify and extract evidence with provenance and limitations.
5. Run specialists in parallel where dependencies allow.
6. Cross-check requirements, design, implementation, tests, and deployment.
7. Apply rubric criteria and produce findings; missing or unreadable evidence becomes `needs_review`.
8. Generate feedback and an AI recommendation.
9. Present blockers first; the evaluator accepts, edits, or discards findings.
10. Record the human decision and render the report without overwriting prior runs.

Every step has an idempotency key, a persisted checkpoint, a bounded retry policy, and an explicit failure state. A run can resume from the last successful job.

## AI orchestration

The orchestrator owns phase ordering, context minimization, dependency checks, cost/time limits, retries, and consolidation. Specialists return structured observations; they do not write directly to the final decision.

- `document-reviewer`: extracts claims and evidence from text documents and authorized public pages.
- `code-reviewer`: inspects repository snapshots, configuration, tests, and basic security signals.
- `media-reviewer`: describes diagrams, screenshots, prototypes, and presentation evidence with limitations.
- `rubric-judge`: maps corroborated evidence to criteria and severity.
- `feedback-writer`: converts accepted findings into prioritized, actionable feedback.

The AI gateway adapts model providers and records model, version, parameters, safety policy, and token/cost metadata. Domain code depends only on gateway interfaces.

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
- Untrusted files and URLs are sandboxed, size-limited, malware-scanned, and time-limited.
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
| Frontend | Server-rendered or SPA selected during UX spike | Yes |
| Model access | Internal AI gateway with adapters | Yes |
| Deployment | Containerized services, managed primitives first | Yes |

Open product decisions: institutional identity provider, supported maximum source sizes, retention duration by role/institution, rubric ownership/approval flow, and first approved model providers. Do not implement integrations until these are validated.

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
