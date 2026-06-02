import { clsx } from "clsx";
import Link from "next/link";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={clsx("rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-soft", className)}>{children}</section>;
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <Card>
      <p className="text-4xl font-bold tabular-nums text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-3 text-sm text-slate-500">{hint}</p>
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

export function SubmitButton({ label, className }: { label: string; className?: string }) {
  return <button className={clsx("rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-brand-700", className)}>{label}</button>;
}

export function SecondaryButton({ label, className }: { label: string; className?: string }) {
  return <button className={clsx("rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-200 hover:text-brand-700", className)}>{label}</button>;
}

export function DangerButton({ label, className }: { label: string; className?: string }) {
  return <button className={clsx("rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-red-700", className)}>{label}</button>;
}

export function ButtonLink({ href, children, variant = "secondary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-soft",
        variant === "primary" ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:text-brand-700",
      )}
    >
      {children}
    </Link>
  );
}

export function Badge({ children, tone = "brand" }: { children: React.ReactNode; tone?: "brand" | "slate" | "amber" | "red" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
  };
  return <span className={clsx("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function Notice({ message, tone = "slate" }: { message?: string; tone?: "slate" | "success" | "error" }) {
  if (!message) return null;
  const tones = {
    slate: "border-slate-200 bg-white text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-red-700",
  };
  return <p className={clsx("mb-4 rounded-xl border px-4 py-3 text-sm", tones[tone])}>{message}</p>;
}

export function EmptyState({ message }: { message: string }) {
  return <p className="py-3 px-1 text-sm text-slate-400">{message}</p>;
}

export function FieldValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-medium text-slate-900">{value || "N/D"}</div>
    </div>
  );
}
