"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import type { Transaction } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

const holderOrder = ["Naveed", "Asif", "Dilshad", "Ali", "Danish"] as const;

const formatPkr = (value: string): string =>
  `₨ ${Number(value).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;

export default function TreasuryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [selectedHolder, setSelectedHolder] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user?.role !== "super_admin") {
      router.push("/tenants");
    }
  }, [authLoading, user, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["treasury-current"],
    queryFn: api.getTreasuryCurrent,
  });
  const { data: approvedTxns = [] } = useQuery({
    queryKey: ["approved-transactions"],
    queryFn: () => api.getTransactions("approved"),
  });

  const holders =
    data?.holders?.slice().sort((a, b) => {
      const ai = holderOrder.indexOf(a.name as (typeof holderOrder)[number]);
      const bi = holderOrder.indexOf(b.name as (typeof holderOrder)[number]);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    }) ?? [];

  const confirmedReceipts = approvedTxns.filter(
    (tx) => tx.type === "INFLOW" && tx.status === "approved" && !!tx.credited_to,
  );

  const recentApproved = [...confirmedReceipts]
    .sort((a: Transaction, b: Transaction) => {
      const left = new Date(b.approved_at ?? b.date).getTime();
      const right = new Date(a.approved_at ?? a.date).getTime();
      return left - right;
    })
    .slice(0, 8);

  if (authLoading || user?.role !== "super_admin") return null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-slate-900">Treasury</h2>
        <p className="mt-1 text-sm text-slate-500">
          Current treasury snapshot by holder.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {(error as Error).message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <motion.article
          whileHover={{ y: -2 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-12"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Period</p>
          {isLoading ? (
            <div className="mt-3 h-7 w-56 animate-pulse rounded bg-slate-200" />
          ) : (
              <p className="mt-2 text-lg font-semibold text-slate-900">{data?.period ?? "—"}</p>
          )}
        </motion.article>

        {/* Removed Confirmed (Approved) Contributions card per MVP specs */}

        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-2xl bg-slate-200 lg:col-span-4"
            />
          ))
        ) : (
          holders.map((holder) => (
            <motion.article
              key={holder.name}
              whileHover={{ y: -2 }}
              onClick={() => setSelectedHolder(holder.name)}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-4 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Holder
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{holder.name}</p>
              <p className="mt-3 text-2xl font-bold text-sky-700">{formatPkr(holder.amount)}</p>
            </motion.article>
          ))
        )}

        <motion.article
          whileHover={{ y: -2 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-12"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recent Approved Receipts (Treasury Impact)
          </p>
          <div className="mt-3 space-y-2">
            {recentApproved.length === 0 ? (
              <p className="text-sm text-slate-500">No approved receipts yet.</p>
            ) : (
              recentApproved.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {tx.credited_to} · {tx.receipt_no || `TXN-${tx.id}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(tx.approved_at ?? tx.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-emerald-700">+{formatPkr(tx.amount)}</p>
                </div>
              ))
            )}
          </div>
        </motion.article>
      </div>

      <AnimatePresence>
        {selectedHolder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 20, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 20, scale: 0.95 }}
              className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  {selectedHolder}&apos;s Credit Details
                </h3>
                <button
                  onClick={() => setSelectedHolder(null)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-6">
                {(() => {
                  const holderTxns = confirmedReceipts.filter((tx) => tx.credited_to === selectedHolder);
                  if (holderTxns.length === 0) {
                    return <p className="text-sm text-slate-500 text-center py-8">No confirmed credits yet.</p>;
                  }
                  return (
                    <div className="space-y-4">
                      {holderTxns.map((tx) => (
                        <div key={tx.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{tx.category.replace("_", " ").toUpperCase()}</p>
                              <p className="text-xs text-slate-500">{new Date(tx.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                            </div>
                            <p className="text-lg font-bold text-emerald-600">+{formatPkr(tx.amount)}</p>
                          </div>
                          <div className="mt-2 text-sm text-slate-600">
                            <span className="font-medium text-slate-700">Method/Notes:</span> {tx.notes || "—"}
                          </div>
                          {tx.receipt_no && (
                            <div className="mt-1 text-xs text-slate-500">
                              Receipt: {tx.receipt_no}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
