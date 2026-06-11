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

const f5 = new Map(), f12 = new Map(), f14src = new Map(), f17owner = new Map();
let withBody = 0;

for (const line of lines) {
  const f = parseRow(line);
  const v5 = clean(f[5]) ?? "null/false"; f5.set(v5, (f5.get(v5)||0)+1);
  const v12 = clean(f[12]) ?? "null"; f12.set(v12, (f12.get(v12)||0)+1);
  const v14 = clean(f[14]) ?? "null";
  if (v14 !== "null" && !v14.startsWith("Importazione")) f14src.set(v14, (f14src.get(v14)||0)+1);
  const v17 = clean(f[17]) ?? "null"; f17owner.set(v17, (f17owner.get(v17)||0)+1);
  // Campo note/corpo
  const body = clean(f[33]) || clean(f[34]) || clean(f[35]) || clean(f[36]);
  if (body && !body.startsWith("http")) withBody++;
}

console.log("Totale righe:", lines.length);
console.log("\nf[5] (attivo/chiuso):", [...f5.entries()].sort((a,b)=>b[1]-a[1]));
console.log("\nf[12] (stato/priorita):", [...f12.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10));
console.log("\nf[14] (fonte, no import):", [...f14src.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10));
console.log("\nf[17] (responsabile):", [...f17owner.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10));
console.log("\nCon note:", withBody);

// Mostra un paio di righe con note
let shown = 0;
for (const line of lines) {
  const f = parseRow(line);
  const body = clean(f[33]) || clean(f[34]) || clean(f[35]);
  if (body && !body.startsWith("http") && shown < 3) {
    console.log(`\n--- Esempio con note (id ${f[0]}) ---`);
    console.log("  company:", f[3]);
    console.log("  f33:", f[33]?.slice(0,100));
    console.log("  f34:", f[34]?.slice(0,100));
    console.log("  f35:", f[35]?.slice(0,100));
    shown++;
  }
}
