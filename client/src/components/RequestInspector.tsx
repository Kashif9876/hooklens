import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Copy, Play, Terminal, Clock, Code2 } from "lucide-react";
import type { WebhookEvent } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const TABS = ["Body", "Headers", "Query", "cURL"] as const;
type Tab = (typeof TABS)[number];
const SPRING = { type: "spring" as const, stiffness: 450, damping: 32, mass: 0.8 };

function JsonView({ data }: { data: unknown }) {
  const str = typeof data === "string" ? data || "(empty body)" : JSON.stringify(data, null, 2);
  const html = str.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?)/g, (m) => {
    const cls = /^"/.test(m)
      ? /:$/.test(m) ? "text-zinc-200 font-medium" : "text-emerald-300"
      : /true|false/.test(m) ? "text-sky-300" : "text-amber-300";
    return `<span class="${cls}">${m}</span>`;
  });
  return <pre className="font-mono text-[13px] leading-relaxed overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function RequestInspector({ event }: { event: WebhookEvent | null }) {
  const [activeTab, setActiveTab] = useState<Tab>("Body");
  const [copied, setCopied] = useState(false);
  const [replayUrl, setReplayUrl] = useState("https://postman-echo.com/post");
  const [replaying, setReplaying] = useState(false);
  const [replayRes, setReplayRes] = useState<{ status: number; statusText: string; durationMs: number } | null>(null);

  if (!event) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 select-none relative overflow-hidden">
        <div className="absolute w-96 h-96 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING} className="relative z-10 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] flex items-center justify-center mb-4">
            <Terminal className="w-6 h-6 text-zinc-300" />
          </div>
          <p className="text-sm font-medium text-zinc-200">Ready to Intercept</p>
          <p className="text-xs text-zinc-500 mt-1.5 max-w-xs text-center leading-relaxed">
            Fire a simulated webhook from the top bar or send any HTTP request to your live endpoint.
          </p>
        </motion.div>
      </div>
    );
  }

  const getCurl = () => {
    const hdrs = Object.entries(event.headers)
      .filter(([k]) => !["host", "content-length", "connection"].includes(k.toLowerCase()))
      .map(([k, v]) => `  -H "${k}: ${v}"`)
      .join(" \\\n");
    const body = typeof event.body === "string" ? event.body : JSON.stringify(event.body);
    return `curl -X ${event.method} "${replayUrl}" \\\n${hdrs}${body && event.method !== "GET" ? ` \\\n  -d '${body}'` : ""}`;
  };

  const rawText =
    activeTab === "cURL"
      ? getCurl()
      : typeof event.body === "string" && activeTab === "Body"
      ? event.body
      : JSON.stringify(activeTab === "Body" ? event.body : activeTab === "Headers" ? event.headers : event.query, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleReplay = async () => {
    if (!replayUrl.trim() || replaying) return;
    setReplaying(true);
    setReplayRes(null);
    try {
      const r = await fetch(`${API_URL}/api/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: replayUrl, event }),
      });
      const d = await r.json();
      setReplayRes({ status: d.status || 502, statusText: d.statusText || (d.status >= 200 && d.status < 300 ? "OK" : "Error"), durationMs: d.durationMs || 0 });
    } catch {
      setReplayRes({ status: 502, statusText: "Unreachable", durationMs: 0 });
    } finally {
      setReplaying(false);
    }
  };
  return (
    <motion.div
      key={event.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      className="flex-1 flex flex-col bg-[#09090B] overflow-hidden"
    >
      <div className="p-4 border-b border-white/[0.08] bg-[#111114]/70 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
            {event.method}
          </span>
          <span className="font-mono text-sm text-zinc-100">{event.path}</span>
          <span className="text-xs font-mono text-zinc-500 flex items-center gap-1.5 pl-2 border-l border-white/10">
            <Clock className="w-3.5 h-3.5" />
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <AnimatePresence mode="popLayout">
            {replayRes && (
              <motion.span
                initial={{ opacity: 0, scale: 0.85, x: 8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={SPRING}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono border ${
                  replayRes.status >= 200 && replayRes.status < 300
                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                    : "bg-rose-500/10 text-rose-300 border-rose-500/25"
                }`}
              >
                {replayRes.status} {replayRes.statusText} • {replayRes.durationMs}ms
              </motion.span>
            )}
          </AnimatePresence>

          <input
            type="text"
            value={replayUrl}
            onChange={(e) => setReplayUrl(e.target.value)}
            className="w-56 px-3 py-1.5 text-xs font-mono bg-[#09090B] border border-white/10 hover:border-white/25 focus:border-white/35 rounded-lg text-zinc-200 focus:outline-none transition-colors"
          />

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING}
            onClick={handleReplay}
            disabled={replaying}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-950 hover:bg-white border border-white/20 shadow-[0_1px_12px_rgba(255,255,255,0.12)] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            <motion.span
              animate={replaying ? { rotate: 360 } : { rotate: 0 }}
              transition={replaying ? { repeat: Infinity, duration: 0.8, ease: "linear" } : SPRING}
            >
              <Play className="w-3 h-3 fill-current" />
            </motion.span>
            {replaying ? "Replaying..." : "Replay"}
          </motion.button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-white/[0.08] flex items-center justify-between bg-[#111114]/30">
        <div className="flex items-center gap-1 bg-[#09090B] p-1 rounded-xl border border-white/[0.08]">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isActive ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="inspectorTabPill"
                    transition={SPRING}
                    className="absolute inset-0 bg-white/[0.09] border border-white/[0.12] rounded-lg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {tab === "cURL" && <Code2 className="w-3.5 h-3.5 text-zinc-400" />}
                  {tab}
                </span>
              </button>
            );
          })}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          transition={SPRING}
          onClick={handleCopy}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/25 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span
                key="ok"
                initial={{ scale: 0.4, rotate: -45, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={SPRING}
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              </motion.span>
            ) : (
              <motion.span
                key="cp"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={SPRING}
              >
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
              </motion.span>
            )}
          </AnimatePresence>
          <span>{copied ? "Copied" : `Copy ${activeTab}`}</span>
        </motion.button>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.995 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="bg-[#111114] border border-white/[0.09] rounded-2xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
          >
            {activeTab === "cURL" ? (
              <pre className="font-mono text-[13px] leading-relaxed text-zinc-200 overflow-x-auto">
                <code>{getCurl()}</code>
              </pre>
            ) : (
              <JsonView
                data={
                  activeTab === "Body"
                    ? event.body
                    : activeTab === "Headers"
                    ? event.headers
                    : event.query
                }
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
