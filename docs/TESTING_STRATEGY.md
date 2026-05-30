# Strategia di test del CRM

## Cosa mancava per avere test eseguibili
La prima iterazione aveva schema, UI e API, ma mancavano tre elementi necessari per poter dichiarare il CRM testabile in modo professionale:

1. **Runner e configurazione test**: mancavano script `npm test`, configurazione Vitest e setup DOM per componenti React.
2. **Test unitari iniziali**: mancavano test su RBAC e validazione input, cioè i due punti più critici prima ancora di collegare un database reale.
3. **Piano CI verificabile**: mancava una sequenza standard di controlli per validare Prisma, TypeScript, lint e unit test.

## Livelli di test richiesti

### 1. Smoke test locale
Comandi minimi dopo aver installato le dipendenze:

```bash
npm install
npm run db:generate
npm run db:validate
npm run typecheck
npm run lint
npm run test
```

### 2. Test unitari
Coprono logica isolata senza database:
- RBAC e matrice permessi.
- Schemi Zod per aziende, contatti, lead e login.
- Utility pure future: normalizzazione import, deduplica, scoring lead.

### 3. Test di integrazione
Da aggiungere appena disponibile un PostgreSQL di test:
- Login con credenziali seed.
- CRUD aziende, contatti e lead con isolamento `tenantId`.
- Audit log su create/update/delete.
- Validazione API con input invalidi.

### 4. Test end-to-end
Da attivare con Playwright:
- Login admin.
- Creazione azienda.
- Creazione contatto collegato ad azienda.
- Creazione lead collegato a contatto e azienda.
- Verifica dashboard KPI aggiornati.

### 5. Requisiti CI/CD
La pipeline deve eseguire:

```bash
npm ci
npm run ci
```

Il comando `npm run ci` esegue generazione Prisma, validazione schema, typecheck, lint e unit test.

## Blocco ambiente attuale
Nel container corrente `npm install` non può scaricare `@prisma/client` perché il registry/proxy restituisce `403 Forbidden`. Finché questo blocco resta attivo non è possibile eseguire Vitest, TypeScript, Prisma o build Next.js in questa macchina. I file di test e gli script sono comunque pronti per un ambiente con accesso npm funzionante.
