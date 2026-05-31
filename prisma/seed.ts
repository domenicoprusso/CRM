import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "Demo CRM", slug: "demo" },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "admin@example.com",
      name: "Admin CRM",
      role: Role.ADMIN,
      passwordHash: await bcrypt.hash("ChangeMe123!", 12),
    },
  });

  const acme = await prisma.company.upsert({
    where: { id: "seed-company-acme" },
    update: {},
    create: {
      id: "seed-company-acme",
      tenantId: tenant.id,
      ownerId: admin.id,
      name: "Acme Italia S.r.l.",
      industry: "Manufacturing",
      website: "https://example.com",
      email: "info@example.com",
      city: "Milano",
      country: "Italia",
      tags: ["enterprise", "demo"],
    },
  });

  const contact = await prisma.contact.upsert({
    where: { id: "seed-contact-giulia" },
    update: {},
    create: {
      id: "seed-contact-giulia",
      tenantId: tenant.id,
      ownerId: admin.id,
      companyId: acme.id,
      firstName: "Giulia",
      lastName: "Rossi",
      email: "giulia.rossi@example.com",
      phone: "+39 02 123456",
      jobTitle: "Operations Director",
      lifecycle: "QUALIFIED",
      tags: ["decision-maker"],
    },
  });

  const lead = await prisma.lead.upsert({
    where: { id: "seed-lead-erp" },
    update: { status: "CONVERTED" },
    create: {
      id: "seed-lead-erp",
      tenantId: tenant.id,
      ownerId: admin.id,
      companyId: acme.id,
      contactId: contact.id,
      title: "Migrazione CRM e automazione follow-up",
      source: "Referral",
      score: 82,
      estimatedValue: "25000.00",
      tags: ["hot", "migration"],
      status: "CONVERTED",
    },
  });

  const stages = [
    { id: "seed-stage-qualifica", name: "Qualifica", order: 10, probability: 20, color: "#2563eb", isWon: false, isLost: false },
    { id: "seed-stage-proposta", name: "Proposta", order: 20, probability: 50, color: "#7c3aed", isWon: false, isLost: false },
    { id: "seed-stage-negoziazione", name: "Negoziazione", order: 30, probability: 75, color: "#d97706", isWon: false, isLost: false },
    { id: "seed-stage-vinta", name: "Vinta", order: 40, probability: 100, color: "#059669", isWon: true, isLost: false },
    { id: "seed-stage-persa", name: "Persa", order: 50, probability: 0, color: "#dc2626", isWon: false, isLost: true },
  ];

  const pipelineStages = [];
  for (const stage of stages) {
    pipelineStages.push(await prisma.pipelineStage.upsert({
      where: { tenantId_order: { tenantId: tenant.id, order: stage.order } },
      update: {},
      create: { ...stage, tenantId: tenant.id },
    }));
  }
  const proposalStage = pipelineStages.find((stage) => stage.order === 20) ?? pipelineStages[0];

  await prisma.opportunity.upsert({
    where: { id: "seed-opportunity-erp" },
    update: {},
    create: {
      id: "seed-opportunity-erp",
      tenantId: tenant.id,
      ownerId: admin.id,
      companyId: acme.id,
      contactId: contact.id,
      sourceLeadId: lead.id,
      stageId: proposalStage.id,
      title: "Migrazione CRM e automazione follow-up",
      value: "25000.00",
      probability: 50,
      expectedCloseDate: new Date("2026-07-31"),
      notes: "Opportunita demo generata dal lead seed.",
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
