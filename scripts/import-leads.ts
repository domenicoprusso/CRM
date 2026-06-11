/**
 * Import Lead da CSV TeamSystem → Supabase
 * Usage: npx tsx scripts/import-leads.ts
 */
import { readFileSync } from "fs";
import { PrismaClient, LeadStatus } from "@prisma/client";

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
function parseDate(v: string | undefined): Date | null {
  const s = clean(v);
  if (!s) return null;
  const [dp] = s.split(" ");
  const pts = dp.split("/");
  if (pts.length === 3) {
    const dt = new Date(`${pts[2]}-${pts[1].padStart(2, "0")}-${pts[0].padStart(2, "0")}`);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}
function normalize(s: string): string {
  return s.toUpperCase().replace(/[.\-,'&;]/g, " ").replace(/\s+/g, " ").trim();
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
  console.log(`\n✓ Tenant: ${tenant.name}`);
  console.log(`✓ Admin: ${adminUser.name}\n`);

  // ── Carica utenti per mapping responsabile ──────────────────────────────────
  const users = await prisma.user.findMany({ where: { tenantId }, select: { id: true, name: true } });
  const userMap = new Map<string, string>(); // nome normalizzato → id
  for (const u of users) {
    userMap.set(u.name.toUpperCase(), u.id);
    // Anche solo il cognome per match parziale
    const parts = u.name.split(" ");
    if (parts.length > 1) userMap.set(parts[parts.length - 1].toUpperCase(), u.id);
  }

  const adminId = adminUser!.id;
  function resolveOwner(name: string | null): string {
    if (!name) return adminId;
    const upper = name.toUpperCase();
    // Match esatto
    if (userMap.has(upper)) return userMap.get(upper)!;
    // Match parziale: cognome
    for (const [k, v] of userMap) {
      if (upper.includes(k) || k.includes(upper.split(" ")[0])) return v;
    }
    return adminId;
  }

  // ── Carica aziende per matching companyId ───────────────────────────────────
  console.log("Caricamento aziende...");
  const companies = await prisma.company.findMany({ where: { tenantId }, select: { id: true, name: true } });
  const compExact = new Map<string, string>();
  const compNorm  = new Map<string, string>();
  for (const c of companies) {
    const upper  = c.name.toUpperCase();
    const normed = normalize(c.name);
    if (!compExact.has(upper)) compExact.set(upper, c.id);
    if (!compNorm.has(normed))  compNorm.set(normed, c.id);
  }
  function resolveCompany(name: string | null): string | null {
    if (!name) return null;
    const upper  = name.toUpperCase();
    const normed = normalize(name);
    return compExact.get(upper) ?? compNorm.get(normed) ?? null;
  }

  // ── Carica externalId lead esistenti ────────────────────────────────────────
  const existingLeads = await prisma.lead.findMany({ where: { tenantId }, select: { id: true, externalId: true } });
  const existingMap = new Map(existingLeads.map(l => [l.externalId, l.id]));
  console.log(`Lead già in DB: ${existingLeads.length}`);

  // ── Legge CSV ────────────────────────────────────────────────────────────────
  const content = readFileSync(LEADS_CSV, "latin1");
  const lines = content.split("\r\n").filter(l => l.trim().startsWith('"'));

  const toCreate: object[] = [];
  const toUpdate: { id: string; data: object }[] = [];
  const now = new Date();
  let noCompany = 0;

  for (const line of lines) {
    const f = parseRow(line);
    const externalId = clean(f[0]);
    const companyName = clean(f[3]);
    if (!externalId || !companyName) continue;

    const active = f[5]?.trim() === "true";
    const status: LeadStatus = active ? LeadStatus.NEW : LeadStatus.LOST;
    const source = clean(f[14]);
    const ownerId = resolveOwner(clean(f[17]));
    const companyId = resolveCompany(companyName);
    const createdAt = parseDate(f[11]) ?? now;
    const notes = clean(f[35]) ?? undefined; // job title / note campo libero

    if (!companyId) noCompany++;

    const data = {
      tenantId,
      externalId,
      ownerId,
      companyId,
      title: companyName,
      source: source && !source.startsWith("Importazione") ? source : "TeamSystem",
      status,
      score: 0,
      notes: notes ?? null,
      tags: [] as string[],
      updatedAt: now,
    };

    const existingId = existingMap.get(externalId);
    if (existingId) {
      toUpdate.push({ id: existingId, data });
    } else {
      toCreate.push({ id: cuid(), createdAt, ...data });
    }
  }

  console.log(`\nDa creare: ${toCreate.length} | Da aggiornare: ${toUpdate.length}`);
  console.log(`Senza match azienda: ${noCompany}`);

  // ── Bulk create ──────────────────────────────────────────────────────────────
  let created = 0;
  for (let i = 0; i < toCreate.length; i += BATCH) {
    const batch = toCreate.slice(i, i + BATCH);
    await (prisma.lead as any).createMany({ data: batch, skipDuplicates: true });
    created += batch.length;
    process.stdout.write(`\r  Create: ${created}/${toCreate.length}`);
  }
  console.log();

  // ── Bulk update ──────────────────────────────────────────────────────────────
  let updated = 0;
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH);
    await prisma.$transaction(batch.map(({ id, data }) => (prisma.lead as any).update({ where: { id }, data })));
    updated += batch.length;
    process.stdout.write(`\r  Aggiornate: ${updated}/${toUpdate.length}`);
  }
  console.log();

  // ── Verifica finale ──────────────────────────────────────────────────────────
  const totLead = await prisma.lead.count({ where: { tenantId } });
  console.log("\n═══════════════════════════════════════");
  console.log(`  DB finale — Lead: ${totLead}`);
  console.log(`  ✅ Creati: ${created} | Aggiornati: ${updated}`);
  console.log("═══════════════════════════════════════\n");
}

main()
  .catch(e => { console.error("\n❌ ERRORE:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
