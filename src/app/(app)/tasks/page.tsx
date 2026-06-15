import { TaskPriority, TaskStatus } from "@prisma/client";
import { createTask } from "./actions";
import { ButtonLink, Card, EmptyState, Notice, PageHeader, SubmitButton } from "@/components/ui";
import { PaginationControls, PageSizeSelector, ResultsCount } from "@/components/pagination";
import { TaskList } from "@/components/productivity";
import { requireUser } from "@/lib/auth";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { buildTaskWhere, parseTaskFilters } from "@/lib/productivity";
import { parsePaginationParams, buildSkipTake, buildPaginationMeta, parseSort } from "@/lib/pagination";

const TASK_SORT_FIELDS = ["dueAt", "status", "createdAt", "updatedAt"] as const;
import { prisma } from "@/lib/prisma";

function listNotice(params: SearchParamsInput) {
  if (readParam(params, "deleted") === "1") return { tone: "success" as const, message: "Task eliminato." };
  if (readParam(params, "created") === "1") return { tone: "success" as const, message: "Task creato." };
  if (readParam(params, "updated") === "1") return { tone: "success" as const, message: "Task aggiornato." };
  if (readParam(params, "error") === "not-found") return { tone: "error" as const, message: "Task non trovato." };
  if (readParam(params, "error") === "confirm") return { tone: "error" as const, message: "Per eliminare devi scrivere ELIMINA nel campo di conferma." };
  if (readParam(params, "error") === "invalid-company") return { tone: "error" as const, message: "Azienda non valida per questo workspace." };
  if (readParam(params, "error") === "invalid-contact") return { tone: "error" as const, message: "Contatto non valido per questo workspace." };
  if (readParam(params, "error") === "invalid-lead") return { tone: "error" as const, message: "Lead non valido per questo workspace." };
  if (readParam(params, "error") === "invalid-opportunity") return { tone: "error" as const, message: "Opportunita non valida per questo workspace." };
  if (readParam(params, "error") === "delete-failed") return { tone: "error" as const, message: "Eliminazione non riuscita." };
  return { tone: "slate" as const, message: undefined };
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const user = await requireUser("task:read");
  const params = await searchParams;
  const filters = parseTaskFilters(params);
  const notice = listNotice(params);
  const { page, pageSize } = parsePaginationParams(params);
  const { field: sortField, dir: sortDir } = parseSort(params, TASK_SORT_FIELDS, "dueAt", "asc");
  const { skip, take } = buildSkipTake(page, pageSize);
  const where = buildTaskWhere(params, user);

  const [tasks, total, users, companies, contacts, leads, opportunities] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ [sortField]: sortDir }, { updatedAt: "desc" }],
      skip,
      take,
      include: { owner: true, company: true, contact: true, lead: true, opportunity: true },
    }),
    prisma.task.count({ where }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, orderBy: { lastName: "asc" } }),
    prisma.lead.findMany({ where: { tenantId: user.tenantId }, orderBy: { title: "asc" } }),
    prisma.opportunity.findMany({ where: { tenantId: user.tenantId }, orderBy: { title: "asc" } }),
  ]);
  const meta = buildPaginationMeta(total, page, pageSize);

  return (
    <>
      <PageHeader
        title="Attivita"
        description="Gestisci task e follow-up con scadenza, priorita, owner e stato completato."
        action={<ButtonLink href="/activities">Apri attivita</ButtonLink>}
      />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <h3 className="text-lg font-semibold">Nuovo task</h3>
          <form action={createTask} className="mt-4 grid gap-3">
            <input name="title" placeholder="Titolo task" required />
            <textarea name="description" placeholder="Descrizione" rows={3} />
            <select name="ownerId" defaultValue={user.id}>
              {users.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <select name="status" defaultValue={TaskStatus.TODO}>
                {Object.values(TaskStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select name="priority" defaultValue={TaskPriority.MEDIUM}>
                {Object.values(TaskPriority).map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1">
                Scadenza
                <input name="dueAt" type="datetime-local" />
              </label>
              <label className="grid gap-1">
                Promemoria
                <input name="reminderAt" type="datetime-local" />
              </label>
            </div>
            <select name="companyId" defaultValue="">
              <option value="">Nessuna azienda</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <select name="contactId" defaultValue="">
              <option value="">Nessun contatto</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.firstName} {contact.lastName}
                </option>
              ))}
            </select>
            <select name="leadId" defaultValue="">
              <option value="">Nessun lead</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.title}
                </option>
              ))}
            </select>
            <select name="opportunityId" defaultValue="">
              <option value="">Nessuna opportunita</option>
              {opportunities.map((opportunity) => (
                <option key={opportunity.id} value={opportunity.id}>
                  {opportunity.title}
                </option>
              ))}
            </select>
            <SubmitButton label="Crea task" />
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <form className="grid gap-3 xl:grid-cols-[1fr_150px_150px_150px_150px_150px_auto_auto] xl:items-end">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cerca
                <input name="q" defaultValue={filters.q ?? ""} placeholder="Titolo, descrizione..." />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stato
                <select name="status" defaultValue={filters.status ?? ""}>
                  <option value="">Tutti</option>
                  {Object.values(TaskStatus).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Priorita
                <select name="priority" defaultValue={filters.priority ?? ""}>
                  <option value="">Tutte</option>
                  {Object.values(TaskPriority).map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Scadenza
                <select name="due" defaultValue={filters.due ?? ""}>
                  <option value="">Tutte</option>
                  <option value="today">Oggi</option>
                  <option value="overdue">Scaduti</option>
                  <option value="upcoming">Future</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Responsabile
                <select name="owner" defaultValue={filters.owner ?? ""}>
                  <option value="">Tutti</option>
                  <option value="me">Le mie attivita</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tag
                <input name="tag" defaultValue={readParam(params, "tag") ?? ""} placeholder="Scuole" />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Progetto
                <input name="project" defaultValue={readParam(params, "project") ?? ""} placeholder="Scuole Roma" />
              </label>
              <SubmitButton label="Filtra" />
              <ButtonLink href="/tasks">Reset</ButtonLink>
            </form>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <div>
                <h3 className="text-lg font-semibold">Le mie attivita</h3>
                <p className="text-sm text-slate-500">Task, follow-up e scadenze operative.</p>
              </div>
              <div className="flex items-center gap-3">
                <ResultsCount meta={meta} />
                <PageSizeSelector meta={meta} params={params} />
              </div>
            </div>
            <div className="p-6">
              {tasks.length === 0 ? <EmptyState message="Nessun task trovato con i filtri correnti." /> : <TaskList tasks={tasks} />}
            </div>
            {meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
                <ResultsCount meta={meta} />
                <PaginationControls meta={meta} params={params} />
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
