import { LeadStatus } from "@prisma/client";
import { createContact } from "./actions";
import { Card, PageHeader, SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ContactsPage() {
  const user = await requireUser("contact:read");
  const [contacts, companies] = await Promise.all([
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, orderBy: { updatedAt: "desc" }, include: { company: true, owner: true } }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Contatti" description="Anagrafica persone, lifecycle, note interne e associazione con aziende." />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <h3 className="text-lg font-semibold">Nuovo contatto</h3>
          <form action={createContact} className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2"><input name="firstName" placeholder="Nome" required /><input name="lastName" placeholder="Cognome" required /></div>
            <input name="email" type="email" placeholder="email@dominio.it" />
            <input name="phone" placeholder="Telefono" />
            <input name="jobTitle" placeholder="Ruolo" />
            <select name="companyId" defaultValue=""><option value="">Nessuna azienda</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
            <select name="lifecycle" defaultValue={LeadStatus.NEW}>{Object.values(LeadStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select>
            <input name="tags" placeholder="Tag separati da virgola" />
            <textarea name="notes" placeholder="Note interne" rows={4} />
            <SubmitButton label="Crea contatto" />
          </form>
        </Card>
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 p-6"><h3 className="text-lg font-semibold">Rubrica</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3">Contatto</th><th className="px-6 py-3">Azienda</th><th className="px-6 py-3">Lifecycle</th><th className="px-6 py-3">Owner</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{contacts.map((contact) => <tr key={contact.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-semibold text-slate-950">{contact.firstName} {contact.lastName}<p className="font-normal text-slate-500">{contact.email ?? contact.phone ?? "—"}</p></td><td className="px-6 py-4">{contact.company?.name ?? "—"}</td><td className="px-6 py-4"><span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{contact.lifecycle}</span></td><td className="px-6 py-4">{contact.owner?.name ?? "—"}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
