# CRM Pro

CRM professionale in Next.js, TypeScript, Prisma e PostgreSQL per gestione utenti, aziende, contatti, lead, pipeline futura, import dati e AI assistant.

## Setup locale

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Credenziali seed: `admin@example.com` / `ChangeMe123!`.

## Moduli implementati in questa iterazione
- Schema database completo e multi-tenant ready.
- Autenticazione JWT HTTP-only con ruoli RBAC.
- Dashboard protetta con KPI.
- CRUD iniziale per aziende, contatti e lead via UI e API REST.
- Audit log sulle azioni principali.

## Testing

La suite iniziale include Vitest per test unitari e script CI per validare Prisma, TypeScript, lint e test:

```bash
npm install
npm run db:generate
npm run db:validate
npm run typecheck
npm run lint
npm run test
```

Vedi `docs/TESTING_STRATEGY.md` per il piano completo di smoke test, unit test, integrazione, end-to-end e CI/CD.
