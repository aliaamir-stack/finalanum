"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ExpenseReport } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const fmt = (v: string | number) =>
  `₨ ${Number(v).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ExpensesPage() {
  const { isAuthenticated } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading, error } = useQuery<ExpenseReport>({
    queryKey: ["reports", "expenses", year, month],
    queryFn: () => api.getExpenseReport(year, month),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-slate-900">Expense Report</h2>
        <p className="mt-1 text-sm text-slate-500">Monthly expense breakdown by category</p>
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

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="border-b border-slate-100 px-4 py-4">
              <p className="text-sm text-slate-500">
                {MONTH_LABELS[data.month - 1]} {data.year}
              </p>
              <p className="text-2xl font-bold text-slate-900">{fmt(data.total_expenses)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-center">Count</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.entries.map((e, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-medium text-slate-700 capitalize">
                        {e.category.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{e.description || "—"}</td>
                      <td className="px-4 py-3 text-center text-slate-500">{e.count}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(e.total)}</td>
                    </tr>
                  ))}
                  {data.entries.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                        No expenses recorded for this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
