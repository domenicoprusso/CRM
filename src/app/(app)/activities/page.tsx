import { ActivityType } from "@prisma/client";
import { createActivity } from "./actions";
import { Badge, ButtonLink, Card, EmptyState, Notice, PageHeader, SubmitButton } from "@/components/ui";
import { ActivityTimeline } from "@/components/productivity";
import { requireUser } from "@/lib/auth";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { buildActivityWhere, parseActivityFilters } from "@/lib/productivity";
import { prisma } from "@/lib/prisma";

function listNotice(params: SearchParamsInput) {
  if (readParam(params, "deleted") === "1") return { tone: "success" as const, message: "Attivita eliminata." };
  if (readParam(params, "created") === "1") return { tone: "success" as const, message: "Attivita creata." };
  if (readParam(params, "updated") === "1") return { tone: "success" as const, message: "Attivita aggiornata." };
  if (readParam(params, "error") === "not-found") return { tone: "error" as const, message: "Attivita non trovata." };
  if (readParam(params, "error") === "confirm") return { tone: "error" as const, message: "Per eliminare devi scrivere ELIMINA nel campo di conferma." };
  if (readParam(params, "error") === "invalid-company") return { tone: "error" as const, message: "Azienda non valida per questo workspace." };
  if (readParam(params, "error") === "invalid-contact") return { tone: "error" as const, message: "Contatto non valido per questo workspace." };
  if (readParam(params, "error") === "invalid-lead") return { tone: "error" as const, message: "Lead non valido per questo workspace." };
  if (readParam(params, "error") === "invalid-opportunity") return { tone: "error" as const, message: "Opportunita non valida per questo workspace." };
  if (readParam(params, "error") === "delete-failed") return { tone: "error" as const, message: "Eliminazione non riuscita." };
  return { tone: "slate" as const, message: undefined };
}

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const user = await requireUser("activity:read");
  const params = await searchParams;
  const filters = parseActivityFilters(params);
  const notice = listNotice(params);
  const [activities, companies, contacts, leads, opportunities] = await Promise.all([
    prisma.activity.findMany({
      where: buildActivityWhere(params, user),
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      include: { user: true, company: true, contact: true, lead: true, opportunity: true },
    }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, orderBy: { lastName: "asc" } }),
    prisma.lead.findMany({ where: { tenantId: user.tenantId }, orderBy: { title: "asc" } }),
    prisma.opportunity.findMany({ where: { tenantId: user.tenantId }, orderBy: { title: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Attivita"
        description="Cronologia operativa di email, chiamate, riunioni, note e follow-up."
        action={<ButtonLink href="/tasks">Vai ai task</ButtonLink>}
      />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <h3 className="text-lg font-semibold">Nuova attivita</h3>
          <form action={createActivity} className="mt-4 grid gap-3">
            <select name="type" defaultValue={ActivityType.NOTE}>
              {Object.values(ActivityType).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input name="subject" placeholder="Soggetto attivita" required />
            <textarea name="body" placeholder="Descrizione" rows={3} />
            <label className="grid gap-1">
              Data e ora
              <input name="occurredAt" type="datetime-local" />
            </label>
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
            <SubmitButton label="Crea attivita" />
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <form className="grid gap-3 xl:grid-cols-[1fr_150px_180px_150px_auto_auto] xl:items-end">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cerca
                <input name="q" defaultValue={filters.q ?? ""} placeholder="Soggetto, note..." />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tipo
                <select name="type" defaultValue={filters.type ?? ""}>
                  <option value="">Tutti</option>
                  {Object.values(ActivityType).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Vista
                <select name="owner" defaultValue={filters.owner ?? ""}>
                  <option value="">Tutti</option>
                  <option value="me">Le mie attivita</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Entita
                <select name="entityType" defaultValue={filters.entityType ?? ""}>
                  <option value="">Tutte</option>
                  <option value="company">Azienda</option>
                  <option value="contact">Contatto</option>
                  <option value="lead">Lead</option>
                  <option value="opportunity">Opportunita</option>
                </select>
              </label>
              <input name="entityId" placeholder="ID entita" defaultValue={filters.entityId ?? ""} />
              <SubmitButton label="Filtra" />
              <ButtonLink href="/activities">Reset</ButtonLink>
            </form>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <div>
                <h3 className="text-lg font-semibold">Cronologia attivita</h3>
                <p className="text-sm text-slate-500">Eventi registrati e note operative.</p>
              </div>
              <Badge tone="slate">{activities.length} risultati</Badge>
            </div>
            <div className="p-6">
              {activities.length === 0 ? (
                <EmptyState message="Nessuna attivita trovata con i filtri correnti." />
              ) : (
                <ActivityTimeline activities={activities} />
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
