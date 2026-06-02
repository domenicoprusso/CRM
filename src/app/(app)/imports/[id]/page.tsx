import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getImportJobDetail, importEntityLabels, importJobExecutionStats, importJobStats } from "@/lib/imports";
import { prisma } from "@/lib/prisma";
import { Badge, ButtonLink, Card, DangerButton, EmptyState, PageHeader, SubmitButton } from "@/components/ui";
import { ImportPreviewTable, ImportStatCard, ImportStatusBadge } from "@/components/imports";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(value);
}

export default async function ImportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("import:read");
  const { id } = await params;
  const job = await getImportJobDetail(prisma, user.tenantId, id);
  if (!job) notFound();

  const fieldMapping = job.fieldMapping as { entity?: keyof typeof importEntityLabels; mapping?: Record<string, string>; delimiter?: string; headers?: string[] };
  const previewRows = job.rows.map((row) => ({
    rowNumber: row.rowNumber,
    rawData: row.rawData as Record<string, string>,
    normalizedData: row.normalizedData as Record<string, unknown>,
    errors: (row.errors as string[] | null) ?? null,
  }));
  const executionStats = job.status === "PREVIEWED" ? null : importJobExecutionStats({
    rowsTotal: job.rowsTotal,
    rowsImported: job.rowsImported,
    rows: job.rows.map((row) => ({
      rowNumber: row.rowNumber,
      normalizedData: row.normalizedData as Record<string, unknown>,
      importedEntity: row.importedEntity,
      importedEntityId: row.importedEntityId,
    })),
  });
  const stats = importJobStats({
    rowsTotal: job.rowsTotal,
    rowsImported: job.rowsImported,
    rows: previewRows.map((row) => ({ normalizedData: row.normalizedData })),
  });
  const canWrite = can(user.role, "import:write");
  const canRollback = can(user.role, "import:rollback");
  const isPreview = job.status === "PREVIEWED";
  const canExecute = canWrite && isPreview;
  const canRollbackJob = canRollback && job.status === "COMPLETED";

  return (
    <>
      <PageHeader
        title={job.fileName}
        description={`Import ${fieldMapping.entity ? importEntityLabels[fieldMapping.entity] : job.source} creato il ${formatDate(job.createdAt)}.`}
        action={<ButtonLink href="/imports">Torna agli import</ButtonLink>}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <ImportStatCard label="Righe totali" value={stats?.total ?? 0} />
        <ImportStatCard label="Valide" value={stats?.valid ?? 0} />
        <ImportStatCard label="Duplicate" value={stats?.duplicate ?? 0} />
        <ImportStatCard label="Errate" value={stats?.invalid ?? 0} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Stato job</h2>
              <p className="text-sm text-slate-500">Esegui l&apos;import solo dopo avere verificato preview, duplicati ed errori.</p>
            </div>
            <ImportStatusBadge status={job.status} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fonte</p>
              <p className="mt-1 text-sm text-slate-950">{job.source}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mapping</p>
              <p className="mt-1 text-sm text-slate-950">{fieldMapping.entity ? importEntityLabels[fieldMapping.entity] : "N/D"}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {canExecute ? (
              <form action={`/api/imports/${job.id}/execute`} method="post">
                <SubmitButton label="Esegui import" />
              </form>
            ) : null}
            {canRollbackJob ? (
              <form action={`/api/imports/${job.id}/rollback`} method="post">
                <DangerButton label="Rollback" />
              </form>
            ) : null}
          </div>

          {job.rollbackToken ? (
            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              Token rollback: <span className="font-mono">{job.rollbackToken}</span>
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Dettagli mapping</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            {fieldMapping.headers?.length ? <p>Colonne rilevate: {fieldMapping.headers.join(", ")}</p> : null}
            {fieldMapping.mapping ? <p>Campi mappati: {Object.entries(fieldMapping.mapping).map(([key, value]) => `${key}=${value}`).join(" | ")}</p> : null}
            <p>Separatore: {fieldMapping.delimiter ?? ","}</p>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Preview righe</h2>
              <p className="text-sm text-slate-500">Le righe duplicate o non valide non verranno importate.</p>
            </div>
          </div>
          <div className="mt-4">
            <ImportPreviewTable rows={previewRows} />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Report finale</h2>
          {job.status === "PREVIEWED" ? (
            <EmptyState message="Il report finale apparira dopo l&apos;esecuzione dell&apos;import." />
          ) : executionStats ? (
            <div className="mt-4 space-y-4 text-sm text-slate-600">
              <div className="grid gap-4 md:grid-cols-4">
                <ImportStatCard label="Importate" value={executionStats.created} />
                <ImportStatCard label="Saltate" value={executionStats.skipped} />
                <ImportStatCard label="Duplicate esistenti" value={executionStats.duplicateExisting} />
                <ImportStatCard label="Duplicate file" value={executionStats.duplicateInFile} />
              </div>

              {executionStats.skippedRows.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Riga</th>
                        <th className="px-4 py-3">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {executionStats.skippedRows.map((row) => (
                        <tr key={`${row.rowNumber}-${row.reason}`}>
                          <td className="px-4 py-3 font-medium text-slate-950">{row.rowNumber}</td>
                          <td className="px-4 py-3">
                            <Badge tone={row.reason === "invalid" ? "red" : "amber"}>{row.reason}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {job.status === "FAILED" ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  Import non completato: nessuna riga e stata creata nonostante fossero presenti righe valide.
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState message="Il report finale non e disponibile." />
          )}

          {job.status === "FAILED" && job.errorLog ? (
            <div className="mt-4 rounded-2xl border border-slate-100 p-4 text-sm text-slate-600">
              <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(job.errorLog, null, 2)}</pre>
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}
