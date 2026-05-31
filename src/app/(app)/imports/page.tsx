import Link from "next/link";
import { ButtonLink, Card, EmptyState, PageHeader, SubmitButton, Notice } from "@/components/ui";
import { ImportStatusBadge, ImportStatCard } from "@/components/imports";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { importEntityLabels, listImportJobs } from "@/lib/imports";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(value);
}

export default async function ImportsPage() {
  const user = await requireUser("import:read");
  const jobs = await listImportJobs(prisma, user.tenantId);
  const canWrite = can(user.role, "import:write");

  return (
    <>
      <PageHeader title="Import" description="Import CSV TeamSystem con preview, deduplica base e rollback deterministico." />

      <div className="grid gap-4 md:grid-cols-3">
        <ImportStatCard label="Import recenti" value={jobs.length} />
        <ImportStatCard label="Formato" value="CSV" hint="Nessun supporto XLSX in questa fase" />
        <ImportStatCard label="Deduplica" value="ExternalId" hint="Fallback base se l'id esterno non e disponibile" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Nuovo import CSV</h2>
              <p className="mt-1 text-sm text-slate-500">Carica un file per una singola entita. Il sistema genera preview e controlli prima dell&apos;esecuzione.</p>
            </div>
          </div>

          {canWrite ? (
            <form action="/api/imports" method="post" encType="multipart/form-data" className="mt-6 grid gap-4">
              <label className="grid gap-1 text-sm">
                Entita
                <select name="entity" defaultValue="companies">
                  {Object.entries(importEntityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Fonte
                <input name="source" defaultValue="TeamSystem CRM" />
              </label>
              <label className="grid gap-1 text-sm">
                File CSV
                <input name="file" type="file" accept=".csv,text/csv" required />
              </label>
              <SubmitButton label="Carica preview" />
            </form>
          ) : (
            <Notice message="Il tuo ruolo non ha permessi di importazione." tone="error" />
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Cosa serve da TeamSystem</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>Usa CSV separato per azienda, contatto, lead, opportunita, attivita e task.</p>
            <p>Se disponibile, esporta sempre un id esterno stabile per ogni riga.</p>
            <p>Il campo Progetto viene importato come tag strutturato project:&lt;slug&gt;.</p>
            <p>Per contatti, lead e opportunita includi la chiave della relazione padre quando esiste.</p>
            <p>Gli owner TeamSystem legacy vengono ignorati; il CRM usa solo ownerId reale per i record operativi.</p>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Import recenti</h2>
              <p className="text-sm text-slate-500">Preview persistita, stato job e accesso al dettaglio.</p>
            </div>
            <ButtonLink href="/api/imports" variant="primary">
              JSON API
            </ButtonLink>
          </div>

          {jobs.length === 0 ? (
            <div className="mt-4">
              <EmptyState message="Nessun import ancora eseguito." />
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Job</th>
                    <th className="px-4 py-3">Entita</th>
                    <th className="px-4 py-3">Stato</th>
                    <th className="px-4 py-3">Righe</th>
                    <th className="px-4 py-3">Importate</th>
                    <th className="px-4 py-3">Creato</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.map((job) => {
                    const fieldMapping = job.fieldMapping as { entity?: keyof typeof importEntityLabels };
                    return (
                      <tr key={job.id}>
                        <td className="px-4 py-4 font-medium text-slate-950">{job.fileName}</td>
                        <td className="px-4 py-4">{fieldMapping.entity ? importEntityLabels[fieldMapping.entity] : job.source}</td>
                        <td className="px-4 py-4">
                          <ImportStatusBadge status={job.status} />
                        </td>
                        <td className="px-4 py-4">{job.rowsTotal}</td>
                        <td className="px-4 py-4">{job.rowsImported}</td>
                        <td className="px-4 py-4 text-slate-500">{formatDate(job.createdAt)}</td>
                        <td className="px-4 py-4 text-right">
                          <Link href={`/imports/${job.id}`} className="font-medium text-brand-700 hover:text-brand-800">
                            Dettaglio
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
