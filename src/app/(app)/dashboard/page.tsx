import Link from "next/link";
import { AlertCircle, Bell, Clock, Sparkles, TrendingUp } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getMyDaySnapshot, MY_DAY_LIMIT } from "@/lib/my-day";
import { prisma } from "@/lib/prisma";

const dayFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(date: Date | null | undefined) {
  return date ? dayFormatter.format(date) : null;
}

function formatDateTime(date: Date | null | undefined) {
  return date ? dateTimeFormatter.format(date) : null;
}

function priorityTone(priority: string): "red" | "amber" | "slate" {
  if (priority === "URGENT" || priority === "HIGH") return "red";
  if (priority === "MEDIUM") return "amber";
  return "slate";
}

function priorityLabel(priority: string) {
  const labels: Record<string, string> = {
    URGENT: "Urgente",
    HIGH: "Alta",
    MEDIUM: "Media",
    LOW: "Bassa",
  };
  return labels[priority] ?? priority;
}

function taskContextLabel(task: {
  company: { name: string } | null;
  contact: { firstName: string; lastName: string } | null;
  lead: { title: string } | null;
  opportunity: { title: string } | null;
}) {
  return (
    task.company?.name ??
    (task.contact ? `${task.contact.firstName} ${task.contact.lastName}` : null) ??
    task.lead?.title ??
    task.opportunity?.title ??
    null
  );
}

type MyDayTaskItem = {
  id: string;
  title: string;
  priority: string;
  dueAt: Date | null;
  reminderAt: Date | null;
  company: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  lead: { id: string; title: string } | null;
  opportunity: { id: string; title: string } | null;
};

