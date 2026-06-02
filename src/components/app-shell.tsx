"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeDollarSign, BarChart3, Building2, KanbanSquare, ListTodo, LogOut, Sun, Target, Upload, UsersRound } from "lucide-react";
import { clsx } from "clsx";
import type { Role } from "@prisma/client";
import { NotificationBell } from "@/components/notification-bell";

const navigation = [
  { href: "/dashboard", label: "My Day", icon: Sun },
  { href: "/companies", label: "Aziende", icon: Building2 },
  { href: "/contacts", label: "Contatti", icon: UsersRound },
  { href: "/leads", label: "Lead", icon: Target },
  { href: "/opportunities", label: "Opportunita", icon: BadgeDollarSign },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/reports", label: "Report", icon: BarChart3 },
  { href: "/imports", label: "Import", icon: Upload },
  { href: "/tasks", label: "Attivita", icon: ListTodo },
];

const pageTitles: Record<string, string> = {
  "/dashboard": "My Day",
  "/companies": "Aziende",
  "/contacts": "Contatti",
  "/leads": "Lead",
  "/opportunities": "Opportunita",
  "/pipeline": "Pipeline",
  "/reports": "Report",
  "/imports": "Import",
  "/tasks": "Attivita",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(path + "/")) return title;
  }
  return "CRM Pro";
}

export function AppShell({ children, user }: { children: React.ReactNode; user: { id: string; tenantId: string; name: string; email: string; role: Role } }) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white/90 p-6 backdrop-blur lg:block">
        <div className="mb-10">
          <svg viewBox="0 0 200 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-11 w-auto">
            {/* Full word: BitCall — "ll" replaced by gold bars visually */}
            <text x="0" y="36" fontFamily="Georgia, 'Times New Roman', serif" fontSize="36" fontWeight="700" fill="#0f3d4c">BitCa</text>
            {/* Gold bars replacing "ll" — positioned right after "BitCa" */}
            <rect x="126" y="4"  width="8" height="32" rx="1.5" fill="#f5a623" />
            <rect x="139" y="4"  width="8" height="32" rx="1.5" fill="#f5a623" />
            {/* Arrow pointing left (before bars) */}
            <polygon points="121,36 128,32 128,40" fill="#f5a623" />
            {/* Arrow pointing right (after bars) */}
            <polygon points="152,36 145,32 145,40" fill="#f5a623" />
            {/* OUTSOURCING SOLUTIONS tagline */}
            <text x="1" y="52" fontFamily="Arial, Helvetica, sans-serif" fontSize="8.5" fontWeight="400" fill="#0f3d4c" letterSpacing="1.8">OUTSOURCING SOLUTIONS</text>
          </svg>
          <p className="mt-3 text-sm text-slate-500">Workspace scalabile per vendite, supporto e customer success.</p>
        </div>
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-2xl border-l-4 px-3 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-l-brand-600 bg-brand-50 text-brand-700"
                    : "border-l-transparent text-slate-700 hover:bg-brand-50 hover:text-brand-700",
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/85 px-4 py-4 backdrop-blur md:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Professional CRM</p>
            <h1 className="text-xl font-semibold text-slate-950">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell tenantId={user.tenantId} userId={user.id} />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role.toLowerCase()} - {user.email}</p>
            </div>
            <form action="/api/auth/logout" method="post">
              <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-200 hover:text-brand-700">
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </form>
          </div>
        </header>
        <div className="px-4 py-6 md:px-8">{children}</div>
      </main>
    </div>
  );
}
