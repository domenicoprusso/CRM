import { describe, expect, it } from "vitest";
import { importJobStats, looksLikeTeamSystemCompanyExport, parseCsv, parseTeamSystemCompanyExport } from "@/lib/imports";

describe("import helpers", () => {
  it("parses csv with semicolon delimiter and quoted fields", () => {
    const parsed = parseCsv('name;email;notes\n"Acme Srl";info@acme.test;"line 1; line 2"');

    expect(parsed.delimiter).toBe(";");
    expect(parsed.headers).toEqual(["name", "email", "notes"]);
    expect(parsed.rows[0]).toEqual(["Acme Srl", "info@acme.test", "line 1; line 2"]);
  });

  it("summarizes import job stats from normalized rows", () => {
    const job = {
      rowsTotal: 3,
      rowsImported: 1,
      rows: [
        { normalizedData: { meta: { state: "valid" } } },
        { normalizedData: { meta: { state: "duplicate" } } },
        { normalizedData: { meta: { state: "invalid" } } },
      ],
    };

    const stats = importJobStats(job);

    expect(stats).toEqual({
      total: 3,
      valid: 1,
      duplicate: 1,
      invalid: 1,
      imported: 1,
    });
  });

  it("parses the TeamSystem company export adapter with project tags and primary contact values", () => {
    const tokens = Array.from({ length: 76 }, () => "");
    tokens[0] = "245544";
    tokens[2] = "Bitcall S.R.L.";
    tokens[5] = "San Cesareo";
    tokens[7] = "02 36729795;02 11111111";
    tokens[8] = "info@bitcall.it;seconda@bitcall.it";
    tokens[10] = "Scuole Roma";
    tokens[12] = "Importazione 30/11/2021 18:00";
    tokens[13] = "Referente: DSGA";
    tokens[22] = "via Della Comunicazione 7";
    tokens[24] = "Italia";
    tokens[35] = "Scuole;PNRR";

    const line = `"${tokens.join('""')}"`;
    const parsed = parseTeamSystemCompanyExport(`header\n${line}`);

    expect(looksLikeTeamSystemCompanyExport(`header\n${line}`)).toBe(true);
    expect(parsed.headers).toEqual(["externalId", "name", "industry", "website", "phone", "email", "address", "city", "country", "owner", "tags", "notes"]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toEqual([
      "245544",
      "Bitcall S.R.L.",
      "",
      "",
      "02 36729795",
      "info@bitcall.it",
      "via Della Comunicazione 7",
      "San Cesareo",
      "Italia",
      "",
      "project:scuole-roma,Scuole,PNRR",
      "Importazione 30/11/2021 18:00 | Referente: DSGA",
    ]);
  });
});
