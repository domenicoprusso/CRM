import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { hasExistingUsers } from "@/lib/registration";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; registered?: string }> }) {
  const [params, registrationDisabled] = await Promise.all([searchParams, hasExistingUsers()]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#e0e7ff,transparent_45%),linear-gradient(135deg,#f7f9fc,#eef2ff)] p-6">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-soft backdrop-blur lg:grid-cols-2">
        <div className="bg-brand-600 p-10 text-white">
          <div className="mb-8 inline-flex rounded-xl bg-white/15 p-3">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Bitcall CRM</h1>
          <p className="mt-4 text-base text-brand-100/80">Il tuo centro di controllo per lead, aziende, attività e pipeline commerciale.</p>
          <div className="mt-10 grid gap-3 text-sm text-brand-100/70">
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Gestione lead e opportunità in un unico posto
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Pipeline visuale e attività per tutto il team
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Report e dashboard aggiornate in tempo reale
            </p>
          </div>
        </div>
        <form action="/api/auth/login" method="post" className="p-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-600">Bentornato</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Accedi al CRM</h2>
          {params.error ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Credenziali non valide o utente non attivo.</p> : null}
          {params.registered ? <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Admin creato. Ora puoi accedere.</p> : null}
          <label className="mt-8 block text-sm font-medium text-slate-700">Email</label>
          <input name="email" type="email" required className="mt-2 w-full" placeholder="nome@azienda.it" />
          <label className="mt-5 block text-sm font-medium text-slate-700">Password</label>
          <input name="password" type="password" required minLength={8} className="mt-2 w-full" placeholder="Password" />
          <button className="mt-8 w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700 active:bg-brand-800">Accedi</button>
          {!registrationDisabled ? (
            <Link href="/register" className="mt-5 inline-flex text-sm font-semibold text-brand-700 hover:text-brand-900">
              Crea il primo admin
            </Link>
          ) : null}
        </form>
      </section>
    </main>
  );
}
