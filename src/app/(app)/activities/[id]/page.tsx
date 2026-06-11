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

  const activity = await prisma.activity.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { user: true, company: true, contact: true, lead: true, opportunity: true },
  });

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
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <FieldValue label="Autore" value={activity.user.name} />
              <FieldValue label="Tipo" value={<ActivityTypeBadge type={activity.type} />} />
              <FieldValue label="Data" value={activity.occurredAt.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} />
              <FieldValue
                label="Azienda"
                value={activity.company
                  ? <Link href={`/companies/${activity.company.id}`} className="text-brand-700 hover:text-brand-900">{activity.company.name}</Link>
                  : "N/D"}
              />
              <FieldValue
                label="Contatto"
                value={activity.contact
                  ? <Link href={`/contacts/${activity.contact.id}`} className="text-brand-700 hover:text-brand-900">{activity.contact.firstName} {activity.contact.lastName}</Link>
                  : "N/D"}
              />
              <FieldValue
                label="Lead"
                value={activity.lead
                  ? <Link href={`/leads/${activity.lead.id}`} className="text-brand-700 hover:text-brand-900">{activity.lead.title}</Link>
                  : "N/D"}
              />
              <FieldValue
                label="Opportunita"
                value={activity.opportunity
                  ? <Link href={`/opportunities/${activity.opportunity.id}`} className="text-brand-700 hover:text-brand-900">{activity.opportunity.title}</Link>
                  : "N/D"}
              />
            </div>
            {activity.body ? <p className="mt-5 whitespace-pre-wrap text-sm text-slate-600">{activity.body}</p> : null}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold">Modifica attivita</h3>
            <form action={updateActivity} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={activity.id} />
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tipo
                <select name="type" defaultValue={activity.type}>
                  {Object.values(ActivityType).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Soggetto
                <input name="subject" defaultValue={activity.subject} placeholder="Soggetto attivita" required />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Note
                <textarea name="body" defaultValue={activity.body ?? ""} placeholder="Descrizione" rows={4} />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Data e ora
                <input name="occurredAt" type="datetime-local" defaultValue={datetimeValue(activity.occurredAt)} />
              </label>
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
