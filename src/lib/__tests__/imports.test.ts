import { describe, expect, it } from "vitest";
import { importJobStats, parseCsv } from "@/lib/imports";

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
});
