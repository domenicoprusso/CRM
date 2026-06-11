import { readFileSync } from "fs";

const content = readFileSync("C:/Users/dprusso/Downloads/export_lead_2026-06-1006-47-36.csv", "latin1");
const lines = content.split("\r\n").filter(l => l.trim().startsWith('"'));

function parseRow(line) {
  const inner = line.slice(1, line.endsWith('"') ? -1 : line.length);
  return inner.split('""');
}
function clean(v) {
  const s = (v ?? "").trim();
  return s === "" || s === "0.0000" || s === "false" || s === "False" || s === "0" ? null : s;
}

// Per ogni campo (fino al 50), conta i valori non-null distinti
const fieldStats = {};
for (let i = 0; i <= 79; i++) fieldStats[i] = new Map();

for (const line of lines) {
  const f = parseRow(line);
  for (let i = 0; i <= 79; i++) {
    const v = clean(f[i]);
    if (v && !v.startsWith("Importazione") && v !== "true" && v !== "false" && v !== "normale") {
      fieldStats[i].set(v, (fieldStats[i].get(v) || 0) + 1);
    }
  }
}

// Mostra campi con valori interessanti (non-null, variati ma non troppo)
console.log("Campi con valori potenzialmente utili:\n");
for (let i = 0; i <= 79; i++) {
  const m = fieldStats[i];
  const size = m.size;
  if (size >= 2 && size <= 50) {
    const top = [...m.entries()].sort((a,b) => b[1]-a[1]).slice(0, 8);
    console.log(`f[${i}] (${size} valori distinti, top entries):`);
    top.forEach(([v, n]) => console.log(`  "${v}" × ${n}`));
  }
}
