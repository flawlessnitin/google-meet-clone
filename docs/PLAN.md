# 🎥 Google Meet Clone — MVP Implementation Plan

## 🏛️ Architecture Philosophy

This project follows three complementary patterns that work together to keep the codebase scalable and maintainable:

### Domain Driven Design (DDD)
Code is organized around **business concepts**, not technical layers. Entities like `Meeting`, `Participant`, and `Room` are first-class citizens. The codebase speaks the same language as the product.

- **Entities** — objects with identity (`Meeting`, `User`, `Participant`)
- **Value Objects** — objects defined by value (`MeetingCode`, `Email`)
- **Repositories** — abstractions over data access (`IMeetingRepository`)
- **Domain Services** — business logic that spans multiple entities

### Modular Architecture
The server is split into **self-contained feature modules**. Each module owns its own domain, application logic, infrastructure, and routes. Modules communicate via well-defined interfaces — not direct imports.

```
server/src/modules/
├── meetings/     ← meeting creation, codes, lifecycle
├── rooms/        ← WebSocket room management, signaling
├── auth/         ← authentication, JWT, user accounts
└── participants/ ← participant state, permissions
```

### Onion (Clean) Architecture
Inside each module, **dependencies point inward only**. The domain core has zero external dependencies — no Express, no Prisma, no WebSocket. Outer layers implement interfaces defined by the inner layers.

```
┌─────────────────────────────────────┐
│  Presentation  (routes, gateways)   │  ← Express, WebSocket handlers
│  ┌───────────────────────────────┐  │
│  │  Application  (use cases)     │  │  ← CreateMeeting, JoinRoom
│  │  ┌─────────────────────────┐  │  │
│  │  │  Domain  (core rules)   │  │  │  ← Entities, interfaces, logic
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
│  Infrastructure  (DB, WS, ext APIs) │  ← Prisma repos, WS adapters
└─────────────────────────────────────┘
```

> [!NOTE]
> **Pragmatic adoption**: Full DDD rigor is introduced in Phase 9 when the DB and auth land. Phases 1–8 use a simpler structure to get WebRTC working fast — modules are scaffolded but kept lean. The architecture is **grown into**, not bolted on upfront.

---

## 18-Phase Build Order

> [!NOTE]
> This plan follows a **bottom-up** approach: get the raw WebRTC plumbing working first, then layer on features. Auth and database come *after* core video calling is proven.

---

### Phase 1: Monorepo + Next.js + Node WS

**Goal**: Scaffold the monorepo with all three packages wired up and a "hello world" from each.

**Deliverables**:
- Root `package.json` with npm workspaces (`client`, `server`, `shared`)
- `shared/` — TypeScript package exporting a placeholder type
- `client/` — Next.js app (App Router) with Tailwind CSS, dark theme (`#202124`), imports from `shared`
- `server/` — Node.js + Express + `ws` server, imports from `shared`
- `tsconfig.base.json` shared across all packages
- Dev scripts: `npm run dev` starts both client (:3000) and server (:3001) concurrently
- `.env.example` with placeholders

**Key Files**:
```
google-meet-clone/
├── package.json                    # workspaces: ["client", "server", "shared"]
├── tsconfig.base.json
├── .env.example
├── shared/
│   ├── package.json                # name: "@meet/shared"
│   ├── tsconfig.json
│   └── src/index.ts
├── client/
│   ├── package.json                # name: "@meet/client"
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   └── src/
│       ├── app/layout.tsx          # Dark theme root layout
│       ├── app/page.tsx            # Placeholder home
│       └── styles/globals.css
└── server/
    ├── package.json                # name: "@meet/server"
    ├── tsconfig.json
    └── src/
        ├── index.ts                # App entry — wires Express + WebSocket
        ├── app.ts                  # Express app factory
        └── modules/                # Feature modules (Modular Architecture)
            ├── rooms/              # WebSocket room management (lean, no DB)
            │   ├── rooms.manager.ts        # In-memory room state
            │   └── rooms.gateway.ts        # WebSocket handler (Presentation)
            └── meetings/           # Meeting codes (lean, no DB yet)
                └── meetings.service.ts     # In-memory meeting registry
```

