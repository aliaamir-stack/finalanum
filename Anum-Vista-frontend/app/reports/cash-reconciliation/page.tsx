"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, CashReconciliationReport } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const fmt = (v: string | number) =>
  `₨ ${Number(v).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CashReconciliationPage() {
  const { user, isAuthenticated } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const isSuperAdmin = user?.role === "super_admin";

  const { data, isLoading, error } = useQuery<CashReconciliationReport>({
    queryKey: ["reports", "cash-reconciliation", year, month],
    queryFn: () => api.getCashReconciliation(year, month),
    enabled: isAuthenticated && isSuperAdmin,
  });

  if (!isAuthenticated) return null;
  if (!isSuperAdmin) {
    return (
      <section className="space-y-6">
        <h2 className="text-3xl font-semibold text-slate-900">Cash Reconciliation</h2>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Only super admins can view cash reconciliation reports.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-slate-900">Cash Reconciliation</h2>
        <p className="mt-1 text-sm text-slate-500">Monthly cash flow with per-treasurer balances</p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {(error as Error).message}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
        >
          {MONTH_LABELS.map((label, i) => (
            <option key={i + 1} value={i + 1}>{label}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
        >
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Total Inflow", value: fmt(data.total_inflow), color: "text-emerald-600" },
              { label: "Total Outflow", value: fmt(data.total_outflow), color: "text-rose-600" },
              { label: "Transfers", value: fmt(data.total_transfer), color: "text-sky-600" },
              { label: "Net Flow", value: fmt(data.net_flow), color: Number(data.net_flow) >= 0 ? "text-emerald-600" : "text-rose-600" },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                <p className={`mt-1 text-xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Opening / Closing */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Opening Balance</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {data.opening_balance != null ? fmt(data.opening_balance) : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Closing Balance</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {data.closing_balance != null ? fmt(data.closing_balance) : "—"}
              </p>
            </div>
          </div>

          {/* Per-Treasurer Balances */}
          {Object.keys(data.by_treasurer).length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">Treasurer Balances</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {Object.entries(data.by_treasurer).map(([name, amount]) => (
                  <div key={name} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium text-slate-700">{name}</span>
                    <span className="text-sm font-semibold text-slate-900">{fmt(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
