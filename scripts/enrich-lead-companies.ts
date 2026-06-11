/**
 * Arricchisce le aziende create dal CSV lead con i dati mancanti:
 * - telefono (f[9]), email (f[28]), CAP (f[23]), settore (f[72])
 * - Corregge city/province se errati
 *
 * Elimina le aziende con nome numerico (P.IVA) e slega i relativi lead
 *
 * Usage: npx tsx scripts/enrich-lead-companies.ts
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

// Normalizza nome azienda per match
function normalizeKey(name: string): string {
  return name.toUpperCase().replace(/\s+/g, " ").trim();
}

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("Nessun tenant trovato.");
  const tenantId = tenant.id;
  console.log(`\n✓ Tenant: ${tenant.name}\n`);

  // ── 1. Elimina aziende con nome numerico ─────────────────────────────────
  console.log("══ STEP 1: Eliminazione aziende con nome numerico ══");
  const numericCompanies = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM "Company"
    WHERE "tenantId" = ${tenantId} AND name ~ '^[0-9]+$'
  `;
  console.log(`Aziende numeriche trovate: ${numericCompanies.length}`);

  if (numericCompanies.length > 0) {
    const numericIds = numericCompanies.map(c => c.id);

    // Slega i lead da queste aziende
    const unlinkedLeads = await prisma.lead.updateMany({
      where: { tenantId, companyId: { in: numericIds } },
      data: { companyId: null },
    });
    console.log(`Lead slegati: ${unlinkedLeads.count}`);

    // Slega le attività
    await prisma.activity.updateMany({
      where: { tenantId, companyId: { in: numericIds } },
      data: { companyId: null },
    });

    // Elimina in batch
    let deleted = 0;
    for (let i = 0; i < numericIds.length; i += BATCH) {
      const batch = numericIds.slice(i, i + BATCH);
      await prisma.company.deleteMany({ where: { id: { in: batch } } });
      deleted += batch.length;
      process.stdout.write(`\r  Eliminate: ${deleted}/${numericIds.length}`);
    }
    console.log(`\n✓ ${numericCompanies.length} aziende numeriche eliminate.\n`);
  }

  // ── 2. Carica mappa aziende per arricchimento ─────────────────────────────
  console.log("══ STEP 2: Arricchimento dati (tel/email/CAP/settore) ══");
  const allCompanies = await prisma.company.findMany({
    where: { tenantId },
    select: { id: true, name: true, phone: true, email: true, postalCode: true, industry: true, address: true, city: true, province: true },
  });
  // nome UPPER → company record
  const companyMap = new Map(allCompanies.map(c => [normalizeKey(c.name), c]));
  console.log(`Aziende in DB dopo pulizia: ${allCompanies.length}`);

  // Legge CSV e raccoglie dati per arricchimento (prima occorrenza per nome)
  const content = readFileSync(LEADS_CSV, "latin1");
  const lines = content.split("\r\n").filter(l => l.trim().startsWith('"'));

  // nome UPPER → enrichment data
  const enrichData = new Map<string, {
    phone: string | null;
    email: string | null;
    postalCode: string | null;
    industry: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    region: string | null;
  }>();

  for (const line of lines) {
    const f = parseRow(line);
    const companyName = clean(f[3]);
    if (!companyName || /^[0-9]+$/.test(companyName)) continue; // salta numerici
    const key = normalizeKey(companyName);
    if (enrichData.has(key)) continue; // già processato (prima occorrenza)

    const phone = clean(f[9]);
    const email = clean(f[28]);
    const postalCode = clean(f[23]);
    const industry = clean(f[72]);
    const address = clean(f[20]);
    const city = clean(f[21]);
    const province = clean(f[22]);
    const region = clean(f[24]);

    // Salva solo se c'è almeno un dato utile
    if (phone || email || postalCode || industry) {
      enrichData.set(key, { phone, email, postalCode, industry, address, city, province, region });
    }
  }
  console.log(`Righe CSV con dati utili: ${enrichData.size}`);

  // Prepara aggiornamenti
  const updates: { id: string; data: Record<string, string | null> }[] = [];

  for (const [key, csvData] of enrichData) {
    const company = companyMap.get(key);
    if (!company) continue;

    const patch: Record<string, string | null> = {};

    // Aggiorna solo se il campo è vuoto in DB
    if (!company.phone && csvData.phone) patch.phone = csvData.phone;
    if (!company.email && csvData.email) patch.email = csvData.email;
    if (!company.postalCode && csvData.postalCode) patch.postalCode = csvData.postalCode;
    if (!company.industry && csvData.industry) patch.industry = csvData.industry;
    if (!company.address && csvData.address) patch.address = csvData.address;
    // Corregge city/province solo se sembrano sbagliati (CAP in city, nome in province)
    if (company.city && /^\d{5}$/.test(company.city) && csvData.city) {
      patch.city = csvData.city;
      patch.postalCode = company.city; // sposta il CAP nella colonna giusta
    }
    if (company.province && company.province.length > 3 && csvData.province) {
      patch.province = csvData.province;
    }

    if (Object.keys(patch).length > 0) {
      updates.push({ id: company.id, data: patch });
    }
  }

  console.log(`Aziende da aggiornare: ${updates.length}`);

  let done = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map(({ id, data }) => prisma.company.update({ where: { id }, data: { ...data, updatedAt: new Date() } }))
    );
    done += batch.length;
    process.stdout.write(`\r  Aggiornate: ${done}/${updates.length}`);
  }
  console.log();

  // ── 3. Report finale ──────────────────────────────────────────────────────
  const [totComp, withPhone, withEmail, withPostal, withIndustry] = await Promise.all([
    prisma.company.count({ where: { tenantId } }),
    prisma.company.count({ where: { tenantId, phone: { not: null } } }),
    prisma.company.count({ where: { tenantId, email: { not: null } } }),
    prisma.company.count({ where: { tenantId, postalCode: { not: null } } }),
    prisma.company.count({ where: { tenantId, industry: { not: null } } }),
  ]);

  console.log("\n═══════════════════════════════════════════");
  console.log(`  Aziende totali: ${totComp}`);
  console.log(`  Con telefono:   ${withPhone}`);
  console.log(`  Con email:      ${withEmail}`);
  console.log(`  Con CAP:        ${withPostal}`);
  console.log(`  Con settore:    ${withIndustry}`);
  console.log("  ✅ Arricchimento completato.");
  console.log("═══════════════════════════════════════════\n");
}

main()
  .catch(e => { console.error("\n❌ ERRORE:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