> [!NOTE]
> Modules are **scaffolded lean** in Phase 1 — no domain/application/infrastructure sub-folders yet. Those layers are introduced in Phase 9 when real persistence arrives. This avoids premature abstraction while establishing the modular boundary.

**Done when**: `npm run dev` from root starts both, client renders a dark page, server logs "WebSocket server listening on 3001".

---

### Phase 2: WebSocket Connection

**Goal**: Client connects to server over WebSocket, sends/receives JSON messages, handles reconnection.

**Deliverables**:
- `shared/` — Define base message types (`{ type: string, payload: any }`)
- `server/` — WebSocket connection handler: accept connections, parse JSON, echo/ack
- `client/` — `WebSocketClient` class with:
  - Connect / disconnect
  - Auto-reconnect with exponential backoff
  - Type-safe `send()` and `onMessage()` using shared types
  - Connection state tracking
- `useWebSocket` React hook exposing connection state + send method
- UI indicator showing connection status (green/red dot)

**Key Files**:
```
shared/src/ws-messages.ts           # Message type definitions
client/src/lib/websocket.ts         # WebSocketClient class
client/src/hooks/useWebSocket.ts    # React hook
server/src/ws/handler.ts            # Connection handler
```

**Done when**: Client connects, sends a ping, server echoes it back, client shows "Connected". Closing server shows "Disconnected" and client auto-reconnects when server restarts.

---

### Phase 3: Signaling Protocol

**Goal**: Define and implement the full signaling message protocol for WebRTC negotiation — without actual WebRTC yet.

**Deliverables**:
- `shared/` — Complete signaling message types:
  - `join-room`, `leave-room`
  - `offer`, `answer`, `ice-candidate`
  - `room-joined`, `peer-joined`, `peer-left`
- `server/` — Room Manager (in-memory):
  - `Map<meetingCode, Room>` tracking connected peers
  - On `join-room`: add peer to room, notify existing peers
  - On disconnect: remove peer, notify others
  - Route `offer`/`answer`/`ice-candidate` to target peer
  - Enforce 10-participant limit
- `client/` — Update `useWebSocket` to handle signaling messages
- Log all signaling events to console for debugging

**Key Files**:
```
shared/src/ws-messages.ts           # Full signaling types
server/src/ws/rooms.ts              # Room manager
server/src/ws/messages.ts           # Message router
```

**Done when**: Open 3 browser tabs, all join same room code. Each tab sees `peer-joined` logs for others. Closing a tab triggers `peer-left` in remaining tabs. Offers/answers are relayed between specific peers.

---

### Phase 4: 1-to-1 WebRTC

**Goal**: Two peers in a room establish a direct WebRTC connection and stream video/audio to each other.

**Deliverables**:
- `client/` — WebRTC Manager:
  - Create `RTCPeerConnection` with Google STUN server
  - Get local media via `getUserMedia()`
  - On `peer-joined`: create offer → send via signaling
  - On `offer`: set remote SDP → create answer → send
  - On `answer`: set remote SDP
  - On `ice-candidate`: add candidate
  - On `track` event: capture remote stream
- Basic meeting page with two `<video>` elements (local + remote)
- `useWebRTC` hook managing peer connections
- `useMediaDevices` hook for `getUserMedia`

**Key Files**:
```
client/src/lib/webrtc.ts            # WebRTC utility functions
client/src/hooks/useWebRTC.ts       # Peer connection management
client/src/hooks/useMediaDevices.ts  # getUserMedia wrapper
client/src/app/meeting/[code]/room/page.tsx  # Meeting room page
client/src/components/meeting/VideoTile.tsx   # Video element wrapper
```

**Done when**: Open two tabs at `/meeting/test-code/room`. Both see their own video + the other person's video. Audio works bidirectionally.

---

### Phase 5: Multi-party WebRTC Mesh

**Goal**: Scale from 1-to-1 to N participants (up to 10), each connected to every other peer.

