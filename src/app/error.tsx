"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-600">Errore</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">Qualcosa non ha funzionato</h1>
        <p className="mt-4 text-sm text-slate-600">Riprova o torna alla dashboard.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-soft hover:bg-brand-700">
            Riprova
          </button>
          <a href="/dashboard" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Dashboard
          </a>
        </div>
      </section>
    </main>
  );
}
