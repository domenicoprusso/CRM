import Link from "next/link";
import { LockKeyhole, ShieldCheck, UserPlus } from "lucide-react";
import { hasExistingUsers } from "@/lib/registration";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string; disabled?: string }> }) {
  const [params, registrationDisabled] = await Promise.all([searchParams, hasExistingUsers()]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_40%),linear-gradient(135deg,#f8fafc,#eef2ff)] p-6">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-soft backdrop-blur lg:grid-cols-2">
        <div className="bg-brand-600 p-10 text-white">
          <div className="mb-8 inline-flex rounded-2xl bg-white/15 p-3">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">CRM Pro</h1>
          <p className="mt-4 text-lg text-brand-50">Configura il primo accesso amministratore.</p>
          <div className="mt-10 grid gap-3 text-sm text-brand-50">
            <p className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Primo utente con ruolo ADMIN
            </p>
            <p className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4" />
              Password protetta con hash
            </p>
          </div>
        </div>

        {registrationDisabled ? (
          <div className="p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-600">Setup completato</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950">Registrazione disabilitata</h2>
            <p className="mt-4 text-sm text-slate-600">Usa la pagina di login per accedere al CRM.</p>
            <Link href="/login" className="mt-8 inline-flex w-full justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-soft hover:bg-brand-700">
              Vai al login
            </Link>
          </div>
        ) : (
          <form action="/api/auth/register" method="post" className="p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-600">Setup iniziale</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950">Crea il primo admin</h2>
            {params.error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Controlla nome, email e password.</p> : null}
            {params.disabled ? <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">Registrazione disabilitata</p> : null}
            <label className="mt-8 block text-sm font-medium text-slate-700">Nome</label>
            <input name="name" type="text" required minLength={2} maxLength={80} className="mt-2 w-full" placeholder="Admin CRM" />
            <label className="mt-5 block text-sm font-medium text-slate-700">Email</label>
            <input name="email" type="email" required className="mt-2 w-full" placeholder="admin@example.com" />
            <label className="mt-5 block text-sm font-medium text-slate-700">Password</label>
            <input name="password" type="password" required minLength={8} maxLength={128} className="mt-2 w-full" placeholder="Minimo 8 caratteri" />
            <button className="mt-8 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-soft hover:bg-brand-700">Crea admin</button>
            <Link href="/login" className="mt-5 inline-flex text-sm font-semibold text-brand-700 hover:text-brand-900">
              Torna al login
            </Link>
          </form>
        )}
      </section>
    </main>
  );
}