**Deliverables**:
- Update WebRTC Manager to maintain `Map<peerId, RTCPeerConnection>`
- On `room-joined` (with existing participants): create offers to ALL existing peers
- On `peer-joined`: only the NEW peer creates the offer
- On `peer-left`: close that peer's connection, clean up
- Zustand store for meeting state:
  - `participants: Map<peerId, { stream, displayName, ... }>`
  - Add/remove participants reactively
- Render multiple `<video>` elements from store

**Key Files**:
```
client/src/stores/meetingStore.ts    # Meeting state (participants)
client/src/stores/mediaStore.ts      # Local media state
client/src/hooks/useWebRTC.ts        # Updated for multi-peer
```

**Done when**: Open 4+ tabs. All see each other's video/audio. One tab closing cleanly removes that participant from all others.

---

### Phase 6: Mic/Camera Controls

**Goal**: Toggle mic and camera on/off with proper track management.

**Deliverables**:
- `ControlBar` component with mic/camera toggle buttons (icons from `lucide-react`)
- Toggle mic: `track.enabled = false` (keeps connection, stops audio)
- Toggle camera: `track.enabled = false` (keeps connection, shows black)
- Broadcast state changes via WebSocket (`toggle-audio`, `toggle-video`)
- Remote peers see mic-off/camera-off indicators
- Leave meeting button (closes all connections, navigates away)

**Key Files**:
```
client/src/components/meeting/ControlBar.tsx
shared/src/ws-messages.ts           # Add toggle messages
```

**Done when**: Muting mic silences audio for remote peers. Toggling camera off shows a black frame. State is reflected in remote peers' UI.

---

### Phase 7: Participant State + Grid

**Goal**: Auto-layout video grid and proper participant tiles with state indicators.

**Deliverables**:
- `VideoGrid` — CSS grid that auto-adjusts:
  - 1 participant: 1×1 full
  - 2: side-by-side
  - 3–4: 2×2
  - 5–6: 2×3
  - 7–9: 3×3
  - 10: 2×5
- `VideoTile` — shows:
  - Video stream (or avatar when camera off)
  - Display name overlay (bottom-left)
  - Mic-off indicator icon
  - Camera-off: colored circle with initials
- Pin/unpin participant (pinned = large main view, others in sidebar)
- Zustand store tracks each participant's audio/video/name state

**Key Files**:
```
client/src/components/meeting/VideoGrid.tsx
client/src/components/meeting/VideoTile.tsx
client/src/components/ui/Avatar.tsx
```

**Done when**: Grid dynamically resizes as participants join/leave. Camera-off shows initials avatar. Mic-off shows icon. Clicking a tile pins it.

---

### Phase 8: Meeting Rooms / Codes

**Goal**: Generate and resolve meeting codes so users can create/join meetings via URL.

**Deliverables**:
- Server: `POST /api/meetings` — generates a random `abc-defg-hij` code (using `nanoid`), stores in-memory (no DB yet)
- Server: `GET /api/meetings/:code` — validates code exists
- Home page UI:
  - "New meeting" button → calls API → navigates to `/meeting/{code}`
  - "Join" input → enter code → navigates to `/meeting/{code}`
- Room manager uses meeting code as the room key
- 404 page for invalid meeting codes

**Key Files**:
```
server/src/routes/meeting.routes.ts
client/src/app/page.tsx              # Home page with create/join
client/src/lib/api.ts                # REST API client
```

**Done when**: Click "New meeting" → get a code like `abc-defg-hij` → share the URL → another user joins via that URL. Invalid codes show an error.

---

### Phase 9: Authentication + PostgreSQL

**Goal**: Add user accounts, JWT auth, and persist meetings to PostgreSQL. **This phase also introduces the full DDD + Onion layer structure** inside each module.

**Deliverables**:
- Prisma schema: `User`, `Meeting`, `MeetingParticipant` models
- Server auth routes: `POST /api/auth/signup`, `POST /api/auth/signin`, `GET /api/auth/me`
- JWT middleware for REST + WebSocket authentication
- Password hashing with `bcryptjs`
- Client auth pages: Sign In, Sign Up
- `authStore` (Zustand) — user state + token storage (localStorage)
- Protected routes: redirect to sign-in if not authenticated
- Meetings now persisted to PostgreSQL (not just in-memory)
- Meeting creator = host (stored in DB)
- **Refactor** `meetings/` and introduce `auth/` module with full Onion layers

