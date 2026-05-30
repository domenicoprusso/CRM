import { ShieldCheck } from "lucide-react";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_40%),linear-gradient(135deg,#f8fafc,#eef2ff)] p-6">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-soft backdrop-blur lg:grid-cols-2">
        <div className="bg-brand-600 p-10 text-white">
          <div className="mb-8 inline-flex rounded-2xl bg-white/15 p-3"><ShieldCheck className="h-8 w-8" /></div>
          <h1 className="text-4xl font-bold tracking-tight">CRM Pro</h1>
          <p className="mt-4 text-lg text-brand-50">Accesso sicuro per team sales, manager e support con ruoli granulari e audit log.</p>
          <div className="mt-10 grid gap-3 text-sm text-brand-50">
            <p>✓ PostgreSQL multi-tenant ready</p>
            <p>✓ Pipeline, import e AI già modellati</p>
            <p>✓ UX responsive per desktop, tablet e mobile</p>
          </div>
        </div>
        <form action="/api/auth/login" method="post" className="p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-600">Bentornato</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-950">Accedi alla dashboard</h2>
          {params.error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Credenziali non valide o utente non attivo.</p> : null}
          <label className="mt-8 block text-sm font-medium text-slate-700">Email</label>
          <input name="email" type="email" required className="mt-2 w-full" placeholder="admin@example.com" />
          <label className="mt-5 block text-sm font-medium text-slate-700">Password</label>
          <input name="password" type="password" required minLength={8} className="mt-2 w-full" placeholder="••••••••" />
          <button className="mt-8 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-soft hover:bg-brand-700">Entra</button>
          <p className="mt-5 text-xs text-slate-500">Seed locale: admin@example.com / ChangeMe123!</p>
        </form>
      </section>
    </main>
  );
}
