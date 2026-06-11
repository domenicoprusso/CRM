import { LeadStatus } from "@prisma/client";
import Link from "next/link";
import { createLead } from "./actions";
import { Badge, ButtonLink, Card, EmptyState, Notice, PageHeader, SubmitButton } from "@/components/ui";
import { PaginationControls, PageSizeSelector, ResultsCount } from "@/components/pagination";
import { requireUser } from "@/lib/auth";
import { buildLeadWhere, parseLeadFilters, readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { parsePaginationParams, buildSkipTake, buildPaginationMeta, parseSort } from "@/lib/pagination";
import { getTagSuggestions, getProjectSuggestions, getTeamUsers, projectLabel } from "@/lib/team";
import { prisma } from "@/lib/prisma";

const LEAD_SORT_FIELDS = ["updatedAt", "title", "createdAt", "score"] as const;

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "Nuovo", CONTACTED: "Contattato", QUALIFIED: "Qualificato",
  NURTURING: "In coltivazione", CONVERTED: "Convertito", LOST: "Perso",
};

function listNotice(params: SearchParamsInput) {
  if (readParam(params, "deleted") === "1") return { tone: "success" as const, message: "Lead eliminato." };
  if (readParam(params, "error") === "not-found") return { tone: "error" as const, message: "Lead non trovato." };
  return { tone: "slate" as const, message: undefined };
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const user = await requireUser("lead:read");
  const params = await searchParams;
  const filters = parseLeadFilters(params);
  const notice = listNotice(params);
  const { page, pageSize } = parsePaginationParams(params);
  const { field: sortField, dir: sortDir } = parseSort(params, LEAD_SORT_FIELDS, "updatedAt", "desc");
  const { skip, take } = buildSkipTake(page, pageSize);
  const where = buildLeadWhere(params, user);

  const [leads, total, teamUsers, tagSuggestions, projectSuggestions] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { [sortField]: sortDir }, skip, take, include: { company: true, owner: true } }),
    prisma.lead.count({ where }),
    getTeamUsers(prisma, user.tenantId),
    getTagSuggestions(prisma, user.tenantId),
    getProjectSuggestions(prisma, user.tenantId),
  ]);
  const meta = buildPaginationMeta(total, page, pageSize);

  return (
    <>
      <PageHeader title="Lead" description="Qualifica opportunita iniziali, assegna score, valore stimato e prossima data di chiusura." />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <h3 className="text-lg font-semibold">Nuovo lead</h3>
          <p className="mt-1 text-sm text-slate-500">Per collegare a un&apos;azienda crea il lead dalla scheda azienda.</p>
          <form action={createLead} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Titolo
              <input name="title" placeholder="Titolo lead" required />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Fonte
              <input name="source" placeholder="LinkedIn, referral, evento..." />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Stato
              <select name="status" defaultValue={LeadStatus.NEW}>
                {Object.values(LeadStatus).map((s) => (
                  <option key={s} value={s}>{LEAD_STATUS_LABELS[s] ?? s}</option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Score
                <input name="score" type="number" min="0" max="100" placeholder="0-100" />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Valore stimato
                <input name="estimatedValue" type="number" min="0" step="0.01" placeholder="EUR" />
              </label>
            </div>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Data chiusura prevista
              <input name="expectedCloseDate" type="date" />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tag
              <input name="tags" placeholder="Tag separati da virgola" list="lead-tag-suggestions" />
              <datalist id="lead-tag-suggestions">
                {tagSuggestions.map((t) => <option key={t} value={t} />)}
              </datalist>
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Note
              <textarea name="notes" placeholder="Note interne" rows={3} />
            </label>
            <SubmitButton label="Crea lead" />
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <form className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 items-end">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cerca
                <input name="q" defaultValue={filters.q ?? ""} placeholder="Titolo, fonte, azienda..." />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stato
                <select name="status" defaultValue={filters.status ?? ""}>
                  <option value="">Tutti</option>
                  {Object.values(LeadStatus).map((s) => (
                    <option key={s} value={s}>{LEAD_STATUS_LABELS[s] ?? s}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Score min.
                <input name="scoreMin" type="number" min="0" max="100" defaultValue={filters.scoreMin ?? ""} placeholder="0" />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tag
                <input name="tag" defaultValue={readParam(params, "tag") ?? ""} placeholder="Tag" list="lead-filter-tags" />
                <datalist id="lead-filter-tags">
                  {tagSuggestions.map((t) => <option key={t} value={t} />)}
                </datalist>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Progetto
                <input name="project" defaultValue={readParam(params, "project") ?? ""} placeholder="lomblead" list="lead-filter-projects" />
                <datalist id="lead-filter-projects">
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
                <ButtonLink href="/leads">Reset</ButtonLink>
              </div>
            </form>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-semibold">Lead pipeline iniziale</h3>
              <div className="flex items-center gap-4">
                <ResultsCount meta={meta} />
                <PageSizeSelector meta={meta} params={params} />
              </div>
            </div>
            {leads.length === 0 ? (
              <div className="p-6">
                <EmptyState message="Nessun lead trovato con i filtri correnti." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Lead</th>
                      <th className="px-6 py-3">Stato</th>
                      <th className="px-6 py-3">Score</th>
                      <th className="px-6 py-3">Valore</th>
                      <th className="px-6 py-3">Progetto</th>
                      <th className="px-6 py-3">Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.map((lead) => {
                      const projectTags = lead.tags.filter((t) => t.startsWith("project:")).slice(0, 2);
                      return (
                        <tr key={lead.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-semibold text-slate-950">
                            <Link href={`/leads/${lead.id}`} className="text-brand-700 hover:text-brand-900">
                              {lead.title}
                            </Link>
                            <p className="font-normal text-slate-500">{lead.company?.name ?? "N/D"}</p>
                          </td>
                          <td className="px-6 py-4">
                            <Badge>{LEAD_STATUS_LABELS[lead.status] ?? lead.status}</Badge>
                          </td>
                          <td className="px-6 py-4">{lead.score}/100</td>
                          <td className="px-6 py-4">{lead.estimatedValue ? `EUR ${lead.estimatedValue}` : "N/D"}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {projectTags.length > 0
                                ? projectTags.map((t) => <Badge key={t} tone="brand">{projectLabel(t)}</Badge>)
                                : <span className="text-slate-400">-</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">{lead.owner?.name ?? "N/D"}</td>
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
