import type { SearchParamsInput } from "@/lib/crm-filters";
import { readParam } from "@/lib/crm-filters";

export const DEFAULT_PAGE_SIZE = 25;
export const ALLOWED_PAGE_SIZES = [25, 50, 100] as const;
export const MAX_PAGE_SIZE = 100;

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  from: number;
  to: number;
};

export type SortDirection = "asc" | "desc";

export function parsePaginationParams(params: SearchParamsInput): { page: number; pageSize: number } {
  const rawPage = Number(readParam(params, "page") ?? "1");
  const rawSize = Number(readParam(params, "pageSize") ?? String(DEFAULT_PAGE_SIZE));

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize = (ALLOWED_PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : DEFAULT_PAGE_SIZE;

  return { page, pageSize };
}

export function buildSkipTake(page: number, pageSize: number): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPaginationMeta(total: number, page: number, pageSize: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
    from,
    to,
  };
}

/** Build a URL preserving existing params, overriding page (and optionally sort/direction/pageSize) */
export function buildPageUrl(
  params: SearchParamsInput,
  overrides: { page?: number; pageSize?: number; sort?: string; direction?: string },
): string {
  const next: Record<string, string> = {};
  // Copy all existing params (except those we override)
  const skip = new Set(["page", "pageSize", "sort", "direction"].filter((k) => k in overrides));
  for (const [key, value] of Object.entries(params)) {
    if (!skip.has(key) && value !== undefined) {
      next[key] = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
    }
  }
  if (overrides.page !== undefined && overrides.page !== 1) next.page = String(overrides.page);
  if (overrides.pageSize !== undefined && overrides.pageSize !== DEFAULT_PAGE_SIZE) next.pageSize = String(overrides.pageSize);
  if (overrides.sort !== undefined) next.sort = overrides.sort;
  if (overrides.direction !== undefined) next.direction = overrides.direction;

  const qs = new URLSearchParams(next).toString();
  return qs ? `?${qs}` : "?";
}

/** Safe sort parser — only allows whitelisted fields */
export function parseSort<T extends string>(
  params: SearchParamsInput,
  allowed: readonly T[],
  defaultField: T,
  defaultDir: SortDirection = "desc",
): { field: T; dir: SortDirection } {
  const rawField = readParam(params, "sort");
  const rawDir = readParam(params, "direction");
  const field = (allowed as readonly string[]).includes(rawField ?? "") ? (rawField as T) : defaultField;
  const dir: SortDirection = rawDir === "asc" || rawDir === "desc" ? rawDir : defaultDir;
  return { field, dir };
}
