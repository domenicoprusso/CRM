import type { PipelineStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const defaultPipelineStages = [
  { name: "Qualifica", order: 10, probability: 20, color: "#2563eb", isWon: false, isLost: false },
  { name: "Proposta", order: 20, probability: 50, color: "#7c3aed", isWon: false, isLost: false },
  { name: "Negoziazione", order: 30, probability: 75, color: "#d97706", isWon: false, isLost: false },
  { name: "Vinta", order: 40, probability: 100, color: "#059669", isWon: true, isLost: false },
  { name: "Persa", order: 50, probability: 0, color: "#dc2626", isWon: false, isLost: true },
];

export async function ensureDefaultPipelineStages(tenantId: string) {
  await Promise.all(
    defaultPipelineStages.map((stage) =>
      prisma.pipelineStage.upsert({
        where: { tenantId_order: { tenantId, order: stage.order } },
        update: {},
        create: { ...stage, tenantId },
      }),
    ),
  );

  return prisma.pipelineStage.findMany({ where: { tenantId }, orderBy: { order: "asc" } });
}

export function getInitialStage(stages: PipelineStage[]) {
  return stages.find((stage) => !stage.isWon && !stage.isLost) ?? stages[0];
}

export function getWonStage(stages: PipelineStage[]) {
  return stages.find((stage) => stage.isWon);
}

export function getLostStage(stages: PipelineStage[]) {
  return stages.find((stage) => stage.isLost);
}

export async function resolveStage(tenantId: string, stageId?: string | null) {
  const stages = await ensureDefaultPipelineStages(tenantId);
  if (stageId) {
    const selected = stages.find((stage) => stage.id === stageId);
    if (selected) return selected;
  }
  return getInitialStage(stages);
}

export async function getAdjacentStage(tenantId: string, currentOrder: number, direction: "next" | "previous") {
  const stages = await ensureDefaultPipelineStages(tenantId);
  const currentIndex = stages.findIndex((stage) => stage.order === currentOrder);
  if (currentIndex === -1) return undefined;
  return direction === "next" ? stages[currentIndex + 1] : stages[currentIndex - 1];
}
