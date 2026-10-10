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
- No application code or provider-specific implementation yet.
- No irreversible cloud provisioning.
- No automatic academic decision without evaluator confirmation.

## Tasks
1. Architecture and infrastructure document. **Done**
2. Repository guidance in `AGENTS.md`. **Done**
3. Git Flow initialization and baseline publication. **Done**

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
