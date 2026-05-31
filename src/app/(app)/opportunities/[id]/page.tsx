import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteOpportunity, setOpportunityOutcome, updateOpportunity } from "../actions";
import { Badge, ButtonLink, Card, DangerButton, FieldValue, Notice, PageHeader, SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { ensureDefaultPipelineStages } from "@/lib/pipeline";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsInput>;
};

function detailNotice(params: SearchParamsInput) {
  if (readParam(params, "created") === "1") return { tone: "success" as const, message: "Opportunita creata." };
  if (readParam(params, "converted") === "1") return { tone: "success" as const, message: "Lead convertito in opportunita." };
  if (readParam(params, "updated") === "1") return { tone: "success" as const, message: "Opportunita aggiornata." };
  if (readParam(params, "error") === "confirm") return { tone: "error" as const, message: "Per eliminare devi scrivere ELIMINA nel campo di conferma." };
  if (readParam(params, "error") === "delete-linked") return { tone: "error" as const, message: "Eliminazione bloccata: l'opportunita ha record collegati." };
  if (readParam(params, "error") === "delete-failed") return { tone: "error" as const, message: "Eliminazione non riuscita." };
  if (readParam(params, "error") === "missing-stage") return { tone: "error" as const, message: "Stage won/lost non configurato." };
  return { tone: "slate" as const, message: undefined };
}

function dateValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function stageTone(stage: { isWon: boolean; isLost: boolean }) {
  if (stage.isWon) return "brand" as const;
  if (stage.isLost) return "red" as const;
  return "slate" as const;
}

export default async function OpportunityDetailPage({ params, searchParams }: PageProps) {
  const user = await requireUser("opportunity:read");
  const { id } = await params;
  const query = await searchParams;
  const notice = detailNotice(query);
  const stages = await ensureDefaultPipelineStages(user.tenantId);
  const [opportunity, companies, contacts] = await Promise.all([
    prisma.opportunity.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        company: true,
        contact: true,
        owner: true,
        stage: true,
        sourceLead: true,
        _count: { select: { activities: true, tasks: true, documents: true } },
      },
    }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, orderBy: { lastName: "asc" } }),
  ]);

  if (!opportunity) notFound();

  return (
    <>
      <PageHeader
        title={opportunity.title}
        description="Scheda opportunita con stage, valore, probabilita e stato won/lost."
        action={<ButtonLink href="/opportunities">Torna alle opportunita</ButtonLink>}
      />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card>
            <div className="grid gap-4 md:grid-cols-3">
              <FieldValue label="Owner" value={opportunity.owner?.name ?? "N/D"} />
              <FieldValue label="Stage" value={<Badge tone={stageTone(opportunity.stage)}>{opportunity.stage.name}</Badge>} />
              <FieldValue label="Probabilita" value={`${opportunity.probability}%`} />
              <FieldValue label="Valore" value={`EUR ${opportunity.value.toString()}`} />
              <FieldValue label="Chiusura prevista" value={dateValue(opportunity.expectedCloseDate) || "N/D"} />
              <FieldValue label="Origine lead" value={opportunity.sourceLead ? <Link href={`/leads/${opportunity.sourceLead.id}`} className="text-brand-700 hover:text-brand-900">{opportunity.sourceLead.title}</Link> : "N/D"} />
              <FieldValue label="Azienda" value={opportunity.company ? <Link href={`/companies/${opportunity.company.id}`} className="text-brand-700 hover:text-brand-900">{opportunity.company.name}</Link> : "N/D"} />
              <FieldValue label="Contatto" value={opportunity.contact ? <Link href={`/contacts/${opportunity.contact.id}`} className="text-brand-700 hover:text-brand-900">{opportunity.contact.firstName} {opportunity.contact.lastName}</Link> : "N/D"} />
            </div>
            {opportunity.notes ? <p className="mt-5 whitespace-pre-wrap text-sm text-slate-600">{opportunity.notes}</p> : null}
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-950">Azioni rapide</h3>
            <div className="mt-4 flex flex-wrap gap-3">
              <form action={setOpportunityOutcome}>
                <input type="hidden" name="id" value={opportunity.id} />
                <input type="hidden" name="outcome" value="won" />
                <SubmitButton label="Segna vinta" />
              </form>
              <form action={setOpportunityOutcome}>
                <input type="hidden" name="id" value={opportunity.id} />
                <input type="hidden" name="outcome" value="lost" />
                <DangerButton label="Segna persa" />
              </form>
              <ButtonLink href="/pipeline">Vai alla pipeline</ButtonLink>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold">Modifica opportunita</h3>
            <form action={updateOpportunity} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={opportunity.id} />
              <input type="hidden" name="sourceLeadId" value={opportunity.sourceLeadId ?? ""} />
              <input name="title" defaultValue={opportunity.title} placeholder="Titolo opportunita" required />
              <div className="grid gap-3 md:grid-cols-2">
                <input name="value" type="number" min="0" step="0.01" defaultValue={opportunity.value.toString()} placeholder="Valore" />
                <input name="probability" type="number" min="0" max="100" defaultValue={opportunity.probability} placeholder="Probabilita" />
              </div>
              <input name="expectedCloseDate" type="date" defaultValue={dateValue(opportunity.expectedCloseDate)} />
              <select name="stageId" defaultValue={opportunity.stageId}>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
              <select name="companyId" defaultValue={opportunity.companyId ?? ""}>
                <option value="">Nessuna azienda</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <select name="contactId" defaultValue={opportunity.contactId ?? ""}>
                <option value="">Nessun contatto</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.firstName} {contact.lastName}
                  </option>
                ))}
              </select>
              <textarea name="notes" defaultValue={opportunity.notes ?? ""} placeholder="Note interne" rows={4} />
              <SubmitButton label="Salva modifiche" />
            </form>
          </Card>

          <Card className="border-red-100">
            <h3 className="text-lg font-semibold text-red-700">Elimina opportunita</h3>
            <p className="mt-2 text-sm text-slate-500">
              Disponibile solo senza record collegati. Collegamenti: attivita {opportunity._count.activities}, task {opportunity._count.tasks}, documenti {opportunity._count.documents}.
            </p>
            <form action={deleteOpportunity} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={opportunity.id} />
              <input name="confirmDelete" placeholder="Scrivi ELIMINA" pattern="ELIMINA" required />
              <DangerButton label="Elimina opportunita" />
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
