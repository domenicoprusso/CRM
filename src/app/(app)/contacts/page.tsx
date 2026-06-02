import { LeadStatus } from "@prisma/client";
import Link from "next/link";
import { createContact } from "./actions";
import { Badge, ButtonLink, Card, EmptyState, Notice, PageHeader, SubmitButton } from "@/components/ui";
import { PaginationControls, PageSizeSelector, ResultsCount } from "@/components/pagination";
import { requireUser } from "@/lib/auth";
import { buildContactWhere, parseContactFilters, readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { parsePaginationParams, buildSkipTake, buildPaginationMeta, parseSort } from "@/lib/pagination";
import { getTeamUsers } from "@/lib/team";
import { prisma } from "@/lib/prisma";

const CONTACT_SORT_FIELDS = ["updatedAt", "lastName", "createdAt"] as const;

const LIFECYCLE_LABELS: Record<string, string> = {
  NEW: "Nuovo", CONTACTED: "Contattato", QUALIFIED: "Qualificato",
  NURTURING: "In coltivazione", CONVERTED: "Convertito", LOST: "Perso",
};

function listNotice(params: SearchParamsInput) {
  if (readParam(params, "deleted") === "1") return { tone: "success" as const, message: "Contatto eliminato." };
  if (readParam(params, "error") === "not-found") return { tone: "error" as const, message: "Contatto non trovato." };
  if (readParam(params, "error") === "invalid-company") return { tone: "error" as const, message: "Azienda non valida per questo workspace." };
  return { tone: "slate" as const, message: undefined };
}

export default async function ContactsPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const user = await requireUser("contact:read");
  const params = await searchParams;
  const filters = parseContactFilters(params);
  const notice = listNotice(params);
  const { page, pageSize } = parsePaginationParams(params);
  const { field: sortField, dir: sortDir } = parseSort(params, CONTACT_SORT_FIELDS, "updatedAt", "desc");
  const { skip, take } = buildSkipTake(page, pageSize);
  const where = buildContactWhere(params, user);

  const [contacts, total, companies, teamUsers] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { [sortField]: sortDir },
      skip,
      take,
      include: { company: true, owner: true },
    }),
    prisma.contact.count({ where }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getTeamUsers(prisma, user.tenantId),
  ]);

  const meta = buildPaginationMeta(total, page, pageSize);

  return (
    <>
      <PageHeader title="Contatti" description="Anagrafica persone, lifecycle, note interne e associazione con aziende." />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <h3 className="text-lg font-semibold">Nuovo contatto</h3>
          <form action={createContact} className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <input name="firstName" placeholder="Nome" required />
              <input name="lastName" placeholder="Cognome" required />
            </div>
            <input name="email" type="email" placeholder="email@dominio.it" />
            <input name="phone" placeholder="Telefono" />
            <input name="jobTitle" placeholder="Ruolo" />
            <select name="companyId" defaultValue="">
              <option value="">Nessuna azienda</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
            <select name="lifecycle" defaultValue={LeadStatus.NEW}>
              {Object.values(LeadStatus).map((status) => (
                <option key={status} value={status}>{LIFECYCLE_LABELS[status] ?? status}</option>
              ))}
            </select>
            <input name="tags" placeholder="Tag separati da virgola" />
            <textarea name="notes" placeholder="Note interne" rows={4} />
            <SubmitButton label="Crea contatto" />
          </form>
        </Card>
        <div className="space-y-6">
          <Card>
            <form className="grid gap-3 lg:grid-cols-[1fr_170px_180px_160px_200px_auto_auto] lg:items-end">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cerca
                <input name="q" defaultValue={filters.q ?? ""} placeholder="Nome, email, azienda..." />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Lifecycle
                <select name="lifecycle" defaultValue={filters.lifecycle ?? ""}>
                  <option value="">Tutti</option>
                  {Object.values(LeadStatus).map((status) => (
                    <option key={status} value={status}>{LIFECYCLE_LABELS[status] ?? status}</option>
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
                Tag
                <input name="tag" defaultValue={readParam(params, "tag") ?? ""} placeholder="Scuole" />
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
              <ButtonLink href="/contacts">Reset</ButtonLink>
            </form>
          </Card>
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-semibold">Rubrica</h3>
              <div className="flex items-center gap-4">
                <ResultsCount meta={meta} />
                <PageSizeSelector meta={meta} params={params} />
              </div>
            </div>
            {contacts.length === 0 ? (
              <div className="p-6">
                <EmptyState message="Nessun contatto trovato con i filtri correnti." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Contatto</th>
                      <th className="px-6 py-3">Azienda</th>
                      <th className="px-6 py-3">Lifecycle</th>
                      <th className="px-6 py-3">Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contacts.map((contact) => (
                      <tr key={contact.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-semibold text-slate-950">
                          <Link href={`/contacts/${contact.id}`} className="text-brand-700 hover:text-brand-900">
                            {contact.firstName} {contact.lastName}
                          </Link>
                          <p className="font-normal text-slate-500">{contact.email ?? contact.phone ?? "N/D"}</p>
                        </td>
                        <td className="px-6 py-4">
                          {contact.company
                            ? <Link href={`/companies/${contact.company.id}`} className="text-brand-700 hover:text-brand-900">{contact.company.name}</Link>
                            : "N/D"}
                        </td>
                        <td className="px-6 py-4">
                          <Badge>{LIFECYCLE_LABELS[contact.lifecycle] ?? contact.lifecycle}</Badge>
                        </td>
                        <td className="px-6 py-4">{contact.owner?.name ?? "N/D"}</td>
                      </tr>
                    ))}
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
