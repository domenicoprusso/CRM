import { clsx } from "clsx";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={clsx("rounded-3xl border border-slate-200 bg-white p-6 shadow-soft", className)}>{children}</section>;
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <Card>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{hint}</p>
    </Card>
  );
}

export function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function SubmitButton({ label }: { label: string }) {
  return <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-brand-700">{label}</button>;
}
