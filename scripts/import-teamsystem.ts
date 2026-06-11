/**
 * Import diretto da CSV TeamSystem → Supabase (bulk SQL)
 * Usage: npx tsx scripts/import-teamsystem.ts
 */
import { readFileSync } from "fs";
import { PrismaClient, ActivityType } from "@prisma/client";

// Carica .env.local
const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

const prisma = new PrismaClient();

const COMPANIES_CSV = "C:/Users/dprusso/Downloads/export_azienda_2026-05-3110-11-56.csv";
const ACTIVITIES_CSV = "C:/Users/dprusso/Downloads/export_attività_2026-06-1006-00-19.csv";
const BATCH = 200;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseRow(line: string): string[] {
  if (!line.startsWith('"')) return [];
  const inner = line.slice(1, line.endsWith('"') ? -1 : line.length);
  return inner.split('""');
}

function clean(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  return s === "" || s === "0.0000" || s === "false" || s === "False" || s === "0" ? null : s;
}

function parseDate(v: string | undefined): Date | null {
  const s = clean(v);
  if (!s) return null;
  const [dp] = s.split(" ");
  const pts = dp.split("/");
  if (pts.length === 3) {
    const dt = new Date(`${pts[2]}-${pts[1].padStart(2,"0")}-${pts[0].padStart(2,"0")}`);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

function projectTag(v: string | null): string | null {
  if (!v) return null;
  const slug = v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug ? `project:${slug}` : null;
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

function mapType(t: string): ActivityType {
  const u = t.toUpperCase();
  if (u.includes("TELEFON") || u.includes("CALL") || u.includes("CHIAMAT")) return ActivityType.CALL;
  if (u.includes("EMAIL") || u.includes("MAIL")) return ActivityType.EMAIL;
  if (u.includes("MEETING") || u.includes("INCONTRO") || u.includes("RIUNIONE") || u.includes("VISITA")) return ActivityType.MEETING;
  if (u.includes("FOLLOW") || u.includes("RICHIAMO")) return ActivityType.FOLLOW_UP;
  return ActivityType.CALL;
}

function cuid(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `c${ts}${rand}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("Nessun tenant trovato.");
  const tenantId = tenant.id;

  const adminUser = await prisma.user.findFirst({ where: { tenantId, role: "ADMIN" }, select: { id: true, name: true } });
  if (!adminUser) throw new Error("Nessun ADMIN trovato.");

  console.log(`\n✓ Tenant: ${tenant.name}`);
  console.log(`✓ Admin: ${adminUser.name}\n`);

  // ── 1. AZIENDE ────────────────────────────────────────────────────────────

  console.log("═══════════════════════════════════════");
  console.log("  STEP 1 — Import Aziende (bulk)");
  console.log("═══════════════════════════════════════");

  const compContent = readFileSync(COMPANIES_CSV, "latin1");
  const compLines = compContent.split("\r\n").filter(l => l.trim().startsWith('"'));

  // Carica externalId esistenti
  const existingComps = await prisma.company.findMany({ where: { tenantId }, select: { id: true, externalId: true } });
  const existingCompMap = new Map(existingComps.map(c => [c.externalId, c.id]));

  const toCreate: object[] = [];
  const toUpdate: { id: string; data: object }[] = [];
  const companyNameToId = new Map<string, string>();

  const now = new Date();

  for (const line of compLines) {
    const f = parseRow(line);
    const externalId = clean(f[0]);
    const name = clean(f[2]);
    if (!name || !externalId) continue;

    const codMecc = clean(f[11]);
    const tagsArr: string[] = [];
    const ptag = projectTag(clean(f[10]));
    if (ptag) tagsArr.push(ptag);
    if (codMecc) tagsArr.push(codMecc);
    const freeTag = clean(f[12]);
    if (freeTag && !freeTag.startsWith("Importazione")) tagsArr.push(freeTag);

    const data = {
      tenantId,
      externalId,
      name,
      phone: clean(f[7]),
      email: clean(f[8]),
      city: clean(f[5]),
      region: clean(f[6]),
      industry: clean(f[16]),
      website: clean(f[20]),
      address: clean(f[22]),
      province: clean(f[23]),
      country: clean(f[24]),
      postalCode: clean(f[25]),
      codMeccanografico: codMecc,
      notes: clean(f[13]),
      tags: tagsArr,
      updatedAt: now,
    };

    const existingId = existingCompMap.get(externalId);
    if (existingId) {
      toUpdate.push({ id: existingId, data });
      companyNameToId.set(name.toUpperCase(), existingId);
    } else {
      const newId = cuid();
      toCreate.push({ id: newId, createdAt: now, ...data });
      companyNameToId.set(name.toUpperCase(), newId);
    }
    companyNameToId.set(name.toUpperCase().replace(/[.\-,']/g, "").replace(/\s+/g, " "), companyNameToId.get(name.toUpperCase())!);
  }

  console.log(`  Da creare: ${toCreate.length} | Da aggiornare: ${toUpdate.length}`);

  // Bulk create in batch
  let created = 0;
  for (let i = 0; i < toCreate.length; i += BATCH) {
    const batch = toCreate.slice(i, i + BATCH);
    await (prisma.company as any).createMany({ data: batch, skipDuplicates: true });
    created += batch.length;
    process.stdout.write(`\r  Create: ${created}/${toCreate.length}`);
  }
  console.log();

  // Bulk update in batch (prisma non ha updateMany con dati diversi per riga → batch di transaction)
  let updated = 0;
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH);
    await prisma.$transaction(batch.map(({ id, data }) => (prisma.company as any).update({ where: { id }, data })));
    updated += batch.length;
    process.stdout.write(`\r  Aggiornate: ${updated}/${toUpdate.length}`);
  }
  console.log();
  console.log(`  ✅ Aziende: ${created} create, ${updated} aggiornate\n`);

  // ── 2. ATTIVITÀ ────────────────────────────────────────────────────────────

  console.log("═══════════════════════════════════════");
  console.log("  STEP 2 — Import Attività (bulk)");
  console.log("═══════════════════════════════════════");

  const actContent = readFileSync(ACTIVITIES_CSV, "latin1");
  const actLines = actContent.split("\r\n").filter(l => l.trim().startsWith('"'));

  // Carica externalId attività esistenti
  const existingActs = await prisma.activity.findMany({ where: { tenantId }, select: { externalId: true } });
  const existingActSet = new Set(existingActs.map(a => a.externalId));

  const actToCreate: object[] = [];
  let actNoMatch = 0;
  const noMatchSamples: string[] = [];

  for (const line of actLines) {
    const f = parseRow(line);
    const externalId = clean(f[0]);
    const subject = clean(f[2]) ?? "Attività";
    if (!externalId || existingActSet.has(externalId)) continue;

    const companyRaw = clean(f[4]) ?? "";
    const cleanedName = dedup(companyRaw).toUpperCase();
    const cleanedNoPunct = cleanedName.replace(/[.\-,']/g, "").replace(/\s+/g, " ");

    let companyId: string | null = companyNameToId.get(cleanedName) ?? companyNameToId.get(cleanedNoPunct) ?? null;

    if (!companyId) {
      actNoMatch++;
      if (noMatchSamples.length < 10) noMatchSamples.push(`"${companyRaw}"`);
    }

    const occurredAt = parseDate(f[6]) ?? now;
    actToCreate.push({
      id: cuid(),
      tenantId,
      externalId,
      userId: adminUser.id,
      companyId,
      type: mapType(clean(f[8]) ?? ""),
      subject,
      body: clean(f[9]),
      occurredAt,
      createdAt: parseDate(f[11]) ?? occurredAt,
    });
  }

  console.log(`  Da creare: ${actToCreate.length} | Senza match azienda: ${actNoMatch}`);
  if (noMatchSamples.length > 0) {
    console.log("  Campione nomi senza match:");
    noMatchSamples.forEach(s => console.log(`    ${s}`));
  }

  let actCreated = 0;
  for (let i = 0; i < actToCreate.length; i += BATCH) {
    const batch = actToCreate.slice(i, i + BATCH);
    await (prisma.activity as any).createMany({ data: batch, skipDuplicates: true });
    actCreated += batch.length;
    process.stdout.write(`\r  Create: ${actCreated}/${actToCreate.length}`);
  }
  console.log();
  console.log(`  ✅ Attività: ${actCreated} create\n`);

  // ── Verifica finale ────────────────────────────────────────────────────────
  const [totComp, totAct] = await Promise.all([
    prisma.company.count({ where: { tenantId } }),
    prisma.activity.count({ where: { tenantId } }),
  ]);
  console.log("═══════════════════════════════════════");
  console.log(`  DB finale — Aziende: ${totComp} | Attività: ${totAct}`);
  console.log("  ✅ Import completato.");
  console.log("═══════════════════════════════════════\n");
}

main()
  .catch(e => { console.error("\n❌ ERRORE:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
