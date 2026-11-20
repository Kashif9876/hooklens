import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Copy, RefreshCw, Send, Radio, Search, ChevronDown } from "lucide-react";
import type { WebhookEvent } from "./types";
import { RequestInspector } from "./components/RequestInspector";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const SPRING = { type: "spring" as const, stiffness: 450, damping: 32, mass: 0.8 };

const PRESETS: {
  name: string;
  tag: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}[] = [
  {
    name: "Stripe Payment",
    tag: "stripe",
    headers: { "X-Stripe-Signature": "t=1732089100,v1=9f8a7b6c5d", "User-Agent": "Stripe/1.0" },
    body: {
      id: "evt_3Q9xLm2eZvKYlo2C",
      type: "payment_intent.succeeded",
      amount: 49900,
      currency: "inr",
      status: "succeeded",
      customer: "dev@btech.ac.in",
    },
  },
  {
    name: "Razorpay Order",
    tag: "razorpay",
    headers: { "X-Razorpay-Event-Id": "evt_RzP99102", "User-Agent": "Razorpay-Webhook/1.0" },
    body: {
      event: "order.paid",
      payload: {
        order_id: "order_P8xK29Lm",
        amount: 149900,
        currency: "INR",
        method: "upi",
        verified: true,
      },
    },
  },
  {
    name: "GitHub Push",
    tag: "github",
    headers: { "X-GitHub-Event": "push", "X-Hub-Signature-256": "sha256=88f1c9a0e4" },
    body: {
      ref: "refs/heads/main",
      repository: "hooklens-engine",
      pusher: { name: "btech-builder" },
      commits_count: 3,
      deployed: true,
    },
  },
];

function generateSessionId() {
  return Math.random().toString(36).substring(2, 10);
}