**Key Files**:
```
server/src/
├── prisma/
│   └── schema.prisma                          # User, Meeting, MeetingParticipant
└── modules/
    ├── auth/                                  # 🔐 Auth module (full Onion)
    │   ├── domain/
    │   │   ├── user.entity.ts                 # User entity (id, email, name, passwordHash)
    │   │   ├── user.value-objects.ts          # Email, Password value objects
    │   │   └── user.repository.interface.ts   # IUserRepository (no Prisma here)
    │   ├── application/
    │   │   ├── sign-up.use-case.ts            # SignUpUseCase
    │   │   ├── sign-in.use-case.ts            # SignInUseCase
    │   │   └── get-me.use-case.ts             # GetMeUseCase
    │   ├── infrastructure/
    │   │   ├── prisma-user.repository.ts      # Implements IUserRepository via Prisma
    │   │   ├── jwt.service.ts                 # Token sign/verify
    │   │   ├── bcrypt.service.ts              # Password hashing
    │   │   └── auth.middleware.ts             # Express JWT guard
    │   └── presentation/
    │       └── auth.routes.ts                 # POST /api/auth/signup, /signin, /me
    │
    ├── meetings/                              # 📅 Meetings module (full Onion)
    │   ├── domain/
    │   │   ├── meeting.entity.ts              # Meeting entity (code, hostId, createdAt)
    │   │   ├── meeting.value-objects.ts       # MeetingCode value object
    │   │   └── meeting.repository.interface.ts # IMeetingRepository
    │   ├── application/
    │   │   ├── create-meeting.use-case.ts     # GenerateMeetingCode → persist
    │   │   └── get-meeting.use-case.ts        # Validate meeting code exists
    │   ├── infrastructure/
    │   │   └── prisma-meeting.repository.ts   # Implements IMeetingRepository via Prisma
    │   └── presentation/
    │       └── meetings.routes.ts             # POST /api/meetings, GET /api/meetings/:code
    │
    └── rooms/                                 # 🚪 Rooms module (stays lean — no DB)
        ├── rooms.manager.ts                   # In-memory room state (unchanged)
        └── rooms.gateway.ts                   # WebSocket handler — now validates JWT

# Client
client/src/
├── app/auth/
│   ├── signin/page.tsx
│   └── signup/page.tsx
├── stores/authStore.ts                        # Zustand: user + token
└── hooks/useAuth.ts                           # Auth helper hook
```

> [!IMPORTANT]
> The `domain/` layer in each module **must not import** from `infrastructure/`, `prisma`, `express`, or any Node/npm package except plain TypeScript. Dependency injection is used to supply the concrete repository at startup.

**Done when**: Users can sign up, sign in, create meetings (persisted to DB). WebSocket connections require a valid JWT. Meeting host is tracked.

---

### Phase 10: Pre-join Experience

**Goal**: "Ready to join?" preview screen before entering the meeting room.

**Deliverables**:
- Pre-join page at `/meeting/[code]`:
  - Camera preview (live `<video>` element)
  - Mic level indicator (using `AudioContext` analyser)
  - Toggle mic/camera before joining
  - Device selector dropdowns (mic, camera, speaker)
  - Display name shown
  - "Join now" button
- `useMediaDevices` hook: enumerate devices, switch devices
- Track replacement: when user changes device, replace track in preview

**Key Files**:
```
client/src/app/meeting/[code]/page.tsx       # Pre-join page
client/src/components/prejoin/PreviewCard.tsx
client/src/components/prejoin/DeviceSelector.tsx
client/src/components/prejoin/JoinControls.tsx
client/src/hooks/useMediaDevices.ts          # Device enumeration
```

**Done when**: Navigating to a meeting URL shows the preview. User sees their camera, can toggle mic/camera, switch devices, and click "Join now" to enter the room.

---

### Phase 11: Screen Sharing

**Goal**: Any participant can share their screen; it replaces the main view for all.

