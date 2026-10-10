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
9. Record Ollama Cloud provider and secret-handling decision in architecture docs. **Done**
10. Implement the Ollama Cloud gateway adapter with contract tests. **Done**
11. Verify and publish the Ollama Cloud work unit. **Done**
12. Document the web review workspace and secure HTTPS/Notion URL intake scope. **Done**
13. Implement secure URL retrieval and provenance checks. **Done**
14. Add the framework-neutral web/API review boundary. **Pending**

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
- Web review workspace, browser-to-server authorization, public HTTPS/Notion MVP assumptions, private Notion authorization requirements, and secure URL retrieval controls documented in `docs/architecture.md` and `docs/infrastructure.md`.
- Repository workflow documented in `AGENTS.md`.
- Secure public HTTPS retrieval boundary implemented with injectable transport, DNS resolver, clock, and hasher; production infrastructure now provides Node SHA-256 hashing and fetch/AbortController transport with bounded body streaming, explicit host/subdomain policy, redirect revalidation, response limits, IPv4/IPv6 private/reserved classification, and source/workspace/project/actor provenance. Missing bodies remain unreadable/`needs_review`; deterministic tests cover accepted, blocked, timeout, size, metadata, missing-body, IPv6 safety, and needs_review outcomes.
- Secure URL retrieval blocker fixed: malformed redirect locations now return `needs_review`/`invalid_url`, redirect bodies are explicitly closed before following redirects, and production fetch readers cancel unconsumed bodies before releasing locks; focused retrieval tests and typecheck pass.
- Secure URL success provenance now exposes the canonical redirect chain and explicit retrieval limitations as queryable fields; deterministic success and production `fetchPublicUrl` reader-cancellation tests cover the contract without real network access.
- Final URL retrieval verification follow-up rejects the documented IPv4 ranges `192.0.2.0/24`, `198.51.100.0/24`, and `203.0.113.0/24`; every 3xx response body is closed before `bad_status`, including responses without `Location`. Focused retrieval tests pass 30/30 and `npm run typecheck` passes; no commit or push was performed.
- DNS approval is now pinned through the transport contract: the validated address list is passed to each request, and production HTTPS uses Node's request API with the selected address, an address-only `lookup` callback (no fallback resolution), and original-host TLS SNI/Host metadata. Deterministic tests cover address propagation and streamed response cleanup.

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
- Ollama Cloud adapter uses an injected HTTP transport, configurable base URL/model/timeout, and injected API key; it validates application requests and structured AgentResult content without vendor SDKs or process.env access.
- Follow-up correction requires an explicit configured model (no invented provider default) and serializes only the task plus authorized evidence into the deterministic provider message payload.
- Focused Ollama Cloud contract tests and typecheck are pending re-verification after the correction. No commit or push was performed for this work unit.
- Re-verification passed: Ollama adapter tests 10/10, full suite 31/31, `npm run typecheck`, and `git diff --check`. No provider SDK, `process.env`, or secret leakage found.
- `314837f` — `feat(ai): add Ollama Cloud gateway`; pushed to `origin/feature/source-intake-slice`.
