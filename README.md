# HookLens — Real-Time HTTP Webhook Inspector & Replay Engine

A low-latency, keyboard-first developer tool to capture, stream, inspect, and replay incoming HTTP webhooks in real time.

## Architecture & Engineering Highlights

```text
[ External Provider ] ──POST /hook/:id──▶ [ Hono / Node.js ]
  (Stripe/Razorpay)                             │
                                   ┌────────────┴────────────┐
                                   ▼                         ▼
                           [ Bounded Map ]           [ EventEmitter ]
                           (Max 50 / 1h TTL)                 │
                                                      streamSSE()
                                                             ▼
[ Target Endpoint ] ◀──POST /api/replay── [ React + Motion Workspace ]
```

- **Zero-Polling Real-Time Streaming:** Uses **Server-Sent Events (`streamSSE`)** backed by Node's native `EventEmitter` with serialized promise write queues to stream payloads to connected clients in milliseconds.
- **Bounded In-Memory Session Store:** Implements `O(1)` session lookup via `Map<string, WebhookEvent[]>` capped at 50 events per session, paired with a background `.unref()` TTL eviction timer (1-hour expiry) to prevent memory leaks.
- **Server-Side HTTP Replay Proxy:** Reconstructs original HTTP methods, safe headers (stripping hop-by-hop and browser `sec-fetch-*` headers), and payloads to forward requests to any target endpoint while measuring round-trip latency (`ms`).
- **Automated `cURL` Generation & Keyboard UX:** Dynamically compiles captured requests into ready-to-run terminal commands, with full `ArrowUp` / `ArrowDown` navigation and spring-physics transitions.

## Tech Stack

- **Backend:** Node.js, TypeScript, Hono, `@hono/node-server`
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Motion (`motion/react`), Lucide Icons

## Local Development

```bash
# 1. Start the Hono backend (Port 3001)
cd server
npm install
npm run dev

# 2. Start the Vite frontend (Port 5173)
cd client
npm install
npm run dev
```
