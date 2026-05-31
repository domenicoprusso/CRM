import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getImportJobDetail, importEntityLabels, importJobStats } from "@/lib/imports";
import { prisma } from "@/lib/prisma";
import { ButtonLink, Card, DangerButton, EmptyState, PageHeader, SubmitButton } from "@/components/ui";
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
          {job.status === "COMPLETED" ? (
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>Righe importate: {job.rowsImported}</p>
              <p>Righe processate: {job.rowsTotal}</p>
              <p>Duplicate: {stats?.duplicate ?? 0}</p>
              <p>Errori: {stats?.invalid ?? 0}</p>
            </div>
          ) : (
            <EmptyState message="Il report finale apparira dopo l&apos;esecuzione dell&apos;import." />
          )}

          {job.errorLog ? (
            <div className="mt-4 rounded-2xl border border-slate-100 p-4 text-sm text-slate-600">
              <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(job.errorLog, null, 2)}</pre>
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}
