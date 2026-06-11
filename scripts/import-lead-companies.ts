/**
 * 1. Crea le aziende mancanti usando i nomi dai lead (con geodati dal CSV)
 * 2. Collega i lead alle aziende appena create
 * Usage: npx tsx scripts/import-lead-companies.ts
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

const prisma = new PrismaClient();
const LEADS_CSV = "C:/Users/dprusso/Downloads/export_lead_2026-06-1006-47-36.csv";
const BATCH = 300;

function parseRow(line: string): string[] {
  if (!line.startsWith('"')) return [];
  const inner = line.slice(1, line.endsWith('"') ? -1 : line.length);
  return inner.split('""');
}
function clean(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  return s === "" || s === "0.0000" || s === "false" || s === "False" || s === "0" ? null : s;
}
function cuid(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `c${ts}${rand}`;
}

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("Nessun tenant trovato.");
  const tenantId = tenant.id;

  const adminUser = await prisma.user.findFirst({ where: { tenantId, role: "ADMIN" }, select: { id: true, name: true } });
  if (!adminUser) throw new Error("Nessun ADMIN trovato.");
  console.log(`\n✓ Tenant: ${tenant.name}\n`);

  // Carica aziende esistenti (nome UPPER → id)
  console.log("Caricamento aziende esistenti...");
  const existing = await prisma.company.findMany({ where: { tenantId }, select: { id: true, name: true } });
  const existingMap = new Map(existing.map(c => [c.name.toUpperCase(), c.id]));
  console.log(`Aziende in DB: ${existing.length}`);

  // Legge CSV e raggruppa geodati per nome azienda (prima occorrenza vince)
  const content = readFileSync(LEADS_CSV, "latin1");
  const lines = content.split("\r\n").filter(l => l.trim().startsWith('"'));

  // nome UPPER → { name, address, city, province, region }
  const newCompanies = new Map<string, { name: string; address: string | null; city: string | null; province: string | null; region: string | null }>();

  for (const line of lines) {
    const f = parseRow(line);
    const companyName = clean(f[3]);
    if (!companyName) continue;
    const upper = companyName.toUpperCase();
    if (existingMap.has(upper)) continue;      // già in DB
    if (newCompanies.has(upper)) continue;     // già processato
    newCompanies.set(upper, {
      name: companyName,
      address: clean(f[20]),
      city: clean(f[21]),
      province: clean(f[22]),
      region: clean(f[24]),
    });
  }
  console.log(`Aziende da creare: ${newCompanies.size}`);

  // Bulk create in batch
  const now = new Date();
  const toCreate = [...newCompanies.values()].map(c => ({
    id: cuid(),
    tenantId,
    ownerId: adminUser.id,
    name: c.name,
    address: c.address,
    city: c.city,
    province: c.province,
    region: c.region,
    tags: [] as string[],
    createdAt: now,
    updatedAt: now,
  }));

  let created = 0;
  for (let i = 0; i < toCreate.length; i += BATCH) {
    const batch = toCreate.slice(i, i + BATCH);
    await (prisma.company as any).createMany({ data: batch, skipDuplicates: true });
    created += batch.length;
    process.stdout.write(`\r  Aziende create: ${created}/${toCreate.length}`);
  }
  console.log();

  // Ricarica la mappa completa (esistenti + appena create)
  console.log("Ricaricamento mappa aziende completa...");
  const allCompanies = await prisma.company.findMany({ where: { tenantId }, select: { id: true, name: true } });
  const fullMap = new Map(allCompanies.map(c => [c.name.toUpperCase(), c.id]));
  console.log(`Totale aziende in DB: ${allCompanies.length}`);

  // Aggiorna i lead senza companyId
  console.log("Collegamento lead → aziende...");
  const unlinkedLeads = await prisma.lead.findMany({
    where: { tenantId, companyId: null },
    select: { id: true, title: true },
  });

  const updates: { id: string; companyId: string }[] = [];
  for (const lead of unlinkedLeads) {
    const companyId = fullMap.get(lead.title.toUpperCase()) ?? null;
    if (companyId) updates.push({ id: lead.id, companyId });
  }
  console.log(`Lead da collegare: ${updates.length}`);

  let linked = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map(({ id, companyId }) => prisma.lead.update({ where: { id }, data: { companyId } }))
    );
    linked += batch.length;
    process.stdout.write(`\r  Collegati: ${linked}/${updates.length}`);
  }
  console.log();

  // Verifica
  const [totComp, totLead, linkedCount] = await Promise.all([
    prisma.company.count({ where: { tenantId } }),
    prisma.lead.count({ where: { tenantId } }),
    prisma.lead.count({ where: { tenantId, companyId: { not: null } } }),
  ]);
  console.log("\n═══════════════════════════════════════");
  console.log(`  Aziende totali: ${totComp}`);
  console.log(`  Lead totali: ${totLead} | Con azienda: ${linkedCount}`);
  console.log(`  ✅ Completato.`);
  console.log("═══════════════════════════════════════\n");
}

main()
  .catch(e => { console.error("\n❌ ERRORE:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
