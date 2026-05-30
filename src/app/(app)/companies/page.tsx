import { createCompany } from "./actions";
import { Card, PageHeader, SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CompaniesPage() {
  const user = await requireUser("company:read");
  const companies = await prisma.company.findMany({ where: { tenantId: user.tenantId }, orderBy: { updatedAt: "desc" }, include: { owner: true, _count: { select: { contacts: true, leads: true } } } });

  return (
    <>
      <PageHeader title="Aziende" description="Gestisci account, informazioni commerciali, tag e collegamenti con contatti e lead." />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <h3 className="text-lg font-semibold">Nuova azienda</h3>
          <form action={createCompany} className="mt-4 grid gap-3">
            <input name="name" placeholder="Nome azienda" required />
            <input name="industry" placeholder="Settore" />
            <input name="website" placeholder="https://azienda.it" />
            <input name="email" type="email" placeholder="info@azienda.it" />
            <input name="phone" placeholder="Telefono" />
            <div className="grid gap-3 md:grid-cols-2"><input name="city" placeholder="Città" /><input name="country" placeholder="Paese" /></div>
            <input name="tags" placeholder="Tag separati da virgola" />
            <textarea name="notes" placeholder="Note interne" rows={4} />
            <SubmitButton label="Crea azienda" />
          </form>
        </Card>
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 p-6"><h3 className="text-lg font-semibold">Account registrati</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3">Azienda</th><th className="px-6 py-3">Settore</th><th className="px-6 py-3">Contatti</th><th className="px-6 py-3">Lead</th><th className="px-6 py-3">Owner</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((company) => (
                  <tr key={company.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-semibold text-slate-950">{company.name}<p className="font-normal text-slate-500">{company.email}</p></td><td className="px-6 py-4">{company.industry ?? "—"}</td><td className="px-6 py-4">{company._count.contacts}</td><td className="px-6 py-4">{company._count.leads}</td><td className="px-6 py-4">{company.owner?.name ?? "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