**Deliverables**:
- "Present now" button in ControlBar
- `getDisplayMedia()` to capture screen
- Replace video track in all peer connections with screen track
- Broadcast `screen-share-started` / `screen-share-stopped` via WebSocket
- Server enforces one screen share at a time
- Layout switch: screen share takes ~75% width, participant tiles in sidebar
- When screen share ends (user clicks stop or browser "Stop sharing"): restore camera track
- `ScreenShareView` component for the large screen share display

**Key Files**:
```
client/src/hooks/useScreenShare.ts
client/src/components/meeting/ScreenShareView.tsx
client/src/components/meeting/ControlBar.tsx     # Add present button
```

**Done when**: User clicks "Present", selects a window/tab, all peers see the screen share as main view. Stopping sharing restores the camera for all peers.

---

### Phase 12: Chat

**Goal**: In-meeting text chat via WebSocket, shown in a slide-out side panel.

**Deliverables**:
- Chat messages sent/received via WebSocket (not WebRTC data channels)
- `ChatPanel` — slides in from the right:
  - Message list (sender name, timestamp, content)
  - Input field + send button
  - Unread message badge on chat toggle button
- `chatStore` (Zustand) — message history for current session
- Messages persist for the duration of the meeting (in-memory, not in DB)
- Auto-scroll to latest message

**Key Files**:
```
client/src/components/meeting/ChatPanel.tsx
client/src/stores/chatStore.ts
shared/src/ws-messages.ts                    # Chat message types
```

**Done when**: Users can open chat panel, send messages, see messages from others with names + timestamps. Badge shows unread count when panel is closed.

---

### Phase 13: Reactions + Raise Hand

**Goal**: Emoji reactions and raise hand feature.

**Deliverables**:
- Reaction picker in ControlBar (👍 👏 ❤️ 😂 😮)
- Reactions sent via WebSocket → broadcast to all peers
- Floating emoji animation: emoji appears and floats up from the sender's tile, fades out after ~3 seconds
- Raise hand toggle:
  - Hand icon (✋) appears on the user's `VideoTile` when raised
  - Raise hand state broadcast via WebSocket
  - Persists until user lowers hand
- `Reactions` component for rendering floating emojis

**Key Files**:
```
client/src/components/meeting/Reactions.tsx
client/src/components/meeting/ControlBar.tsx    # Add reaction picker
client/src/components/meeting/VideoTile.tsx      # Add hand icon
```

**Done when**: Clicking a reaction shows a floating emoji on all participants' screens. Raising hand shows ✋ on the tile persistently until lowered.

---

### Phase 14: Waiting Room

**Goal**: Host-controlled lobby where participants wait for admission.

**Deliverables**:
- Meeting has `waitingRoom: boolean` (default true, host can toggle)
- When joining a meeting with waiting room enabled:
  - Non-host participants enter a waiting state
  - They see a "Waiting for the host to let you in..." screen
  - Host sees a notification/panel of pending participants
- Host actions: Admit (participant enters room) or Deny (participant gets redirected)
- Server enforces waiting room logic: hold WebSocket connection but don't add to room
- `WaitingRoom` component (client-side waiting screen)
- Host notification badge for pending participants

**Key Files**:
```
client/src/components/meeting/WaitingRoom.tsx
server/src/ws/rooms.ts                          # Waiting room logic
shared/src/ws-messages.ts                       # admit/deny messages
```

**Done when**: Non-host joins → sees waiting screen. Host sees pending list → admits → participant enters meeting. Deny → participant redirected to home.

---

### Phase 15: Host Moderation

**Goal**: Host can mute others, remove participants, and end the meeting for all.

**Deliverables**:
- `ParticipantPanel` (slide-out, like chat) showing all participants with:
  - Mic/camera status indicators
  - Host badge next to host's name
  - "Mute" button (host only) — sends `force-muted` to target
  - "Remove" button (host only) — sends `removed` to target, closes their connections
- "End meeting for all" button (host only) in ControlBar
  - Sends `meeting-ended` → all peers disconnect → redirect to summary
- If a regular user leaves: only they leave. If host ends: everyone leaves.
- `HostControls` component for moderation actions

