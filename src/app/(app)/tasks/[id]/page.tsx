import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { completeTask, deleteTask, reopenTask, updateTask } from "../actions";
import { ButtonLink, Card, DangerButton, FieldValue, Notice, PageHeader, SubmitButton } from "@/components/ui";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/productivity";
import { requireUser } from "@/lib/auth";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsInput>;
};

function detailNotice(params: SearchParamsInput) {
  if (readParam(params, "created") === "1") return { tone: "success" as const, message: "Task creato." };
  if (readParam(params, "updated") === "1") return { tone: "success" as const, message: "Task aggiornato." };
  if (readParam(params, "error") === "confirm") return { tone: "error" as const, message: "Per eliminare devi scrivere ELIMINA nel campo di conferma." };
  if (readParam(params, "error") === "not-found") return { tone: "error" as const, message: "Task non trovato." };
  if (readParam(params, "error") === "delete-failed") return { tone: "error" as const, message: "Eliminazione non riuscita." };
  if (readParam(params, "error") === "invalid-company") return { tone: "error" as const, message: "Azienda non valida per questo workspace." };
  if (readParam(params, "error") === "invalid-contact") return { tone: "error" as const, message: "Contatto non valido per questo workspace." };
  if (readParam(params, "error") === "invalid-lead") return { tone: "error" as const, message: "Lead non valido per questo workspace." };
  if (readParam(params, "error") === "invalid-opportunity") return { tone: "error" as const, message: "Opportunita non valida per questo workspace." };
  return { tone: "slate" as const, message: undefined };
}

function dateValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function datetimeValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 16) : "";
}

export default async function TaskDetailPage({ params, searchParams }: PageProps) {
  const user = await requireUser("task:read");
  const { id } = await params;
  const query = await searchParams;
  const notice = detailNotice(query);
  const [task, users, companies, contacts, leads, opportunities] = await Promise.all([
    prisma.task.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        owner: true,
        company: true,
        contact: true,
        lead: true,
        opportunity: true,
      },
    }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, orderBy: { lastName: "asc" } }),
    prisma.lead.findMany({ where: { tenantId: user.tenantId }, orderBy: { title: "asc" } }),
    prisma.opportunity.findMany({ where: { tenantId: user.tenantId }, orderBy: { title: "asc" } }),
  ]);

  if (!task) notFound();

  return (
    <>
      <PageHeader
        title={task.title}
        description="Scheda task con owner, scadenza, priorita e collegamenti ai record."
        action={<ButtonLink href="/tasks">Torna ai task</ButtonLink>}
      />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card>
            <div className="grid gap-4 md:grid-cols-3">
              <FieldValue label="Owner" value={task.owner.name} />
              <FieldValue label="Stato" value={<TaskStatusBadge status={task.status} />} />
              <FieldValue label="Priorita" value={<TaskPriorityBadge priority={task.priority} />} />
              <FieldValue label="Scadenza" value={datetimeValue(task.dueAt) || "N/D"} />
              <FieldValue label="Promemoria" value={task.reminderAt ? task.reminderAt.toISOString() : "N/D"} />
              <FieldValue label="Completato" value={task.completedAt ? task.completedAt.toISOString() : "N/D"} />
              <FieldValue label="Azienda" value={task.company ? <Link href={`/companies/${task.company.id}`} className="text-brand-700 hover:text-brand-900">{task.company.name}</Link> : "N/D"} />
              <FieldValue label="Contatto" value={task.contact ? <Link href={`/contacts/${task.contact.id}`} className="text-brand-700 hover:text-brand-900">{task.contact.firstName} {task.contact.lastName}</Link> : "N/D"} />
              <FieldValue label="Lead" value={task.lead ? <Link href={`/leads/${task.lead.id}`} className="text-brand-700 hover:text-brand-900">{task.lead.title}</Link> : "N/D"} />
              <FieldValue label="Opportunita" value={task.opportunity ? <Link href={`/opportunities/${task.opportunity.id}`} className="text-brand-700 hover:text-brand-900">{task.opportunity.title}</Link> : "N/D"} />
            </div>
            {task.description ? <p className="mt-5 whitespace-pre-wrap text-sm text-slate-600">{task.description}</p> : null}
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-950">Azioni rapide</h3>
            <div className="mt-4 flex flex-wrap gap-3">
              {task.status === TaskStatus.DONE ? (
                <form action={reopenTask}>
                  <input type="hidden" name="id" value={task.id} />
                  <SubmitButton label="Riapri task" />
                </form>
              ) : (
                <form action={completeTask}>
                  <input type="hidden" name="id" value={task.id} />
                  <SubmitButton label="Segna completato" />
                </form>
              )}
              <ButtonLink href="/tasks">Vai alla lista</ButtonLink>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold">Modifica task</h3>
            <form action={updateTask} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={task.id} />
              <input name="title" defaultValue={task.title} placeholder="Titolo task" required />
              <textarea name="description" defaultValue={task.description ?? ""} placeholder="Descrizione" rows={3} />
              <select name="ownerId" defaultValue={task.ownerId}>
                {users.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </select>
              <div className="grid gap-3 md:grid-cols-2">
                <select name="status" defaultValue={task.status}>
                  {Object.values(TaskStatus).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <select name="priority" defaultValue={task.priority}>
                  {Object.values(TaskPriority).map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input name="dueAt" type="datetime-local" defaultValue={datetimeValue(task.dueAt)} />
                <input name="reminderAt" type="datetime-local" defaultValue={datetimeValue(task.reminderAt)} />
              </div>
              <select name="companyId" defaultValue={task.companyId ?? ""}>
                <option value="">Nessuna azienda</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <select name="contactId" defaultValue={task.contactId ?? ""}>
                <option value="">Nessun contatto</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.firstName} {contact.lastName}
                  </option>
                ))}
              </select>
              <select name="leadId" defaultValue={task.leadId ?? ""}>
                <option value="">Nessun lead</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.title}
                  </option>
                ))}
              </select>
              <select name="opportunityId" defaultValue={task.opportunityId ?? ""}>
                <option value="">Nessuna opportunita</option>
                {opportunities.map((opportunity) => (
                  <option key={opportunity.id} value={opportunity.id}>
                    {opportunity.title}
                  </option>
                ))}
              </select>
              <SubmitButton label="Salva modifiche" />
            </form>
          </Card>

          <Card className="border-red-100">
            <h3 className="text-lg font-semibold text-red-700">Elimina task</h3>
            <p className="mt-2 text-sm text-slate-500">Conferma richiesta prima di eliminare il task.</p>
            <form action={deleteTask} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={task.id} />
              <input name="confirmDelete" placeholder="Scrivi ELIMINA" pattern="ELIMINA" required />
              <DangerButton label="Elimina task" />
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
