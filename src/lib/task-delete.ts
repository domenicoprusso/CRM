import { prisma } from "@/lib/prisma";

export async function getTaskDeleteState(tenantId: string, id: string) {
  const record = await prisma.task.findFirst({
    where: { id, tenantId },
    include: {
      owner: true,
      company: true,
      contact: true,
      lead: true,
      opportunity: true,
    },
  });

  return { record };
}
