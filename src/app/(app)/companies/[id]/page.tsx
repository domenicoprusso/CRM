import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCompany, updateCompany } from "../actions";
import { createActivity } from "../../activities/actions";
import { createTask } from "../../tasks/actions";
import { Badge, ButtonLink, Card, DangerButton, EmptyState, FieldValue, Notice, PageHeader, SubmitButton } from "@/components/ui";
import { ActivityTimeline, TaskList, UnifiedTimeline } from "@/components/productivity";
import { requireUser } from "@/lib/auth";
import { getCompanyTimeline } from "@/lib/timeline";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsInput>;
};

function detailNotice(params: SearchParamsInput) {
  if (readParam(params, "activity_created") === "1") return { tone: "success" as const, message: "Attivita registrata." };
  if (readParam(params, "task_created") === "1") return { tone: "success" as const, message: "Task creato." };
  if (readParam(params, "updated") === "1") return { tone: "success" as const, message: "Azienda aggiornata." };
  if (readParam(params, "error") === "confirm") return { tone: "error" as const, message: "Per eliminare devi scrivere ELIMINA nel campo di conferma." };
  if (readParam(params, "error") === "delete-linked") return { tone: "error" as const, message: "Eliminazione bloccata: l'azienda ha record collegati." };
  if (readParam(params, "error") === "delete-failed") return { tone: "error" as const, message: "Eliminazione non riuscita." };
  return { tone: "slate" as const, message: undefined };
}

