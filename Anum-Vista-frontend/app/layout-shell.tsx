"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import NotificationBell from "@/components/NotificationBell";

function Sidebar() {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  useEffect(() => {
    if (pathname.startsWith("/transactions")) {
      setExpensesOpen(true);
    }
    if (pathname.startsWith("/reports") || pathname.startsWith("/ledger") || pathname.startsWith("/reminders")) {
      setReportsOpen(true);
    }
  }, [pathname]);

  if (!isAuthenticated || pathname === "/login") return null;

  const isSuperAdmin = user?.role === "super_admin";

  const adminItems = [
    { href: "/tenants", label: "Residents", icon: "🏠" },
    { href: "/car-maintenance", label: "Car Maintenance", icon: "🚗" },
  ];
  const superAdminItems = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/analytics", label: "Analytics", icon: "📈" },
    { href: "/treasury", label: "Treasury", icon: "🏦" },
    { href: "/audit-log", label: "Audit Log", icon: "📋" },
  ];

  // Super Admin items go above Admin items, or we can just list them in a logical order.
  const navItems = isSuperAdmin ? [...superAdminItems, ...adminItems] : adminItems;

  return (
    <aside className="sticky top-0 h-screen w-[240px] shrink-0 overflow-y-auto bg-[#1e2a3a] text-white flex flex-col">
      <div className="border-b border-white/10 px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
          Anum Vista
        </p>
        <h1 className="mt-1 text-lg font-semibold text-white">Finance Portal</h1>
      </div>

      <nav className="flex-1 px-3 py-5">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-white/15 text-white"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
          
          {/* Expenses Dropdown */}
          <li key="expenses">
            <button
              onClick={() => setExpensesOpen(!expensesOpen)}
              className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                pathname.startsWith("/transactions")
                  ? "bg-white/15 text-white"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">💸</span>
                Expenses
              </div>
              <span className="text-xs">{expensesOpen ? "▼" : "▶"}</span>
            </button>
            {expensesOpen && (
              <ul className="mt-1 ml-9 space-y-1">
                {isSuperAdmin && (
                  <li>
                    <Link
                      href="/transactions?tab=inflow"
                      className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                        searchParams.get("tab") === "inflow" || (pathname === "/transactions" && !searchParams.get("tab"))
                          ? "text-white bg-white/10"
                          : "text-gray-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      Inflow (Revenue)
                    </Link>
                  </li>
                )}
                <li>
                  <Link
                    href="/transactions?tab=outflow"
                    className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                      searchParams.get("tab") === "outflow" || (!isSuperAdmin && pathname === "/transactions")
                        ? "text-white bg-white/10"
                        : "text-gray-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    Outflow (New Expenses)
                  </Link>
                </li>
              </ul>
            )}
          </li>

          {/* Reports Dropdown */}
          <li key="reports">
            <button
              onClick={() => setReportsOpen(!reportsOpen)}
              className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                pathname.startsWith("/reports") || pathname.startsWith("/ledger") || pathname.startsWith("/reminders")
                  ? "bg-white/15 text-white"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">📑</span>
                Reports
              </div>
              <span className="text-xs">{reportsOpen ? "▼" : "▶"}</span>
            </button>
            {reportsOpen && (
              <ul className="mt-1 ml-9 space-y-1">
                {[
                  { href: "/reports/pending-dues", label: "Pending Dues" },
                  { href: "/reports/advance-payments", label: "Advance Payments" },
                  { href: "/reports/expenses", label: "Expenses" },
                  ...(isSuperAdmin ? [{ href: "/reports/cash-reconciliation", label: "Cash Reconciliation" }] : []),
                  { href: "/ledger", label: "Resident Ledger" },
                  { href: "/reminders", label: "Due Reminders" },
                ].map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                        pathname === item.href
                          ? "text-white bg-white/10"
                          : "text-gray-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        </ul>
      </nav>

      {/* User info + notification bell */}
      <div className="border-t border-white/10 px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <NotificationBell />
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              isSuperAdmin
                ? "bg-amber-500/20 text-amber-300"
                : "bg-sky-500/20 text-sky-300"
            }`}
          >
            {isSuperAdmin ? "Super Admin" : "Admin"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-200 truncate">{user?.username}</p>
          <button
            onClick={logout}
            className="text-xs font-medium text-slate-400 hover:text-white transition"
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <AuthProvider>
      <div className="flex min-h-screen">
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
        <main className={`min-h-screen flex-1 ${isLoginPage ? "" : "bg-[#f5f6fa] p-8"}`}>
          <Suspense fallback={null}>{children}</Suspense>
        </main>
      </div>
    </AuthProvider>
  );
}
