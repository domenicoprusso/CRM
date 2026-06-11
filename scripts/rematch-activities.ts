/**
 * Associa le attività senza companyId:
 *   1. Tenta match su Company.name
 *   2. Se non trovato, tenta match su Lead.title → imposta leadId + companyId del lead
 * Usage: npx tsx scripts/rematch-activities.ts
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

const prisma = new PrismaClient();
const ACTIVITIES_CSV = "C:/Users/dprusso/Downloads/export_attività_2026-06-1006-00-19.csv";

function parseRow(line: string): string[] {
  if (!line.startsWith('"')) return [];
  const inner = line.slice(1, line.endsWith('"') ? -1 : line.length);
  return inner.split('""');
}
function clean(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  return s === "" || s === "0.0000" || s === "false" || s === "False" || s === "0" ? null : s;
}
function dedup(raw: string): string {
  const s = raw.trim();
  const words = s.split(" ");
  const mid = words.length / 2;
  if (Number.isInteger(mid) && mid > 0) {
    const a = words.slice(0, mid).join(" ");
    const b = words.slice(mid).join(" ");
    if (a === b) return a;
  }
  return s;
}
function normalize(s: string): string {
  return s.toUpperCase().replace(/[.\-,'&;]/g, " ").replace(/\s+/g, " ").trim();
}

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("Nessun tenant trovato.");
  const tenantId = tenant.id;
  console.log(`\n✓ Tenant: ${tenant.name}\n`);

  // Attività senza companyId
  const unlinked = await prisma.activity.findMany({
    where: { tenantId, companyId: null, externalId: { not: null } },
    select: { id: true, externalId: true },
  });
  const unlinkedMap = new Map(unlinked.map(a => [a.externalId!, a.id]));
  console.log(`Attività senza azienda: ${unlinked.length}`);
  if (unlinked.length === 0) { console.log("Niente da fare."); return; }

  // Mappa Company: nome UPPER → id
  const companies = await prisma.company.findMany({ where: { tenantId }, select: { id: true, name: true } });
  const compMap = new Map<string, string>();
  for (const c of companies) {
    compMap.set(c.name.toUpperCase(), c.id);
    compMap.set(normalize(c.name), c.id);
  }
  console.log(`Aziende in DB: ${companies.length}`);

  // Mappa Lead: titolo UPPER → { leadId, companyId }
  const leads = await prisma.lead.findMany({
    where: { tenantId },
    select: { id: true, title: true, companyId: true },
  });
  const leadMap = new Map<string, { leadId: string; companyId: string | null }>();
  for (const l of leads) {
    const key = l.title.toUpperCase();
    const keyNorm = normalize(l.title);
    if (!leadMap.has(key)) leadMap.set(key, { leadId: l.id, companyId: l.companyId });
    if (!leadMap.has(keyNorm)) leadMap.set(keyNorm, { leadId: l.id, companyId: l.companyId });
  }
  console.log(`Lead in DB: ${leads.length}`);

  // Legge CSV
  const actContent = readFileSync(ACTIVITIES_CSV, "latin1");
  const actLines = actContent.split("\r\n").filter(l => l.trim().startsWith('"'));

  type Update = { id: string; companyId: string | null; leadId?: string };
  const updates: Update[] = [];
  let stillNoMatch = 0;
  const noMatchSamples: string[] = [];

  for (const line of actLines) {
    const f = parseRow(line);
    const externalId = clean(f[0]);
    if (!externalId) continue;
    const actId = unlinkedMap.get(externalId);
    if (!actId) continue;

    const companyRaw = clean(f[4]) ?? "";
    const deduped = dedup(companyRaw);
    const upper = deduped.toUpperCase();
    const normed = normalize(deduped);

    // 1. Match su Company
    let companyId = compMap.get(upper) ?? compMap.get(normed) ?? null;
    if (companyId) {
      updates.push({ id: actId, companyId });
      continue;
    }

    // 2. Match su Lead.title → prende companyId del lead
    const leadMatch = leadMap.get(upper) ?? leadMap.get(normed) ?? null;
    if (leadMatch) {
      updates.push({ id: actId, companyId: leadMatch.companyId, leadId: leadMatch.leadId });
      continue;
    }

    stillNoMatch++;
    if (noMatchSamples.length < 10) noMatchSamples.push(`"${deduped}"`);
  }

  const viaCompany = updates.filter(u => !u.leadId).length;
  const viaLead    = updates.filter(u => !!u.leadId).length;
  console.log(`\nMatch su Company: ${viaCompany} | Match su Lead: ${viaLead} | Senza match: ${stillNoMatch}`);
  if (noMatchSamples.length > 0) {
    console.log("Campione ancora senza match:");
    noMatchSamples.forEach(s => console.log("  ", s));
  }
  if (updates.length === 0) { console.log("Nessun aggiornamento."); return; }

  const BATCH = 100;
  let done = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map(({ id, companyId, leadId }) =>
        prisma.activity.update({ where: { id }, data: { companyId, ...(leadId ? { leadId } : {}) } })
      )
    );
    done += batch.length;
    process.stdout.write(`\r  Aggiornate: ${done}/${updates.length}`);
  }
  console.log();
  console.log(`\n✅ Associazioni applicate: ${updates.length} (company: ${viaCompany}, lead: ${viaLead})`);
  console.log(`   Ancora senza match: ${stillNoMatch}\n`);
}

main()
  .catch(e => { console.error("\n❌ ERRORE:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
