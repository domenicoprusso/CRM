import Link from "next/link";
import { moveOpportunity } from "../opportunities/actions";
import { Badge, Card, EmptyState, PageHeader, SecondaryButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ensureDefaultPipelineStages } from "@/lib/pipeline";
import { prisma } from "@/lib/prisma";

function stageTone(stage: { isWon: boolean; isLost: boolean }) {
  if (stage.isWon) return "brand" as const;
  if (stage.isLost) return "red" as const;
  return "slate" as const;
}

export default async function PipelinePage() {
  const user = await requireUser("pipeline:read");
  const stages = await ensureDefaultPipelineStages(user.tenantId);
  const opportunities = await prisma.opportunity.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ expectedCloseDate: "asc" }, { updatedAt: "desc" }],
    include: { company: true, contact: true, owner: true, stage: true },
  });
  const canMove = can(user.role, "opportunity:write");

  return (
    <>
      <PageHeader title="Pipeline" description="Vista Kanban semplice per seguire valore, probabilita e avanzamento delle opportunita." />
      <div className="grid gap-4 xl:grid-cols-5">
        {stages.map((stage) => {
          const cards = opportunities.filter((opportunity) => opportunity.stageId === stage.id);
          const total = cards.reduce((sum, opportunity) => sum + Number(opportunity.value), 0);
          return (
            <Card key={stage.id} className="min-h-[420px] p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-950">{stage.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">EUR {total.toFixed(2)} - {cards.length} deal</p>
                </div>
                <Badge tone={stageTone(stage)}>{stage.probability}%</Badge>
              </div>

              <div className="space-y-3">
                {cards.length === 0 ? <EmptyState message="Nessuna opportunita in questo stage." /> : null}
                {cards.map((opportunity) => (
                  <div key={opportunity.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                    <Link href={`/opportunities/${opportunity.id}`} className="font-semibold text-brand-700 hover:text-brand-900">
                      {opportunity.title}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">{opportunity.company?.name ?? opportunity.contact?.lastName ?? "N/D"}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <span>Valore</span>
                      <span className="text-right font-semibold text-slate-900">EUR {opportunity.value.toString()}</span>
                      <span>Probabilita</span>
                      <span className="text-right font-semibold text-slate-900">{opportunity.probability}%</span>
                    </div>
                    {canMove ? (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <form action={moveOpportunity}>
                          <input type="hidden" name="id" value={opportunity.id} />
                          <input type="hidden" name="direction" value="previous" />
                          <SecondaryButton label="Indietro" className="w-full" />
                        </form>
                        <form action={moveOpportunity}>
                          <input type="hidden" name="id" value={opportunity.id} />
                          <input type="hidden" name="direction" value="next" />
                          <SecondaryButton label="Avanti" className="w-full" />
                        </form>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