export default async function CompanyDetailPage({ params, searchParams }: PageProps) {
  const user = await requireUser("company:read");
  const { id } = await params;
  const query = await searchParams;
  const notice = detailNotice(query);
  const [company, timeline] = await Promise.all([
    prisma.company.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        owner: true,
        contacts: { orderBy: { updatedAt: "desc" }, take: 10 },
        leads: { orderBy: { updatedAt: "desc" }, take: 10 },
        activities: { orderBy: { occurredAt: "desc" }, take: 10, include: { user: true, company: true, contact: true, lead: true, opportunity: true } },
        tasks: { where: { status: { notIn: ["DONE", "CANCELLED"] } }, orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }], take: 10, include: { owner: true, company: true, contact: true, lead: true, opportunity: true } },
        _count: { select: { contacts: true, leads: true, opportunities: true, activities: true, tasks: true, documents: true } },
      },
    }),
    getCompanyTimeline(prisma, user.tenantId, id),
  ]);

  if (!company) notFound();

  return (
    <>
      <PageHeader
        title={company.name}
        description="Scheda azienda con dati commerciali, record collegati e modifica controllata."
        action={<ButtonLink href="/companies">Torna alle aziende</ButtonLink>}
      />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card>
            <div className="grid gap-4 md:grid-cols-4">
              <FieldValue label="Owner" value={company.owner?.name ?? "N/D"} />
              <FieldValue label="Settore" value={company.industry ?? "N/D"} />
              {company.codMeccanografico && (
                <FieldValue label="Cod. Meccanografico" value={company.codMeccanografico} />
              )}
              <FieldValue label="Città" value={company.city ?? "N/D"} />
              <FieldValue label="Provincia" value={company.province ?? "N/D"} />
              <FieldValue label="Regione" value={company.region ?? "N/D"} />
              <FieldValue label="CAP" value={company.postalCode ?? "N/D"} />
              <FieldValue label="Paese" value={company.country ?? "N/D"} />
              <FieldValue label="Email" value={company.email ?? "N/D"} />
              <FieldValue label="Telefono" value={company.phone ?? "N/D"} />
              <FieldValue label="Website" value={company.website ? <a href={company.website} className="text-brand-700 hover:text-brand-900">{company.website}</a> : "N/D"} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {company.tags.length === 0 ? <Badge tone="slate">Nessun tag</Badge> : company.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
            </div>
            {company.notes ? <p className="mt-5 whitespace-pre-wrap text-sm text-slate-600">{company.notes}</p> : null}
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-950">Contatti collegati</h3>
            <div className="mt-4 space-y-3">
              {company.contacts.length === 0 ? <EmptyState message="Nessun contatto collegato." /> : null}
              {company.contacts.map((contact) => (
                <Link key={contact.id} href={`/contacts/${contact.id}`} className="block rounded-2xl border border-slate-100 p-4 hover:border-brand-200 hover:bg-brand-50">
                  <p className="font-semibold text-slate-950">{contact.firstName} {contact.lastName}</p>
                  <p className="text-sm text-slate-500">{contact.email ?? contact.phone ?? "N/D"}</p>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-950">Lead collegati</h3>
            <div className="mt-4 space-y-3">
              {company.leads.length === 0 ? <EmptyState message="Nessun lead collegato." /> : null}
              {company.leads.map((lead) => (
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
              <ActivityTimeline activities={company.activities} />
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-950">Follow-up aperti</h3>
            <div className="mt-4">
              <TaskList tasks={company.tasks} />
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-950">Timeline CRM</h3>
            <p className="mt-1 text-sm text-slate-500">Storico cronologico di tutte le interazioni e modifiche.</p>
            <div className="mt-5">
              <UnifiedTimeline events={timeline} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold">+ Attivita rapida</h3>
            <form action={createActivity} className="mt-3 grid gap-2">
              <input type="hidden" name="companyId" value={company.id} />
              <input type="hidden" name="redirectTo" value={`/companies/${company.id}?activity_created=1`} />
              <input name="subject" placeholder="Soggetto (es. Chiamata, Email...)" required className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <textarea name="body" placeholder="Note (opzionale)" rows={2} className="rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none" />
              <SubmitButton label="Registra attivita" />
            </form>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold">+ Task rapido</h3>
            <form action={createTask} className="mt-3 grid gap-2">
              <input type="hidden" name="companyId" value={company.id} />
              <input type="hidden" name="redirectTo" value={`/companies/${company.id}?task_created=1`} />
              <input name="title" placeholder="Titolo task" required className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input name="dueAt" type="datetime-local" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <SubmitButton label="Crea task" />
            </form>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold">Modifica azienda</h3>
            <form action={updateCompany} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={company.id} />
              <input name="name" defaultValue={company.name} placeholder="Nome azienda" required />
              <input name="industry" defaultValue={company.industry ?? ""} placeholder="Settore" />
              <input name="codMeccanografico" defaultValue={company.codMeccanografico ?? ""} placeholder="Codice Meccanografico (es. TOIC83500A)" />
              <input name="website" defaultValue={company.website ?? ""} placeholder="https://azienda.it" />
              <input name="email" type="email" defaultValue={company.email ?? ""} placeholder="info@azienda.it" />
              <input name="phone" defaultValue={company.phone ?? ""} placeholder="Telefono" />
              <input name="address" defaultValue={company.address ?? ""} placeholder="Indirizzo" />
              <div className="grid gap-3 md:grid-cols-2">
                <input name="city" defaultValue={company.city ?? ""} placeholder="Citta" />
                <input name="province" defaultValue={company.province ?? ""} placeholder="Provincia" />
                <input name="region" defaultValue={company.region ?? ""} placeholder="Regione" />
                <input name="postalCode" defaultValue={company.postalCode ?? ""} placeholder="CAP" />
                <input name="country" defaultValue={company.country ?? ""} placeholder="Paese" />
              </div>
              <input name="tags" defaultValue={company.tags.join(", ")} placeholder="Tag separati da virgola" />
              <textarea name="notes" defaultValue={company.notes ?? ""} placeholder="Note interne" rows={4} />
              <SubmitButton label="Salva modifiche" />
            </form>
          </Card>

          <Card className="border-red-100">
            <h3 className="text-lg font-semibold text-red-700">Elimina azienda</h3>
            <p className="mt-2 text-sm text-slate-500">
              Disponibile solo senza record collegati. Collegamenti: contatti {company._count.contacts}, lead {company._count.leads}, opportunita {company._count.opportunities}, attivita {company._count.activities}, task {company._count.tasks}, documenti {company._count.documents}.
            </p>
            <form action={deleteCompany} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={company.id} />
              <input name="confirmDelete" placeholder="Scrivi ELIMINA" pattern="ELIMINA" required />
              <DangerButton label="Elimina azienda" />
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
