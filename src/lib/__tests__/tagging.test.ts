import { describe, expect, it } from "vitest";
import { normalizeProjectSlug, normalizeTagList, projectTagFromValue, projectTagsFromValue, splitMultiValue } from "@/lib/tagging";

describe("tag helpers", () => {
  it("normalizes project names into stable project tags", () => {
    expect(normalizeProjectSlug("Scuole Roma")).toBe("scuole-roma");
    expect(projectTagFromValue("Scuole Roma")).toBe("project:scuole-roma");
    expect(projectTagsFromValue("Scuole Roma;  Demo")).toEqual(["project:scuole-roma", "project:demo"]);
  });

  it("keeps free tags trimmed and splits structured values", () => {
    expect(normalizeTagList("Scuole; PNRR |  Demo ")).toEqual(["Scuole", "PNRR", "Demo"]);
    expect(splitMultiValue("a, b; c|d")).toEqual(["a", "b", "c", "d"]);
  });
});
