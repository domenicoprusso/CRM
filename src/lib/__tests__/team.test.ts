import { describe, it, expect } from "vitest";
import { projectLabel } from "@/lib/team";

describe("projectLabel", () => {
  it("converts project tag to human-readable label", () => {
    expect(projectLabel("project:scuole-roma")).toBe("Scuole Roma");
  });

  it("capitalizes each word", () => {
    expect(projectLabel("project:recupero-crediti")).toBe("Recupero Crediti");
  });

  it("handles single word", () => {
    expect(projectLabel("project:scuole")).toBe("Scuole");
  });

  it("handles multiple words", () => {
    expect(projectLabel("project:scuole-superiori-torino")).toBe("Scuole Superiori Torino");
  });
});
