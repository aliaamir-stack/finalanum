"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, LedgerOut } from "@/lib/api";
import type { Occupant } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

const fmt = (v: string | number) =>
  `₨ ${Number(v).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;

const statusStyles: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-rose-100 text-rose-700",
  partial: "bg-amber-100 text-amber-700",
  advance: "bg-sky-100 text-sky-700",
  upcoming: "bg-slate-100 text-slate-500",
};

export default function LedgerPage() {
  const { isAuthenticated } = useAuth();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");

  const { data: tenants = [] } = useQuery<Occupant[]>({
    queryKey: ["tenants"],
    queryFn: api.getTenants,
    enabled: isAuthenticated,
  });

  const { data: ledger, isLoading: ledgerLoading } = useQuery<LedgerOut>({
    queryKey: ["ledger", selectedId, year],
    queryFn: () => api.getResidentLedger(selectedId!, year),
    enabled: isAuthenticated && selectedId != null,
  });

  const filteredTenants = tenants.filter((t) => {
    if (!t.unit?.unit_no) return false;
    const q = search.trim().toLowerCase();
    return !q || t.name.toLowerCase().includes(q) || t.unit.unit_no.toLowerCase().includes(q);
  }).sort((a, b) => {
    const an = a.unit.unit_no.match(/\d+/);
    const bn = b.unit.unit_no.match(/\d+/);
    return (an ? Number(an[0]) : 999) - (bn ? Number(bn[0]) : 999);
  });

  if (!isAuthenticated) return null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-slate-900">Resident Ledger</h2>
        <p className="mt-1 text-sm text-slate-500">Month-by-month payment status for any resident</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        {/* Resident Picker */}
        <div className="flex-1 min-w-[240px]">
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Select Resident</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search residents..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
          />
          {search && !selectedId && filteredTenants.length > 0 && (
            <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {filteredTenants.slice(0, 10).map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedId(t.id); setSearch(`${t.unit.unit_no} — ${t.name}`); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition"
                >
                  <span className="font-semibold text-slate-900">{t.unit.unit_no}</span>
                  <span className="ml-2 text-slate-600">{t.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Year Picker */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {selectedId && (
          <button
            onClick={() => { setSelectedId(null); setSearch(""); }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        )}
      </div>

      {!selectedId && (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-slate-400">Select a resident above to view their ledger.</p>
        </div>
      )}

      {selectedId && ledgerLoading && (
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      )}

      {ledger && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {ledger.unit_no} — {ledger.occupant_name}
                </p>
                <p className="text-sm text-slate-500">Monthly fee: {fmt(ledger.monthly_fee)}</p>
              </div>
              <div className="flex gap-2 text-xs">
                {Object.entries(statusStyles).map(([key, cls]) => (
                  <span key={key} className={`rounded-full px-2 py-0.5 font-semibold capitalize ${cls}`}>
                    {key}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ledger.entries.map((e) => {
                  const due = Number(e.amount_due);
                  const paid = Number(e.amount_paid);
                  const balance = due - paid;
                  return (
                    <tr key={e.month_key} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-medium text-slate-700">{e.label}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusStyles[e.status] || "bg-slate-100 text-slate-500"}`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(due)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(paid)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${balance > 0 ? "text-rose-600" : balance < 0 ? "text-sky-600" : "text-slate-400"}`}>
                        {balance === 0 ? "—" : balance > 0 ? fmt(balance) : `-${fmt(Math.abs(balance))}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