export default function App() {
  const [sessionId, setSessionId] = useState<string>(() => {
    return localStorage.getItem("hooklens_session") || generateSessionId();
  });
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [presetIdx, setPresetIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const webhookUrl = `${API_URL}/hook/${sessionId}`;

  useEffect(() => {
    localStorage.setItem("hooklens_session", sessionId);
    setEvents([]);
    setSelectedId(null);

    fetch(`${API_URL}/api/events/${sessionId}`)
      .then((r) => r.json())
      .then((data: WebhookEvent[]) => {
        setEvents(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch(() => {});

    const es = new EventSource(`${API_URL}/api/stream/${sessionId}`);
    es.addEventListener("webhook", (e) => {
      const incoming: WebhookEvent = JSON.parse(e.data);
      setEvents((prev) => [incoming, ...prev]);
      setSelectedId((curr) => curr || incoming.id);
    });

    return () => es.close();
  }, [sessionId]);

  const filteredEvents = events.filter((ev) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      ev.method.toLowerCase().includes(q) ||
      ev.id.toLowerCase().includes(q) ||
      JSON.stringify(ev.body).toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || filteredEvents.length === 0) return;
      const idx = filteredEvents.findIndex((ev) => ev.id === selectedId);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = filteredEvents[Math.min(idx + 1, filteredEvents.length - 1)];
        if (next) setSelectedId(next.id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = filteredEvents[Math.max(idx - 1, 0)];
        if (prev) setSelectedId(prev.id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredEvents, selectedId]);

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1600);
  };

  const rotateSession = () => {
    setRotating(true);
    setSessionId(generateSessionId());
    setTimeout(() => setRotating(false), 450);
  };

  const simulateWebhook = async (idx = presetIdx) => {
    setSimulating(true);
    setMenuOpen(false);
    const preset = PRESETS[idx];
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...preset.headers,
        },
        body: JSON.stringify({
          ...preset.body,
          timestamp_iso: new Date().toISOString(),
        }),
      });
    } finally {
      setSimulating(false);
    }
  };

  const selectedEvent = events.find((e) => e.id === selectedId) || null;
  return (
    <div className="h-screen w-screen bg-[#09090B] text-zinc-100 flex flex-col overflow-hidden antialiased selection:bg-white/20">
      {/* Apple-Grade Glass Top Bar */}
      <header className="h-14 px-5 border-b border-white/[0.08] bg-[#111114]/80 backdrop-blur-xl flex items-center justify-between gap-4 shrink-0 relative z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-white/[0.1] to-white/[0.02] border border-white/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)] flex items-center justify-center">
            <Radio className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="font-semibold tracking-tight text-sm text-zinc-100">HookLens</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            SSE STREAM
          </span>
        </div>

        {/* Interactive Endpoint Pill */}
        <div className="flex items-center gap-2 bg-[#09090B] border border-white/10 hover:border-white/20 rounded-xl px-3.5 py-1.5 max-w-md w-full justify-between transition-colors duration-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
          <span className="font-mono text-xs text-zinc-300 truncate">{webhookUrl}</span>
          <div className="flex items-center gap-1 shrink-0">
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              transition={SPRING}
              onClick={copyUrl}
              title="Copy URL"
              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            >
              <AnimatePresence mode="wait" initial={false}>
                {copiedUrl ? (
                  <motion.span
                    key="ok"
                    initial={{ scale: 0.5, rotate: -45, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={SPRING}
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="cp"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={SPRING}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              onClick={rotateSession}
              title="Rotate Endpoint"
              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            >
              <motion.div
                animate={{ rotate: rotating ? 360 : 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </motion.div>
            </motion.button>
          </div>
        </div>

        {/* Multi-Preset Simulate Split Button */}
        <div className="relative flex items-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING}
            onClick={() => simulateWebhook(presetIdx)}
            disabled={simulating}
            className="px-3.5 py-1.5 rounded-l-xl text-xs font-medium bg-zinc-100 text-zinc-950 hover:bg-white border-r border-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer shadow-[0_1px_14px_rgba(255,255,255,0.12)]"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{simulating ? "Firing..." : `Test ${PRESETS[presetIdx].name}`}</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING}
            onClick={() => setMenuOpen((o) => !o)}
            className="px-2 py-1.5 rounded-r-xl text-xs font-medium bg-zinc-100 text-zinc-950 hover:bg-white flex items-center cursor-pointer"
          >
            <motion.div animate={{ rotate: menuOpen ? 180 : 0 }} transition={SPRING}>
              <ChevronDown className="w-3.5 h-3.5" />
            </motion.div>
          </motion.button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.96 }}
                transition={SPRING}
                className="absolute right-0 top-10 w-48 rounded-xl bg-[#16161A] border border-white/15 shadow-2xl p-1.5 z-50"
              >
                {PRESETS.map((p, i) => (
                  <button
                    key={p.tag}
                    onClick={() => {
                      setPresetIdx(i);
                      simulateWebhook(i);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-zinc-200 hover:bg-white/[0.08] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>{p.name}</span>
                    <span className="font-mono text-[10px] text-zinc-500">{p.tag}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main Split Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Feed */}
        <aside className="w-80 border-r border-white/[0.08] bg-[#111114]/40 flex flex-col shrink-0">
          <div className="p-3 border-b border-white/[0.08] space-y-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter payloads..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#09090B] border border-white/10 hover:border-white/20 focus:border-white/30 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none transition-colors duration-200"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
              <span>Requests ({filteredEvents.length})</span>
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10 text-zinc-400">↑</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10 text-zinc-400">↓</kbd>
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <AnimatePresence initial={false}>
              {filteredEvents.map((ev) => {
                const isSelected = ev.id === selectedId;
                return (
                  <motion.button
                    key={ev.id}
                    layout
                    initial={{ opacity: 0, y: -14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ x: 2 }}
                    transition={SPRING}
                    onClick={() => setSelectedId(ev.id)}
                    className="relative w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="activeRequestPill"
                        transition={SPRING}
                        className="absolute inset-0 bg-white/[0.08] border border-white/15 rounded-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                      />
                    )}
                    <div className="relative z-10 flex items-center gap-2.5 min-w-0">
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {ev.method}
                      </span>
                      <span className="font-mono text-xs text-zinc-200 group-hover:text-white truncate transition-colors">
                        #{ev.id.slice(0, 6)}
                      </span>
                    </div>
                    <div className="relative z-10 text-right shrink-0">
                      <div className="font-mono text-[11px] text-zinc-400">
                        {new Date(ev.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-600">{ev.sizeBytes} B</div>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </aside>

        {/* Right Payload Inspector */}
        <RequestInspector event={selectedEvent} />
      </div>
    </div>
  );
}
