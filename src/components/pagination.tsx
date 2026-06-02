import Link from "next/link";
import { clsx } from "clsx";
import type { PaginationMeta } from "@/lib/pagination";
import { ALLOWED_PAGE_SIZES, buildPageUrl } from "@/lib/pagination";
import type { SearchParamsInput } from "@/lib/crm-filters";

type Props = { meta: PaginationMeta; params: SearchParamsInput };

export function ResultsCount({ meta }: { meta: PaginationMeta }) {
  if (meta.total === 0) return <span className="text-sm text-slate-500">Nessun risultato</span>;
  return (
    <span className="text-sm text-slate-500">
      {meta.from}-{meta.to} di {meta.total}
    </span>
  );
}

export function PageSizeSelector({ meta, params }: Props) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500">
      <span>Mostra</span>
      <div className="flex gap-1">
        {ALLOWED_PAGE_SIZES.map((size) => (
          <Link
            key={size}
            href={buildPageUrl(params, { pageSize: size, page: 1 })}
            className={clsx(
              "inline-flex h-7 min-w-[2rem] items-center justify-center rounded-lg px-2 text-xs font-semibold",
              meta.pageSize === size
                ? "bg-brand-600 text-white"
                : "border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700",
            )}
          >
            {size}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function PaginationControls({ meta, params }: Props) {
  if (meta.totalPages <= 1) return null;

  const prevUrl = meta.hasPrev ? buildPageUrl(params, { page: meta.page - 1 }) : null;
  const nextUrl = meta.hasNext ? buildPageUrl(params, { page: meta.page + 1 }) : null;

  // Build visible page numbers: always show first, last, current ±1
  const pages = new Set<number>();
  pages.add(1);
  pages.add(meta.totalPages);
  pages.add(meta.page);
  if (meta.page > 1) pages.add(meta.page - 1);
  if (meta.page < meta.totalPages) pages.add(meta.page + 1);
  const sortedPages = [...pages].sort((a, b) => a - b);

  const btnBase = "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-sm font-medium";
  const btnActive = "bg-brand-600 text-white shadow-sm";
  const btnInactive = "border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700";
  const btnDisabled = "border border-slate-100 text-slate-300 cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center gap-1">
      {prevUrl ? (
        <Link href={prevUrl} className={clsx(btnBase, btnInactive)}>
          &lsaquo;
        </Link>
      ) : (
        <span className={clsx(btnBase, btnDisabled)}>&lsaquo;</span>
      )}

      {sortedPages.map((p, i) => {
        const prev = sortedPages[i - 1];
        const showEllipsis = prev !== undefined && p - prev > 1;
        return (
          <span key={p} className="flex items-center gap-1">
            {showEllipsis && <span className="px-1 text-slate-400 text-sm">...</span>}
            <Link
              href={buildPageUrl(params, { page: p })}
              className={clsx(btnBase, p === meta.page ? btnActive : btnInactive)}
            >
              {p}
            </Link>
          </span>
        );
      })}

      {nextUrl ? (
        <Link href={nextUrl} className={clsx(btnBase, btnInactive)}>
          &rsaquo;
        </Link>
      ) : (
        <span className={clsx(btnBase, btnDisabled)}>&rsaquo;</span>
      )}
    </div>
  );
}
