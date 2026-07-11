"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, PendingDuesReport } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

const fmt = (v: string | number) =>
  `₨ ${Number(v).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;

type SortKey = "unit_no" | "name" | "months_overdue" | "total_due";

export default function PendingDuesPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [sortBy, setSortBy] = useState<SortKey>("total_due");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery<PendingDuesReport>({
    queryKey: ["reports", "pending-dues"],
    queryFn: api.getPendingDuesReport,
    enabled: isAuthenticated,
  });

  const sorted = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.entries
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          e.unit_no.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === "unit_no") cmp = a.unit_no.localeCompare(b.unit_no, undefined, { numeric: true });
        else if (sortBy === "name") cmp = a.name.localeCompare(b.name);
        else if (sortBy === "months_overdue") cmp = a.months_overdue - b.months_overdue;
        else cmp = Number(a.total_due) - Number(b.total_due);
        return sortAsc ? cmp : -cmp;
      });
  }, [data, sortBy, sortAsc, search]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(false); }
  };

  const arrow = (key: SortKey) =>
    sortBy === key ? (sortAsc ? " ↑" : " ↓") : "";

  if (!isAuthenticated) return null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-slate-900">Pending Dues</h2>
        <p className="mt-1 text-sm text-slate-500">
          Residents with outstanding maintenance payments
          {data && (
            <span className="ml-2 font-semibold text-rose-600">
              — Total Due: {fmt(data.total_due)}
            </span>
          )}
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
                  <th className="cursor-pointer px-4 py-3 hover:text-slate-700" onClick={() => toggleSort("unit_no")}>
                    Apt{arrow("unit_no")}
                  </th>
                  <th className="cursor-pointer px-4 py-3 hover:text-slate-700" onClick={() => toggleSort("name")}>
                    Resident{arrow("name")}
                  </th>
                  <th className="px-4 py-3">Monthly Fee</th>
                  <th className="cursor-pointer px-4 py-3 hover:text-slate-700" onClick={() => toggleSort("months_overdue")}>
                    Months Overdue{arrow("months_overdue")}
                  </th>
                  <th className="cursor-pointer px-4 py-3 text-right hover:text-slate-700" onClick={() => toggleSort("total_due")}>
                    Total Due{arrow("total_due")}
                  </th>
                  <th className="px-4 py-3">Last Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.map((e) => (
                  <tr key={e.occupant_id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-semibold text-slate-900">{e.unit_no}</td>
                    <td className="px-4 py-3 text-slate-700">{e.name}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(e.monthly_fee)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        e.months_overdue >= 3
                          ? "bg-rose-100 text-rose-700"
                          : e.months_overdue >= 2
                            ? "bg-amber-100 text-amber-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {e.months_overdue} month{e.months_overdue !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-600">{fmt(e.total_due)}</td>
                    <td className="px-4 py-3 text-slate-500">{e.last_paid_month || "Never"}</td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      {search ? "No results match your search." : "No pending dues — all residents are current!"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {data && sorted.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-3 text-right text-sm">
            <span className="text-slate-500">{sorted.length} resident(s)</span>
            <span className="ml-4 font-semibold text-slate-900">
              Total: {fmt(sorted.reduce((s, e) => s + Number(e.total_due), 0))}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
