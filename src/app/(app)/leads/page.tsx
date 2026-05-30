import { LeadStatus } from "@prisma/client";
import Link from "next/link";
import { createLead } from "./actions";
import { Badge, ButtonLink, Card, EmptyState, Notice, PageHeader, SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { buildLeadWhere, parseLeadFilters, readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { prisma } from "@/lib/prisma";

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
  const [leads, companies, contacts] = await Promise.all([
    prisma.lead.findMany({ where: buildLeadWhere(params, user), orderBy: { updatedAt: "desc" }, include: { company: true, contact: true, owner: true } }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, orderBy: { lastName: "asc" } }),
  ]);

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
                <option key={status} value={status}>
                  {status}
                </option>
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
            <input name="tags" placeholder="Tag separati da virgola" />
            <textarea name="notes" placeholder="Note interne" rows={4} />
            <SubmitButton label="Crea lead" />
          </form>
        </Card>
        <div className="space-y-6">
          <Card>
            <form className="grid gap-3 xl:grid-cols-[1fr_150px_180px_120px_150px_auto_auto] xl:items-end">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cerca
                <input name="q" defaultValue={filters.q ?? ""} placeholder="Titolo, fonte, azienda..." />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stato
                <select name="status" defaultValue={filters.status ?? ""}>
                  <option value="">Tutti</option>
                  {Object.values(LeadStatus).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Azienda
                <select name="companyId" defaultValue={filters.companyId ?? ""}>
                  <option value="">Tutte</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Score min.
                <input name="scoreMin" type="number" min="0" max="100" defaultValue={filters.scoreMin ?? ""} />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Vista
                <select name="owner" defaultValue={filters.owner ?? ""}>
                  <option value="">Tutti</option>
                  <option value="me">I miei record</option>
                </select>
              </label>
              <SubmitButton label="Filtra" />
              <ButtonLink href="/leads">Reset</ButtonLink>
            </form>
          </Card>
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <h3 className="text-lg font-semibold">Lead pipeline iniziale</h3>
              <Badge tone="slate">{leads.length} risultati</Badge>
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
                      <th className="px-6 py-3">Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-semibold text-slate-950">
                          <Link href={`/leads/${lead.id}`} className="text-brand-700 hover:text-brand-900">
                            {lead.title}
                          </Link>
                          <p className="font-normal text-slate-500">{lead.company?.name ?? (lead.contact ? `${lead.contact.firstName} ${lead.contact.lastName}` : "N/D")}</p>
                        </td>
                        <td className="px-6 py-4">
                          <Badge>{lead.status}</Badge>
                        </td>
                        <td className="px-6 py-4">{lead.score}/100</td>
                        <td className="px-6 py-4">{lead.estimatedValue ? `EUR ${lead.estimatedValue}` : "N/D"}</td>
                        <td className="px-6 py-4">{lead.owner?.name ?? "N/D"}</td>
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
