import { ActivityTimeline, TaskList } from "@/components/productivity";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOpportunitiesWithoutRecentActivityCount, getRemindersDue } from "@/lib/productivity";

function dayBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start, end };
}

export default async function DashboardPage() {
  const user = await requireUser("dashboard:read");
  const now = new Date();
  const { start, end } = dayBounds(now);

  const [
    companies,
    contacts,
    leads,
    openLeads,
    openOpportunities,
    pipelineValue,
    activitiesToday,
    overdueTasks,
    overdueTasksList,
    recentActivities,
    remindersDue,
    staleOppsCount,
    staleOpps,
  ] = await Promise.all([
    prisma.company.count({ where: { tenantId: user.tenantId } }),
    prisma.contact.count({ where: { tenantId: user.tenantId } }),
    prisma.lead.count({ where: { tenantId: user.tenantId } }),
    prisma.lead.count({ where: { tenantId: user.tenantId, status: { in: ["NEW", "CONTACTED", "QUALIFIED", "NURTURING"] } } }),
    prisma.opportunity.count({ where: { tenantId: user.tenantId, stage: { isWon: false, isLost: false } } }),
    prisma.opportunity.aggregate({ where: { tenantId: user.tenantId, stage: { isWon: false, isLost: false } }, _sum: { value: true } }),
    prisma.activity.count({ where: { tenantId: user.tenantId, occurredAt: { gte: start, lt: end } } }),
    prisma.task.count({ where: { tenantId: user.tenantId, status: { notIn: ["DONE", "CANCELLED"] }, dueAt: { lt: now } } }),
    prisma.task.findMany({
      where: { tenantId: user.tenantId, status: { notIn: ["DONE", "CANCELLED"] }, dueAt: { lt: now } },
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
      take: 5,
      include: { owner: true, company: true, contact: true, lead: true, opportunity: true },
    }),
    prisma.activity.findMany({
      where: { tenantId: user.tenantId, occurredAt: { gte: start, lt: end } },
      orderBy: { occurredAt: "desc" },
      take: 6,
      include: { user: true, company: true, contact: true, lead: true, opportunity: true },
    }),
    getRemindersDue(prisma, user.tenantId, now),
    getOpportunitiesWithoutRecentActivityCount(prisma, user.tenantId),
    prisma.opportunity.findMany({
      where: {
        tenantId: user.tenantId,
        stage: { isWon: false, isLost: false },
        activities: { none: { occurredAt: { gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) } } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 5,
      include: { owner: true, company: true, stage: true },
    }),
  ]);

  return (
    <>
      <PageHeader title="Dashboard" description="KPI operativi e segnali prioritari per coordinare sales, support e management." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
        <StatCard label="Aziende" value={companies} hint="Account registrati" />
        <StatCard label="Contatti" value={contacts} hint="Persone in anagrafica" />
        <StatCard label="Lead totali" value={leads} hint="Acquisiti da ogni fonte" />
        <StatCard label="Lead aperti" value={openLeads} hint="Da lavorare in pipeline" />
        <StatCard label="Opportunita aperte" value={openOpportunities} hint="Deal non chiusi" />
        <StatCard label="Valore pipeline" value={`EUR ${pipelineValue._sum.value?.toString() ?? "0"}`} hint="Somma deal aperti" />
        <StatCard label="Attivita oggi" value={activitiesToday} hint="Eventi registrati oggi" />
        <StatCard label="Follow-up scaduti" value={overdueTasks} hint="Richiedono attenzione" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h3 className="text-lg font-semibold text-slate-950">Attivita di oggi</h3>
          <div className="mt-4">
            {recentActivities.length === 0 ? (
              <p className="text-sm text-slate-500">Nessuna attivita registrata oggi.</p>
            ) : (
              <ActivityTimeline activities={recentActivities} />
            )}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-slate-950">Follow-up prioritari</h3>
          <div className="mt-4">
            {overdueTasksList.length === 0 ? <p className="text-sm text-slate-500">Nessun follow-up scaduto.</p> : <TaskList tasks={overdueTasksList} />}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <h3 className="text-lg font-semibold text-slate-950">Promemoria da inviare</h3>
          <div className="mt-4">
            {remindersDue.length === 0 ? <p className="text-sm text-slate-500">Nessun promemoria in scadenza.</p> : <TaskList tasks={remindersDue} />}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Opportunita senza attivita recenti</h3>
              <p className="text-sm text-slate-500">Nessuna attivita negli ultimi 14 giorni.</p>
            </div>
            <p className="text-3xl font-bold text-slate-950">{staleOppsCount}</p>
          </div>
          <div className="mt-4 space-y-3">
            {staleOpps.length === 0 ? (
              <p className="text-sm text-slate-500">Nessuna opportunita aperta senza attivita recente.</p>
            ) : (
              staleOpps.map((opportunity: (typeof staleOpps)[number]) => (
                <div key={opportunity.id} className="rounded-2xl border border-slate-100 p-4">
                  <p className="font-semibold text-slate-950">{opportunity.title}</p>
                  <p className="text-sm text-slate-500">{opportunity.company?.name ?? "N/D"} · {opportunity.owner?.name ?? "N/D"} · {opportunity.stage.name}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
