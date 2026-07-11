"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Occupant } from "@/lib/types";

const EXTRA_MAINTENANCE_PER_ADDITIONAL_CAR = 2000;

const formatAmount = (value: string | undefined): string =>
  `₨ ${parseFloat(value || "0").toLocaleString("en-PK")}`;

export default function CarMaintenancePage() {
  const { isLoading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [editors, setEditors] = useState<Record<number, { carCount: number }>>({});
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const { data: tenants = [], isLoading, error } = useQuery({
    queryKey: ["tenants"],
    queryFn: api.getTenants,
  });

  // Initialise editors when tenants load
  useEffect(() => {
    if (tenants.length === 0) return;
    setEditors((prev) => {
      const next: Record<number, { carCount: number }> = {};
      tenants.forEach((t) => {
        next[t.id] = prev[t.id] ?? { carCount: t.car_count ?? 1 };
      });
      return next;
    });
  }, [tenants]);

  const totals = useMemo(() => {
    return tenants.reduce(
      (acc, tenant) => {
        acc.extra += parseFloat(tenant.extra_car_charges || "0");
        acc.total += parseFloat(tenant.total_monthly_maintenance || "0");
        return acc;
      },
      { extra: 0, total: 0 },
    );
  }, [tenants]);

  const saveRow = async (tenant: Occupant) => {
    const editor = editors[tenant.id];
    if (!editor) return;
    const normalizedCars = Math.max(0, Number(editor.carCount || 0));
    if (Number.isNaN(normalizedCars)) {
      setToast({ type: "error", message: "Please enter a valid number of cars." });
      return;
    }

    try {
      setSavingId(tenant.id);
      await api.updateCarMaintenance(tenant.id, {
        car_count: normalizedCars,
        extra_car_maintenance_fee: EXTRA_MAINTENANCE_PER_ADDITIONAL_CAR.toFixed(2),
      });
      qc.invalidateQueries({ queryKey: ["tenants"] });
      setToast({ type: "success", message: `Updated car count for ${tenant.unit.unit_no}.` });
    } catch (err) {
      setToast({ type: "error", message: (err as Error).message || "Failed to update car maintenance." });
    } finally {
      setSavingId(null);
    }
  };

  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(id);
    }
  }, [toast]);

  if (authLoading) return null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-slate-900">Car Maintenance</h2>
        <p className="mt-1 text-sm text-slate-500">
          1 car = no additional maintenance. Each extra car after the 1st adds ₨{" "}
          {EXTRA_MAINTENANCE_PER_ADDITIONAL_CAR.toLocaleString("en-PK")} to the monthly maintenance.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {(error as Error).message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <motion.article
          whileHover={{ y: -2 }}
          className="rounded-2xl border-l-4 border-slate-200 bg-white p-6 shadow-sm"
          style={{ borderLeftColor: "#6366f1" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Extra-Car Charges / Month
          </p>
          <p className="mt-2 text-2xl font-bold text-indigo-600">
            ₨ {totals.extra.toLocaleString("en-PK")}
          </p>
        </motion.article>
        <motion.article
          whileHover={{ y: -2 }}
          className="rounded-2xl border-l-4 border-slate-200 bg-white p-6 shadow-sm"
          style={{ borderLeftColor: "#16a34a" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Monthly Maintenance (with Cars)
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            ₨ {totals.total.toLocaleString("en-PK")}
          </p>
        </motion.article>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#1e2a3a] text-white">
              <tr>
                <th className="px-5 py-3 font-semibold">Resident</th>
                <th className="px-5 py-3 font-semibold">Unit</th>
                <th className="px-5 py-3 font-semibold">Base Fee</th>
                <th className="px-5 py-3 font-semibold">Cars</th>
                <th className="px-5 py-3 font-semibold">Fee per Extra Car</th>
                <th className="px-5 py-3 font-semibold">Extra Charges</th>
                <th className="px-5 py-3 font-semibold">Total Maintenance</th>
                <th className="px-5 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-4" colSpan={8}>
                        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
                      </td>
                    </tr>
                  ))
                : tenants.map((tenant) => {
                    const editor = editors[tenant.id];
                    const computedCars = Math.max(0, Number(editor?.carCount ?? 0));
                    const additionalCars = Math.max(0, computedCars - 1);
                    const expectedExtra = additionalCars * EXTRA_MAINTENANCE_PER_ADDITIONAL_CAR;
                    return (
                      <tr key={tenant.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4 font-medium text-slate-800">{tenant.name}</td>
                        <td className="px-5 py-4 text-slate-700">{tenant.unit.unit_no}</td>
                        <td className="px-5 py-4 text-slate-700">
                          {formatAmount(tenant.monthly_maintenance_fee)}
                        </td>
                        <td className="px-5 py-4">
                          <input
                            type="number"
                            min={0}
                            value={editor?.carCount ?? 0}
                            onChange={(e) =>
                              setEditors((prev) => ({
                                ...prev,
                                [tenant.id]: { carCount: Number(e.target.value) },
                              }))
                            }
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                          />
                          <p className="mt-1 text-xs text-slate-500">
                            Extra: {additionalCars} → +₨ {expectedExtra.toLocaleString("en-PK")}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          ₨ {EXTRA_MAINTENANCE_PER_ADDITIONAL_CAR.toLocaleString("en-PK")}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {formatAmount(tenant.extra_car_charges)}
                        </td>
                        <td className="px-5 py-4 font-medium text-slate-800">
                          {formatAmount(tenant.total_monthly_maintenance)}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => void saveRow(tenant)}
                            disabled={savingId === tenant.id}
                            className="rounded-lg bg-[#1e2a3a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2d3f54] disabled:opacity-50"
                          >
                            {savingId === tenant.id ? "Saving…" : "Save"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className={`fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              toast.type === "success"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-rose-100 text-rose-800"
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
