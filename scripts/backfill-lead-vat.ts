/**
 * Backfill vatNumber sui lead esistenti leggendo il CSV TeamSystem.
 * Usage: npx tsx scripts/backfill-lead-vat.ts
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
const BATCH = 200;

function parseRow(line: string): string[] {
  if (!line.startsWith('"')) return [];
  const inner = line.slice(1, line.endsWith('"') ? -1 : line.length);
  return inner.split('""');
}
function clean(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  return s === "" || s === "0.0000" || s === "false" || s === "False" || s === "0" ? null : s;
}

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("Nessun tenant trovato.");
  const tenantId = tenant.id;

  const existingLeads = await prisma.lead.findMany({
    where: { tenantId },
    select: { id: true, externalId: true },
  });
  const existingMap = new Map(existingLeads.map(l => [l.externalId, l.id]));
  console.log(`Lead in DB: ${existingLeads.length}`);

  const content = readFileSync(LEADS_CSV, "latin1");
  const lines = content.split("\r\n").filter(l => l.trim().startsWith('"'));

  const updates: { id: string; vatNumber: string }[] = [];

  for (const line of lines) {
    const f = parseRow(line);
    const externalId = clean(f[0]);
    const vatNumber = clean(f[27]);
    if (!externalId || !vatNumber) continue;

    const leadId = existingMap.get(externalId);
    if (!leadId) continue;

    updates.push({ id: leadId, vatNumber });
  }

  console.log(`Lead con P.IVA da aggiornare: ${updates.length}`);

  let updated = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map(({ id, vatNumber }) =>
        prisma.lead.update({ where: { id }, data: { vatNumber } })
      )
    );
    updated += batch.length;
    process.stdout.write(`\r  Aggiornati: ${updated}/${updates.length}`);
  }
  console.log();

  console.log("\n✅ Backfill completato.");
}

main()
  .catch(e => { console.error("\n❌ ERRORE:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
