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
  if (readParam(params, "error") === "delete-failed") return { tone: "error" as const, message: "Eliminazione non riuscita." };
  return { tone: "slate" as const, message: undefined };
}

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const user = await requireUser("activity:read");
  const params = await searchParams;
  const filters = parseActivityFilters(params);
  const notice = listNotice(params);

  const activities = await prisma.activity.findMany({
    where: buildActivityWhere(params, user),
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: { user: true, company: true, contact: true, lead: true, opportunity: true },
  });

  return (
    <>
      <PageHeader
        title="Attivita"
        description="Cronologia operativa di email, chiamate, riunioni, note e follow-up."
        action={<ButtonLink href="/tasks">Vai ai task</ButtonLink>}
      />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <h3 className="text-lg font-semibold">Nuova attivita</h3>
          <p className="mt-1 text-sm text-slate-500">Per collegare a un&apos;azienda crea l&apos;attivita dalla scheda azienda.</p>
          <form action={createActivity} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tipo
              <select name="type" defaultValue={ActivityType.NOTE}>
                {Object.values(ActivityType).map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Soggetto
              <input name="subject" placeholder="Soggetto attivita" required />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Note
              <textarea name="body" placeholder="Descrizione opzionale" rows={3} />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Data e ora
              <input name="occurredAt" type="datetime-local" />
            </label>
            <SubmitButton label="Crea attivita" />
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cerca
                <input name="q" defaultValue={filters.q ?? ""} placeholder="Soggetto, note..." />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tipo
                <select name="type" defaultValue={filters.type ?? ""}>
                  <option value="">Tutti</option>
                  {Object.values(ActivityType).map((type) => (
                    <option key={type} value={type}>{type}</option>
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
              <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
                <SubmitButton label="Filtra" />
                <ButtonLink href="/activities">Reset</ButtonLink>
              </div>
            </form>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <div>
                <h3 className="text-lg font-semibold">Cronologia attivita</h3>
                <p className="text-sm text-slate-500">Ultime 200 attivita registrate.</p>
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
