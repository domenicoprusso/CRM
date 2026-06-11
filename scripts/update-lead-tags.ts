/**
 * Aggiunge i tag progetto ai lead già importati leggendo f[13] dal CSV
 * Usage: npx tsx scripts/update-lead-tags.ts
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
function toProjectTag(v: string): string | null {
  // Normalizza il valore in un tag project:slug
  const slug = v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug ? `project:${slug}` : null;
}

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("Nessun tenant trovato.");
  const tenantId = tenant.id;
  console.log(`\n✓ Tenant: ${tenant.name}\n`);

  // Carica externalId → id dei lead in DB
  const dbLeads = await prisma.lead.findMany({ where: { tenantId }, select: { id: true, externalId: true, tags: true } });
  const leadMap = new Map(dbLeads.map(l => [l.externalId, l]));
  console.log(`Lead in DB: ${dbLeads.length}`);

  // Legge CSV e costruisce aggiornamenti
  const content = readFileSync(LEADS_CSV, "latin1");
  const lines = content.split("\r\n").filter(l => l.trim().startsWith('"'));

  // Conta valori distinti in f[13] per report
  const tagCount = new Map<string, number>();
  const updates: { id: string; tags: string[] }[] = [];

  for (const line of lines) {
    const f = parseRow(line);
    const externalId = clean(f[0]);
    if (!externalId) continue;

    const rawTag = clean(f[13]);
    if (!rawTag) continue;

    // Escludi valori che sembrano nomi azienda (contengono spazi e non sono brevi sigle)
    const words = rawTag.trim().split(/\s+/);
    if (words.length > 2) continue; // probabilmente un nome, non un codice progetto

    const tag = toProjectTag(rawTag);
    if (!tag) continue;

    tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);

    const lead = leadMap.get(externalId);
    if (!lead) continue;

    // Normalizzazioni: lombead → lomblead
    const canonicalTag = tag.replace("project:lombead", "project:lomblead");

    if (!lead.tags.includes(canonicalTag)) {
      updates.push({ id: lead.id, tags: [...lead.tags, canonicalTag] });
    }
  }

  console.log("Tag trovati in f[13]:");
  [...tagCount.entries()].sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`  ${t} × ${n}`));
  console.log(`\nLead da aggiornare: ${updates.length}`);

  if (updates.length === 0) { console.log("Niente da fare."); return; }

  let done = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map(({ id, tags }) => prisma.lead.update({ where: { id }, data: { tags } }))
    );
    done += batch.length;
    process.stdout.write(`\r  Aggiornati: ${done}/${updates.length}`);
  }
  console.log();
  console.log(`\n✅ Tag progetto aggiunti a ${updates.length} lead.\n`);
}

main()
  .catch(e => { console.error("\n❌ ERRORE:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
