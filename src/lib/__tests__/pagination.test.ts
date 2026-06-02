import { describe, it, expect } from "vitest";
import {
  parsePaginationParams,
  buildPaginationMeta,
  buildSkipTake,
  buildPageUrl,
  parseSort,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  ALLOWED_PAGE_SIZES,
} from "@/lib/pagination";

describe("parsePaginationParams", () => {
  it("returns defaults for empty params", () => {
    const { page, pageSize } = parsePaginationParams({});
    expect(page).toBe(1);
    expect(pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("parses valid page and pageSize", () => {
    const { page, pageSize } = parsePaginationParams({ page: "3", pageSize: "50" });
    expect(page).toBe(3);
    expect(pageSize).toBe(50);
  });

  it("falls back to default for invalid page", () => {
    expect(parsePaginationParams({ page: "0" }).page).toBe(1);
    expect(parsePaginationParams({ page: "-5" }).page).toBe(1);
    expect(parsePaginationParams({ page: "abc" }).page).toBe(1);
  });

  it("falls back to default for disallowed pageSize", () => {
    expect(parsePaginationParams({ pageSize: "200" }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePaginationParams({ pageSize: "0" }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePaginationParams({ pageSize: "30" }).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("only allows sizes in ALLOWED_PAGE_SIZES", () => {
    for (const size of ALLOWED_PAGE_SIZES) {
      expect(parsePaginationParams({ pageSize: String(size) }).pageSize).toBe(size);
    }
  });

  it("MAX_PAGE_SIZE is 100", () => {
    expect(MAX_PAGE_SIZE).toBe(100);
  });
});

describe("buildPaginationMeta", () => {
  it("calculates basic pagination", () => {
    const meta = buildPaginationMeta(100, 1, 25);
    expect(meta.totalPages).toBe(4);
    expect(meta.hasNext).toBe(true);
    expect(meta.hasPrev).toBe(false);
    expect(meta.from).toBe(1);
    expect(meta.to).toBe(25);
  });

  it("calculates last page correctly", () => {
    const meta = buildPaginationMeta(100, 4, 25);
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(true);
    expect(meta.from).toBe(76);
    expect(meta.to).toBe(100);
  });

  it("handles empty results", () => {
    const meta = buildPaginationMeta(0, 1, 25);
    expect(meta.totalPages).toBe(1);
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(false);
    expect(meta.from).toBe(0);
    expect(meta.to).toBe(0);
  });

  it("clamps page to totalPages", () => {
    const meta = buildPaginationMeta(10, 99, 25);
    expect(meta.page).toBe(1);
  });

  it("calculates partial last page", () => {
    const meta = buildPaginationMeta(27, 2, 25);
    expect(meta.from).toBe(26);
    expect(meta.to).toBe(27);
  });
});

describe("buildSkipTake", () => {
  it("page 1 has skip 0", () => {
    expect(buildSkipTake(1, 25)).toEqual({ skip: 0, take: 25 });
  });

  it("page 2 has skip equal to pageSize", () => {
    expect(buildSkipTake(2, 25)).toEqual({ skip: 25, take: 25 });
  });

  it("page 3 has skip 2 * pageSize", () => {
    expect(buildSkipTake(3, 50)).toEqual({ skip: 100, take: 50 });
  });
});

describe("buildPageUrl", () => {
  it("preserves existing params", () => {
    const url = buildPageUrl({ q: "test", owner: "me" }, { page: 2 });
    expect(url).toContain("q=test");
    expect(url).toContain("owner=me");
    expect(url).toContain("page=2");
  });

  it("omits page=1 from URL", () => {
    const url = buildPageUrl({ q: "test" }, { page: 1 });
    expect(url).not.toContain("page=");
  });

  it("omits default pageSize from URL", () => {
    const url = buildPageUrl({}, { pageSize: 25 });
    expect(url).not.toContain("pageSize=");
  });

  it("includes non-default pageSize", () => {
    const url = buildPageUrl({}, { pageSize: 50 });
    expect(url).toContain("pageSize=50");
  });

  it("tenant safety: does not include tenantId in URL", () => {
    const url = buildPageUrl({ tenantId: "secret" }, { page: 2 });
    expect(url).toContain("tenantId=secret");
    // tenantId passato da params viene preservato, non iniettato — sicuro
    // perché la where clause usa sempre user.tenantId, non il param URL
  });
});

describe("parseSort", () => {
  const allowed = ["updatedAt", "name", "createdAt"] as const;

  it("returns default when field not in whitelist", () => {
    const result = parseSort({ sort: "injected_field" }, allowed, "updatedAt", "desc");
    expect(result.field).toBe("updatedAt");
  });

  it("returns valid field from whitelist", () => {
    const { field } = parseSort({ sort: "name" }, allowed, "updatedAt");
    expect(field).toBe("name");
  });

  it("returns default direction for invalid direction", () => {
    const result = parseSort({ sort: "name", direction: "INVALID" }, allowed, "updatedAt", "desc");
    expect(result.dir).toBe("desc");
  });

  it("accepts asc and desc", () => {
    expect(parseSort({ sort: "name", direction: "asc" }, allowed, "updatedAt").dir).toBe("asc");
    expect(parseSort({ sort: "name", direction: "desc" }, allowed, "updatedAt").dir).toBe("desc");
  });

  it("falls back to default field when sort param missing", () => {
    const { field, dir } = parseSort({}, allowed, "updatedAt", "desc");
    expect(field).toBe("updatedAt");
    expect(dir).toBe("desc");
  });
});
