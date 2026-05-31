import { ImportStatus } from "@prisma/client";
import { Badge, Card, EmptyState } from "@/components/ui";

export function ImportStatusBadge({ status }: { status: ImportStatus }) {
  const tone =
    status === "COMPLETED"
      ? "brand"
      : status === "FAILED"
        ? "red"
        : status === "ROLLED_BACK"
          ? "slate"
          : status === "IMPORTING"
            ? "amber"
            : status === "PREVIEWED"
              ? "brand"
              : "slate";

  return <Badge tone={tone}>{status}</Badge>;
}

export function ImportStatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
    </Card>
  );
}

export function ImportPreviewTable({
  rows,
}: {
  rows: Array<{
    rowNumber: number;
    rawData: Record<string, string>;
    normalizedData: Record<string, unknown>;
    errors: string[] | null;
  }>;
}) {
  if (rows.length === 0) {
    return <EmptyState message="Nessuna riga disponibile." />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Riga</th>
            <th className="px-4 py-3">Stato</th>
            <th className="px-4 py-3">Dati normalizzati</th>
            <th className="px-4 py-3">Errori</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const meta = row.normalizedData.meta as { state?: string } | undefined;
            const status = meta?.state ?? "valid";
            const tone = status === "valid" || status === "imported" ? "brand" : status === "duplicate" ? "amber" : "red";
            return (
              <tr key={row.rowNumber}>
                <td className="px-4 py-3 font-medium text-slate-950">{row.rowNumber}</td>
                <td className="px-4 py-3">
                  <Badge tone={tone}>{status}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">{JSON.stringify(row.normalizedData)}</td>
                <td className="px-4 py-3 text-slate-600">{row.errors?.length ? row.errors.join(", ") : "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
