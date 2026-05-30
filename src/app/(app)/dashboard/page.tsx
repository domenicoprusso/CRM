import { Card, PageHeader, StatCard } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireUser("dashboard:read");
  const [companies, contacts, leads, openLeads, overdueTasks, recentActivities] = await Promise.all([
    prisma.company.count({ where: { tenantId: user.tenantId } }),
    prisma.contact.count({ where: { tenantId: user.tenantId } }),
    prisma.lead.count({ where: { tenantId: user.tenantId } }),
    prisma.lead.count({ where: { tenantId: user.tenantId, status: { in: ["NEW", "CONTACTED", "QUALIFIED", "NURTURING"] } } }),
    prisma.task.count({ where: { tenantId: user.tenantId, status: { not: "DONE" }, dueAt: { lt: new Date() } } }),
    prisma.activity.findMany({ where: { tenantId: user.tenantId }, orderBy: { occurredAt: "desc" }, take: 6, include: { user: true } }),
  ]);

  return (
    <>
      <PageHeader title="Dashboard" description="KPI operativi e segnali prioritari per coordinare sales, support e management." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Aziende" value={companies} hint="Account registrati" />
        <StatCard label="Contatti" value={contacts} hint="Persone in anagrafica" />
        <StatCard label="Lead totali" value={leads} hint="Acquisiti da ogni fonte" />
        <StatCard label="Lead aperti" value={openLeads} hint="Da lavorare in pipeline" />
        <StatCard label="Follow-up scaduti" value={overdueTasks} hint="Richiedono attenzione" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h3 className="text-lg font-semibold text-slate-950">Priorità giornaliere suggerite</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Contatta i lead qualificati senza attività recente.</div>
            <div className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">Completa schede contatto prive di azienda o email.</div>
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">Prepara email follow-up per opportunità ad alto valore.</div>
          </div>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold text-slate-950">Timeline recente</h3>
          <div className="mt-4 space-y-3">
            {recentActivities.length === 0 ? <p className="text-sm text-slate-500">Nessuna attività registrata.</p> : null}
            {recentActivities.map((activity) => (
              <div key={activity.id} className="rounded-2xl border border-slate-100 p-3">
                <p className="text-sm font-semibold text-slate-900">{activity.subject}</p>
                <p className="text-xs text-slate-500">{activity.type.toLowerCase()} · {activity.user.name}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
