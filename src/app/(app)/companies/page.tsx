import Link from "next/link";
import { createCompany } from "./actions";
import { Badge, ButtonLink, Card, EmptyState, Notice, PageHeader, SubmitButton } from "@/components/ui";
import { PaginationControls, PageSizeSelector, ResultsCount } from "@/components/pagination";
import { requireUser } from "@/lib/auth";
import { buildCompanyWhere, parseCompanyFilters, readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { parsePaginationParams, buildSkipTake, buildPaginationMeta, parseSort } from "@/lib/pagination";
import { getTagsAndProjects, getTeamUsers, projectLabel } from "@/lib/team";
import { prisma } from "@/lib/prisma";

const COMPANY_SORT_FIELDS = ["updatedAt", "name", "createdAt", "lastActivityAt"] as const;

const dateFormatter = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
function fmt(d: Date | null) { return d ? dateFormatter.format(new Date(d)) : null; }

function listNotice(params: SearchParamsInput) {
  if (readParam(params, "deleted") === "1") return { tone: "success" as const, message: "Azienda eliminata." };
  if (readParam(params, "error") === "not-found") return { tone: "error" as const, message: "Azienda non trovata." };
  return { tone: "slate" as const, message: undefined };
}

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const user = await requireUser("company:read");
  const params = await searchParams;
  const filters = parseCompanyFilters(params);
  const notice = listNotice(params);
  const { page, pageSize } = parsePaginationParams(params);
  const { field: sortField, dir: sortDir } = parseSort(params, COMPANY_SORT_FIELDS, "updatedAt", "desc");
  const { skip, take } = buildSkipTake(page, pageSize);
  const where = buildCompanyWhere(params, user);

  const orderBy = sortField === "lastActivityAt"
    ? { lastActivityAt: { sort: sortDir, nulls: "first" as const } }
    : { [sortField]: sortDir };

  const [companies, total, teamUsers, { tagSuggestions, projectSuggestions }] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy,
      skip,
      take,
      include: { owner: true, _count: { select: { contacts: true, leads: true } } },
    }),
    prisma.company.count({ where }),
    getTeamUsers(prisma, user.tenantId),
    getTagsAndProjects(prisma, user.tenantId),
  ]);

  const meta = buildPaginationMeta(total, page, pageSize);

  return (
    <>
      <PageHeader title="Aziende" description="Gestisci account, informazioni commerciali, tag e collegamenti con contatti e lead." />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <h3 className="text-lg font-semibold">Nuova azienda</h3>
          <form action={createCompany} className="mt-4 grid gap-3">
            <input name="name" placeholder="Nome azienda" required />
            <input name="industry" placeholder="Settore" />
            <input name="website" placeholder="https://azienda.it" />
            <input name="email" type="email" placeholder="info@azienda.it" />
            <input name="phone" placeholder="Telefono" />
            <div className="grid gap-3 grid-cols-2">
              <input name="city" placeholder="Citta" />
              <input name="province" placeholder="Provincia" />
              <input name="region" placeholder="Regione" />
              <input name="postalCode" placeholder="CAP" />
              <input name="country" placeholder="Paese" className="col-span-2" />
            </div>
            <input name="tags" placeholder="Tag separati da virgola" list="tag-suggestions" />
            <datalist id="tag-suggestions">
              {tagSuggestions.map((t) => <option key={t} value={t} />)}
            </datalist>
            <textarea name="notes" placeholder="Note interne" rows={4} />
            <SubmitButton label="Crea azienda" />
          </form>
        </Card>
        <div className="space-y-6">
          <Card>
            <form className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 items-end">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cerca
                <input name="q" defaultValue={filters.q ?? ""} placeholder="Nome, email, citta..." />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Settore
                <input name="industry" defaultValue={filters.industry ?? ""} placeholder="Settore" />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Regione
                <input name="region" defaultValue={filters.region ?? ""} placeholder="Lombardia" />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Provincia
                <input name="province" defaultValue={filters.province ?? ""} placeholder="MI" />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Paese
                <input name="country" defaultValue={filters.country ?? ""} placeholder="Paese" />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tag
                <input name="tag" defaultValue={readParam(params, "tag") ?? ""} placeholder="Scuole" list="filter-tags" />
                <datalist id="filter-tags">
                  {tagSuggestions.map((t) => <option key={t} value={t} />)}
                </datalist>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Progetto
                <input name="project" defaultValue={readParam(params, "project") ?? ""} placeholder="Scuole Roma" list="filter-projects" />
                <datalist id="filter-projects">
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
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ordina per
                <select name="sort" defaultValue={readParam(params, "sort") ?? "updatedAt"}>
                  <option value="updatedAt">Ultima modifica</option>
                  <option value="name">Nome</option>
                  <option value="lastActivityAt">Ultima attività</option>
                  <option value="createdAt">Data creazione</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Direzione
                <select name="direction" defaultValue={readParam(params, "direction") ?? "desc"}>
                  <option value="asc">Crescente ↑</option>
                  <option value="desc">Decrescente ↓</option>
                </select>
              </label>
              <div className="flex gap-2 col-span-2 sm:col-span-1">
                <SubmitButton label="Filtra" className="flex-1" />
                <ButtonLink href="/companies">Reset</ButtonLink>
              </div>
            </form>
          </Card>
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-semibold">Account registrati</h3>
              <div className="flex items-center gap-4">
                <ResultsCount meta={meta} />
                <PageSizeSelector meta={meta} params={params} />
              </div>
            </div>
            {companies.length === 0 ? (
              <div className="p-6">
                <EmptyState message="Nessuna azienda trovata con i filtri correnti." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Azienda</th>
                      <th className="px-6 py-3">Settore</th>
                      <th className="px-6 py-3">Localita</th>
                      <th className="px-6 py-3">Tag</th>
                      <th className="px-6 py-3">Progetto</th>
                      <th className="px-6 py-3">Contatti</th>
                      <th className="px-6 py-3">Lead</th>
                      <th className="px-6 py-3">Ultima attività</th>
                      <th className="px-6 py-3">Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {companies.map((company) => {
                      const freeTags = company.tags.filter((t) => !t.startsWith("project:")).slice(0, 3);
                      const projectTags = company.tags.filter((t) => t.startsWith("project:")).slice(0, 2);
                      const locality = [company.city, company.province, company.region].filter(Boolean).join(", ");
                      return (
                        <tr key={company.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-semibold text-slate-950">
                            <Link href={`/companies/${company.id}`} className="text-brand-700 hover:text-brand-900">
                              {company.name}
                            </Link>
                            <p className="font-normal text-slate-500">{company.email ?? company.phone ?? "N/D"}</p>
                          </td>
                          <td className="px-6 py-4">{company.industry ?? "N/D"}</td>
                          <td className="px-6 py-4 text-slate-600">{locality || "N/D"}</td>
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
                          <td className="px-6 py-4">{company._count.contacts}</td>
                          <td className="px-6 py-4">{company._count.leads}</td>
                          <td className="px-6 py-4 text-slate-500">
                            {fmt(company.lastActivityAt) ?? <span className="text-slate-400 italic">Mai</span>}
                          </td>
                          <td className="px-6 py-4">{company.owner?.name ?? "N/D"}</td>
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
