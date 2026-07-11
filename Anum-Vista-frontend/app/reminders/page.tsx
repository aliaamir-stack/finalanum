"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, DueReminderEntry, DueRemindersOut } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const fmt = (v: string | number) =>
  `₨ ${Number(v).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;

export default function RemindersPage() {
  const { user, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const isSuperAdmin = user?.role === "super_admin";
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<Record<number, "sending" | "sent" | "error">>({});

  const { data, isLoading, error } = useQuery<DueRemindersOut>({
    queryKey: ["reminders", "due"],
    queryFn: api.getDueReminders,
    enabled: isAuthenticated,
  });

  const { data: waConfig } = useQuery({
    queryKey: ["whatsapp", "config"],
    queryFn: api.getWhatsAppConfig,
    enabled: isAuthenticated,
    retry: false,
  });

  const generateMutation = useMutation({
    mutationFn: api.generateDueReminders,
    onSuccess: (resp) => {
      setToast({ type: "success", message: resp.message });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (e) => {
      setToast({ type: "error", message: (e as Error).message });
      setTimeout(() => setToast(null), 3000);
    },
  });

  const sendWhatsApp = async (entry: DueReminderEntry) => {
    if (!entry.contact) return;
    setWhatsappStatus((prev) => ({ ...prev, [entry.occupant_id]: "sending" }));
    try {
      const message = `Dear ${entry.name},\n\nThis is a reminder that your maintenance dues of ${fmt(entry.total_due)} (${entry.months_overdue} month${entry.months_overdue !== 1 ? "s" : ""}) for Apt ${entry.unit_no} are pending.\n\nUnpaid months: ${entry.unpaid_months.join(", ")}\n\nPlease arrange payment at your earliest convenience.\n\nRegards,\nAnum Vista Management`;
      await api.sendWhatsAppReminder({
        occupant_id: entry.occupant_id,
        phone: entry.contact,
        message,
      });
      setWhatsappStatus((prev) => ({ ...prev, [entry.occupant_id]: "sent" }));
    } catch {
      setWhatsappStatus((prev) => ({ ...prev, [entry.occupant_id]: "error" }));
    }
  };

  const sendBulkWhatsApp = async () => {
    if (!data) return;
    const entries = data.entries.filter((e) => e.contact);
    if (entries.length === 0) {
      setToast({ type: "error", message: "No residents have contact numbers." });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const bulk = entries.map((e) => ({
      occupant_id: e.occupant_id,
      phone: e.contact!,
      message: `Dear ${e.name}, your maintenance dues of ${fmt(e.total_due)} (${e.months_overdue} month(s)) for Apt ${e.unit_no} are pending. Please arrange payment. — Anum Vista`,
    }));
    try {
      const resp = await api.sendWhatsAppBulk({ entries: bulk });
      setToast({ type: "success", message: `Sent ${resp.sent} message(s), ${resp.failed} failed.` });
    } catch (err) {
      setToast({ type: "error", message: (err as Error).message });
    }
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = (data?.entries ?? []).filter((e) => {
    const q = search.trim().toLowerCase();
    return !q || e.name.toLowerCase().includes(q) || e.unit_no.toLowerCase().includes(q);
  });

  const waConfigured = waConfig?.configured === true;

  if (!isAuthenticated) return null;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900">Due Reminders</h2>
          <p className="mt-1 text-sm text-slate-500">
            Residents with pending maintenance dues
            {data && <span className="ml-2 font-semibold text-amber-600">— {data.total_residents_due} resident(s)</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {generateMutation.isPending ? "Sending..." : "Generate In-App Notifications"}
            </button>
          )}
          <button
            onClick={sendBulkWhatsApp}
            disabled={!waConfigured}
            title={waConfigured ? "Send WhatsApp reminders to all" : "WhatsApp not configured — set up API keys in backend .env"}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              waConfigured
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-green-200 text-green-500 cursor-not-allowed"
            }`}
          >
            Send All via WhatsApp
          </button>
        </div>
      </div>

      {!waConfigured && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          WhatsApp integration is not configured yet. Add your API credentials in the backend <code className="rounded bg-slate-200 px-1 py-0.5 text-xs">.env</code> file to enable messaging.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {(error as Error).message}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or apartment..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none md:max-w-sm"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((e) => (
              <div key={e.occupant_id} className="flex flex-wrap items-center gap-4 px-4 py-4 hover:bg-slate-50 transition">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{e.unit_no}</span>
                    <span className="text-sm text-slate-600">{e.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      e.months_overdue >= 3 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {e.months_overdue} month{e.months_overdue !== 1 ? "s" : ""} overdue
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {e.unpaid_months.join(", ")} — Fee: {fmt(e.monthly_fee)}/mo
                  </p>
                  {e.contact && (
                    <p className="mt-0.5 text-xs text-slate-400">Contact: {e.contact}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-rose-600">{fmt(e.total_due)}</span>
                  <button
                    onClick={() => sendWhatsApp(e)}
                    disabled={!waConfigured || !e.contact || whatsappStatus[e.occupant_id] === "sending"}
                    title={!e.contact ? "No contact number" : !waConfigured ? "WhatsApp not configured" : "Send WhatsApp reminder"}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      whatsappStatus[e.occupant_id] === "sent"
                        ? "bg-emerald-100 text-emerald-700"
                        : whatsappStatus[e.occupant_id] === "error"
                          ? "bg-rose-100 text-rose-700"
                          : waConfigured && e.contact
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {whatsappStatus[e.occupant_id] === "sending"
                      ? "Sending..."
                      : whatsappStatus[e.occupant_id] === "sent"
                        ? "Sent ✓"
                        : whatsappStatus[e.occupant_id] === "error"
                          ? "Failed"
                          : "WhatsApp"}
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-400">
                {search ? "No results match your search." : "No pending dues — all caught up!"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
          toast.type === "success" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
        }`}>
          {toast.message}
        </div>
      )}
    </section>
  );
}