function TaskRow({ task, dateLabel }: { task: MyDayTaskItem; dateLabel: string | null }) {
  const context = taskContextLabel(task);
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4">
      <div className="min-w-0 flex-1">
        <Link href={`/tasks/${task.id}`} className="font-semibold text-brand-700 hover:text-brand-900 hover:underline">
          {task.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {dateLabel && <span>{dateLabel}</span>}
          {context && <span className="text-slate-400">|</span>}
          {context && <span>{context}</span>}
        </div>
      </div>
      <Badge tone={priorityTone(task.priority)}>{priorityLabel(task.priority)}</Badge>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  total,
  seeAllHref,
  tone,
  anchorId,
}: {
  icon: React.ElementType;
  title: string;
  total: number;
  seeAllHref: string;
  tone: "red" | "amber" | "brand" | "slate";
  anchorId?: string;
}) {
  const tones = {
    red: "text-red-600",
    amber: "text-amber-600",
    brand: "text-brand-600",
    slate: "text-slate-600",
  };
  return (
    <div id={anchorId} className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${tones[tone]}`} />
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        {total > 0 && <Badge tone={tone}>{total}</Badge>}
      </div>
      {total > MY_DAY_LIMIT && (
        <Link href={seeAllHref} className="text-xs font-semibold text-brand-600 hover:text-brand-800 hover:underline">
          Vedi tutti ({total})
        </Link>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser("dashboard:read");
  const snapshot = await getMyDaySnapshot(prisma, user.tenantId, user.id);

  const totalAlerts =
    snapshot.overdueTotal +
    snapshot.dueTodayTotal +
    snapshot.followupTodayTotal +
    snapshot.opportunitiesWithoutNextActionTotal;

  // Smart alert banner
  const alertParts: string[] = [];
  if (snapshot.overdueTotal > 0)
    alertParts.push(`${snapshot.overdueTotal} task scadut${snapshot.overdueTotal === 1 ? "o" : "i"}`);
  if (snapshot.staleOpportunitiesTotal > 0)
    alertParts.push(
      `${snapshot.staleOpportunitiesTotal} opportunit${snapshot.staleOpportunitiesTotal === 1 ? "a ferma" : "a ferme"} da piu di 7 giorni`,
    );
  const alertMessage = alertParts.length > 0 ? `Hai ${alertParts.join(" e ")}. Vuoi partire da qui?` : null;

  return (
    <>
      <PageHeader
        title="My Day"
        description={`${snapshot.today} - Ciao ${user.name.split(" ")[0]}, ecco la tua giornata.`}
        action={<ButtonLink href="/reports">Report manageriale</ButtonLink>}
      />

      {/* Smart alert banner */}
      {alertMessage ? (
        <div className="mb-6 flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-amber-900">{alertMessage}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {snapshot.overdueTotal > 0 && (
                <a href="#overdue" className="text-sm font-medium text-amber-700 underline hover:text-amber-900">
                  Vai ai task scaduti
                </a>
              )}
              {snapshot.staleOpportunitiesTotal > 0 && (
                <Link href="/opportunities?owner=me" className="text-sm font-medium text-amber-700 underline hover:text-amber-900">
                  Vedi opportunita ferme
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* All clear */}
      {totalAlerts === 0 && snapshot.newLeadsTotal === 0 && snapshot.staleOpportunitiesTotal === 0 ? (
        <Card className="mb-6">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-brand-600" />
            <div>
              <p className="font-semibold text-slate-950">Tutto in ordine!</p>
              <p className="text-sm text-slate-500">Nessun task scaduto, nessun follow-up pendente, nessun lead da prendere in carico.</p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Task scaduti */}
      <Card className="mb-6">
        <SectionHeader
          icon={AlertCircle}
          title="Task scaduti"
          total={snapshot.overdueTotal}
          seeAllHref="/tasks?due=overdue&owner=me"
          tone="red"
          anchorId="overdue"
        />
        {snapshot.overdueTasks.length === 0 ? (
          <EmptyState message="Nessun task scaduto. Ottimo lavoro!" />
        ) : (
          <div className="space-y-3">
            {snapshot.overdueTasks.map((task) => (
              <TaskRow key={task.id} task={task} dateLabel={task.dueAt ? `Scaduto il ${formatDate(task.dueAt)}` : null} />
            ))}
          </div>
        )}
      </Card>

      {/* Task in scadenza oggi */}
      <Card className="mb-6">
        <SectionHeader
          icon={Clock}
          title="Task in scadenza oggi"
          total={snapshot.dueTodayTotal}
          seeAllHref="/tasks?due=today&owner=me"
          tone="amber"
        />
        {snapshot.dueTodayTasks.length === 0 ? (
          <EmptyState message="Nessun task in scadenza oggi." />
        ) : (
          <div className="space-y-3">
            {snapshot.dueTodayTasks.map((task) => (
              <TaskRow key={task.id} task={task} dateLabel={task.dueAt ? `Scadenza ${formatDate(task.dueAt)}` : null} />
            ))}
          </div>
        )}
      </Card>

      {/* Follow-up di oggi */}
      <Card className="mb-6">
        <SectionHeader
          icon={Bell}
          title="Follow-up di oggi"
          total={snapshot.followupTodayTotal}
          seeAllHref="/tasks?owner=me"
          tone="brand"
        />
        {snapshot.followupTodayTasks.length === 0 ? (
          <EmptyState message="Nessun follow-up programmato per oggi." />
        ) : (
          <div className="space-y-3">
            {snapshot.followupTodayTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                dateLabel={task.reminderAt ? `Promemoria ${formatDateTime(task.reminderAt)}` : null}
              />
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Opportunita senza next action */}
        <Card>
          <SectionHeader
            icon={TrendingUp}
            title="Opportunita senza next action"
            total={snapshot.opportunitiesWithoutNextActionTotal}
            seeAllHref="/opportunities?owner=me"
            tone="slate"
          />
          {snapshot.opportunitiesWithoutNextAction.length === 0 ? (
            <EmptyState message="Tutte le tue opportunita hanno almeno un task aperto." />
          ) : (
            <div className="space-y-3">
              {snapshot.opportunitiesWithoutNextAction.map((opp) => {
                const closeDate = formatDate(opp.expectedCloseDate);
                return (
                  <div key={opp.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                    <Link href={`/opportunities/${opp.id}`} className="font-semibold text-brand-700 hover:text-brand-900 hover:underline">
                      {opp.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Badge tone="slate">{opp.stage.name}</Badge>
                      {opp.company && (
                        <>
                          <span className="text-slate-400">|</span>
                          <Link href={`/companies/${opp.company.id}`} className="hover:text-brand-700">
                            {opp.company.name}
                          </Link>
                        </>
                      )}
                      {closeDate && (
                        <>
                          <span className="text-slate-400">|</span>
                          <span>Chiusura {closeDate}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                      <span>
                        Valore{" "}
                        <span className="font-semibold text-slate-700">
                          {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(opp.value))}
                        </span>
                      </span>
                      <span className="text-slate-400">|</span>
                      <span>{opp.probability}% prob.</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Lead NEW assegnati a me */}
        <Card>
          <SectionHeader
            icon={Sparkles}
            title="Lead nuovi da prendere in carico"
            total={snapshot.newLeadsTotal}
            seeAllHref="/leads?status=NEW&owner=me"
            tone="slate"
          />
          {snapshot.newLeads.length === 0 ? (
            <EmptyState message="Nessun lead nuovo assegnato a te." />
          ) : (
            <div className="space-y-3">
              {snapshot.newLeads.map((lead) => {
                const context =
                  lead.company?.name ??
                  (lead.contact ? `${lead.contact.firstName} ${lead.contact.lastName}` : null);
                return (
                  <div key={lead.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/leads/${lead.id}`} className="font-semibold text-brand-700 hover:text-brand-900 hover:underline">
                        {lead.title}
                      </Link>
                      <Badge tone="slate">Score {lead.score}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {context && <span>{context}</span>}
                      {lead.source && (
                        <>
                          {context && <span className="text-slate-400">|</span>}
                          <span>{lead.source}</span>
                        </>
                      )}
                      {lead.estimatedValue && (
                        <>
                          <span className="text-slate-400">|</span>
                          <span>
                            {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(lead.estimatedValue))}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
