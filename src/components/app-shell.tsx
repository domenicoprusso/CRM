import Link from "next/link";
import { BadgeDollarSign, BarChart3, Building2, KanbanSquare, ListTodo, LogOut, Sun, Target, Upload, UsersRound } from "lucide-react";
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

export function AppShell({ children, user }: { children: React.ReactNode; user: { id: string; tenantId: string; name: string; email: string; role: Role } }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white/90 p-6 backdrop-blur lg:block">
        <div className="mb-10">
          <div className="rounded-2xl bg-brand-600 px-4 py-3 text-lg font-bold text-white shadow-soft">CRM Pro</div>
          <p className="mt-3 text-sm text-slate-500">Workspace scalabile per vendite, supporto e customer success.</p>
        </div>
        <nav className="space-y-2">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700">
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/85 px-4 py-4 backdrop-blur md:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Professional CRM</p>
            <h1 className="text-xl font-semibold text-slate-950">Centro operativo</h1>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell tenantId={user.tenantId} userId={user.id} />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role.toLowerCase()} · {user.email}</p>
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
