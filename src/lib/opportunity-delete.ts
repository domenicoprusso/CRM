import { prisma } from "@/lib/prisma";

export async function getOpportunityDeleteState(tenantId: string, id: string) {
  const record = await prisma.opportunity.findFirst({
    where: { id, tenantId },
    include: {
      _count: {
        select: {
          activities: true,
          tasks: true,
          documents: true,
        },
      },
    },
  });

  const blocker = record && (record._count.activities > 0 || record._count.tasks > 0 || record._count.documents > 0)
    ? `Eliminazione bloccata: record collegati presenti (attivita: ${record._count.activities}, task: ${record._count.tasks}, documenti: ${record._count.documents}).`
    : undefined;

  return { record, blocker };
}
