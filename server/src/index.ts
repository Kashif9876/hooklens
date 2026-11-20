import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { setInterval } from "node:timers";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import type { WebhookEvent } from "./types.js";

const PORT = Number(process.env.PORT) || 3001;
const MAX_EVENTS_PER_SESSION = 50;
const EVENT_TTL_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

const sessions = new Map<string, WebhookEvent[]>();
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

const app = new Hono();

app.use("*", cors());

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function queryToRecord(url: string): Record<string, string> {
  const record: Record<string, string> = {};
  new URL(url).searchParams.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

async function readBody(request: Request): Promise<{ body: unknown; sizeBytes: number }> {
  const raw = await request.text();
  const sizeBytes = new TextEncoder().encode(raw).byteLength;
  if (raw.length === 0) {
    return { body: "", sizeBytes };
  }
  try {
    return { body: JSON.parse(raw) as unknown, sizeBytes };
  } catch {
    return { body: raw, sizeBytes };
  }
}

function storeEvent(sessionId: string, event: WebhookEvent): void {
  const events = sessions.get(sessionId) ?? [];
  events.unshift(event);
  if (events.length > MAX_EVENTS_PER_SESSION) {
    events.length = MAX_EVENTS_PER_SESSION;
  }
  sessions.set(sessionId, events);
}

setInterval(() => {
  const cutoff = Date.now() - EVENT_TTL_MS;
  for (const [sessionId, events] of sessions) {
    const fresh = events.filter((event) => event.timestamp >= cutoff);
    if (fresh.length === 0) {
      sessions.delete(sessionId);
    } else if (fresh.length !== events.length) {
      sessions.set(sessionId, fresh);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

app.all("/hook/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const { body, sizeBytes } = await readBody(c.req.raw);
  const event: WebhookEvent = {
    id: randomUUID(),
    sessionId,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    headers: headersToRecord(c.req.raw.headers),
    query: queryToRecord(c.req.url),
    body,
    timestamp: Date.now(),
    sizeBytes,
  };

  storeEvent(sessionId, event);
  emitter.emit(sessionId, event);

  return c.json({ received: true, eventId: event.id });
});

app.get("/api/events/:sessionId", (c) => {
  const sessionId = c.req.param("sessionId");
  return c.json(sessions.get(sessionId) ?? []);
});

app.get("/api/stream/:sessionId", (c) => {
  const sessionId = c.req.param("sessionId");

  return streamSSE(c, async (stream) => {
    let writes = Promise.resolve();

    const listener = (event: WebhookEvent) => {
      writes = writes
        .then(() =>
          stream.writeSSE({
            event: "webhook",
            data: JSON.stringify(event),
          }),
        )
        .catch(() => {
          emitter.off(sessionId, listener);
        });
    };

    emitter.on(sessionId, listener);

    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        emitter.off(sessionId, listener);
        resolve();
      });
    });
  });
});

app.post("/api/replay", async (c) => {
  const payload = await c.req.json<{ targetUrl: string; event: WebhookEvent }>();
  const { targetUrl, event } = payload;
  const headers = new Headers();

  for (const [key, value] of Object.entries(event.headers)) {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "content-length" || lower === "origin" || lower === "referer" || lower.startsWith("sec-")) {
      continue;    
        
    }
    headers.set(key, value);
  }

  const method = event.method.toUpperCase();
  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD" && event.body !== undefined && event.body !== null) {
    init.body = typeof event.body === "string" ? event.body : JSON.stringify(event.body);
  }

  const started = Date.now();
  try {
    const response = await fetch(targetUrl, init);
    const responseBody = await response.text();
    return c.json({
      status: response.status,
      statusText: response.statusText,
      durationMs: Date.now() - started,
      responseBody,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Replay failed";
    return c.json(
      {
        status: 0,
        statusText: "Error",
        durationMs: Date.now() - started,
        responseBody: message,
      },
      502,
    );
  }
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`HookLens listening on http://localhost:${info.port}`);
});
