# Google Meet Clone

A real-time video conferencing application replicating the core Google Meet experience, built with Bun, Turborepo, Fastify, Next.js, and WebRTC Mesh.

## Tech Stack & Monorepo Structure

- **Runtime & Package Manager**: Bun
- **Monorepo Tooling**: Turborepo (`turbo run build`, `turbo run dev`, `turbo run check-types`, `turbo run test`)
- **Backend (`apps/server`)**: Fastify with `@fastify/cors` and `@fastify/websocket`
- **Frontend (`apps/web`)**: Next.js 16 (App Router), React 19, Tailwind CSS v4 (Dark Theme `#202124`), Zustand
- **Shared (`packages/shared`)**: `@meet/shared` containing cross-package domain types and constants
- **Signaling**: Native WebSockets (`ws://localhost:3001/ws`)
- **Media**: WebRTC mesh topology with Google public STUN

## Coding Standards

All code contributions and automated reviews must strictly follow [`CODING_STANDARDS.md`](./CODING_STANDARDS.md). Review violations are hard failures.

## Agent Guardrails

AI agents and automated tools operating on this repository must strictly adhere to the following safety constraints:

### 1. Git & Safety Guardrails

- **No destructive git commands**: Never execute `git reset --hard`, `git clean -fd`, `git clean -f`, `git branch -D`, or `git checkout .`.
- **No force-pushing**: Never execute `git push --force` or `git push --force-with-lease` unless explicitly instructed by the user.
- **Never bypass commit hooks**: Never use `--no-verify` on `git commit`. All pre-commit checks (`lint-staged`, `check-types`, `test`) must pass naturally.
- **No phantom commits**: Keep commits atomic, clean, and directly tied to issues (`Closes #<id>`).

### 2. Workspace & Dependency Discipline

- **Bun workspace protocol**: All internal monorepo packages must use the `"workspace:*"` protocol (`@meet/shared`, `@meet/ui`, `@meet/typescript-config`, `@meet/eslint-config`).
- **No lockfile tampering**: Never hand-edit `bun.lock`. Always update dependencies through `bun add` or `bun remove`.
- **Environment variables**: Every new `process.env` key must be mirrored in `.env.example` immediately.

### 3. Scope & Ticket Boundary

- **Zero scope creep**: The diff must implement only what the assigned ticket's acceptance criteria specify. Do not include unsolicited refactors or unrelated file formatting.
- **Verification required**: Always run `bun run check-types` and local unit tests before marking any ticket complete or triggering code review.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical five-role vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout with root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
