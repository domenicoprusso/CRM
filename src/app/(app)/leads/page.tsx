import { LeadStatus } from "@prisma/client";
import { createLead } from "./actions";
import { Card, PageHeader, SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function LeadsPage() {
  const user = await requireUser("lead:read");
  const [leads, companies, contacts] = await Promise.all([
    prisma.lead.findMany({ where: { tenantId: user.tenantId }, orderBy: { updatedAt: "desc" }, include: { company: true, contact: true, owner: true } }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, orderBy: { lastName: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Lead" description="Qualifica opportunità iniziali, assegna score, valore stimato e prossima data di chiusura." />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <h3 className="text-lg font-semibold">Nuovo lead</h3>
          <form action={createLead} className="mt-4 grid gap-3">
            <input name="title" placeholder="Titolo lead" required />
            <input name="source" placeholder="Fonte (LinkedIn, referral, evento...)" />
            <select name="status" defaultValue={LeadStatus.NEW}>{Object.values(LeadStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select>
            <div className="grid gap-3 md:grid-cols-2"><input name="score" type="number" min="0" max="100" placeholder="Score" /><input name="estimatedValue" type="number" min="0" step="0.01" placeholder="Valore stimato" /></div>
            <input name="expectedCloseDate" type="date" />
            <select name="companyId" defaultValue=""><option value="">Nessuna azienda</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
            <select name="contactId" defaultValue=""><option value="">Nessun contatto</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</option>)}</select>
            <input name="tags" placeholder="Tag separati da virgola" />
            <textarea name="notes" placeholder="Note interne" rows={4} />
            <SubmitButton label="Crea lead" />
          </form>
        </Card>
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 p-6"><h3 className="text-lg font-semibold">Lead pipeline iniziale</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3">Lead</th><th className="px-6 py-3">Stato</th><th className="px-6 py-3">Score</th><th className="px-6 py-3">Valore</th><th className="px-6 py-3">Owner</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{leads.map((lead) => <tr key={lead.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-semibold text-slate-950">{lead.title}<p className="font-normal text-slate-500">{lead.company?.name ?? (lead.contact ? `${lead.contact.firstName} ${lead.contact.lastName}` : "—")}</p></td><td className="px-6 py-4"><span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{lead.status}</span></td><td className="px-6 py-4">{lead.score}/100</td><td className="px-6 py-4">{lead.estimatedValue ? `€ ${lead.estimatedValue}` : "—"}</td><td className="px-6 py-4">{lead.owner?.name ?? "—"}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
