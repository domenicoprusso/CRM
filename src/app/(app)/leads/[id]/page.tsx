import { LeadStatus } from "@prisma/client";
import Link from "next/link";
import { Phone } from "lucide-react";
import { notFound } from "next/navigation";
import { deleteLead, quickCallOnLead, updateLead } from "../actions";
import { convertLeadToOpportunity } from "../../opportunities/actions";
import { Badge, ButtonLink, Card, DangerButton, FieldValue, Notice, PageHeader, SubmitButton } from "@/components/ui";
import { ActivityTimeline, TaskList } from "@/components/productivity";
import { requireUser } from "@/lib/auth";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { ensureDefaultPipelineStages } from "@/lib/pipeline";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsInput>;
};

function detailNotice(params: SearchParamsInput) {
  if (readParam(params, "logged") === "1") return { tone: "success" as const, message: "Chiamata registrata." };
  if (readParam(params, "updated") === "1") return { tone: "success" as const, message: "Lead aggiornato." };
  if (readParam(params, "error") === "confirm") return { tone: "error" as const, message: "Per eliminare devi scrivere ELIMINA nel campo di conferma." };
  if (readParam(params, "error") === "delete-linked") return { tone: "error" as const, message: "Eliminazione bloccata: il lead ha record collegati." };
  if (readParam(params, "error") === "delete-failed") return { tone: "error" as const, message: "Eliminazione non riuscita." };
  if (readParam(params, "error") === "invalid-company") return { tone: "error" as const, message: "Azienda non valida per questo workspace." };
  if (readParam(params, "error") === "invalid-contact") return { tone: "error" as const, message: "Contatto non valido per questo workspace." };
  if (readParam(params, "error") === "lost-lead") return { tone: "error" as const, message: "Un lead perso non puo essere convertito." };
  return { tone: "slate" as const, message: undefined };
}

function dateValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function LeadDetailPage({ params, searchParams }: PageProps) {
  const user = await requireUser("lead:read");
  const { id } = await params;
  const query = await searchParams;
  const notice = detailNotice(query);
  const stages = await ensureDefaultPipelineStages(user.tenantId);
  const [lead, companies, contacts] = await Promise.all([
    prisma.lead.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        company: true,
        contact: true,
        owner: true,
        sourceOpportunity: true,
        activities: { orderBy: { occurredAt: "desc" }, take: 10, include: { user: true, company: true, contact: true, lead: true, opportunity: true } },
        tasks: { where: { status: { notIn: ["DONE", "CANCELLED"] } }, orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }], take: 10, include: { owner: true, company: true, contact: true, lead: true, opportunity: true } },
        _count: { select: { activities: true, tasks: true, documents: true } },
      },
    }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, orderBy: { lastName: "asc" } }),
  ]);

  if (!lead) notFound();

  return (
    <>
      <PageHeader
        title={lead.title}
        description="Scheda lead con qualificazione, collegamenti e modifica controllata."
        action={<ButtonLink href="/leads">Torna ai lead</ButtonLink>}
      />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card>
            <div className="grid gap-4 md:grid-cols-3">
              <FieldValue label="Owner" value={lead.owner?.name ?? "N/D"} />
              <FieldValue label="Stato" value={<Badge>{lead.status}</Badge>} />
              <FieldValue label="Score" value={`${lead.score}/100`} />
              <FieldValue label="Valore stimato" value={lead.estimatedValue ? `EUR ${lead.estimatedValue}` : "N/D"} />
              <FieldValue label="Fonte" value={lead.source ?? "N/D"} />
              <FieldValue label="Chiusura prevista" value={dateValue(lead.expectedCloseDate) || "N/D"} />
              <FieldValue label="Azienda" value={lead.company ? <Link href={`/companies/${lead.company.id}`} className="text-brand-700 hover:text-brand-900">{lead.company.name}</Link> : "N/D"} />
              <FieldValue label="Contatto" value={lead.contact ? <Link href={`/contacts/${lead.contact.id}`} className="text-brand-700 hover:text-brand-900">{lead.contact.firstName} {lead.contact.lastName}</Link> : "N/D"} />
              <FieldValue label="Opportunita" value={lead.sourceOpportunity ? <Link href={`/opportunities/${lead.sourceOpportunity.id}`} className="text-brand-700 hover:text-brand-900">{lead.sourceOpportunity.title}</Link> : "N/D"} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {lead.tags.length === 0 ? <Badge tone="slate">Nessun tag</Badge> : lead.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
            </div>
            {lead.notes ? <p className="mt-5 whitespace-pre-wrap text-sm text-slate-600">{lead.notes}</p> : null}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-brand-200 bg-brand-50/60">
            <h3 className="flex items-center gap-2 text-xl font-bold text-brand-900">
              <Phone className="h-5 w-5 shrink-0" />
              Ho chiamato
            </h3>
            <p className="mt-1 text-sm text-slate-500">Registra la chiamata in 3 secondi. Se serve, aggiungi subito la prossima azione.</p>
            <form action={quickCallOnLead} className="mt-4 grid gap-3">
              <input type="hidden" name="leadId" value={lead.id} />
              <select name="esito" defaultValue="risposto" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="risposto">Risposto — ho parlato con il cliente</option>
                <option value="non_risposto">Non risposto — non disponibile</option>
                <option value="da_richiamare">Da richiamare — ha chiesto di essere richiamato</option>
              </select>
              <textarea name="nota" placeholder="Nota breve (opzionale)" rows={2} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm resize-none" />
              <input name="prossima_azione" placeholder="Prossima azione (opzionale, crea un task)" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              <input name="prossima_data" type="date" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
                Registra chiamata
              </button>
            </form>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold">Modifica lead</h3>
            <form action={updateLead} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={lead.id} />
              <input name="title" defaultValue={lead.title} placeholder="Titolo lead" required />
              <input name="source" defaultValue={lead.source ?? ""} placeholder="Fonte" />
              <select name="status" defaultValue={lead.status}>
                {Object.values(LeadStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <div className="grid gap-3 md:grid-cols-2">
                <input name="score" type="number" min="0" max="100" defaultValue={lead.score} placeholder="Score" />
                <input name="estimatedValue" type="number" min="0" step="0.01" defaultValue={lead.estimatedValue?.toString() ?? ""} placeholder="Valore stimato" />
              </div>
              <input name="expectedCloseDate" type="date" defaultValue={dateValue(lead.expectedCloseDate)} />
              <select name="companyId" defaultValue={lead.companyId ?? ""}>
                <option value="">Nessuna azienda</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <select name="contactId" defaultValue={lead.contactId ?? ""}>
                <option value="">Nessun contatto</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.firstName} {contact.lastName}
                  </option>
                ))}
              </select>
              <input name="tags" defaultValue={lead.tags.join(", ")} placeholder="Tag separati da virgola" />
              <textarea name="notes" defaultValue={lead.notes ?? ""} placeholder="Note interne" rows={4} />
              <SubmitButton label="Salva modifiche" />
            </form>
          </Card>

          {!lead.sourceOpportunity && lead.status !== "LOST" && lead.status !== "CONVERTED" ? (
            <Card className="border-emerald-200 bg-emerald-50/30">
              <h3 className="text-lg font-semibold text-emerald-800">Converti in opportunita</h3>
              <form action={convertLeadToOpportunity} className="mt-4 grid gap-3">
                <input type="hidden" name="leadId" value={lead.id} />
                <input name="title" defaultValue={lead.title} placeholder="Titolo opportunita" required />
                <div className="grid gap-3 md:grid-cols-2">
                  <input name="value" type="number" min="0" step="0.01" defaultValue={lead.estimatedValue?.toString() ?? "0"} placeholder="Valore" />
                  <input name="probability" type="number" min="0" max="100" defaultValue={stages[0]?.probability ?? 20} placeholder="Probabilita" />
                </div>
                <input name="expectedCloseDate" type="date" defaultValue={dateValue(lead.expectedCloseDate)} />
                <select name="stageId" defaultValue={stages[0]?.id ?? ""}>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
                <textarea name="notes" defaultValue={lead.notes ?? ""} placeholder="Note opportunita" rows={3} />
                <SubmitButton label="Converti lead" />
              </form>
            </Card>
          ) : null}

          <Card>
            <h3 className="text-lg font-semibold text-slate-950">Timeline attivita</h3>
            <div className="mt-4">
              <ActivityTimeline activities={lead.activities} />
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-950">Follow-up aperti</h3>
            <div className="mt-4">
              <TaskList tasks={lead.tasks} />
            </div>
          </Card>

          <Card className="border-red-100">
            <h3 className="text-sm font-semibold text-red-600">Elimina lead</h3>
            <p className="mt-1 text-xs text-slate-400">
              Disponibile solo senza record collegati. Collegamenti: attivita {lead._count.activities}, task {lead._count.tasks}, documenti {lead._count.documents}.
            </p>
            <form action={deleteLead} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={lead.id} />
              <input name="confirmDelete" placeholder="Scrivi ELIMINA" pattern="ELIMINA" required />
              <DangerButton label="Elimina lead" />
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
