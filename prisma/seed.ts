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

  await prisma.lead.upsert({
    where: { id: "seed-lead-erp" },
    update: {},
    create: {
      id: "seed-lead-erp",
      tenantId: tenant.id,
      ownerId: admin.id,
      companyId: acme.id,
      contactId: contact.id,
      title: "Migrazione CRM e automazione follow-up",
      source: "Referral",
      status: "QUALIFIED",
      score: 82,
      estimatedValue: "25000.00",
      tags: ["hot", "migration"],
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
