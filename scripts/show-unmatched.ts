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

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("No tenant");
  const tenantId = tenant.id;

  const unlinked = await prisma.activity.findMany({
    where: { tenantId, companyId: null, externalId: { not: null } },
    select: { externalId: true },
  });
  const unlinkedSet = new Set(unlinked.map(a => a.externalId!));
  console.log(`Attività senza azienda: ${unlinked.length}`);

  const actContent = readFileSync(ACTIVITIES_CSV, "latin1");
  const actLines = actContent.split("\r\n").filter(l => l.trim().startsWith('"'));

  const samples: string[] = [];
  for (const line of actLines) {
    const f = parseRow(line);
    const externalId = clean(f[0]);
    if (!externalId || !unlinkedSet.has(externalId)) continue;
    const raw = clean(f[4]) ?? "";
    const name = dedup(raw);
    if (name && !samples.includes(name)) samples.push(name);
    if (samples.length >= 40) break;
  }

  console.log("\nCampione nomi non abbinati:");
  samples.forEach(s => console.log(" ", s));
}

main()
  .catch(e => { console.error("ERRORE:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
