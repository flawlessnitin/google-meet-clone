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

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical five-role vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout with root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
