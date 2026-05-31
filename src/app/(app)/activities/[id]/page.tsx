import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteActivity, updateActivity } from "../actions";
import { ActivityType } from "@prisma/client";
import { ButtonLink, Card, DangerButton, FieldValue, Notice, PageHeader, SubmitButton } from "@/components/ui";
import { ActivityTypeBadge } from "@/components/productivity";
import { requireUser } from "@/lib/auth";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsInput>;
};

function detailNotice(params: SearchParamsInput) {
  if (readParam(params, "created") === "1") return { tone: "success" as const, message: "Attivita creata." };
  if (readParam(params, "updated") === "1") return { tone: "success" as const, message: "Attivita aggiornata." };
  if (readParam(params, "error") === "confirm") return { tone: "error" as const, message: "Per eliminare devi scrivere ELIMINA nel campo di conferma." };
  if (readParam(params, "error") === "not-found") return { tone: "error" as const, message: "Attivita non trovata." };
  if (readParam(params, "error") === "delete-failed") return { tone: "error" as const, message: "Eliminazione non riuscita." };
  if (readParam(params, "error") === "invalid-company") return { tone: "error" as const, message: "Azienda non valida per questo workspace." };
  if (readParam(params, "error") === "invalid-contact") return { tone: "error" as const, message: "Contatto non valido per questo workspace." };
  if (readParam(params, "error") === "invalid-lead") return { tone: "error" as const, message: "Lead non valido per questo workspace." };
  if (readParam(params, "error") === "invalid-opportunity") return { tone: "error" as const, message: "Opportunita non valida per questo workspace." };
  return { tone: "slate" as const, message: undefined };
}

function datetimeValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 16) : "";
}

export default async function ActivityDetailPage({ params, searchParams }: PageProps) {
  const user = await requireUser("activity:read");
  const { id } = await params;
  const query = await searchParams;
  const notice = detailNotice(query);
  const [activity, companies, contacts, leads, opportunities] = await Promise.all([
    prisma.activity.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { user: true, company: true, contact: true, lead: true, opportunity: true },
    }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, orderBy: { lastName: "asc" } }),
    prisma.lead.findMany({ where: { tenantId: user.tenantId }, orderBy: { title: "asc" } }),
    prisma.opportunity.findMany({ where: { tenantId: user.tenantId }, orderBy: { title: "asc" } }),
  ]);

  if (!activity) notFound();

  return (
    <>
      <PageHeader
        title={activity.subject}
        description="Scheda attivita con collegamenti ai record e modifica controllata."
        action={<ButtonLink href="/activities">Torna alle attivita</ButtonLink>}
      />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card>
            <div className="grid gap-4 md:grid-cols-3">
              <FieldValue label="Autore" value={activity.user.name} />
              <FieldValue label="Tipo" value={<ActivityTypeBadge type={activity.type} />} />
              <FieldValue label="Data" value={activity.occurredAt.toISOString()} />
              <FieldValue label="Azienda" value={activity.company ? <Link href={`/companies/${activity.company.id}`} className="text-brand-700 hover:text-brand-900">{activity.company.name}</Link> : "N/D"} />
              <FieldValue label="Contatto" value={activity.contact ? <Link href={`/contacts/${activity.contact.id}`} className="text-brand-700 hover:text-brand-900">{activity.contact.firstName} {activity.contact.lastName}</Link> : "N/D"} />
              <FieldValue label="Lead" value={activity.lead ? <Link href={`/leads/${activity.lead.id}`} className="text-brand-700 hover:text-brand-900">{activity.lead.title}</Link> : "N/D"} />
              <FieldValue label="Opportunita" value={activity.opportunity ? <Link href={`/opportunities/${activity.opportunity.id}`} className="text-brand-700 hover:text-brand-900">{activity.opportunity.title}</Link> : "N/D"} />
            </div>
            {activity.body ? <p className="mt-5 whitespace-pre-wrap text-sm text-slate-600">{activity.body}</p> : null}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold">Modifica attivita</h3>
            <form action={updateActivity} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={activity.id} />
              <select name="type" defaultValue={activity.type}>
                {Object.values(ActivityType).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <input name="subject" defaultValue={activity.subject} placeholder="Soggetto attivita" required />
              <textarea name="body" defaultValue={activity.body ?? ""} placeholder="Descrizione" rows={3} />
              <input name="occurredAt" type="datetime-local" defaultValue={datetimeValue(activity.occurredAt)} />
              <select name="companyId" defaultValue={activity.companyId ?? ""}>
                <option value="">Nessuna azienda</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <select name="contactId" defaultValue={activity.contactId ?? ""}>
                <option value="">Nessun contatto</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.firstName} {contact.lastName}
                  </option>
                ))}
              </select>
              <select name="leadId" defaultValue={activity.leadId ?? ""}>
                <option value="">Nessun lead</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.title}
                  </option>
                ))}
              </select>
              <select name="opportunityId" defaultValue={activity.opportunityId ?? ""}>
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
            <h3 className="text-lg font-semibold text-red-700">Elimina attivita</h3>
            <p className="mt-2 text-sm text-slate-500">Conferma richiesta prima di eliminare il record.</p>
            <form action={deleteActivity} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={activity.id} />
              <input name="confirmDelete" placeholder="Scrivi ELIMINA" pattern="ELIMINA" required />
              <DangerButton label="Elimina attivita" />
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
