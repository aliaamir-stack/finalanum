"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { escapeHtml } from "@/lib/utils";
import type { MonthlyReportResponse, MonthlyTransactionLine } from "@/lib/types";

const months = [
  { label: "January", short: "Jan", value: 1 },
  { label: "February", short: "Feb", value: 2 },
  { label: "March", short: "Mar", value: 3 },
  { label: "April", short: "Apr", value: 4 },
  { label: "May", short: "May", value: 5 },
  { label: "June", short: "Jun", value: 6 },
  { label: "July", short: "Jul", value: 7 },
  { label: "August", short: "Aug", value: 8 },
  { label: "September", short: "Sep", value: 9 },
  { label: "October", short: "Oct", value: 10 },
  { label: "November", short: "Nov", value: 11 },
  { label: "December", short: "Dec", value: 12 },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  maintenance: "#16a34a",
  ad_revenue: "#9333ea",
  expense: "#dc2626",
  other: "#64748b",
};

const num = (v?: string | null) => {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtPkr = (v: number | string) =>
  `₨ ${Number(v).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const titleCase = (s: string) =>
  s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default function MonthlyAnalyticsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user?.role !== "super_admin") {
      router.push("/tenants");
    }
  }, [authLoading, user, router]);

  const {
    data: report,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["monthly-report", year, month],
    queryFn: () => api.getMonthlyReport(year, month),
    enabled: user?.role === "super_admin",
  });

  const monthLabel = useMemo(
    () => months.find((m) => m.value === month)?.label ?? String(month),
    [month],
  );
  const periodLabel = `${monthLabel} ${year}`;

  const inflowCats = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.inflow_by_category)
      .map(([name, value]) => ({ name, value: num(value), fill: CATEGORY_COLORS[name] ?? "#16a34a" }))
      .sort((a, b) => b.value - a.value);
  }, [report]);

  const outflowCats = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.outflow_by_category)
      .map(([name, value]) => ({ name, value: num(value), fill: CATEGORY_COLORS[name] ?? "#dc2626" }))
      .sort((a, b) => b.value - a.value);
  }, [report]);

  const treasurerChart = useMemo(() => {
    if (!report) return [];
    const inflow = report.inflow_by_treasurer ?? {};
    const outflow = report.outflow_by_treasurer ?? {};
    const holders = new Set<string>([...Object.keys(inflow), ...Object.keys(outflow)]);
    return Array.from(holders).map((h) => ({
      holder: h,
      inflow: num(inflow[h]),
      outflow: num(outflow[h]),
    }));
  }, [report]);

  const transactions: MonthlyTransactionLine[] = report?.transactions ?? [];
  const inflowTx = transactions.filter((t) => t.type === "INFLOW");
  const outflowTx = transactions.filter((t) => t.type === "OUTFLOW");
  const transferTx = transactions.filter((t) => t.type === "TRANSFER");

  const downloadPdf = () => {
    if (!report) return;
    const html = buildReportHtml(report, periodLabel);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  };

  if (authLoading || user?.role !== "super_admin") return null;

  const cards = report
    ? [
        {
          label: "Inflow Total",
          value: report.inflow_total,
          accent: "#16a34a",
          tone: "text-emerald-600",
        },
        {
          label: "Outflow Total",
          value: report.outflow_total,
          accent: "#dc2626",
          tone: "text-rose-600",
        },
        {
          label: "Net Flow",
          value: report.net_flow ?? String(num(report.inflow_total) - num(report.outflow_total)),
          accent: "#2563eb",
          tone: "text-sky-700",
        },
        {
          label: "Maintenance Collected",
          value: report.maintenance_received,
          accent: "#0f766e",
          tone: "text-teal-700",
        },
        {
          label: "Transfers",
          value: report.transfer_total,
          accent: "#9333ea",
          tone: "text-purple-700",
        },
        {
          label: "Treasury Closing",
          value: report.treasury_closing ?? "0",
          accent: "#0ea5e9",
          tone: "text-sky-600",
        },
      ]
    : [];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900">Monthly Analytics</h2>
          <p className="mt-1 text-sm text-slate-500">
            Full breakdown of every inflow and outflow recorded for {periodLabel}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none"
          >
            {[now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.short}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={!report}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Download report
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {(error as Error).message}
        </div>
      ) : null}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
            ))
          : cards.map((c) => (
              <motion.article
                key={c.label}
                whileHover={{ y: -2 }}
                className="rounded-2xl border-l-4 border-slate-200 bg-white p-5 shadow-sm"
                style={{ borderLeftColor: c.accent }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {c.label}
                </p>
                <p className={`mt-2 text-2xl font-bold ${c.tone}`}>{fmtPkr(c.value)}</p>
              </motion.article>
            ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Inflow by Category
          </p>
          <div className="mt-4 h-64">
            {inflowCats.length === 0 ? (
              <EmptyChart label="No inflow recorded" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={inflowCats}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={86}
                    label={(d) => titleCase(String(d.name))}
                  >
                    {inflowCats.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => fmtPkr(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Outflow by Category
          </p>
          <div className="mt-4 h-64">
            {outflowCats.length === 0 ? (
              <EmptyChart label="No outflow recorded" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outflowCats}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={86}
                    label={(d) => titleCase(String(d.name))}
                  >
                    {outflowCats.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => fmtPkr(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Treasurer Activity
          </p>
          <div className="mt-4 h-64">
            {treasurerChart.length === 0 ? (
              <EmptyChart label="No treasurer movement this month" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={treasurerChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="holder" />
                  <YAxis />
                  <Tooltip formatter={(v: unknown) => fmtPkr(Number(v))} />
                  <Legend />
                  <Bar dataKey="inflow" fill="#16a34a" />
                  <Bar dataKey="outflow" fill="#dc2626" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Category breakdown tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BreakdownTable title="Inflow Breakdown" rows={inflowCats} tone="text-emerald-700" />
        <BreakdownTable title="Outflow Breakdown" rows={outflowCats} tone="text-rose-700" />
      </div>

      {/* Treasurer split */}
      {report?.treasurer_split && report.treasurer_split.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Treasurer Balances (as of {periodLabel})
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {report.treasurer_split.map((s) => (
              <div key={s.person} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">{s.person}</p>
                <p className="mt-1 text-lg font-bold text-sky-700">{fmtPkr(s.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed transaction tables */}
      <TransactionTable
        title="Inflow Details"
        emptyLabel="No inflow transactions this month."
        rows={inflowTx}
        amountTone="text-emerald-600"
        showSign="+"
      />
      <TransactionTable
        title="Outflow Details"
        emptyLabel="No outflow transactions this month."
        rows={outflowTx}
        amountTone="text-rose-600"
        showSign="-"
      />
      {transferTx.length > 0 && (
        <TransactionTable
          title="Transfers"
          emptyLabel="No transfers this month."
          rows={transferTx}
          amountTone="text-purple-700"
          showSign="↔"
        />
      )}
    </section>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
      {label}
    </div>
  );
}

function BreakdownTable({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: { name: string; value: number }[];
  tone: string;
}) {
  const total = rows.reduce((acc, r) => acc + r.value, 0);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No data.</p>
      ) : (
        <div className="mt-3 divide-y divide-slate-100">
          {rows.map((r) => {
            const pct = total ? Math.round((r.value / total) * 100) : 0;
            return (
              <div key={r.name} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-semibold text-slate-800">{titleCase(r.name)}</p>
                  <p className="text-xs text-slate-500">{pct}% of category</p>
                </div>
                <p className={`font-bold ${tone}`}>{fmtPkr(r.value)}</p>
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-3 text-sm">
            <p className="font-semibold text-slate-700">Total</p>
            <p className={`font-bold ${tone}`}>{fmtPkr(total)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionTable({
  title,
  rows,
  emptyLabel,
  amountTone,
  showSign,
}: {
  title: string;
  rows: MonthlyTransactionLine[];
  emptyLabel: string;
  amountTone: string;
  showSign: "+" | "-" | "↔";
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-500">{rows.length} entries</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Details</th>
                <th className="px-4 py-2">Treasurer</th>
                <th className="px-4 py-2">Generated By</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((tx) => {
                const reference = tx.receipt_no
                  ? tx.receipt_no
                  : tx.unit_no
                    ? `${tx.unit_no} • ${tx.occupant_name ?? ""}`
                    : tx.notes?.split(" ").slice(0, 6).join(" ") ?? `TXN-${tx.id}`;
                const detail =
                  tx.expense_description ||
                  tx.notes ||
                  (tx.transfer_from ? `${tx.transfer_from} → ${tx.credited_to ?? ""}` : "—");
                return (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-700">{fmtDate(tx.date)}</td>
                    <td className="px-4 py-2 text-slate-700">{reference}</td>
                    <td className="px-4 py-2 text-slate-700">{titleCase(tx.category)}</td>
                    <td className="px-4 py-2 text-slate-600">
                      <div>{detail}</div>
                      {tx.expense_details && (
                        <div className="text-xs text-slate-400">{tx.expense_details}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{tx.credited_to ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-700">{tx.generated_by ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-700">{tx.status}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${amountTone}`}>
                      {showSign}
                      {fmtPkr(tx.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function buildReportHtml(report: MonthlyReportResponse, periodLabel: string): string {
  const txs = report.transactions ?? [];
  const inflowTx = txs.filter((t) => t.type === "INFLOW");
  const outflowTx = txs.filter((t) => t.type === "OUTFLOW");
  const transferTx = txs.filter((t) => t.type === "TRANSFER");

  const renderCategory = (entries: Record<string, string>) => {
    const items = Object.entries(entries);
    if (items.length === 0) return `<p style="color:#64748b">No data.</p>`;
    return `<table class="kv">${items
      .map(([k, v]) => `<tr><td>${titleCase(k)}</td><td>${fmtPkr(v)}</td></tr>`)
      .join("")}</table>`;
  };

  const renderTxTable = (title: string, rows: MonthlyTransactionLine[]) => {
    if (rows.length === 0) {
      return `<h3>${title}</h3><p style="color:#64748b">No entries.</p>`;
    }
    return `
      <h3>${title}</h3>
      <table class="tx">
        <thead>
          <tr>
            <th>Date</th><th>Reference</th><th>Category</th><th>Details</th>
            <th>Treasurer</th><th>Generated By</th><th>Status</th><th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((tx) => {
              const ref =
                tx.receipt_no ||
                (tx.unit_no ? `${tx.unit_no} - ${tx.occupant_name ?? ""}` : `TXN-${tx.id}`);
              const detail =
                tx.expense_description ||
                tx.notes ||
                (tx.transfer_from ? `${tx.transfer_from} → ${tx.credited_to ?? ""}` : "—");
              return `<tr>
                <td>${fmtDate(tx.date)}</td>
                <td>${escapeHtml(ref)}</td>
                <td>${titleCase(tx.category)}</td>
                <td>${escapeHtml(String(detail))}${
                  tx.expense_details
                    ? `<div style="font-size:11px;color:#94a3b8">${escapeHtml(tx.expense_details)}</div>`
                    : ""
                }</td>
                <td>${escapeHtml(tx.credited_to ?? "—")}</td>
                <td>${escapeHtml(tx.generated_by ?? "—")}</td>
                <td>${tx.status}</td>
                <td class="right">${fmtPkr(tx.amount)}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;
  };

  const split = report.treasurer_split ?? [];
  const treasurerHtml =
    split.length === 0
      ? ""
      : `<h3>Treasurer Balances</h3><table class="kv">${split
          .map((s) => `<tr><td>${escapeHtml(s.person)}</td><td>${fmtPkr(s.amount)}</td></tr>`)
          .join("")}</table>`;

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Monthly Report — ${escapeHtml(periodLabel)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 18px 0 6px; color: #334155; }
  h3 { font-size: 14px; margin: 18px 0 6px; color: #1e293b; }
  .subtitle { color: #64748b; font-size: 12px; margin-bottom: 14px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
  .kpi { border: 1px solid #e2e8f0; padding: 8px 10px; border-radius: 6px; }
  .kpi .label { font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
  .kpi .value { font-size: 16px; font-weight: 700; margin-top: 2px; }
  table.kv { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
  table.kv td { padding: 4px 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
  table.kv td:last-child { text-align: right; font-weight: 600; }
  table.tx { border-collapse: collapse; width: 100%; font-size: 11px; }
  table.tx th, table.tx td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
  table.tx th { background: #f8fafc; text-transform: uppercase; font-size: 10px; color: #475569; }
  table.tx td.right, table.tx th.right { text-align: right; }
  tr { page-break-inside: avoid; }
</style></head><body>
  <h1>Anum Vista — Monthly Report</h1>
  <div class="subtitle">${escapeHtml(periodLabel)} · Generated ${new Date().toLocaleString("en-GB")}</div>
  <div class="grid">
    <div class="kpi"><div class="label">Inflow Total</div><div class="value">${fmtPkr(report.inflow_total)}</div></div>
    <div class="kpi"><div class="label">Outflow Total</div><div class="value">${fmtPkr(report.outflow_total)}</div></div>
    <div class="kpi"><div class="label">Net Flow</div><div class="value">${fmtPkr(report.net_flow ?? String(num(report.inflow_total) - num(report.outflow_total)))}</div></div>
    <div class="kpi"><div class="label">Maintenance Collected</div><div class="value">${fmtPkr(report.maintenance_received)}</div></div>
    <div class="kpi"><div class="label">Transfers</div><div class="value">${fmtPkr(report.transfer_total)}</div></div>
    <div class="kpi"><div class="label">Treasury Closing</div><div class="value">${fmtPkr(report.treasury_closing ?? "0")}</div></div>
  </div>

  <h2>Inflow by Category</h2>
  ${renderCategory(report.inflow_by_category)}
  <h2>Outflow by Category</h2>
  ${renderCategory(report.outflow_by_category)}

  ${treasurerHtml}

  ${renderTxTable("Inflow Transactions", inflowTx)}
  ${renderTxTable("Outflow Transactions", outflowTx)}
  ${transferTx.length ? renderTxTable("Transfers", transferTx) : ""}

  <script>window.onafterprint = () => window.close();</script>
</body></html>`;
}
