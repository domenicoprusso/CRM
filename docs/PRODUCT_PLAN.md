# CRM professionale: analisi e piano tecnico

## 1. Analisi del prodotto
Il prodotto è una web app CRM B2B per uno staff iniziale di 10 persone, progettata per crescere verso un'offerta multi-tenant SaaS. Le aree core sono gestione anagrafiche, lead, pipeline, agenda, importazione dati, documenti, reportistica e assistente AI operativo.

### Obiettivi di business
- Centralizzare clienti, aziende, lead, opportunità e follow-up.
- Ridurre perdita di opportunità tramite reminder, pipeline visibile e priorità giornaliere.
- Rendere l'onboarding da altri CRM sicuro e reversibile.
- Integrare AI come acceleratore operativo, non come sostituto delle decisioni umane.

### Scelte di prodotto
- MVP focalizzato su autenticazione, ruoli, dashboard, contatti, aziende e lead.
- Pipeline, agenda, import e AI progettati nello schema fin dall'inizio per evitare refactor costosi.
- UX orientata a staff commerciale: sidebar stabile, KPI immediati, creazione rapida, liste filtrabili.

## 2. Architettura tecnica
### Stack selezionato
- Frontend: Next.js App Router, React, TypeScript.
- Backend: Next.js Route Handlers e Server Components per MVP, con moduli separati pronti per estrazione in NestJS.
- Database: PostgreSQL.
- ORM: Prisma, scelto per tipizzazione forte, migrazioni e produttività.
- Auth: sessione JWT HTTP-only custom per ridurre lock-in iniziale; compatibile con migrazione futura verso Auth.js/Clerk.
- UI: Tailwind CSS e componenti interni ispirati a shadcn/ui.
- File storage futuro: S3-compatible con metadata in tabella Document.
- AI futura: OpenAI API con audit, logging, prompt template e policy di data minimization.
- Deploy: Docker-ready, Vercel/Render/Fly.io/AWS compatibili.

### Moduli applicativi
- `auth`: login, logout, sessione, ruoli e permessi.
- `crm-core`: aziende, contatti, lead, attività e timeline.
- `sales`: pipeline, opportunità, reminder.
- `agenda`: task, meeting, follow-up e notifiche.
- `imports`: upload, mapping, deduplica, preview, rollback.
- `documents`: metadata file, ricerca e categorizzazione AI.
- `ai`: azioni assistite, report, classificazione e priorità.
- `audit`: log sicurezza e tracciamento modifiche.

## 3. Schema database completo
Lo schema Prisma include tenant, utenti, ruoli, aziende, contatti, lead, pipeline stage, opportunità, attività, task, documenti, import job, import row, interazioni AI e audit log. Ogni entità operativa contiene `tenantId` per isolamento futuro multi-tenant e indici sulle query CRM più frequenti.

## 4. User stories
### Admin
- Come admin voglio creare utenti con ruolo, così posso controllare accessi e responsabilità.
- Come admin voglio audit log delle azioni, così posso verificare modifiche critiche.

### Manager
- Come manager voglio vedere KPI e performance per owner, così posso guidare il team.
- Come manager voglio pipeline e follow-up scaduti, così posso intervenire sulle opportunità a rischio.

### Sales
- Come sales voglio creare lead, contatti e aziende rapidamente, così posso registrare attività senza perdere tempo.
- Come sales voglio vedere timeline e note, così posso prepararmi prima di chiamate e meeting.

### Support
- Come support voglio cercare documenti e storico interazioni, così posso assistere clienti esistenti.

### Viewer
- Come viewer voglio accesso in sola lettura, così posso consultare dati senza modificarli.

## 5. Roadmap MVP
1. Autenticazione, ruoli, dashboard e seed admin.
2. CRUD aziende, contatti e lead con validazione e audit log.
3. Pipeline Kanban con stage personalizzabili.
4. Agenda task/follow-up con reminder email.
5. Import CSV/XLSX/JSON con mapping, deduplica e rollback.
6. AI assistant con azioni CRM controllate e loggate.
7. Report esportabili CSV/PDF e ottimizzazione query.
8. Test end-to-end, hardening sicurezza e pipeline deploy.

## 6. Struttura cartelle progetto
```text
prisma/                 Schema, migrazioni e seed
src/app/                Route, pagine e layout Next.js
src/app/api/            API REST interne
src/components/         UI riutilizzabile e layout shell
src/lib/                Auth, Prisma, validazioni, permessi e audit
docs/                   Decisioni prodotto e architettura
```

## 7. API principali
- `POST /api/auth/login`: autentica utente e imposta cookie sessione.
- `POST /api/auth/logout`: invalida cookie sessione.
- `GET/POST /api/companies`: lista e crea aziende.
- `GET/PATCH/DELETE /api/companies/:id`: dettaglio e modifica aziende.
- `GET/POST /api/contacts`: lista e crea contatti.
- `GET/PATCH/DELETE /api/contacts/:id`: dettaglio e modifica contatti.
- `GET/POST /api/leads`: lista e crea lead.
- `GET/PATCH/DELETE /api/leads/:id`: dettaglio e modifica lead.
- Future: `/api/opportunities`, `/api/tasks`, `/api/imports`, `/api/ai/actions`, `/api/reports`.

## 8. Piano sicurezza
- Password hash con bcrypt.
- Cookie sessione HTTP-only, same-site strict e secure in produzione.
- JWT firmato con `AUTH_SECRET` e scadenza limitata.
- RBAC centralizzato con permessi per ruolo.
- Validazione input con Zod su API e server actions.
- Isolamento dati via `tenantId` su tutte le query.
- Audit log per creazioni, aggiornamenti, eliminazioni e login.
- Preparazione a rate limiting e protezione brute-force su login.
- Data minimization per prompt AI e logging controllato.

## 9. Piano importazione dati
- Upload file in storage temporaneo.
- Parsing CSV/XLSX/JSON in job asincrono.
- Profilazione colonne e suggerimento mapping tramite euristiche e AI.
- Normalizzazione email, telefoni, country e tag.
- Preview con errori, duplicati e record mergiabili.
- Import transazionale a batch con `rollbackToken`.
- Log riga per riga in `ImportRow`.
- Connettori futuri: HubSpot, Salesforce, Pipedrive e Zoho tramite adapter dedicati.

## 10. Piano integrazione AI
- Azioni AI come tool espliciti: summary cliente, follow-up, email draft, pipeline risk, inactive customers, lead scoring e import mapping.
- Prompt template versionati e testabili.
- Contesto minimo necessario per ogni azione.
- Salvataggio in `AiInteraction` di prompt sintetico, risposta e metadata per audit.
- Human-in-the-loop per email, import e aggiornamenti CRM.
- Guardrail: niente modifiche distruttive automatiche, output strutturato JSON quando serve automazione.
