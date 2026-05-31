import { Badge, ButtonLink, Card, EmptyState, PageHeader, StatCard, SubmitButton } from "@/components/ui";
import { ReportSection, ReportTable } from "@/components/reporting";
import { requireUser } from "@/lib/auth";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { can } from "@/lib/permissions";
import { getReportSnapshot, parseReportFilters, reportPeriodLabel, formatPercentage } from "@/lib/reports";
import { prisma } from "@/lib/prisma";

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function money(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const user = await requireUser("reports:read");
  const params = await searchParams;
  const filters = parseReportFilters(params);
  const snapshot = await getReportSnapshot(prisma, user.tenantId, filters);
  const canExport = can(user.role, "reports:export");
  const fromInput = readParam(params, "from") ?? dateInputValue(filters.from);
  const toInput = readParam(params, "to") ?? dateInputValue(readParam(params, "to") ? new Date(filters.to.getTime() - 24 * 60 * 60 * 1000) : new Date());
  const ownerOptions = [{ id: "", name: "Tutti" }, ...snapshot.users];
  const exportParams = new URLSearchParams({
    from: fromInput,
    to: toInput,
    ...(readParam(params, "ownerId") ? { ownerId: readParam(params, "ownerId")! } : {}),
    ...(readParam(params, "tag") ? { tag: readParam(params, "tag")! } : {}),
    ...(readParam(params, "project") ? { project: readParam(params, "project")! } : {}),
  });

  return (
    <>
      <PageHeader
        title="Report"
        description={`Dashboard manageriale del periodo ${reportPeriodLabel(snapshot.period)}.`}
        action={canExport ? <ButtonLink href={`/api/reports/export?entity=summary&${exportParams.toString()}`} variant="primary">Export CSV</ButtonLink> : undefined}
      />

      <Card className="mb-6">
        <form method="get" className="grid gap-3 xl:grid-cols-[180px_180px_1fr_1fr_1fr_auto_auto] xl:items-end">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dal
            <input name="from" type="date" defaultValue={fromInput} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Al
            <input name="to" type="date" defaultValue={toInput} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Commerciale
            <select name="ownerId" defaultValue={readParam(params, "ownerId") ?? ""}>
              {ownerOptions.map((owner) => (
                <option key={owner.id || "all"} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tag
            <input name="tag" defaultValue={readParam(params, "tag") ?? ""} placeholder="Scuole, enterprise..." />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Progetto
            <input name="project" defaultValue={readParam(params, "project") ?? ""} placeholder="Scuole Roma" />
          </label>
          <ButtonLink href="/reports">Reset</ButtonLink>
          <SubmitButton label="Aggiorna" />
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Forecast totale" value={money(snapshot.summary.forecastTotal)} hint="Valore ponderato delle opportunita aperte" />
        <StatCard label="Conversion rate" value={formatPercentage(snapshot.summary.conversionRate)} hint="Opportunity create da lead sul periodo" />
        <StatCard label="Won rate" value={formatPercentage(snapshot.summary.wonRate)} hint="Quota chiuse vinte sul totale chiuso" />
        <StatCard label="Lost rate" value={formatPercentage(snapshot.summary.lostRate)} hint="Quota chiuse perse sul totale chiuso" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ReportSection title="Pipeline per stage" description="Valore e conteggio delle opportunita aperte per stage.">
          <ReportTable headers={["Stage", "Count", "Valore", "Forecast"]}>
            {snapshot.pipelineRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6">
                  <EmptyState message="Nessun dato pipeline nel periodo selezionato." />
                </td>
              </tr>
            ) : (
              snapshot.pipelineRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-4 font-semibold text-slate-950">{row.name}</td>
                  <td className="px-4 py-4">{row.count}</td>
                  <td className="px-4 py-4">{money(row.value)}</td>
                  <td className="px-4 py-4">{money(row.weightedValue)}</td>
                </tr>
              ))
            )}
          </ReportTable>
        </ReportSection>

        <ReportSection title="Forecast per commerciale" description="Forecast totale e ponderato per owner.">
          <ReportTable headers={["Commerciale", "Opp.", "Valore", "Forecast"]}>
            {snapshot.forecastRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6">
                  <EmptyState message="Nessuna opportunita aperta nel periodo selezionato." />
                </td>
              </tr>
            ) : (
              snapshot.forecastRows.map((row) => (
                <tr key={row.ownerId ?? "unassigned"}>
                  <td className="px-4 py-4 font-semibold text-slate-950">{row.ownerName}</td>
                  <td className="px-4 py-4">{row.count}</td>
                  <td className="px-4 py-4">{money(row.value)}</td>
                  <td className="px-4 py-4">{money(row.weightedValue)}</td>
                </tr>
              ))
            )}
          </ReportTable>
        </ReportSection>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ReportSection title="Attivita per commerciale" description="Numero di attivita registrate nel periodo.">
          <ReportTable headers={["Commerciale", "Attivita"]}>
            {snapshot.activityRows.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6">
                  <EmptyState message="Nessuna attivita nel periodo selezionato." />
                </td>
              </tr>
            ) : (
              snapshot.activityRows.map((row) => (
                <tr key={row.ownerId ?? "unassigned"}>
                  <td className="px-4 py-4 font-semibold text-slate-950">{row.ownerName}</td>
                  <td className="px-4 py-4">{row.count}</td>
                </tr>
              ))
            )}
          </ReportTable>
        </ReportSection>

        <ReportSection title="Task scaduti per owner" description="Task aperti con scadenza superata.">
          <ReportTable headers={["Commerciale", "Task"]}>
            {snapshot.overdueTaskRows.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6">
                  <EmptyState message="Nessun task scaduto." />
                </td>
              </tr>
            ) : (
              snapshot.overdueTaskRows.map((row) => (
                <tr key={row.ownerId ?? "unassigned"}>
                  <td className="px-4 py-4 font-semibold text-slate-950">{row.ownerName}</td>
                  <td className="px-4 py-4">{row.count}</td>
                </tr>
              ))
            )}
          </ReportTable>
        </ReportSection>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ReportSection title="Opportunita senza next action" description="Opportunita aperte senza alcun task aperto associato.">
          {snapshot.opportunitiesWithoutNextAction.length === 0 ? (
            <EmptyState message="Nessuna opportunita scoperta." />
          ) : (
            <div className="space-y-3">
              {snapshot.opportunitiesWithoutNextAction.map((opportunity) => (
                <div key={opportunity.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">{opportunity.title}</p>
                    <Badge tone="slate">{opportunity.stage.name}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{opportunity.company?.name ?? "N/D"} - {opportunity.owner?.name ?? "N/D"}</p>
                </div>
              ))}
            </div>
          )}
        </ReportSection>

        <ReportSection title="Export CSV base" description="Scarica i dati in formato CSV per analisi esterne.">
          {canExport ? (
            <div className="flex flex-wrap gap-3">
              <ButtonLink href={`/api/reports/export?entity=summary&${exportParams.toString()}`} variant="primary">
                Export summary
              </ButtonLink>
              <ButtonLink href={`/api/reports/export?entity=opportunities&${exportParams.toString()}`}>Export opportunita</ButtonLink>
              <ButtonLink href={`/api/reports/export?entity=leads&${exportParams.toString()}`}>Export lead</ButtonLink>
              <ButtonLink href={`/api/reports/export?entity=contacts&${exportParams.toString()}`}>Export contatti</ButtonLink>
              <ButtonLink href={`/api/reports/export?entity=companies&${exportParams.toString()}`}>Export aziende</ButtonLink>
            </div>
          ) : (
            <EmptyState message="Il tuo ruolo non ha accesso all'export." />
          )}
        </ReportSection>
      </div>
    </>
  );
}
