import Link from "next/link";
import { createCompany } from "./actions";
import { Badge, ButtonLink, Card, EmptyState, Notice, PageHeader, SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { buildCompanyWhere, parseCompanyFilters, readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { prisma } from "@/lib/prisma";

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
  const companies = await prisma.company.findMany({
    where: buildCompanyWhere(params, user),
    orderBy: { updatedAt: "desc" },
    include: { owner: true, _count: { select: { contacts: true, leads: true } } },
  });

  return (
    <>
      <PageHeader title="Aziende" description="Gestisci account, informazioni commerciali, tag e collegamenti con contatti e lead." />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <h3 className="text-lg font-semibold">Nuova azienda</h3>
          <form action={createCompany} className="mt-4 grid gap-3">
            <input name="name" placeholder="Nome azienda" required />
            <input name="industry" placeholder="Settore" />
            <input name="website" placeholder="https://azienda.it" />
            <input name="email" type="email" placeholder="info@azienda.it" />
            <input name="phone" placeholder="Telefono" />
            <div className="grid gap-3 md:grid-cols-2">
              <input name="city" placeholder="Citta" />
              <input name="country" placeholder="Paese" />
            </div>
            <input name="tags" placeholder="Tag separati da virgola" />
            <textarea name="notes" placeholder="Note interne" rows={4} />
            <SubmitButton label="Crea azienda" />
          </form>
        </Card>
        <div className="space-y-6">
          <Card>
            <form className="grid gap-3 lg:grid-cols-[1fr_160px_160px_150px_auto_auto] lg:items-end">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cerca
                <input name="q" defaultValue={filters.q ?? ""} placeholder="Nome, email, citta..." />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Settore
                <input name="industry" defaultValue={filters.industry ?? ""} placeholder="Settore" />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Paese
                <input name="country" defaultValue={filters.country ?? ""} placeholder="Paese" />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Vista
                <select name="owner" defaultValue={filters.owner ?? ""}>
                  <option value="">Tutti</option>
                  <option value="me">I miei record</option>
                </select>
              </label>
              <SubmitButton label="Filtra" />
              <ButtonLink href="/companies">Reset</ButtonLink>
            </form>
          </Card>
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <h3 className="text-lg font-semibold">Account registrati</h3>
              <Badge tone="slate">{companies.length} risultati</Badge>
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
                      <th className="px-6 py-3">Contatti</th>
                      <th className="px-6 py-3">Lead</th>
                      <th className="px-6 py-3">Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {companies.map((company) => (
                      <tr key={company.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-semibold text-slate-950">
                          <Link href={`/companies/${company.id}`} className="text-brand-700 hover:text-brand-900">
                            {company.name}
                          </Link>
                          <p className="font-normal text-slate-500">{company.email ?? company.phone ?? "N/D"}</p>
                        </td>
                        <td className="px-6 py-4">{company.industry ?? "N/D"}</td>
                        <td className="px-6 py-4">{company._count.contacts}</td>
                        <td className="px-6 py-4">{company._count.leads}</td>
                        <td className="px-6 py-4">{company.owner?.name ?? "N/D"}</td>
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
