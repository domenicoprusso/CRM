import { LeadStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteContact, updateContact } from "../actions";
import { createActivity } from "../../activities/actions";
import { createTask } from "../../tasks/actions";
import { Badge, ButtonLink, Card, DangerButton, EmptyState, FieldValue, Notice, PageHeader, SubmitButton } from "@/components/ui";
import { ActivityTimeline, TaskList } from "@/components/productivity";
import { requireUser } from "@/lib/auth";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsInput>;
};

function detailNotice(params: SearchParamsInput) {
  if (readParam(params, "activity_created") === "1") return { tone: "success" as const, message: "Attivita registrata." };
  if (readParam(params, "task_created") === "1") return { tone: "success" as const, message: "Task creato." };
  if (readParam(params, "updated") === "1") return { tone: "success" as const, message: "Contatto aggiornato." };
  if (readParam(params, "error") === "confirm") return { tone: "error" as const, message: "Per eliminare devi scrivere ELIMINA nel campo di conferma." };
  if (readParam(params, "error") === "delete-linked") return { tone: "error" as const, message: "Eliminazione bloccata: il contatto ha record collegati." };
  if (readParam(params, "error") === "delete-failed") return { tone: "error" as const, message: "Eliminazione non riuscita." };
  if (readParam(params, "error") === "invalid-company") return { tone: "error" as const, message: "Azienda non valida per questo workspace." };
  return { tone: "slate" as const, message: undefined };
}

export default async function ContactDetailPage({ params, searchParams }: PageProps) {
  const user = await requireUser("contact:read");
  const { id } = await params;
  const query = await searchParams;
  const notice = detailNotice(query);
  const [contact, companies] = await Promise.all([
    prisma.contact.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        company: true,
        owner: true,
        leads: { orderBy: { updatedAt: "desc" }, take: 10 },
        activities: { orderBy: { occurredAt: "desc" }, take: 10, include: { user: true, company: true, contact: true, lead: true, opportunity: true } },
        tasks: { where: { status: { notIn: ["DONE", "CANCELLED"] } }, orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }], take: 10, include: { owner: true, company: true, contact: true, lead: true, opportunity: true } },
        _count: { select: { leads: true, opportunities: true, activities: true, tasks: true, documents: true } },
      },
    }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
  ]);

  if (!contact) notFound();

  return (
    <>
      <PageHeader
        title={`${contact.firstName} ${contact.lastName}`}
        description="Scheda contatto con azienda, lead collegati e modifica controllata."
        action={<ButtonLink href="/contacts">Torna ai contatti</ButtonLink>}
      />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card>
            <div className="grid gap-4 md:grid-cols-3">
              <FieldValue label="Owner" value={contact.owner?.name ?? "N/D"} />
              <FieldValue label="Lifecycle" value={<Badge>{contact.lifecycle}</Badge>} />
              <FieldValue label="Azienda" value={contact.company ? <Link href={`/companies/${contact.company.id}`} className="text-brand-700 hover:text-brand-900">{contact.company.name}</Link> : "N/D"} />
              <FieldValue label="Email" value={contact.email ?? "N/D"} />
              <FieldValue label="Telefono" value={contact.phone ?? "N/D"} />
              <FieldValue label="Ruolo" value={contact.jobTitle ?? "N/D"} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {contact.tags.length === 0 ? <Badge tone="slate">Nessun tag</Badge> : contact.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
            </div>
            {contact.notes ? <p className="mt-5 whitespace-pre-wrap text-sm text-slate-600">{contact.notes}</p> : null}
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-950">Lead collegati</h3>
            <div className="mt-4 space-y-3">
              {contact.leads.length === 0 ? <EmptyState message="Nessun lead collegato." /> : null}
              {contact.leads.map((lead) => (
                <Link key={lead.id} href={`/leads/${lead.id}`} className="block rounded-2xl border border-slate-100 p-4 hover:border-brand-200 hover:bg-brand-50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-950">{lead.title}</p>
                    <Badge>{lead.status}</Badge>
                  </div>
                  <p className="text-sm text-slate-500">Score {lead.score}/100</p>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-950">Timeline attivita</h3>
            <div className="mt-4">
              <ActivityTimeline activities={contact.activities} />
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-950">Follow-up aperti</h3>
            <div className="mt-4">
              <TaskList tasks={contact.tasks} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold">+ Attivita rapida</h3>
            <form action={createActivity} className="mt-3 grid gap-2">
              <input type="hidden" name="contactId" value={contact.id} />
              {contact.companyId ? <input type="hidden" name="companyId" value={contact.companyId} /> : null}
              <input type="hidden" name="redirectTo" value={`/contacts/${contact.id}?activity_created=1`} />
              <input name="subject" placeholder="Soggetto (es. Chiamata, Email...)" required className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <textarea name="body" placeholder="Note (opzionale)" rows={2} className="rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none" />
              <SubmitButton label="Registra attivita" />
            </form>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold">+ Task rapido</h3>
            <form action={createTask} className="mt-3 grid gap-2">
              <input type="hidden" name="contactId" value={contact.id} />
              {contact.companyId ? <input type="hidden" name="companyId" value={contact.companyId} /> : null}
              <input type="hidden" name="redirectTo" value={`/contacts/${contact.id}?task_created=1`} />
              <input name="title" placeholder="Titolo task" required className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input name="dueAt" type="date" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <SubmitButton label="Crea task" />
            </form>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold">Modifica contatto</h3>
            <form action={updateContact} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={contact.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <input name="firstName" defaultValue={contact.firstName} placeholder="Nome" required />
                <input name="lastName" defaultValue={contact.lastName} placeholder="Cognome" required />
              </div>
              <input name="email" type="email" defaultValue={contact.email ?? ""} placeholder="email@dominio.it" />
              <input name="phone" defaultValue={contact.phone ?? ""} placeholder="Telefono" />
              <input name="jobTitle" defaultValue={contact.jobTitle ?? ""} placeholder="Ruolo" />
              <select name="companyId" defaultValue={contact.companyId ?? ""}>
                <option value="">Nessuna azienda</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <select name="lifecycle" defaultValue={contact.lifecycle}>
                {Object.values(LeadStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <input name="tags" defaultValue={contact.tags.join(", ")} placeholder="Tag separati da virgola" />
              <textarea name="notes" defaultValue={contact.notes ?? ""} placeholder="Note interne" rows={4} />
              <SubmitButton label="Salva modifiche" />
            </form>
          </Card>

          <Card className="border-red-100">
            <h3 className="text-lg font-semibold text-red-700">Elimina contatto</h3>
            <p className="mt-2 text-sm text-slate-500">
              Disponibile solo senza record collegati. Collegamenti: lead {contact._count.leads}, opportunita {contact._count.opportunities}, attivita {contact._count.activities}, task {contact._count.tasks}, documenti {contact._count.documents}.
            </p>
            <form action={deleteContact} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={contact.id} />
              <input name="confirmDelete" placeholder="Scrivi ELIMINA" pattern="ELIMINA" required />
              <DangerButton label="Elimina contatto" />
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
