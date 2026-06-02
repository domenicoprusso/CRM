export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-600">404</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">Pagina non trovata</h1>
        <p className="mt-4 text-sm text-slate-600">La risorsa richiesta non esiste o non e disponibile.</p>
        <a href="/dashboard" className="mt-8 inline-flex rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-soft hover:bg-brand-700">
          Torna alla dashboard
        </a>
      </section>
    </main>
  );
}
