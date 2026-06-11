import Link from "next/link";
import { createOpportunity } from "./actions";
import { Badge, ButtonLink, Card, EmptyState, Notice, PageHeader, SubmitButton } from "@/components/ui";
import { PaginationControls, PageSizeSelector, ResultsCount } from "@/components/pagination";
import { requireUser } from "@/lib/auth";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { buildOpportunityWhere, parseOpportunityFilters } from "@/lib/opportunity-filters";
import { parsePaginationParams, buildSkipTake, buildPaginationMeta, parseSort } from "@/lib/pagination";
import { getTagSuggestions, getProjectSuggestions, getTeamUsers, projectLabel } from "@/lib/team";
import { ensureDefaultPipelineStages } from "@/lib/pipeline";
import { prisma } from "@/lib/prisma";

const OPP_SORT_FIELDS = ["updatedAt", "title", "createdAt", "value"] as const;

function listNotice(params: SearchParamsInput) {
  if (readParam(params, "deleted") === "1") return { tone: "success" as const, message: "Opportunita eliminata." };
  if (readParam(params, "error") === "not-found") return { tone: "error" as const, message: "Opportunita non trovata." };
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
  const { page, pageSize } = parsePaginationParams(params);
  const { field: sortField, dir: sortDir } = parseSort(params, OPP_SORT_FIELDS, "updatedAt", "desc");
  const { skip, take } = buildSkipTake(page, pageSize);
  const where = buildOpportunityWhere(params, user);

  const [opportunities, total, teamUsers, tagSuggestions, projectSuggestions] = await Promise.all([
    prisma.opportunity.findMany({
      where, orderBy: { [sortField]: sortDir }, skip, take,
      include: { company: true, owner: true, stage: true },
    }),
    prisma.opportunity.count({ where }),
    getTeamUsers(prisma, user.tenantId),
    getTagSuggestions(prisma, user.tenantId),
    getProjectSuggestions(prisma, user.tenantId),
  ]);
  const meta = buildPaginationMeta(total, page, pageSize);

  return (
    <>
      <PageHeader
        title="Opportunita"
        description="Gestisci deal, valore, probabilita, stage e chiusura prevista."
        action={<ButtonLink href="/pipeline" variant="primary">Apri pipeline</ButtonLink>}
      />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <h3 className="text-lg font-semibold">Nuova opportunita</h3>
          <p className="mt-1 text-sm text-slate-500">Per collegare a un&apos;azienda crea l&apos;opportunita dalla scheda azienda.</p>
          <form action={createOpportunity} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Titolo
              <input name="title" placeholder="Titolo opportunita" required />
            </label>
            <div className="grid gap-3 grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Valore
                <input name="value" type="number" min="0" step="0.01" placeholder="EUR" required />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Probabilita %
                <input name="probability" type="number" min="0" max="100" defaultValue={stages[0]?.probability ?? 20} />
              </label>
            </div>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Stage
              <select name="stageId" defaultValue={stages[0]?.id ?? ""}>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Data chiusura prevista
              <input name="expectedCloseDate" type="date" />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Note
              <textarea name="notes" placeholder="Note interne" rows={3} />
            </label>
            <SubmitButton label="Crea opportunita" />
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <form className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 items-end">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cerca
                <input name="q" defaultValue={filters.q ?? ""} placeholder="Titolo, azienda..." />
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
                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tag
                <input name="tag" defaultValue={readParam(params, "tag") ?? ""} placeholder="Tag" list="opp-filter-tags" />
                <datalist id="opp-filter-tags">
                  {tagSuggestions.map((t) => <option key={t} value={t} />)}
                </datalist>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Progetto
                <input name="project" defaultValue={readParam(params, "project") ?? ""} placeholder="Progetto" list="opp-filter-projects" />
                <datalist id="opp-filter-projects">
                  {projectSuggestions.map((p) => <option key={p.slug} value={p.slug} />)}
                </datalist>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Responsabile
                <select name="owner" defaultValue={filters.owner ?? ""}>
                  <option value="">Tutti</option>
                  <option value="me">I miei record</option>
                  {teamUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2 col-span-2 sm:col-span-1">
                <SubmitButton label="Filtra" className="flex-1" />
                <ButtonLink href="/opportunities">Reset</ButtonLink>
              </div>
            </form>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-semibold">Deal registrati</h3>
              <div className="flex items-center gap-4">
                <ResultsCount meta={meta} />
                <PageSizeSelector meta={meta} params={params} />
              </div>
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
                      <th className="px-6 py-3">Progetto</th>
                      <th className="px-6 py-3">Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {opportunities.map((opp) => {
                      const projectTags = (opp.company?.tags ?? []).filter((t) => t.startsWith("project:")).slice(0, 2);
                      return (
                        <tr key={opp.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-semibold text-slate-950">
                            <Link href={`/opportunities/${opp.id}`} className="text-brand-700 hover:text-brand-900">
                              {opp.title}
                            </Link>
                            <p className="font-normal text-slate-500">{opp.company?.name ?? "N/D"}</p>
                          </td>
                          <td className="px-6 py-4">
                            <Badge tone={stageTone(opp.stage)}>{opp.stage.name}</Badge>
                          </td>
                          <td className="px-6 py-4">EUR {opp.value.toString()}</td>
                          <td className="px-6 py-4">{opp.probability}%</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {projectTags.length > 0
                                ? projectTags.map((t) => <Badge key={t} tone="brand">{projectLabel(t)}</Badge>)
                                : <span className="text-slate-400">-</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">{opp.owner?.name ?? "N/D"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
