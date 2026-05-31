import { ButtonLink, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { ReportSection, ReportTable } from "@/components/reporting";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getReportSnapshot, parseReportFilters, formatPercentage, reportPeriodLabel } from "@/lib/reports";
import { prisma } from "@/lib/prisma";

function money(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export default async function DashboardPage() {
  const user = await requireUser("dashboard:read");
  const snapshot = await getReportSnapshot(prisma, user.tenantId, parseReportFilters({}));
  const exportEnabled = can(user.role, "reports:export");

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Sintesi manageriale del periodo ${reportPeriodLabel(snapshot.period)}.`}
        action={<ButtonLink href="/reports" variant="primary">Apri report</ButtonLink>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Forecast totale" value={money(snapshot.summary.forecastTotal)} hint="Valore ponderato delle opportunita aperte" />
        <StatCard label="Conversion rate" value={formatPercentage(snapshot.summary.conversionRate)} hint="Lead convertiti in opportunita" />
        <StatCard label="Won rate" value={formatPercentage(snapshot.summary.wonRate)} hint="Opportunita vinte sul totale chiuso" />
        <StatCard label="Lost rate" value={formatPercentage(snapshot.summary.lostRate)} hint="Opportunita perse sul totale chiuso" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ReportSection title="Pipeline per stage" description="Valore e conto delle opportunita aperte per stage.">
          <ReportTable headers={["Stage", "Count", "Valore", "Forecast"]}>
            {snapshot.pipelineRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6">
                  <EmptyState message="Nessuna opportunita aperta nel periodo corrente." />
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
                  <EmptyState message="Nessuna opportunita aperta da aggregare." />
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
        <ReportSection title="Attivita per commerciale" description="Attivita registrate nel periodo corrente.">
          <ReportTable headers={["Commerciale", "Attivita"]}>
            {snapshot.activityRows.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6">
                  <EmptyState message="Nessuna attivita nel periodo corrente." />
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
                  <p className="font-semibold text-slate-950">{opportunity.title}</p>
                  <p className="text-sm text-slate-500">{opportunity.company?.name ?? "N/D"} - {opportunity.owner?.name ?? "N/D"} - {opportunity.stage.name}</p>
                </div>
              ))}
            </div>
          )}
        </ReportSection>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Accesso rapido</h3>
              <p className="text-sm text-slate-500">Vai ai report completi o esporta lo snapshot corrente.</p>
            </div>
            <ButtonLink href="/reports" variant="primary">
              Report completi
            </ButtonLink>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {exportEnabled ? (
              <ButtonLink href="/api/reports/export?entity=summary" variant="primary">
                Export summary
              </ButtonLink>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  );
}
