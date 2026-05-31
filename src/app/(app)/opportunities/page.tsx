import Link from "next/link";
import { createOpportunity } from "./actions";
import { Badge, ButtonLink, Card, EmptyState, Notice, PageHeader, SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { buildOpportunityWhere, parseOpportunityFilters } from "@/lib/opportunity-filters";
import { ensureDefaultPipelineStages } from "@/lib/pipeline";
import { prisma } from "@/lib/prisma";

function listNotice(params: SearchParamsInput) {
  if (readParam(params, "deleted") === "1") return { tone: "success" as const, message: "Opportunita eliminata." };
  if (readParam(params, "error") === "not-found") return { tone: "error" as const, message: "Opportunita non trovata." };
  if (readParam(params, "error") === "invalid-company") return { tone: "error" as const, message: "Azienda non valida per questo workspace." };
  if (readParam(params, "error") === "invalid-contact") return { tone: "error" as const, message: "Contatto non valido per questo workspace." };
  return { tone: "slate" as const, message: undefined };
}

function stageTone(stage: { isWon: boolean; isLost: boolean }) {
  if (stage.isWon) return "brand" as const;
  if (stage.isLost) return "red" as const;
  return "slate" as const;
}

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const user = await requireUser("opportunity:read");
  const params = await searchParams;
  const filters = parseOpportunityFilters(params);
  const notice = listNotice(params);
  const stages = await ensureDefaultPipelineStages(user.tenantId);
  const [opportunities, companies, contacts] = await Promise.all([
    prisma.opportunity.findMany({
      where: buildOpportunityWhere(params, user),
      orderBy: { updatedAt: "desc" },
      include: { company: true, contact: true, owner: true, stage: true },
    }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, orderBy: { lastName: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Opportunita"
        description="Gestisci deal, valore, probabilita, stage e chiusura prevista."
        action={<ButtonLink href="/pipeline" variant="primary">Apri pipeline</ButtonLink>}
      />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <h3 className="text-lg font-semibold">Nuova opportunita</h3>
          <form action={createOpportunity} className="mt-4 grid gap-3">
            <input name="title" placeholder="Titolo opportunita" required />
            <div className="grid gap-3 md:grid-cols-2">
              <input name="value" type="number" min="0" step="0.01" placeholder="Valore" required />
              <input name="probability" type="number" min="0" max="100" defaultValue={stages[0]?.probability ?? 20} placeholder="Probabilita" />
            </div>
            <input name="expectedCloseDate" type="date" />
            <select name="stageId" defaultValue={stages[0]?.id ?? ""}>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
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
            <textarea name="notes" placeholder="Note interne" rows={4} />
            <SubmitButton label="Crea opportunita" />
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <form className="grid gap-3 xl:grid-cols-[1fr_150px_170px_150px_auto_auto] xl:items-end">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cerca
                <input name="q" defaultValue={filters.q ?? ""} placeholder="Titolo, azienda, contatto..." />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stato
                <select name="status" defaultValue={filters.status ?? ""}>
                  <option value="">Tutti</option>
                  <option value="open">Aperte</option>
                  <option value="won">Vinte</option>
                  <option value="lost">Perse</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stage
                <select name="stageId" defaultValue={filters.stageId ?? ""}>
                  <option value="">Tutti</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Vista
                <select name="owner" defaultValue={filters.owner ?? ""}>
                  <option value="">Tutti</option>
                  <option value="me">I miei record</option>
                </select>
              </label>
              <SubmitButton label="Filtra" />
              <ButtonLink href="/opportunities">Reset</ButtonLink>
            </form>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <h3 className="text-lg font-semibold">Deal registrati</h3>
              <Badge tone="slate">{opportunities.length} risultati</Badge>
            </div>
            {opportunities.length === 0 ? (
              <div className="p-6">
                <EmptyState message="Nessuna opportunita trovata con i filtri correnti." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Opportunita</th>
                      <th className="px-6 py-3">Stage</th>
                      <th className="px-6 py-3">Valore</th>
                      <th className="px-6 py-3">Prob.</th>
                      <th className="px-6 py-3">Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {opportunities.map((opportunity) => (
                      <tr key={opportunity.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-semibold text-slate-950">
                          <Link href={`/opportunities/${opportunity.id}`} className="text-brand-700 hover:text-brand-900">
                            {opportunity.title}
                          </Link>
                          <p className="font-normal text-slate-500">{opportunity.company?.name ?? opportunity.contact?.lastName ?? "N/D"}</p>
                        </td>
                        <td className="px-6 py-4">
                          <Badge tone={stageTone(opportunity.stage)}>{opportunity.stage.name}</Badge>
                        </td>
                        <td className="px-6 py-4">EUR {opportunity.value.toString()}</td>
                        <td className="px-6 py-4">{opportunity.probability}%</td>
                        <td className="px-6 py-4">{opportunity.owner?.name ?? "N/D"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
