/**
 * Analizza il CSV lead cercando campi con email, telefono, indirizzo, P.IVA
 * Usage: node scripts/analyze-lead-company-fields.mjs
 */
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

// Pattern recognition
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRe = /^[\d\s\+\-\/\(\)\.]{7,20}$/;
const vatRe = /^\d{10,11}$/;
const capRe = /^\d{5}$/;

// Per ogni campo raccoglie campioni e statistiche
const stats = {};
for (let i = 0; i <= 79; i++) {
  stats[i] = { count: 0, emails: 0, phones: 0, vats: 0, caps: 0, samples: [] };
}

for (const line of lines) {
  const f = parseRow(line);
  for (let i = 0; i <= 79; i++) {
    const v = clean(f[i]);
    if (!v) continue;
    stats[i].count++;
    if (emailRe.test(v)) stats[i].emails++;
    if (phoneRe.test(v) && !vatRe.test(v) && !capRe.test(v)) stats[i].phones++;
    if (vatRe.test(v)) stats[i].vats++;
    if (capRe.test(v)) stats[i].caps++;
    if (stats[i].samples.length < 5) stats[i].samples.push(v);
  }
}

console.log("=== CAMPI CON EMAIL ===");
for (let i = 0; i <= 79; i++) {
  if (stats[i].emails > 10) {
    console.log(`f[${i}]: ${stats[i].emails} email su ${stats[i].count} → es: ${stats[i].samples.slice(0,3).join(", ")}`);
  }
}

console.log("\n=== CAMPI CON TELEFONO ===");
for (let i = 0; i <= 79; i++) {
  if (stats[i].phones > 10) {
    console.log(`f[${i}]: ${stats[i].phones} telefoni su ${stats[i].count} → es: ${stats[i].samples.slice(0,3).join(", ")}`);
  }
}

console.log("\n=== CAMPI CON P.IVA (11 cifre) ===");
for (let i = 0; i <= 79; i++) {
  if (stats[i].vats > 10) {
    console.log(`f[${i}]: ${stats[i].vats} P.IVA su ${stats[i].count} → es: ${stats[i].samples.slice(0,3).join(", ")}`);
  }
}

console.log("\n=== CAMPI CON CAP (5 cifre) ===");
for (let i = 0; i <= 79; i++) {
  if (stats[i].caps > 10) {
    console.log(`f[${i}]: ${stats[i].caps} CAP su ${stats[i].count} → es: ${stats[i].samples.slice(0,3).join(", ")}`);
  }
}

console.log("\n=== TUTTI I CAMPI NON VUOTI (count > 100) ===");
for (let i = 0; i <= 79; i++) {
  if (stats[i].count > 100) {
    console.log(`f[${i}]: ${stats[i].count} valori → es: ${stats[i].samples.slice(0,4).join(" | ")}`);
  }
}
