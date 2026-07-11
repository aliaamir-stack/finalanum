"use client";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { api, UnpaidMonth } from "@/lib/api";
import type { Occupant } from "@/lib/types";

const fmt = (v: string) => `₨ ${Number(v).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
const toMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const parseDate = (v: string | null) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
const prettyMonth = (v: string) => { const [y, m] = v.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }); };
const computeStatus = (t: Occupant): "Overdue" | "Settled" => {
  const now = new Date(); const cur = new Date(now.getFullYear(), now.getMonth(), 1);
  const lp = parseDate(t.last_paid_month); if (!lp) return "Overdue";
  return new Date(lp.getFullYear(), lp.getMonth(), 1) >= cur ? "Settled" : "Overdue";
};
const computeUnpaid = (t: Occupant): string[] => {
  const now = new Date(); const cur = new Date(now.getFullYear(), now.getMonth(), 1);
  const lp = parseDate(t.last_paid_month); if (!lp) return [toMonthKey(cur)];
  const pm = new Date(lp.getFullYear(), lp.getMonth(), 1); const ms: string[] = [];
  const c = new Date(pm.getFullYear(), pm.getMonth() + 1, 1);
  while (c <= cur) { ms.push(toMonthKey(c)); c.setMonth(c.getMonth() + 1); }
  return ms;
};

const getNum = (u: string) => { const m = u.match(/\d+/g); if (!m) return null; const n = Number(m.join("")); return isFinite(n) ? n : null; };
const DEFAULT_TREASURERS = ["Naveed", "Asif", "Dilshad", "Ali", "Danish"];

// Generate month options for multi-select
const genMonthOptions = (year: number) => {
  const labels = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return labels.map((l, i) => ({ label: l, value: `${year}-${String(i + 1).padStart(2, "0")}`, year }));
};

export default function TenantsPage() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OVERDUE" | "SETTLED">("ALL");
  const [selectedTenant, setSelectedTenant] = useState<Occupant | null>(null);
  const [treasurers, setTreasurers] = useState<string[]>(DEFAULT_TREASURERS);
  const [creditedTo, setCreditedTo] = useState(DEFAULT_TREASURERS[0]);
  const [generatedBy, setGeneratedBy] = useState<string>("System");
  const [paymentMode, setPaymentMode] = useState<string>("cash");
  const [autoAllocateMode, setAutoAllocateMode] = useState(false);
  const [autoAmount, setAutoAmount] = useState("");
  const [autoResult, setAutoResult] = useState<import("@/lib/api").AutoAllocateResult | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Multi-month selection
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [unpaidMonths, setUnpaidMonths] = useState<UnpaidMonth[]>([]);
  const [monthError, setMonthError] = useState<string | null>(null);

  const { data: tenants = [], isLoading, error } = useQuery({ queryKey: ["tenants"], queryFn: api.getTenants });

  useEffect(() => {
    api
      .getTreasurers()
      .then((resp) => {
        if (resp.treasurers?.length) {
          setTreasurers(resp.treasurers);
          setCreditedTo((prev) => (resp.treasurers.includes(prev) ? prev : resp.treasurers[0]));
        }
      })
      .catch(() => {
        setTreasurers(DEFAULT_TREASURERS);
      });
  }, []);

  // Fetch unpaid months when tenant is selected
  useEffect(() => {
    if (!selectedTenant) { setUnpaidMonths([]); setSelectedMonths(new Set()); return; }
    api.getUnpaidMonths(selectedTenant.id).then(r => {
      setUnpaidMonths(r.months);
      // Auto-select the earliest unpaid month
      if (r.months.length > 0) setSelectedMonths(new Set([r.months[0].month_key]));
      else setSelectedMonths(new Set());
    }).catch(() => {});
  }, [selectedTenant]);

  const hasDues = unpaidMonths.length > 0;
  const unpaidKeys = useMemo(() => new Set(unpaidMonths.map(m => m.month_key)), [unpaidMonths]);

  // Available months: current year + next year
  const currentYear = new Date().getFullYear();
  const allMonths = useMemo(
    () => [...genMonthOptions(currentYear), ...genMonthOptions(currentYear + 1)],
    [currentYear],
  );

  // Paid months from tenant data
  const paidThrough = selectedTenant?.last_paid_month ? parseDate(selectedTenant.last_paid_month) : null;
  const paidThroughKey = paidThrough ? toMonthKey(new Date(paidThrough.getFullYear(), paidThrough.getMonth(), 1)) : null;

  const toggleMonth = (key: string) => {
    setMonthError(null);
    const next = new Set(selectedMonths);
    if (next.has(key)) {
      next.delete(key);
    } else {
      // If this is an unpaid month, auto-select all earlier unpaid months
      if (unpaidKeys.has(key)) {
        for (const u of unpaidMonths) {
          if (u.month_key <= key) next.add(u.month_key);
        }
      } else if (hasDues) {
        // Can't select future months if dues exist without selecting all dues first
        const allDuesSelected = unpaidMonths.every(u => next.has(u.month_key));
        if (!allDuesSelected) {
          setMonthError("Clear all outstanding dues before selecting advance months.");
          return;
        }
        next.add(key);
      } else {
        next.add(key);
      }
    }
    // Validate: if any unpaid month is selected, all earlier ones must be too
    if (hasDues) {
      const earliestUnpaid = unpaidMonths[0].month_key;
      const hasAnyDue = unpaidMonths.some(u => next.has(u.month_key));
      if (hasAnyDue && !next.has(earliestUnpaid)) {
        setMonthError(`Must include earliest due (${prettyMonth(earliestUnpaid)}) first.`);
        return;
      }
    }
    setSelectedMonths(next);
  };

  const totalAmount = useMemo(() => {
    if (!selectedTenant) return 0;
    const fee = Number(selectedTenant.total_monthly_maintenance || selectedTenant.monthly_maintenance_fee);
    return fee * selectedMonths.size;
  }, [selectedTenant, selectedMonths]);

  const submitReceipt = useMutation({
    mutationFn: () => {
      if (!selectedTenant || selectedMonths.size === 0) throw new Error("Select months");
      return api.createReceiptV2({
        occupant_id: selectedTenant.id,
        months: Array.from(selectedMonths).sort(),
        amount: String(totalAmount),
        generated_by: generatedBy,
        credited_to: creditedTo,
        payment_mode: paymentMode || undefined,
      });
    },
    onSuccess: (resp) => {
      const approved = resp.status === "approved";
      setToast({
        type: "success",
        message: approved
          ? "Receipt logged and credited to inflow."
          : "Receipt submitted for Super Admin approval.",
      });
      setSelectedTenant(null); setSelectedMonths(new Set());
      setAutoAllocateMode(false); setAutoAmount(""); setAutoResult(null);
      qc.invalidateQueries({ queryKey: ["tenants"] });
    },
    onError: (e) => setToast({ type: "error", message: (e as Error).message }),
  });

  const submitAutoAllocate = useMutation({
    mutationFn: () => {
      if (!selectedTenant || !autoAmount) throw new Error("Enter an amount");
      return api.autoAllocatePayment({
        occupant_id: selectedTenant.id,
        amount: autoAmount,
        credited_to: creditedTo,
        generated_by: generatedBy,
        payment_mode: paymentMode || undefined,
      });
    },
    onSuccess: (resp) => {
      setAutoResult(resp);
      const approved = resp.status === "approved";
      setToast({
        type: "success",
        message: approved
          ? `Auto-allocated ${resp.months_covered.length} month(s). Receipt ${resp.receipt_no} approved.`
          : `Auto-allocated ${resp.months_covered.length} month(s). Pending approval.`,
      });
      qc.invalidateQueries({ queryKey: ["tenants"] });
    },
    onError: (e) => setToast({ type: "error", message: (e as Error).message }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants
      .filter(t => {
        // Drop placeholder/invalid units (e.g. "Appartment No." with no numeric unit)
        if (!t.unit || !t.unit.unit_no) return false;
        if (getNum(t.unit.unit_no) === null) return false;
        const ms = !q || t.name.toLowerCase().includes(q) || t.unit.unit_no.toLowerCase().includes(q);
        const s = computeStatus(t);
        const sf = statusFilter === "ALL" || (statusFilter === "OVERDUE" && s === "Overdue") || (statusFilter === "SETTLED" && s === "Settled");
        return ms && sf;
      })
      .sort((a, b) => {
        const an = getNum(a.unit.unit_no) ?? Number.MAX_SAFE_INTEGER;
        const bn = getNum(b.unit.unit_no) ?? Number.MAX_SAFE_INTEGER;
        if (an !== bn) return an - bn;
        return a.unit.unit_no.localeCompare(b.unit.unit_no);
      });
  }, [search, statusFilter, tenants]);

  useEffect(() => { if (toast) { const id = setTimeout(() => setToast(null), 3000); return () => clearTimeout(id); } }, [toast]);

  return (
    <section className="space-y-6">
      <div><h2 className="text-3xl font-semibold text-slate-900">Residents & Collections</h2><p className="mt-1 text-sm text-slate-500">Expand residents, review dues, and generate maintenance receipts.</p></div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{(error as Error).message}</div>}

      <div className="sticky top-4 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or apartment..." className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none md:max-w-xl" />
          <div className="flex items-center gap-2">
            {(["ALL", "OVERDUE", "SETTLED"] as const).map(o => (
              <button key={o} onClick={() => setStatusFilter(o)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${statusFilter === o ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                {o === "ALL" ? "All" : o === "OVERDUE" ? "Overdue" : "Settled"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />)}</div> : (
        <div className="space-y-3">
          {filtered.map(tenant => {
            const status = computeStatus(tenant); const isExp = expandedId === tenant.id;
            const unpaid = computeUnpaid(tenant); const hasPast = unpaid.length > 1;
            const isRental = tenant.unit.is_rental;
            return (
              <motion.article key={tenant.id} layout className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${isRental ? "border-violet-200 ring-1 ring-violet-100" : "border-slate-200"}`}>
                <button type="button" onClick={() => setExpandedId(isExp ? null : tenant.id)} className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition ${isRental ? "hover:bg-violet-50/50" : "hover:bg-slate-50"}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-semibold text-slate-900">{tenant.unit.unit_no}</p>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${isRental ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>{isRental ? "Rental" : "Permanent"}</span>
                      {hasPast && <span className="relative inline-flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" /></span>}
                    </div>
                    <p className="truncate text-sm text-slate-600">{tenant.name}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === "Overdue" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{status}</span>
                </button>
                <AnimatePresence>{isExp && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="border-t border-slate-100 px-5 py-4">
                    <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                      <p><span className="font-semibold text-slate-800">Monthly (base):</span> {fmt(tenant.monthly_maintenance_fee)}</p>
                      <p><span className="font-semibold text-slate-800">Total Monthly:</span> {tenant.total_monthly_maintenance ? fmt(tenant.total_monthly_maintenance) : fmt(tenant.monthly_maintenance_fee)}</p>
                      <p><span className="font-semibold text-slate-800">Contact:</span> {tenant.contact || "—"}</p>
                      <p><span className="font-semibold text-slate-800">CNIC:</span> {tenant.cnic || "—"}</p>
                      <p className="md:col-span-2"><span className="font-semibold text-slate-800">Expected dues:</span> {fmt(tenant.expected_dues)}</p>
                    </div>
                    {unpaid.length > 0 && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Unpaid months</p>
                        <div className="mt-2 flex flex-wrap gap-2">{unpaid.map(m => <span key={m} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">{prettyMonth(m)}</span>)}</div>
                      </div>
                    )}
                    <button type="button" onClick={() => setSelectedTenant(tenant)} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Generate Receipt</button>
                  </motion.div>
                )}</AnimatePresence>
              </motion.article>
            );
          })}
          {!isLoading && filtered.length === 0 && <p className="text-sm text-slate-600">No tenants match your filters.</p>}
        </div>
      )}

      {/* Receipt Modal — Multi-Month + Credited To */}
      <AnimatePresence>{selectedTenant && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex justify-between">
              <div><h3 className="text-xl font-semibold text-slate-900">Generate Receipt</h3><p className="text-sm text-slate-500">For {selectedTenant.name} — {selectedTenant.unit.unit_no}</p></div>
              <button onClick={() => { setSelectedTenant(null); setAutoAllocateMode(false); setAutoAmount(""); setAutoResult(null); }} className="text-sm font-semibold text-slate-500 hover:text-slate-700">Close</button>
            </div>

            {/* Mode Toggle */}
            <div className="mb-4 flex rounded-lg border border-slate-200 p-0.5">
              <button
                onClick={() => { setAutoAllocateMode(false); setAutoResult(null); }}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${!autoAllocateMode ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                Manual Select
              </button>
              <button
                onClick={() => setAutoAllocateMode(true)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${autoAllocateMode ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                Auto-Allocate
              </button>
            </div>

            {autoAllocateMode ? (
              /* ── Auto-Allocate Mode ── */
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Total Amount Received</label>
                  <input
                    type="number"
                    value={autoAmount}
                    onChange={(e) => { setAutoAmount(e.target.value); setAutoResult(null); }}
                    placeholder="Enter amount in PKR..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Monthly fee: {fmt(selectedTenant.total_monthly_maintenance || selectedTenant.monthly_maintenance_fee)}
                    — System will cover unpaid months first, then advance months.
                  </p>
                </div>

                {/* Shared fields: Credited To, Generated By, Payment Mode */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Credited To</label>
                  <select value={creditedTo} onChange={e => setCreditedTo(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none">
                    {treasurers.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Generated By</label>
                  <select value={generatedBy} onChange={e => setGeneratedBy(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none">
                    <option>Naveed</option><option>Dilshad</option><option>System</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Payment Mode</label>
                  <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none">
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="online">Online</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {autoResult && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                    <p className="text-sm font-semibold text-emerald-800">
                      Receipt {autoResult.receipt_no} — {autoResult.status.toUpperCase()}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {autoResult.months_covered.map((m) => (
                        <span key={m.month_key} className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          {m.label} ({fmt(m.amount)})
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-emerald-600">
                      Applied: {fmt(autoResult.total_applied)}
                      {Number(autoResult.remainder) > 0 && ` — Remainder: ${fmt(autoResult.remainder)} (not stored as credit)`}
                    </p>
                  </div>
                )}

                {!autoResult && (
                  <button
                    type="button"
                    onClick={() => submitAutoAllocate.mutate()}
                    disabled={submitAutoAllocate.isPending || !autoAmount || Number(autoAmount) <= 0}
                    className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {submitAutoAllocate.isPending ? "Allocating..." : "Auto-Allocate & Submit"}
                  </button>
                )}

                {autoResult && (
                  <button
                    type="button"
                    onClick={() => { setSelectedTenant(null); setAutoAllocateMode(false); setAutoAmount(""); setAutoResult(null); }}
                    className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Done
                  </button>
                )}
              </div>
            ) : (
              /* ── Manual Select Mode ── */
              <>
            {hasDues && (
              <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                This resident has outstanding dues. Earliest dues must be cleared first. Advance months can only be selected after all dues are paid.
              </div>
            )}

            {monthError && <div className="mb-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{monthError}</div>}

            {/* Month Grid */}
            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold uppercase text-slate-500">Select Months</label>
              <div className="grid grid-cols-3 gap-2">
                {allMonths.map(m => {
                  const isPaid = paidThroughKey ? m.value <= paidThroughKey : false;
                  const isDue = unpaidKeys.has(m.value);
                  const isSelected = selectedMonths.has(m.value);
                  const isFuture = !isPaid && !isDue;
                  return (
                    <button key={m.value} type="button" disabled={isPaid}
                      onClick={() => toggleMonth(m.value)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        isPaid ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" :
                        isSelected && isDue ? "bg-amber-500 text-white border-amber-500" :
                        isSelected && isFuture ? "bg-sky-500 text-white border-sky-500" :
                        isDue ? "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100" :
                        "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {m.label.slice(0, 3)} {m.year}
                      {isPaid && " ✓"}
                      {isDue && !isSelected && " ●"}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-4 text-[10px] text-slate-500">
                <span>✓ Paid</span><span className="text-amber-600">● Due</span><span className="text-sky-600">■ Advance</span>
              </div>
            </div>

            {/* Credited To */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Credited To</label>
              <select value={creditedTo} onChange={e => setCreditedTo(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none">
                {treasurers.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Generated By */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Generated By</label>
              <select value={generatedBy} onChange={e => setGeneratedBy(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none">
                <option>Naveed</option><option>Dilshad</option><option>System</option>
              </select>
            </div>

            {/* Payment Mode */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Payment Mode</label>
              <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="online">Online</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Total */}
            <div className="mb-4 rounded-xl bg-slate-50 border border-slate-200 p-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-500">{selectedMonths.size} month(s) selected</p>
                <p className="text-sm text-slate-600">{Array.from(selectedMonths).sort().map(m => prettyMonth(m)).join(", ") || "None"}</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">{fmt(String(totalAmount))}</p>
            </div>

            <button type="button" onClick={() => submitReceipt.mutate()} disabled={submitReceipt.isPending || selectedMonths.size === 0}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
              {submitReceipt.isPending ? "Submitting..." : "Submit for Approval"}
            </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{toast && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
          className={`fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === "success" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
          {toast.message}
        </motion.div>
      )}</AnimatePresence>
    </section>
  );
}
