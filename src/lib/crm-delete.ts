import { prisma } from "@/lib/prisma";

type Blocker = { label: string; count: number };

function blockerMessage(blockers: Blocker[]) {
  const active = blockers.filter((blocker) => blocker.count > 0);
  if (active.length === 0) return undefined;
  return `Eliminazione bloccata: record collegati presenti (${active.map((blocker) => `${blocker.label}: ${blocker.count}`).join(", ")}).`;
}

export async function getCompanyDeleteState(tenantId: string, id: string) {
  const record = await prisma.company.findFirst({
    where: { id, tenantId },
    include: {
      _count: {
        select: {
          contacts: true,
          leads: true,
          opportunities: true,
          tasks: true,
          activities: true,
          documents: true,
        },
      },
    },
  });

  return {
    record,
    blocker: record
      ? blockerMessage([
          { label: "contatti", count: record._count.contacts },
          { label: "lead", count: record._count.leads },
          { label: "opportunita", count: record._count.opportunities },
          { label: "task", count: record._count.tasks },
          { label: "attivita", count: record._count.activities },
          { label: "documenti", count: record._count.documents },
        ])
      : undefined,
  };
}

export async function getContactDeleteState(tenantId: string, id: string) {
  const record = await prisma.contact.findFirst({
    where: { id, tenantId },
    include: {
      _count: {
        select: {
          leads: true,
          opportunities: true,
          activities: true,
          tasks: true,
          documents: true,
        },
      },
    },
  });

  return {
    record,
    blocker: record
      ? blockerMessage([
          { label: "lead", count: record._count.leads },
          { label: "opportunita", count: record._count.opportunities },
          { label: "attivita", count: record._count.activities },
          { label: "task", count: record._count.tasks },
          { label: "documenti", count: record._count.documents },
        ])
      : undefined,
  };
}

export async function getLeadDeleteState(tenantId: string, id: string) {
  const record = await prisma.lead.findFirst({
    where: { id, tenantId },
    include: {
      sourceOpportunity: { select: { id: true } },
      _count: {
        select: {
          activities: true,
          tasks: true,
          documents: true,
        },
      },
    },
  });

  return {
    record,
    blocker: record
      ? blockerMessage([
          { label: "attivita", count: record._count.activities },
          { label: "task", count: record._count.tasks },
          { label: "documenti", count: record._count.documents },
          { label: "opportunita convertita", count: record.sourceOpportunity ? 1 : 0 },
        ])
      : undefined,
  };
}
