import Link from "next/link";
import { Phone } from "lucide-react";
import { notFound } from "next/navigation";
import { deleteOpportunity, quickCallOnOpportunity, setOpportunityOutcome, updateOpportunity } from "../actions";
import { Badge, ButtonLink, Card, DangerButton, FieldValue, Notice, PageHeader, SubmitButton } from "@/components/ui";
import { ActivityTimeline, NextActionPanel, TaskList, UnifiedTimeline } from "@/components/productivity";
import { getOpportunityTimeline } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { ensureDefaultPipelineStages } from "@/lib/pipeline";
import { prisma } from "@/lib/prisma";
import { getNextOpenTaskForOpportunity } from "@/lib/productivity";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsInput>;
};

function detailNotice(params: SearchParamsInput) {
  if (readParam(params, "logged") === "1") return { tone: "success" as const, message: "Chiamata registrata." };
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
  const [opportunity, companies, contacts, timeline] = await Promise.all([
    prisma.opportunity.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        company: true,
        contact: true,
        owner: true,
        stage: true,
        sourceLead: true,
        activities: { orderBy: { occurredAt: "desc" }, take: 10, include: { user: true, company: true, contact: true, lead: true, opportunity: true } },
        tasks: { where: { status: { notIn: ["DONE", "CANCELLED"] } }, orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }], take: 10, include: { owner: true, company: true, contact: true, lead: true, opportunity: true } },
        _count: { select: { activities: true, tasks: true, documents: true } },
      },
    }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, orderBy: { lastName: "asc" } }),
    getOpportunityTimeline(prisma, user.tenantId, id),
  ]);

  if (!opportunity) notFound();
  const nextAction = await getNextOpenTaskForOpportunity(prisma, user.tenantId, opportunity.id);

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

          <Card className={!nextAction ? "border-amber-300 bg-amber-50/40" : undefined}>
            <h3 className={`text-lg font-semibold ${!nextAction ? "text-amber-800" : "text-slate-950"}`}>
              Next Action{!nextAction ? " — nessuna azione pianificata" : ""}
            </h3>
            <div className="mt-4">
              <NextActionPanel task={nextAction ? { ...nextAction, owner: nextAction.owner } : null} />
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-950">Timeline attivita</h3>
            <div className="mt-4">
              <ActivityTimeline activities={opportunity.activities} />
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-950">Follow-up aperti</h3>
            <div className="mt-4">
              <TaskList tasks={opportunity.tasks} />
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-950">Timeline CRM</h3>
            <p className="mt-1 text-sm text-slate-500">Storico cronologico di tutte le interazioni e modifiche.</p>
            <div className="mt-5">
              <UnifiedTimeline events={timeline} />
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-950">Azioni rapide</h3>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <form action={setOpportunityOutcome}>
                <input type="hidden" name="id" value={opportunity.id} />
                <input type="hidden" name="outcome" value="won" />
                <SubmitButton label="Segna vinta" className="bg-emerald-600 px-5 py-2.5 text-base font-bold hover:bg-emerald-700" />
              </form>
              <form action={setOpportunityOutcome}>
                <input type="hidden" name="id" value={opportunity.id} />
                <input type="hidden" name="outcome" value="lost" />
                <DangerButton label="Segna persa" className="bg-red-500 px-3 py-1.5 text-xs hover:bg-red-600" />
              </form>
              <ButtonLink href="/pipeline">Vai alla pipeline</ButtonLink>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-brand-200 bg-brand-50/60">
            <h3 className="flex items-center gap-2 text-xl font-bold text-brand-900">
              <Phone className="h-5 w-5 shrink-0" />
              Ho chiamato
            </h3>
            <p className="mt-1 text-sm text-slate-500">Registra la chiamata in 3 secondi. Se serve, aggiungi subito la prossima azione.</p>
            <form action={quickCallOnOpportunity} className="mt-4 grid gap-3">
              <input type="hidden" name="opportunityId" value={opportunity.id} />
              <select name="esito" defaultValue="risposto" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="risposto">Risposto — ho parlato con il cliente</option>
                <option value="non_risposto">Non risposto — non disponibile</option>
                <option value="da_richiamare">Da richiamare — ha chiesto di essere richiamato</option>
              </select>
              <textarea name="nota" placeholder="Nota breve (opzionale)" rows={2} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm resize-none" />
              <input name="prossima_azione" placeholder="Prossima azione (opzionale, crea un task)" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              <input name="prossima_data" type="datetime-local" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
                Registra chiamata
              </button>
            </form>
          </Card>

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
            <h3 className="text-sm font-semibold text-red-600">Elimina opportunita</h3>
            <p className="mt-1 text-xs text-slate-400">
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
