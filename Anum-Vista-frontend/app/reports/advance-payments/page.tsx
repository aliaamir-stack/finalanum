"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, AdvancePaymentReport } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const prettyMonth = (v: string) => {
  const [y, m] = v.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

export default function AdvancePaymentsPage() {
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery<AdvancePaymentReport>({
    queryKey: ["reports", "advance-payments"],
    queryFn: api.getAdvancePaymentsReport,
    enabled: isAuthenticated,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.entries.filter(
      (e) => !q || e.name.toLowerCase().includes(q) || e.unit_no.toLowerCase().includes(q),
    );
  }, [data, search]);

  if (!isAuthenticated) return null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-slate-900">Advance Payments</h2>
        <p className="mt-1 text-sm text-slate-500">
          Residents who have paid ahead of the current month
          {data && <span className="ml-2 font-semibold text-emerald-600">— {data.entries.length} resident(s)</span>}
        </p>
      </div>

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
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Apartment</th>
                  <th className="px-4 py-3">Resident</th>
                  <th className="px-4 py-3">Paid Through</th>
                  <th className="px-4 py-3 text-right">Months Ahead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((e) => (
                  <tr key={e.occupant_id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-semibold text-slate-900">{e.unit_no}</td>
                    <td className="px-4 py-3 text-slate-700">{e.name}</td>
                    <td className="px-4 py-3 text-slate-600">{prettyMonth(e.paid_through)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        +{e.months_ahead} month{e.months_ahead !== 1 ? "s" : ""}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      {search ? "No results match your search." : "No advance payments recorded."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