**Key Files**:
```
client/src/components/meeting/ParticipantPanel.tsx
client/src/components/meeting/HostControls.tsx
server/src/ws/rooms.ts                           # Host action enforcement
```

**Done when**: Host can mute a participant (their mic toggles off), remove them (they get kicked), and end the meeting (everyone gets redirected to summary).

---

### Phase 16: Recording

**Goal**: Local (browser-side) recording of the meeting.

**Deliverables**:
- Record button in ControlBar (host only or all — your call)
- Compositing approach:
  - Create an offscreen `<canvas>`, draw all video tiles onto it
  - Mix all audio tracks via `AudioContext` + `MediaStreamDestination`
  - Combine canvas stream + mixed audio into one `MediaStream`
- `MediaRecorder` API records the combined stream
- Recording indicator (red dot + "Recording" text) visible to all
- On stop: generate `.webm` blob → trigger browser download
- `useRecording` hook encapsulating all logic

**Key Files**:
```
client/src/hooks/useRecording.ts
client/src/components/meeting/RecordingIndicator.tsx
client/src/components/meeting/ControlBar.tsx        # Record button
```

**Done when**: Click record → red indicator appears → stop recording → `.webm` file downloads. File contains all participants' video and audio.

---

### Phase 17: Polish + Failure Handling

**Goal**: Handle edge cases, improve UX, make the app production-ready.

**Deliverables**:
- **WebSocket reconnection**: auto-reconnect with backoff, re-join room on reconnect
- **WebRTC ICE restart**: handle `iceConnectionState === "failed"` → trigger ICE restart
- **Peer connection recovery**: detect disconnected peers, show "Reconnecting..." overlay
- **Permission handling**: graceful fallback when mic/camera denied (audio-only mode, camera-off mode)
- **Network quality indicator**: show connection quality per peer (based on `RTCPeerConnection.getStats()`)
- **Responsive design**: mobile-friendly layout (stack tiles vertically, smaller controls)
- **Toast notifications**: "X joined", "X left", "X is presenting"
- **Loading states**: skeleton screens for meeting room
- **Error boundaries**: catch React errors, show friendly error pages
- **Post-meeting summary page**: duration, participant list, recording download link
- **Sounds**: join/leave notification sounds
- **Keyboard shortcuts**: `Ctrl+D` toggle mic, `Ctrl+E` toggle camera

**Key Files**:
```
client/src/app/meeting/[code]/summary/page.tsx
client/src/components/ui/Toast.tsx
client/src/components/meeting/NetworkIndicator.tsx
```

**Done when**: App handles network drops gracefully, shows helpful error states, works on mobile, and has a polished user experience.

---

### Phase 18: Testing + Deployment

**Goal**: Test coverage and deploy the application.

**Deliverables**:
- **Unit tests**: Zustand stores, utility functions, message parsing
- **Integration tests**: WebSocket message flow, room manager logic
- **E2E tests** (Playwright): sign up → create meeting → join → video call → leave
- **Server deployment**: Dockerize server (Node.js + Prisma + PostgreSQL)
- **Client deployment**: Deploy Next.js to Vercel (or similar)
- **Environment setup**: production environment variables, CORS config
- **CI/CD**: GitHub Actions for lint + test + build
- **Documentation**: README with setup instructions, architecture overview

**Key Files**:
```
server/Dockerfile
docker-compose.yml
.github/workflows/ci.yml
README.md
```

**Done when**: All tests pass, app is deployed and accessible via a public URL, README documents setup and usage.

---

## Quick Reference: Tech Decisions

| Decision | Choice |
|---|---|
| **Frontend** | Next.js (App Router) + TypeScript |
| **Backend** | Node.js + Express + TypeScript |
| **Real-time Media** | WebRTC Mesh (P2P) |
| **Signaling** | Raw WebSockets (`ws`) |
| **ICE Servers** | Google STUN (TURN deferred) |
| **Database** | PostgreSQL + Prisma |
| **Auth** | JWT + bcrypt |
| **State** | Zustand |
| **Styling** | Tailwind CSS, dark theme |
| **Structure** | Monorepo (npm workspaces) |
| **Meeting IDs** | `abc-defg-hij` codes |
| **Max participants** | 10 per meeting |
