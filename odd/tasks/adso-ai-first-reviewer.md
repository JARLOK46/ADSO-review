# ODD Feature: ADSO AI-First Reviewer foundation

## Goal
Translate the product specification in `ADSO-AI-First-Especificacion-y-Prompt.docx` into a reviewable architecture and repository operating contract before implementation begins.

## Scope
- Define MVP architecture and infrastructure.
- Define provider-neutral AI orchestration boundaries and structured contracts.
- Define initial domain/data model, security, observability, and deployment assumptions.
- Create `AGENTS.md` with repository guidance.
- Initialize Git Flow and publish the documentation baseline.

## Non-goals
- No provider-specific implementation yet.
- No irreversible cloud provisioning.
- No automatic academic decision without evaluator confirmation.

## Tasks
1. Architecture and infrastructure document. **Done**
2. Repository guidance in `AGENTS.md`. **Done**
3. Git Flow initialization and baseline publication. **Done**
4. Implement the source-intake domain slice with deterministic tests. **Done**
5. Add the fake AI gateway contract boundary and deterministic fixture. **Done**
6. Verify and publish each work unit on `feature/source-intake-slice`. **Done**
7. Add runtime validation for AI gateway requests and evidence citations. **Done**
8. Verify and publish runtime validation work unit. **Done**

## Acceptance criteria
- Architecture is traceable to the specification and explicitly labels assumptions.
- Infrastructure supports asynchronous, resumable reviews and provider substitution.
- Evidence provenance, human decision authority, tenancy, retention, and auditability are addressed.
- `AGENTS.md` defines workflow, boundaries, checks, and documentation-first sequencing.
- The repository has a `develop` integration branch and the baseline is pushed to GitHub.

## Evidence log
- Source specification reviewed: `C:/Users/ander/Downloads/ADSO-AI-First-Especificacion-y-Prompt.docx`.
- Remote repository cloned: `https://github.com/JARLOK46/ADSO-review.git`.
- Architecture decisions documented in `docs/architecture.md`, including a specification traceability matrix.
- Infrastructure decisions documented in `docs/infrastructure.md`, including consistent deletion scope.
- Repository workflow documented in `AGENTS.md`.

## Commits
- `d6cd94b` — `docs: define ADSO reviewer architecture baseline` (architecture, infrastructure, AGENTS.md, ODD task record).
- Git Flow configured with `develop` as integration and `main` as production branch; both pushed to `origin`.
- Initial implementation baseline: strict TypeScript on Node.js 22+ with Vitest; framework and cloud adapters remain deferred.
- Source-intake implementation in `src/domain/source-intake.ts` registers file and HTTPS URL sources with workspace, project, actor, size, SHA-256, and deterministic ID/time dependencies; invalid metadata and URL inputs are rejected.
- Focused source-intake tests pass: 8/8 in `tests/source-intake.test.ts`.
- Typecheck passes with `skipLibCheck: true`; this is the dependency declaration boundary for external library declarations and does not relax checking of project source or tests.
- `4ea7649` — `feat(source-intake): register project sources` (source-intake implementation, deterministic tests, TypeScript baseline, and repository tracking metadata); pushed to `origin/feature/source-intake-slice`.
- Fake AI gateway contract implemented in `src/application/ai-gateway.ts` with deterministic fixture in `src/infrastructure/fake-ai-gateway.ts` and 3 focused tests in `tests/fake-ai-gateway.test.ts`.
- Verification passed: focused gateway tests 3/3, full suite 11/11, `npm run typecheck`, and `git diff --check`.
- Boundary review found no vendor SDK, network call, secret, environment, or OpenCode coupling. Follow-up: add runtime validation for malformed requests/citations before untrusted input reaches the gateway.
- `1c8a45b` — `feat(ai): add provider-neutral fake gateway`; pushed to `origin/feature/source-intake-slice`.
- Runtime validation now returns a discriminated validation result and rejects malformed requests with `InvalidAgentRequestError` before deterministic processing; missing authorized evidence still produces `needs_review`.
- Focused gateway tests pass: 13/13; `npm run typecheck` passes; `git diff --check` passes. No commit or push was performed for this work unit.
- Re-verification passed after adding the explicit `needs_review` status assertion: focused gateway tests 13/13, full suite 21/21, typecheck, and diff checks.
- `5a7a677` — `feat(ai): validate gateway requests`; pushed to `origin/feature/source-intake-slice`.
- Native review preflight was attempted after publication but could not evaluate because negotiated target status reported an unrelated-target inconsistency; no review mutation or lineage was started.
