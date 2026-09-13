# Coding standards

The rules code review enforces in this repository. Each is checkable against a diff — if a rule cannot be violated in an observable way, it does not belong here.

These sit **on top of** general code-quality judgment, not instead of it. Where a general heuristic and a rule here disagree, this file wins: it encodes decisions already made for this codebase.

Anything Prettier, ESLint, or `tsc` already enforces is deliberately absent. Don't review for formatting.

---

## Architecture & Boundaries

1. **A server route or WebSocket handler holds no business rules.** It parses input, delegates to a domain service or Room Manager, and sends the response.
2. **Cross-package domain types live in `@meet/shared`.** Message definitions, room states, participant models, and core constants (`MAX_PARTICIPANTS`) must be exported from `@meet/shared`, never duplicated across `apps/server` and `apps/web`.
3. **Application factory pattern is strictly maintained.** The Fastify instance is configured in `src/app.ts` (`buildApp`), separate from network listener startup in `src/index.ts`. This ensures in-process testing via `app.inject()` requires no live port binding.
4. **Presentation components are dumb.** React components render store state and dispatch hook actions. Complex WebRTC/WebSocket side-effects belong in custom hooks (`useWebRTC`, `useWebSocket`, `useMediaDevices`), never directly in JSX components.

---

## Realtime & WebRTC

5. **Local media tracks are always explicitly stopped.** Any unmount, room exit, or device switch must invoke `track.stop()` on both audio and video tracks to turn off hardware indicators (camera/mic lights).
6. **Peer connections are closed and deregistered on disconnect.** When a peer leaves or connections reset, `pc.close()` must be called and the peer instance removed from `Map<peerId, RTCPeerConnection>` to prevent memory leaks.
7. **Mesh participant limit is enforced server-side.** The server strictly enforces `MAX_PARTICIPANTS = 10` on `join-room`. The client must gracefully handle room-full rejections.
8. **ICE candidates and SDP offers/answers are pure relay.** The signaling server never modifies, caches, or inspects SDP or ICE candidate payloads — it solely routes by `targetPeerId`.

---

## WebSocket Messaging

9. **All WebSocket messages are discriminated unions.** Every message payload extends `{ type: string }` and corresponds to a typed contract in `@meet/shared`.
10. **Incoming WebSocket messages must be validated.** Never cast raw `JSON.parse` output blindly with `as`. Validate message `type` and payload structure before processing.
11. **Client handles connection drops with exponential backoff.** Reconnection attempts must back off progressively (1s, 2s, 4s, 8s, 16s, max 5 attempts) and transition connection state reactively.

---

## State Management

12. **Store boundaries are distinct.**
    - `meetingStore` owns room state (participants, active speaker, screen share status).
    - `mediaStore` owns local device tracks and toggle states (mic on/off, camera on/off).
    - `chatStore` owns transient in-meeting text messages.
    - `authStore` owns session tokens and authenticated user data.
13. **No derived state in stores.** If a value can be computed synchronously from existing state (e.g. `isRoomFull = participants.size >= 10`), compute it in a selector, not as a separate stored field.

---

## Configuration & Security

14. **No magic numbers or URLs.** Default ports, timeouts, and limits live in `@meet/shared` or module config.
15. **Every environment variable is mirrored in `.env.example`.** Any code introducing `process.env.NEW_KEY` must simultaneously add it to `.env.example` with a clear explanation.
16. **No secrets or credentials in tracked files.** This is a hard blocker at all severities.
17. **CORS origins are strictly constrained.** Never set `origin: true` or wildcard `*` with credentials in production. Restrict explicitly to client origins.

---

## TypeScript

18. **No `any`.** Use `unknown` and narrow with type guards. If an external library boundary forces an exception, document the reason with a comment.
19. **No non-null assertion operator (`!`) to silence nullable values.** Handle `null`/`undefined` defensively or throw an explicit error.
20. **No `@ts-ignore`.** Use `@ts-expect-error` with an explanatory comment only if an upstream type definition is provably defective.

---

## Testing

21. **Test behavior, not implementation details.** Assert against observable output: HTTP response status/body, WebSocket dispatched messages, or store state transitions. Do not test private methods or internal Maps.
22. **Unit tests must run fast and isolated.** Tests in `apps/server` must not require external databases or running network listeners. Use `app.inject()`.
23. **Every new route and store action carries a test.** A PR introducing a route or state transition without test coverage is incomplete.

---

## Scope & Discipline

24. **The diff does what the ticket asked, and nothing else.** Do not bundle opportunistic refactors, whitespace reformatting, or unrequested features into a ticket branch.
25. **All pre-commit hooks and typechecks must pass cleanly.** Never bypass commit hooks (`--no-verify`).
