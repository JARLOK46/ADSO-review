# AGENTS.md

## Project

ADSO AI-First Reviewer is a provider-neutral web platform for traceable, human-supervised review of ADSO formative projects. The product specification is the source of product intent; `docs/architecture.md` and `docs/infrastructure.md` are the current technical baseline.

## Non-negotiable invariants

- The evaluator, not the AI, owns the final academic decision.
- Every important finding cites verifiable evidence and distinguishes facts, inferences, and open questions.
- AI recommendations and human decisions are stored and displayed separately.
- Review runs are asynchronous, resumable, retry-safe, and preserve history; never overwrite a prior review snapshot.
- Domain code depends on the internal AI gateway, never directly on a model vendor or OpenCode.
- Workspace authorization is enforced server-side for every read, write, file, URL, and report operation.
- Secrets never appear in source control, prompts, logs, fixtures, or reports.
- Unreadable or unverifiable evidence becomes `needs_review`; do not invent evidence.

## Workflow

1. Read the relevant specification and architecture docs before changing behavior.
2. Resolve product-blocking questions; record reversible assumptions in architecture docs.
3. Update architecture/infrastructure documentation before implementation when a decision changes.
4. Build vertical slices with tests, fixtures, and user-facing documentation together.
5. Keep each change small enough to review and use Conventional Commits.
6. Work with Git Flow: `develop` is integration, `feature/<name>` is implementation, `release/<version>` prepares a release, and `hotfix/<name>` is for production fixes. Do not commit directly to `main` for feature work.
7. After each completed work unit, run focused checks, commit, and push the current branch to GitHub. Do not force-push.
8. Never merge, publish a release, or provision production infrastructure without explicit authorization.

## Before code

No application code should be written until the architecture and infrastructure documents have been reviewed and the relevant task is approved. New services, data stores, model providers, or external integrations require an architecture note describing ownership, failure behavior, security, and rollback.

## Code and AI boundaries

- Use typed, versioned JSON contracts for agent input/output.
- Keep prompts and provider adapters at the infrastructure/application boundary.
- Pass minimum necessary context to each specialist.
- Persist checkpoints and idempotency keys for every asynchronous job.
- Make model, rubric, source, and human-action provenance queryable.

## Testing and verification

For behavior changes, write a meaningful failing test first when a deterministic runner and expected result exist, then make it pass and refactor. At minimum, cover authorization boundaries, evidence citation validation, idempotent retries, checkpoint resume, human decision transitions, and retention/deletion behavior as those areas are implemented.

Every work-unit commit records focused test results. Documentation-only changes use structural checks (links, headings, examples, and formatting) and explain why runtime tests do not apply.

## Repository map

- `docs/architecture.md`: domain boundaries, lifecycle, AI contracts, and invariants.
- `docs/infrastructure.md`: environments, deployment, security operations, reliability, and observability.
- `odd/tasks/`: ODD feature/task records and evidence.
- `AGENTS.md`: this operating contract.

## Review checklist

- [ ] Scope matches the approved task and stays inside MVP boundaries.
- [ ] Evidence and audit provenance are preserved.
- [ ] Tenant and role boundaries are tested.
- [ ] Failure, retry, resume, and deletion behavior is explicit.
- [ ] Docs, tests, and rollback notes accompany the behavior.
- [ ] No secrets, unexplained provider coupling, or irreversible migration slipped in.
