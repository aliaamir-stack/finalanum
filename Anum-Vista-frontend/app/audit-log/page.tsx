"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, AuditLogItem } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

const actionColors: Record<string, string> = {
  created: "bg-sky-100 text-sky-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-200 text-slate-600",
  verified: "bg-amber-100 text-amber-700",
  login: "bg-violet-100 text-violet-700",
};

const actionIcons: Record<string, string> = {
  created: "📝", approved: "✅", rejected: "❌", cancelled: "🚫", verified: "🔍", login: "🔑",
};

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function AuditLogPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [actorFilter, setActorFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (!authLoading && user?.role !== "super_admin") {
      router.push("/tenants");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    setLoading(true);
    api
      .getAuditLogs({
        limit: 200,
        offset: 0,
        action: actionFilter === "ALL" ? undefined : actionFilter,
        actor: actorFilter.trim() || undefined,
        date_from: fromDate || undefined,
        date_to: toDate || undefined,
      })
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [actionFilter, actorFilter, fromDate, toDate]);


  if (authLoading || user?.role !== "super_admin") return null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-slate-900">Audit Log</h2>
        <p className="mt-1 text-sm text-slate-500">Complete history of all actions. Records cannot be deleted.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          {["ALL", "created", "approved", "rejected", "cancelled", "verified", "login"].map(f => (
            <button key={f} onClick={() => setActionFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${actionFilter === f ? "bg-[#1e2a3a] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            {f === "ALL" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder="Filter by user"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
          />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200" />)}</div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-slate-600">No audit entries found.</p>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const isExp = expandedId === log.id;
            let details: Record<string, unknown> | null = null;
            try { if (log.details) details = JSON.parse(log.details); } catch {}

            return (
              <motion.div key={log.id} layout className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button type="button" onClick={() => setExpandedId(isExp ? null : log.id)}
                  className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-slate-50 transition">
                  <span className="text-lg">{actionIcons[log.action] || "📄"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${actionColors[log.action] || "bg-slate-100 text-slate-600"}`}>
                        {log.action}
                      </span>
                      <span className="text-xs text-slate-400">{log.entity_type} #{log.entity_id}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">
                      by <span className="font-medium text-slate-800">{log.performed_by_username || "System"}</span>
                      <span className="text-slate-400 ml-2">· {fmtTime(log.created_at)}</span>
                    </p>
                  </div>
                </button>
                {isExp && details && (
                  <div className="border-t border-slate-100 px-5 py-3 bg-slate-50">
                    <pre className="text-xs text-slate-600 whitespace-pre-wrap">{JSON.stringify(details, null, 2)}</pre>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
