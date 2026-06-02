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
  NEW: "Nuovo",
  CONTACTED: "Contattato",
  QUALIFIED: "Qualificato",
  NURTURING: "In coltivazione",
  CONVERTED: "Convertito",
  LOST: "Perso",
};

function listNotice(params: SearchParamsInput) {
  if (readParam(params, "deleted") === "1") return { tone: "success" as const, message: "Lead eliminato." };
  if (readParam(params, "error") === "not-found") return { tone: "error" as const, message: "Lead non trovato." };
  if (readParam(params, "error") === "invalid-company") return { tone: "error" as const, message: "Azienda non valida per questo workspace." };
  if (readParam(params, "error") === "invalid-contact") return { tone: "error" as const, message: "Contatto non valido per questo workspace." };
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

  const [leads, total, companies, contacts, teamUsers, tagSuggestions, projectSuggestions] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { [sortField]: sortDir }, skip, take, include: { company: true, contact: true, owner: true } }),
    prisma.lead.count({ where }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, orderBy: { lastName: "asc" } }),
    getTeamUsers(prisma, user.tenantId),
    getTagSuggestions(prisma, user.tenantId),
    getProjectSuggestions(prisma, user.tenantId),
  ]);
  const meta = buildPaginationMeta(total, page, pageSize);

  return (
    <>
      <PageHeader title="Lead" description="Qualifica opportunita iniziali, assegna score, valore stimato e prossima data di chiusura." />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <h3 className="text-lg font-semibold">Nuovo lead</h3>
          <form action={createLead} className="mt-4 grid gap-3">
            <input name="title" placeholder="Titolo lead" required />
            <input name="source" placeholder="Fonte (LinkedIn, referral, evento...)" />
            <select name="status" defaultValue={LeadStatus.NEW}>
              {Object.values(LeadStatus).map((status) => (
                <option key={status} value={status}>{LEAD_STATUS_LABELS[status] ?? status}</option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="score" type="number" min="0" max="100" placeholder="Score" />
              <input name="estimatedValue" type="number" min="0" step="0.01" placeholder="Valore stimato" />
            </div>
            <input name="expectedCloseDate" type="date" />
            <select name="companyId" defaultValue="">
              <option value="">Nessuna azienda</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
            <select name="contactId" defaultValue="">
              <option value="">Nessun contatto</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</option>
              ))}
            </select>
            <input name="tags" placeholder="Tag separati da virgola" list="lead-tag-suggestions" />
            <datalist id="lead-tag-suggestions">
              {tagSuggestions.map((t) => <option key={t} value={t} />)}
            </datalist>
            <textarea name="notes" placeholder="Note interne" rows={4} />
            <SubmitButton label="Crea lead" />
          </form>
        </Card>
        <div className="space-y-6">
          <Card>
            <form className="grid gap-3 xl:grid-cols-[1fr_150px_180px_120px_150px_150px_200px_auto_auto] xl:items-end">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cerca
                <input name="q" defaultValue={filters.q ?? ""} placeholder="Titolo, fonte, azienda..." />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stato
                <select name="status" defaultValue={filters.status ?? ""}>
                  <option value="">Tutti</option>
                  {Object.values(LeadStatus).map((status) => (
                    <option key={status} value={status}>{LEAD_STATUS_LABELS[status] ?? status}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Azienda
                <select name="companyId" defaultValue={filters.companyId ?? ""}>
                  <option value="">Tutte</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Score min.
                <input name="scoreMin" type="number" min="0" max="100" defaultValue={filters.scoreMin ?? ""} />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tag
                <input name="tag" defaultValue={readParam(params, "tag") ?? ""} placeholder="Scuole" list="lead-filter-tags" />
                <datalist id="lead-filter-tags">
                  {tagSuggestions.map((t) => <option key={t} value={t} />)}
                </datalist>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Progetto
                <input name="project" defaultValue={readParam(params, "project") ?? ""} placeholder="Scuole Roma" list="lead-filter-projects" />
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
              <SubmitButton label="Filtra" />
              <ButtonLink href="/leads">Reset</ButtonLink>
            </form>
          </Card>
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <h3 className="text-lg font-semibold">Lead pipeline iniziale</h3>
              <div className="flex items-center gap-3">
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
                      <th className="px-6 py-3">Tag</th>
                      <th className="px-6 py-3">Progetto</th>
                      <th className="px-6 py-3">Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.map((lead) => {
                      const freeTags = lead.tags.filter((t) => !t.startsWith("project:")).slice(0, 2);
                      const projectTags = lead.tags.filter((t) => t.startsWith("project:")).slice(0, 2);
                      return (
                        <tr key={lead.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-semibold text-slate-950">
                            <Link href={`/leads/${lead.id}`} className="text-brand-700 hover:text-brand-900">
                              {lead.title}
                            </Link>
                            <p className="font-normal text-slate-500">{lead.company?.name ?? (lead.contact ? `${lead.contact.firstName} ${lead.contact.lastName}` : "N/D")}</p>
                          </td>
                          <td className="px-6 py-4">
                            <Badge>{LEAD_STATUS_LABELS[lead.status] ?? lead.status}</Badge>
                          </td>
                          <td className="px-6 py-4">{lead.score}/100</td>
                          <td className="px-6 py-4">{lead.estimatedValue ? `EUR ${lead.estimatedValue}` : "N/D"}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {freeTags.length > 0
                                ? freeTags.map((t) => <Badge key={t} tone="slate">{t}</Badge>)
                                : <span className="text-slate-400">-</span>}
                            </div>
                          </td>
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
