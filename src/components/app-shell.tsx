"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeDollarSign, BarChart3, Building2, ChevronLeft, ChevronRight, KanbanSquare, ListTodo, LogOut, Menu, Sun, Target, Upload, Users, UsersRound, X } from "lucide-react";
import { clsx } from "clsx";
import { useState, useEffect } from "react";
import type { Role } from "@prisma/client";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";

const navigation = [
  { href: "/dashboard", label: "My Day", icon: Sun, roles: null },
  { href: "/companies", label: "Aziende", icon: Building2, roles: null },
  { href: "/contacts", label: "Contatti", icon: UsersRound, roles: null },
  { href: "/leads", label: "Lead", icon: Target, roles: null },
  { href: "/opportunities", label: "Opportunità", icon: BadgeDollarSign, roles: null },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare, roles: null },
  { href: "/reports", label: "Report", icon: BarChart3, roles: null },
  { href: "/imports", label: "Import", icon: Upload, roles: null },
  { href: "/tasks", label: "Attività", icon: ListTodo, roles: null },
  { href: "/users", label: "Team", icon: Users, roles: ["ADMIN", "MANAGER"] as string[] },
];

const pageTitles: Record<string, string> = {
  "/dashboard": "My Day",
  "/companies": "Aziende",
  "/contacts": "Contatti",
  "/leads": "Lead",
  "/opportunities": "Opportunità",
  "/pipeline": "Pipeline",
  "/reports": "Report",
  "/imports": "Import",
  "/tasks": "Attività",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(path + "/")) return title;
  }
  return "Bitcall CRM";
}

export function AppShell({ children, user }: { children: React.ReactNode; user: { id: string; tenantId: string; name: string; email: string; role: Role } }) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", String(!prev));
      return !prev;
    });
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navItems = navigation.filter((item) => !item.roles || item.roles.includes(user.role));

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="space-y-0.5">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            title={collapsed ? item.label : undefined}
            className={clsx(
              "flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150",
              collapsed ? "justify-center p-2.5" : "px-3 py-2.5",
              isActive
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
            )}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && item.label}
          </Link>
        );
      })}
    </nav>
  );

  const sidebarW = collapsed ? "w-16" : "w-64";
  const mainPl = collapsed ? "lg:pl-16" : "lg:pl-64";

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#f7f9fc] dark:bg-slate-950">
      {/* Sidebar desktop */}
      <aside className={clsx(
        "fixed inset-y-0 left-0 hidden border-r border-slate-200/80 bg-white transition-all duration-300 dark:border-slate-700/60 dark:bg-slate-900 lg:flex lg:flex-col",
        sidebarW,
      )}>
        <div className={clsx(
          "flex shrink-0 items-center border-b border-slate-100 py-5 dark:border-slate-800",
          collapsed ? "justify-center px-3" : "px-5",
        )}>
          {!collapsed ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo_bitcall.png" alt="BitCall" className="h-14 w-auto object-contain" />
              <p className="mt-1.5 text-[11px] font-medium tracking-wide text-slate-400 dark:text-slate-500">Vendite & Customer Success</p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo_bitcall.png" alt="BitCall" className="h-8 w-auto object-contain" />
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <NavLinks />
        </div>

        <div className="shrink-0 border-t border-slate-100 p-3 dark:border-slate-800">
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Espandi sidebar" : "Comprimi sidebar"}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span className="font-medium">Comprimi</span></>}
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar mobile */}
      <aside className={clsx(
        "fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-200 bg-white p-5 shadow-2xl transition-transform duration-300 dark:border-slate-700 dark:bg-slate-900 lg:hidden",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800"
          aria-label="Chiudi menu"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mb-6 mt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_bitcall.png" alt="BitCall" className="h-12 w-auto object-contain" />
        </div>
        <NavLinks onClick={() => setMobileOpen(false)} />
      </aside>

      {/* Main */}
      <div className={clsx("flex min-w-0 flex-1 flex-col transition-all duration-300", mainPl)}>
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3.5 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/90 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-brand-400 lg:hidden"
              aria-label="Apri menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Bitcall CRM</p>
              <h1 className="truncate text-[17px] font-bold leading-tight text-slate-900 dark:text-slate-100">{pageTitle}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <ThemeToggle />
            <NotificationBell tenantId={user.tenantId} userId={user.id} />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{user.name}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">{user.role.toLowerCase()}</p>
            </div>
            <form action="/api/auth/logout" method="post">
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-brand-500 dark:hover:text-brand-400">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Esci</span>
              </button>
            </form>
          </div>
        </header>
        <div className="min-w-0 overflow-x-auto px-4 py-6 md:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}
