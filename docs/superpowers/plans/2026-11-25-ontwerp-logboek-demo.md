# Ontwerp logboek — Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een werkende demo (release 0) van het Ontwerp logboek: inbox, registraties met workflow, OTL-objecten met import per fase, rapporttabellen met export en revisie-snapshots, met fictieve data en rolwissel.

**Architecture:** Next.js App Router-app. Alle domeinlogica zit in `src/domain/*` als pure TypeScript-functies die een Drizzle-database meekrijgen; UI gebruikt server actions die alleen domeinfuncties aanroepen. Database is PostgreSQL via Drizzle: lokaal en in tests PGlite (Postgres in-process), in hosting Supabase via `DATABASE_URL`. Rechten worden in de domeinlaag afgedwongen (`src/domain/rechten.ts`); RLS volgt in release 1.

**Tech Stack:** Next.js 15 (App Router) + TypeScript (strict), Tailwind CSS 4, Drizzle ORM + drizzle-kit, `@electric-sql/pglite` (dev/test) en `postgres` (productie), Zod, Vitest, Playwright (één smoke-test), `docx` (Word-export), `exceljs` (Excel), `papaparse` (CSV), `@anthropic-ai/sdk` (optioneel AI-voorstel).

**Spec:** `docs/superpowers/specs/2026-11-25-ontwerp-logboek-design.md` (levend: https://claude.ai/artifact/TyH6oJo4hTUVrhvQ8BwFGE)

## Global Constraints

- Alle UI-teksten in het Nederlands; termen exact als in de spec: Melding, Issue, Afwijking, Wijziging, Ontwerpkeuze, Raakvlakafspraak, Ontwerpleider (OL), Ontwerpcoördinator (OC), Teamlid.
- Nummering per project, 4 cijfers: `M-0001` (melding), `IS-`, `AF-`, `WZ-`, `OK-`, `RV-`.
- Statussen exact: Issue `open | in_behandeling | opgelost | vervallen`; AF/WZ/OK `concept | ter_goedkeuring | goedgekeurd | afgewezen | verwerkt | vervangen`; RV `concept | afgestemd | verwerkt | vastgesteld | vervangen`; Melding `nieuw | omgezet | samengevoegd | vervallen`. Labels in UI: "Open", "In behandeling", "Ter goedkeuring", enz.
- Koppelen alleen op niveau 0–3. Raakvlakkanten altijd hetzelfde niveau.
- Elke mutatie schrijft een `historie`-regel (wie, wanneer, actie, oud, nieuw). Geen mutatie buiten `src/domain`.
- Goedgekeurd/afgestemd = bevroren: inhoudsvelden alleen nog wijzigbaar door OL als 'tekstcorrectie' (gelogd met actie `tekstcorrectie`).
- Opsteller (`aangemaakt_door`) mag niet zelf goedkeuren; OC alleen goedkeuren met actieve delegatie.
- Inbox-signaal: melding `nieuw` langer dan 5 werkdagen (ma–vr), instelbaar per project (`projecten.inbox_signaal_werkdagen`, default 5).
- Huisstijl: navy `#004168`, blauw `#0077BC`, mint `#38D6B2`; Tailwind-tokens `navy`, `blauw`, `mint`.
- Alleen fictieve data. Geen Microsoft-login in de demo: gebruiker kiezen via cookie `demo_gebruiker`.
- AI-model: `claude-opus-5-5`, effort `low`. Zonder `ANTHROPIC_API_KEY` of bij fout/refusal: heuristisch voorstel. De app werkt volledig zonder AI.
- Geen commits pushen; lokale commits per taak.

## Review Focus

1. **Typekoppeling + doortellen dubbel tellen:** een registratie die zowel via exemplaar als via type op hetzelfde object valt, verschijnt één keer per overzicht/rapport. → test in Task 5.
2. **Import met wees-objecten:** CSV-regel met onbekende `ouder_code` of niveau-sprong (niveau 3 onder niveau 1) moet een leesbare importfout geven, niet half importeren. → test in Task 2.
3. **Herkoppelen na split:** registratie op een verdwenen object blijft bestaan, verliest geen andere koppelingen, en staat op 'Te herkoppelen' tot ze verplaatst is. → test in Task 2.
4. **Bevroren registratie via omweg wijzigen:** objectkoppelingen of velden van een goedgekeurde registratie wijzigen via een update-actie moet geweigerd worden (behalve OL-tekstcorrectie). → test in Task 6.
5. **Snellevoer `#as-1` dubbelzinnig:** meerdere objecten matchen → geen object gekozen, maar kandidaten teruggeven. → test in Task 4.

---

## File Structure

```
ontwerp-logboek/
  package.json, tsconfig.json, next.config.ts, drizzle.config.ts, vitest.config.ts, playwright.config.ts
  src/db/schema.ts            tabellen en enums
  src/db/client.ts            getDb(): PGlite (DATABASE_URL leeg) of postgres-js
  src/db/test-db.ts           maakTestDb(): verse PGlite + migraties
  drizzle/                    gegenereerde migraties
  src/domain/types.ts         gedeelde TS-typen (Rol, RegistratieType, Status-unions, Actor)
  src/domain/historie.ts      logHistorie()
  src/domain/nummering.ts     volgendNummer()
  src/domain/rechten.ts       rolVan(), magX()-checks
  src/domain/objecten.ts      boom-queries
  src/domain/import.ts        parse, diff, toepassen, herkoppelen
  src/domain/meldingen.ts     melden, snelinvoer, omzetten, samenvoegen, vervallen
  src/domain/registraties.ts  aanmaken, bijwerken, koppelen, scope-queries
  src/domain/velden.ts        Zod-schema's per type (details)
  src/domain/workflow.ts      statusovergangen AF/WZ/OK/IS
  src/domain/raakvlakken.ts   kanten, afstemmen, verwerken, eindoordeel
  src/domain/fasen.ts         faseovergang, vervangen, vervangen-blok
  src/domain/rapport.ts       selectie per document, revisie-snapshot, diff
  src/domain/export.ts        docx en xlsx
  src/domain/signalen.ts      mijnWerk(), signalen()
  src/domain/ai.ts            stelVoor()
  src/seed/demo.ts            demodata; src/seed/data/*.csv
  src/app/...                 UI (Task 11–14)
  tests/domain/*.test.ts      Vitest; tests/e2e/demo.spec.ts
```

---

### Task 1: Project-opzet, schema en testdatabase

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `drizzle.config.ts`, `vitest.config.ts`, `.gitignore`, `src/db/schema.ts`, `src/db/client.ts`, `src/db/test-db.ts`, `src/domain/types.ts`, `src/domain/historie.ts`, `src/domain/nummering.ts`, `src/domain/rechten.ts`
- Test: `tests/domain/basis.test.ts`

**Interfaces:**
- Produces:
  - `type Db` (Drizzle PGlite/postgres-js gemeenschappelijk type), `maakTestDb(): Promise<Db>`, `getDb(): Promise<Db>`
  - `type RegistratieType = 'issue'|'afwijking'|'wijziging'|'ontwerpkeuze'|'raakvlak'`; `PREFIX: Record<RegistratieType|'melding', string>` = `{melding:'M', issue:'IS', afwijking:'AF', wijziging:'WZ', ontwerpkeuze:'OK', raakvlak:'RV'}`
  - `type Rol = 'teamlid'|'ontwerpcoordinator'|'ontwerpleider'`; `type Actor = { gebruikerId: string; projectId: string }`
  - `volgendNummer(db, projectId, soort: RegistratieType|'melding'): Promise<string>` → `"AF-0001"`
  - `logHistorie(db, { projectId, gebruikerId, entiteit: 'melding'|'registratie'|'object'|'document', entiteitId, actie: string, oud?: unknown, nieuw?: unknown }): Promise<void>`
  - `rolVan(db, actor): Promise<Rol|null>`; `magBeoordelen(db, actor): Promise<boolean>` (OL of OC); `magGoedkeuren(db, actor, registratie: {aangemaaktDoor: string}): Promise<{ok: true}|{ok:false; reden: string}>` (OL, of OC met actieve delegatie; nooit opsteller); `isOntwerpleider(db, actor): Promise<boolean>`

Schema-tabellen (kolommen in snake_case, ids `uuid` default random):
- `gebruikers(id, naam, email)`; `projecten(id, naam, nummer, actieve_fase_id, inbox_signaal_werkdagen int default 5)`; `fasen(id, project_id, code text 'SO'|'VO'|'DO'|'UO', volgorde int)`
- `projectleden(project_id, gebruiker_id, rol)`; `delegaties(project_id, gebruiker_id, actief bool, sinds)`
- `nummerteller(project_id, soort, laatste int)` PK (project_id, soort)
- `object_imports(id, project_id, fase_id, bestandsnaam, uitgevoerd_door, uitgevoerd_op)`
- `objecten(id, project_id, code, naam, niveau int, objecttype, toepassing, locatie, ouder_id null, extern bool, eigenaar_organisatie null, eigenaar_id null (gebruiker), actief bool default true, laatste_import_id)` unique (project_id, code)
- `meldingen(id, project_id, nummer, titel, omschrijving, fase_id, status, bron_soort 'waarneming'|'mail'|'overleg'|'document'|'ontwerppeil', bron_ref text null, gemeld_door, gemeld_op, vervallen_reden null, beoordeeld_door null)`; `melding_objecten(melding_id, object_id)`
- `registraties(id, project_id, type, nummer, titel, omschrijving, fase_id, status, discipline null, eigenaar_id null, aangemaakt_door, aangemaakt_op, details jsonb, goedgekeurd_door null, goedgekeurd_onder_delegatie bool, goedgekeurd_op null, afwijs_toelichting null, verwerkt_door null, verwerkt_op null, vervangen_door_id null)`
- `registratie_koppelingen(id, registratie_id, soort 'exemplaar'|'type', object_id null, objecttype null, toepassing null, bereik_object_id null /* null = heel project */, te_herkoppelen bool default false)`
- `registratie_relaties(van_id, naar_id, soort 'vervangt'|'lost_op'|'gerelateerd'|'verfijnt')`; `registratie_bronnen(registratie_id, melding_id)`
- `raakvlak_kanten(id, registratie_id, object_id, verantwoordelijke_id, afgestemd_op null, afgestemd_bron null, verwerkt_op null)`
- `documenten(id, project_id, nummer, titel, discipline, revisie, status, fase_id)`; `document_objecten(document_id, object_id)`
- `document_uitsluitingen(document_id, registratie_id, reden, door, op)`
- `rapport_snapshots(id, document_id, revisie, vastgelegd_door, vastgelegd_op, inhoud jsonb)` (inhoud = per registratie: id, nummer, status, versie-hash, kolomwaarden)
- `historie(id, project_id, gebruiker_id, entiteit, entiteit_id, actie, oud jsonb, nieuw jsonb, op timestamptz default now())`

- [ ] **Step 1: Scaffold** — `npx create-next-app@15 . --ts --tailwind --app --src-dir --eslint --use-npm --no-import-alias`, add deps listed in Tech Stack, `git init` is al gedaan. Scripts: `test` = `vitest run`, `db:generate` = `drizzle-kit generate`, `seed` = `tsx src/seed/demo.ts`, `e2e` = `playwright test --trace off`.
- [ ] **Step 2: Write failing tests** in `tests/domain/basis.test.ts`:
  - `volgendNummer geeft AF-0001 dan AF-0002, los per soort en project` (IS-0001 ongemoeid, tweede project begint weer op AF-0001)
  - `logHistorie schrijft een regel met oud en nieuw`
  - `magGoedkeuren`: OL ok; OL die zelf opsteller is → `{ok:false, reden:'Opsteller mag niet zelf goedkeuren'}`; OC zonder delegatie → `{ok:false, reden:'Geen delegatie'}`; OC met delegatie ok; teamlid → `{ok:false, reden:'Geen bevoegdheid'}`
- [ ] **Step 3: Run** `npm test` — Expected: FAIL (modules ontbreken).
- [ ] **Step 4: Implement** schema, `db:generate`, `client.ts`, `test-db.ts` (PGlite in-memory + `migrate` uit `drizzle-orm/pglite/migrator`), `nummering.ts` (upsert op `nummerteller` in één statement met `returning`), `historie.ts`, `rechten.ts`.
- [ ] **Step 5: Run** `npm test` — Expected: PASS.
- [ ] **Step 6: Commit** `feat: projectopzet, schema en basisdomein`

---

### Task 2: Objectboom en import per fase

**Files:**
- Create: `src/domain/objecten.ts`, `src/domain/import.ts`
- Test: `tests/domain/import.test.ts`, fixtures `tests/fixtures/so.csv`, `tests/fixtures/do.csv`

**Interfaces:**
- Consumes: `Db`, `logHistorie`, `isOntwerpleider`
- Produces:
  - CSV-kolommen (header exact): `code;naam;niveau;objecttype;toepassing;locatie;ouder_code;extern;eigenaar_organisatie` (scheidingsteken `;`, `extern` = `ja|nee`)
  - `type ImportRegel = { code; naam; niveau: 0|1|2|3; objecttype; toepassing; locatie; ouderCode: string|null; extern: boolean; eigenaarOrganisatie: string|null }`
  - `parseObjectCsv(tekst: string): { regels: ImportRegel[]; fouten: string[] }` — fouten o.a. `Regel 7: onbekende ouder_code "X"`, `Regel 9: niveau 3 kan niet direct onder niveau 1`, `Regel 4: niveau 4 wordt niet ondersteund (alleen 0–3)`, dubbele code.
  - `type ImportDiff = { nieuw: ImportRegel[]; gewijzigd: {code; velden: string[]}[]; verdwenen: {code; naam; aantalKoppelingen: number}[] }`
  - `vergelijkImport(db, projectId, regels): Promise<ImportDiff>`
  - `voerImportUit(db, actor, faseId, bestandsnaam, regels): Promise<{ importId: string; teHerkoppelen: number }>` — alleen OL; upsert op code; verdwenen → `actief=false` en hun exemplaarkoppelingen `te_herkoppelen=true`; alles in één transactie; eigenaar blijft behouden bij bestaande codes.
  - `teHerkoppelen(db, projectId): Promise<{koppelingId; registratieId; nummer; objectCode; objectNaam; voorstellen: {objectId; code; naam}[]}[]>` — voorstel = actieve objecten waarvan de naam het laatste locatie-woord of de naam deelt, plus kinderen van de ouder van het verdwenen object.
  - `herkoppel(db, actor, koppelingId, nieuwObjectId): Promise<void>`
  - `voorouders(db, objectId): Promise<string[]>`, `nakomelingen(db, objectId): Promise<string[]>` (recursieve CTE, inclusief zichzelf niet), `objectBoom(db, projectId): Promise<ObjectKnoop[]>` met `ObjectKnoop = {id, code, naam, niveau, objecttype, toepassing, extern, eigenaarId, effectieveEigenaarId, kinderen: ObjectKnoop[]}`
  - `effectieveEigenaar(db, objectId): Promise<string|null>` — eerste eigenaar_id omhoog in de boom.

- [ ] **Step 1: Write failing tests**: parse geldig SO-bestand (≥10 regels); de drie foutsoorten + dubbele code (Review Focus 2: bij fouten wordt niets opgeslagen); `vergelijkImport` SO→DO geeft nieuw (niveau 3), gewijzigd (hernoemd object: velden `['naam']`), verdwenen (gesplitst object); `voerImportUit` zet koppeling op verdwenen object op `te_herkoppelen` en laat andere koppelingen van dezelfde registratie ongemoeid (Review Focus 3); `herkoppel` haalt hem van de lijst; `effectieveEigenaar` erft van ouder.
- [ ] **Step 2: Run** `npm test -- import` — FAIL.
- [ ] **Step 3: Implement** `objecten.ts` en `import.ts` (papaparse met `delimiter: ';'`).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: objectboom en import per fase met herkoppelen`

---

### Task 3: Registraties, velden en objectkoppelingen

**Files:**
- Create: `src/domain/velden.ts`, `src/domain/registraties.ts`
- Test: `tests/domain/registraties.test.ts`

**Interfaces:**
- Consumes: Task 1, `nakomelingen`, `voorouders`
- Produces:
  - Zod-schema's in `velden.ts` (alle velden optioneel bij concept; `verplichtVoorAanbieden: Record<RegistratieType, string[]>`):
    - issue: `prioriteit: 'hoog'|'normaal'|'laag'`, `gevolg`, `streefdatum` (ISO-datum)
    - afwijking: `afwijkingVan`, `artikel`, `eis`, `voorgesteld`, `motivatie`, `gevolgen: {veiligheid, kosten, planning, beheer}`, `maatregelen`, `instemming: Instemming`
    - wijziging: `aanleiding: 'opdrachtgever'|'intern'|'extern'`, `situatieOud`, `situatieNieuw`, `gevolgen: {scope, kosten, planning, raakvlakken}`, `geraakteDocumenten: string[]`, `instemming`
    - ontwerpkeuze: `vraagstuk`, `alternatieven: {naam, voordelen, nadelen}[]`, `criteria`, `gekozen` (naam uit alternatieven), `motivatie`, `consequenties`, `instemming`
    - raakvlak: `soort: 'fysiek'|'functioneel'|'ruimtelijk'`, `afspraak`
    - `Instemming = { nodig: boolean; status?: 'aangevraagd'|'verleend'|'geweigerd'; datum?: string; referentie?: string }`
    - verplicht bij aanbieden: AF `afwijkingVan, eis, voorgesteld, motivatie`; WZ `aanleiding, situatieOud, situatieNieuw`; OK `vraagstuk, alternatieven(≥2), gekozen, motivatie`; RV `soort, afspraak`.
  - `type Koppeling = {soort:'exemplaar'; objectId} | {soort:'type'; objecttype; toepassing: string|null; bereikObjectId: string|null}`
  - `maakRegistratie(db, actor, input: {type; titel; omschrijving; faseId?; koppelingen: Koppeling[]; details?; eigenaarId?; discipline?; bronMeldingIds?: string[]}): Promise<{id; nummer}>` — status start: issue `open`, raakvlak `concept`, overige `concept`; fase default = actieve fase; koppelingen op niveau >3 → fout; eigenaar default = effectieve eigenaar van eerste exemplaar-object.
  - `werkBij(db, actor, id, patch: {titel?; omschrijving?; details?; koppelingen?; eigenaarId?; discipline?}): Promise<void>` — weigert met `Fout('Registratie is bevroren')` als status in `goedgekeurd|verwerkt|vervangen|afgestemd|vastgesteld`, behalve via `tekstcorrectie` (Task 5).
  - `registratiesVoorObject(db, objectId, opties: {inclusiefOnderliggend: boolean; faseId?: string|null}): Promise<RegistratieRij[]>` — exemplaarkoppelingen op object (en nakomelingen) + typekoppelingen waarvan `objecttype/toepassing` matcht met het object (of een nakomeling) en het object binnen `bereik_object_id` valt (of bereik null). Resultaat ontdubbeld op registratie-id (Review Focus 1). `RegistratieRij = {id, nummer, type, titel, status, faseCode, viaType: boolean}`.
  - `registratiesOpObjectBoom(db, projectId): Promise<Map<objectId, number>>` — telling inclusief onderliggend, voor de boom.
  - `haalRegistratie(db, id): Promise<RegistratieDetail>` met koppelingen, relaties (in beide richtingen), bronnen, raakvlakkanten, historie, `opgenomenIn: {documentNummer, revisie}[]`.

- [ ] **Step 1: Write failing tests**: nummer per type; koppeling niveau 4 geweigerd; doortellen: afwijking op Landhoofd as-1 verschijnt bij Viaduct met `inclusiefOnderliggend:true` en niet zonder; typekoppeling "alle Landhoofden in Viaduct Noord" verschijnt bij Landhoofd as-1 én as-2 met `viaType:true`, en een landhoofd dat later via import binnen het bereik komt valt er ook onder; registratie met exemplaar Landhoofd as-1 + type Landhoofd verschijnt één keer bij Landhoofd as-1 (Review Focus 1); `werkBij` op goedgekeurde registratie → fout.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: registraties met velden, koppelingen en doortellen`

---

### Task 4: Inbox en meldingen

**Files:**
- Create: `src/domain/meldingen.ts`
- Test: `tests/domain/meldingen.test.ts`

**Interfaces:**
- Consumes: Task 1–3 (`maakRegistratie`)
- Produces:
  - `meld(db, actor, input: {titel; omschrijving; objectIds?: string[]; bronSoort?; bronRef?}): Promise<{id; nummer}>` — titel en omschrijving verplicht; fase = actieve fase.
  - `parseSnelinvoer(db, projectId, tekst: string): Promise<{titel: string; objectId: string|null; kandidaten: {id; code; naam}[]}>` — `#token` matcht case-insensitief op code of als woord in naam/locatie van actieve objecten; meerdere `#token`s worden samen gezocht (`#landhoofd #as-1`); exact 1 match → `objectId`; meer → `objectId:null`, `kandidaten` (Review Focus 5); titel = tekst zonder tokens, getrimd.
  - `zetOm(db, actor, meldingId, doelen: {type: RegistratieType; titel?; koppelingen?}[]): Promise<{id; nummer}[]>` — alleen `magBeoordelen`; ≥1 doel; per doel `maakRegistratie` met titel/omschrijving/objecten van melding als default en `bronMeldingIds`; melding → `omgezet`, `beoordeeld_door`.
  - `voegSamen(db, actor, meldingId, registratieId)` → `registratie_bronnen` + status `samengevoegd`.
  - `laatVervallen(db, actor, meldingId, reden: string)` — reden verplicht (niet leeg) → `vervallen`.
  - `inbox(db, projectId, filter: {status?: MeldingStatus[]; zoek?: string}): Promise<MeldingRij[]>` met `MeldingRij = {id, nummer, titel, status, gemeldDoor, gemeldOp, objecten: {code; naam}[], bronSoort, werkdagenOpen: number}`.
  - `werkdagenTussen(van: Date, tot: Date): number` (ma–vr).

- [ ] **Step 1: Write failing tests**: melden zonder omschrijving → fout; snelinvoer `Kabels passen niet door landhoofd #as-1` met één landhoofd as-1 → objectId gezet, titel `Kabels passen niet door landhoofd`; `#as-1` met steunpunt én landhoofd as-1 → kandidaten (2); teamlid mag niet omzetten; omzetten naar issue + ontwerpkeuze maakt twee registraties met bron; vervallen zonder reden → fout; `werkdagenTussen(vr, ma)` = 1.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat: inbox, snelinvoer en omzetten van meldingen`

---

### Task 5: Workflow afwijking, wijziging, ontwerpkeuze en issue

**Files:**
- Create: `src/domain/workflow.ts`
- Test: `tests/domain/workflow.test.ts`

**Interfaces:**
- Consumes: `magGoedkeuren`, `isOntwerpleider`, `verplichtVoorAanbieden`, `logHistorie`
- Produces (alle: actor-check, statuscheck, historie; ongeldige overgang → `Fout('Overgang niet toegestaan: <van> → <naar>')`):
  - `biedAan(db, actor, id)` concept|afgewezen → ter_goedkeuring; ontbrekende verplichte velden → `Fout('Ontbrekende velden: ...')`.
  - `keurGoed(db, actor, id)` ter_goedkeuring → goedgekeurd; zet `goedgekeurd_door`, `goedgekeurd_onder_delegatie`.
  - `wijsAf(db, actor, id, toelichting: string)` → afgewezen (toelichting verplicht).
  - `markeerVerwerkt(db, actor, id)` goedgekeurd → verwerkt; zet `verwerkt_door/op`.
  - `zetInstemming(db, actor, id, instemming: Instemming)` — toegestaan in elke status behalve vervangen (instemming loopt buiten de app door); gelogd.
  - `tekstcorrectie(db, actor, id, patch: {titel?; omschrijving?; details?})` — alleen OL, alleen op bevroren status, koppelingen niet wijzigbaar; historie-actie `tekstcorrectie`.
  - Issue: `zetIssueStatus(db, actor, id, naar: 'in_behandeling'|'opgelost'|'vervallen', opts?: {oplossingId?: string; reden?: string})` — opgelost vereist `oplossingId` (relatie `lost_op`), vervallen vereist reden.
  - `delegeer(db, actor, gebruikerId, actief: boolean)` — alleen OL.

- [ ] **Step 1: Write failing tests**: volledige route AF concept→ter_goedkeuring→goedgekeurd→verwerkt met historie-acties in volgorde; aanbieden met lege velden → foutmelding noemt `eis`; afwijzen → afgewezen → opnieuw aanbieden mag; opsteller-OL keurt eigen AF goed → fout; OC met delegatie keurt goed en `goedgekeurd_onder_delegatie=true`; na goedkeuring `werkBij` met nieuwe koppeling → fout, `tekstcorrectie` door OL op titel ok en door teamlid fout (Review Focus 4); issue opgelost zonder oplossing → fout.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat: goedkeuringsworkflow en issue-statussen`

---

### Task 6: Raakvlakafspraken

**Files:**
- Create: `src/domain/raakvlakken.ts`
- Test: `tests/domain/raakvlakken.test.ts`

**Interfaces:**
- Consumes: `maakRegistratie`, `effectieveEigenaar`, `isOntwerpleider`
- Produces:
  - `maakRaakvlak(db, actor, input: {titel; omschrijving; objectIds: string[] /* ≥2 */; details: {soort; afspraak}; bronMeldingIds?}): Promise<{id; nummer}>` — alle objecten zelfde niveau anders `Fout('Raakvlak alleen tussen objecten op hetzelfde niveau')`; per object een kant met `verantwoordelijke_id = effectieveEigenaar` (extern object: effectieve eigenaar van de ouder, d.w.z. de interne verantwoordelijke); ook exemplaarkoppelingen.
  - `kantAfgestemd(db, actor, kantId, bron?: string)` — alleen verantwoordelijke van die kant (of OL); bij externe kant is `bron` verplicht; als alle kanten afgestemd → registratie `afgestemd`.
  - `kantVerwerkt(db, actor, kantId)` — alleen na status afgestemd; alle kanten → `verwerkt`.
  - `eindoordeel(db, actor, id, akkoord: boolean, opmerking?: string)` — alleen OL, alleen in `verwerkt`; akkoord → `vastgesteld`; niet akkoord → status `afgestemd`, opmerking verplicht, `verwerkt_op` gewist op kanten die OL aanwijst: param `terugNaarKantIds: string[]` (≥1).
  - `verfijn(db, actor, raakvlakId, input zoals maakRaakvlak)` — nieuw raakvlak met relatie `verfijnt`; objecten moeten nakomelingen zijn van de kanten van het origineel.

- [ ] **Step 1: Write failing tests**: verschillende niveaus → fout; teamlid die geen eigenaar is kan kant niet afstemmen; beide kanten afgestemd → `afgestemd`; verwerkt vóór afgestemd → fout; eindoordeel door OC → fout; eindoordeel niet akkoord → terug naar afgestemd met gewiste verwerkt-markering op aangewezen kant; externe kant zonder bron → fout.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat: raakvlakafspraken met kanten en eindoordeel`

---

### Task 7: Fasen en vervanging

**Files:**
- Create: `src/domain/fasen.ts`
- Test: `tests/domain/fasen.test.ts`

**Interfaces:**
- Produces:
  - `vervang(db, actor, oudId, input: Omit<maakRegistratie-input,'type'>): Promise<{id; nummer}>` — oud moet bevroren status hebben (`goedgekeurd|verwerkt|vastgesteld`); nieuw krijgt actieve fase en relatie `vervangt`; oud krijgt `vervangen_door_id` en status `vervangen` pas als de nieuwe goedgekeurd/vastgesteld wordt (hook in `keurGoed`/`eindoordeel`: als registratie een `vervangt`-relatie heeft). Tot dan staat bij oud "vervanging in behandeling".
  - `faseOverzicht(db, projectId, faseId): Promise<{registraties: RegistratieRij[]; vervangenUitVorigeFasen: {oud: RegistratieRij; nieuw: RegistratieRij}[]}>`
  - `openIssuesVorigeFase(db, projectId): Promise<RegistratieRij[]>`
  - `startFase(db, actor, faseId, besluiten: {issueId; actie: 'meenemen'|'vervallen'; reden?}[])` — alleen OL; elke open issue van vorige fase moet een besluit hebben, anders `Fout('Besluit ontbreekt voor IS-xxxx')`; meenemen = `fase_id` wordt nieuwe fase (historie `fase_meegenomen`).

- [ ] **Step 1: Write failing tests**: vervang VO-OK in DO: na goedkeuring nieuwe → oud `vervangen`, verschijnt in DO-`vervangenUitVorigeFasen`, niet meer in DO-registraties, wel in VO-overzicht; vervangen van concept → fout; `startFase` met ontbrekend issue-besluit → fout; meenemen verplaatst fase.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat: faseovergang en vervangen van registraties`

---

### Task 8: Rapportselectie, export en revisie-snapshots

**Files:**
- Create: `src/domain/rapport.ts`, `src/domain/export.ts`
- Test: `tests/domain/rapport.test.ts`

**Interfaces:**
- Consumes: `registratiesVoorObject`, `faseOverzicht`
- Produces:
  - `KOLOMMEN: Record<RegistratieType, {kop: string; waarde: (r: RegistratieDetail) => string}[]>` — vaste kolommen per type: altijd `Nr.`, `Titel`, `Object(en)`, `Status`; daarna AF: `Afwijking van`, `Eis`, `Voorgesteld`, `Motivatie`, `Maatregelen`, `Instemming OG`; WZ: `Aanleiding`, `Oud`, `Nieuw`, `Gevolgen`, `Instemming OG`; OK: `Vraagstuk`, `Gekozen`, `Motivatie`, `Alternatieven` (namen, `; `-gescheiden); RV: `Soort`, `Afspraak`, `Kanten` (`code ↔ code`); IS: `Prioriteit`, `Gevolg`, `Opgelost door`.
  - `rapportInhoud(db, documentId): Promise<{ perType: Record<RegistratieType, RegistratieDetail[]>; vervangen: {oud; nieuw}[]; uitgesloten: {registratie; reden}[] }>` — objecten van document + onderliggend + typekoppelingen; fase = documentfase; statusfilter: AF/WZ/OK `goedgekeurd|verwerkt`, RV `afgestemd|verwerkt|vastgesteld`, issues alle behalve `vervallen`; uitsluitingen eruit; gesorteerd op nummer; ontdubbeld.
  - `sluitUit(db, actor, documentId, registratieId, reden)` / `neemOp(db, actor, documentId, registratieId)`
  - `exporteerDocx(inhoud, document): Promise<Buffer>` — kop `Registraties <nummer> <titel> rev. <revisie>`, per type een `Heading2` (`Afwijkingen`, `Wijzigingen`, `Ontwerpkeuzes`, `Raakvlakafspraken`, `Issues`) + tabel met `KOLOMMEN`; lege typen weggelaten; blok `Vervangen registraties uit vorige fasen`.
  - `exporteerXlsx(inhoud, document): Promise<Buffer>` — één werkblad per type met dezelfde kolommen.
  - `legRevisieVast(db, actor, documentId, revisie: string): Promise<{snapshotId}>` — inhoud = per registratie `{id, nummer, status, hash, waarden}` met `hash` = sha256 van kolomwaarden.
  - `verschilMetVorige(db, documentId): Promise<{vorigeRevisie: string|null; nieuw: string[]; gewijzigd: string[]; vervallen: string[]}>` (nummers) — huidige inhoud vs laatste snapshot.
  - `opgenomenIn` (gebruikt in Task 3) leest snapshots.

- [ ] **Step 1: Write failing tests**: DO-nota Viaduct Noord bevat goedgekeurde AF op Landhoofd as-1 en niet de concept-AF, niet de VO-OK, wel de typekoppeling; uitgesloten registratie zit niet in `perType` maar in `uitgesloten`; `exporteerDocx` levert buffer die begint met `PK` en waarin (unzip `word/document.xml`) `AF-0001` voorkomt; snapshot rev A, daarna nieuwe AF goedgekeurd en tekstcorrectie op bestaande → `verschilMetVorige` = nieuw [AF-0002], gewijzigd [AF-0001].
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat: rapporttabellen, Word/Excel-export en revisie-snapshots`

---

### Task 9: Mijn werk, signalen en AI-voorstel

**Files:**
- Create: `src/domain/signalen.ts`, `src/domain/ai.ts`
- Test: `tests/domain/signalen.test.ts`, `tests/domain/ai.test.ts`

**Interfaces:**
- Produces:
  - `mijnWerk(db, actor): Promise<{ wachtOpMijnGoedkeuring: RegistratieRij[]; wachtOpMijnAkkoord: {kantId; registratie: RegistratieRij; stap: 'afstemmen'|'verwerken'}[]; eigenaarVan: RegistratieRij[]; goedgekeurdNietVerwerkt: RegistratieRij[]; teBeoordelenMeldingen: MeldingRij[] }>` — goedkeuring alleen als `magGoedkeuren` ok; meldingen alleen voor OL/OC.
  - `signalen(db, projectId): Promise<{ soort: 'inbox_te_lang'|'goedgekeurd_niet_verwerkt'|'instemming_open'|'te_herkoppelen'|'eindoordeel_nodig'; tekst: string; link: string }[]>` — inbox: `werkdagenOpen > inbox_signaal_werkdagen`.
  - `stelVoor(db, projectId, meldingId, opts?: {client?: Pick<Anthropic,'messages'>}): Promise<{ type: RegistratieType; objectIds: string[]; mogelijkDubbel: string[] /* registratie-nummers */; toelichting: string; bron: 'ai'|'heuristiek' }>`
    - Heuristiek: trefwoorden (`afwijk|norm|eis` → afwijking; `wijzig|scope|opdrachtgever wil` → wijziging; `kiezen|keuze|variant|alternatief` → ontwerpkeuze; `raakvlak|aansluit|interface|kabel|leiding` → raakvlak; anders issue); objecten via `parseSnelinvoer`-logica op woorden in titel+omschrijving; dubbel = registraties met ≥2 gedeelde niet-stopwoorden in titel.
    - AI (alleen als `process.env.ANTHROPIC_API_KEY` of `opts.client`): `client.messages.parse({ model: 'claude-opus-5-5', max_tokens: 1024, output_config: { effort: 'low', format: zodOutputFormat(VoorstelSchema) }, system: <Nederlandse instructie>, messages: [{role:'user', content: <melding + lijst actieve objecten (code, naam, niveau) + lijst registraties (nummer, titel)>}] })`. `VoorstelSchema = z.object({ type: z.enum([...]), objectCodes: z.array(z.string()), mogelijkDubbel: z.array(z.string()), toelichting: z.string() })`. Codes die niet bestaan worden gefilterd. Bij `stop_reason === 'refusal'`, `parsed_output === null` of exception → heuristiek. Import: `zodOutputFormat` uit `@anthropic-ai/sdk/helpers/zod`.

- [ ] **Step 1: Write failing tests**: `mijnWerk` voor OL toont AF ter goedkeuring maar niet zijn eigen; voor eigenaar Landhoofd toont raakvlakkant; `signalen` met melding van 6 werkdagen oud → `inbox_te_lang`; `stelVoor` zonder key → `bron:'heuristiek'`, type `raakvlak` voor "Kabels van derden kruisen landhoofd as-1"; met nep-client die `{parsed_output: {type:'afwijking', objectCodes:['ONBEKEND','VN-LH1'], ...}, stop_reason:'end_turn'}` teruggeeft → `bron:'ai'` en alleen het bestaande object; nep-client met `stop_reason:'refusal'` → heuristiek.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat: mijn werk, signalen en voorstel bij meldingen`

---

### Task 10: Demodata

**Files:**
- Create: `src/seed/demo.ts`, `src/seed/data/so.csv`, `src/seed/data/do.csv`, `src/seed/data/documenten.ts`
- Test: `tests/domain/seed.test.ts`

**Interfaces:**
- Consumes: alle domeinfuncties (seed gebruikt uitsluitend domeinfuncties, zodat historie klopt)
- Produces: `seedDemo(db): Promise<{projectId; gebruikers: Record<'ol'|'oc'|'constructeur'|'wegontwerper'|'installatie', string>}>`; `npm run seed` reset en vult de lokale database (`.data/pglite`).

Inhoud:
- Gebruikers (fictief): Sanne de Vries (ontwerpleider), Joris Bakker (ontwerpcoördinator, delegatie actief), Fatma Yilmaz (constructeur, eigenaar Viaduct Noord), Pieter Jansen (wegontwerper, eigenaar Weglichaam), Lotte Visser (installaties, teamlid).
- Project `Traject N-weg — Viaduct Noord`, nummer `P-2026-014`, fasen SO, VO, DO, UO; actieve fase VO.
- `so.csv` (niveau 0–2, codes `TN`, `TN-WL`, `TN-WL-RB-R`, `VN`, `VN-OA-AB`, `VN-OA-BC`, `VN-SP-1`, `VN-SP-2`, `VN-SP-3`, `VN-SP-4`, `EXT-KL` (Kabels en leidingen derden, niveau 2 onder `TN`, extern, eigenaar_organisatie `Netbeheerder Noord`)); geïmporteerd in fase SO.
- `do.csv`: `VN-SP-2` hernoemd naam; `VN-SP-3` verdwenen en gesplitst in `VN-SP-3A`, `VN-SP-3B`; nieuwe niveau 3: `VN-LH-1` (Draagconstructie, toepassing Landhoofd, onder `VN-SP-1`), `VN-LH-4` (Landhoofd onder `VN-SP-4`), `VN-DK-AB` (Dekconstructie, Liggerdek), `VN-PF-1` (Funderingsconstructie, Paalfundering). Niet geïmporteerd in seed: dit doet de demo live.
- In VO: OK-0001 "Liggerdek in plaats van plaatdek" (goedgekeurd), AF-0001 betondekking (ter goedkeuring, opgesteld door Fatma), WZ-0001 (concept), IS-0001 open op `VN-SP-3` (wordt te herkoppelen bij DO-import), RV-0001 tussen `VN-OA-AB` en `VN-SP-2` (beide kanten afgestemd), RV-0002 `EXT-KL` ↔ `TN-WL-RB-R` (concept), een typekoppeling op AF-0001 "alle Steunpunten in Viaduct Noord".
- Inbox: 4 meldingen, waarvan één 7 werkdagen oud, één met bron `ontwerppeil` ("Besluit B-0012 uit Ontwerpteamoverleg #8: kabeltracé langs landhoofd as-1"), één via snelinvoer met `#VN-SP-1`.
- Documenten: `VN-NOT-001 Ontwerpnota Viaduct Noord VO` (fase VO, objecten `VN`, rev A), `VN-NOT-002 Ontwerpnota Viaduct Noord DO` (fase DO, objecten `VN`, rev 0), `TN-NOT-001 Raakvlakkendocument Traject` (fase VO, objecten `TN`).

- [ ] **Step 1: Write failing test** `seedDemo vult project`: 5 gebruikers, ≥11 objecten, 4 meldingen, registraties met nummers OK-0001, AF-0001, WZ-0001, IS-0001, RV-0001, RV-0002; `signalen` bevat `inbox_te_lang`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Run `npm run seed` — Expected: `Demo-project aangemaakt: P-2026-014`.
- [ ] **Step 5: Commit** `feat: demodata Viaduct Noord`

---

### Task 11: App-shell, huisstijl en rolwissel

**Files:**
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (redirect naar project), `src/app/(app)/project/[projectId]/layout.tsx`, `src/components/Zijbalk.tsx`, `src/components/GebruikerWissel.tsx`, `src/components/StatusLabel.tsx`, `src/lib/sessie.ts`, `src/lib/acties.ts`
- Test: `tests/domain/sessie.test.ts`

**Interfaces:**
- Produces:
  - `huidigeActor(projectId): Promise<Actor>` (leest cookie `demo_gebruiker`, default de ontwerpleider) in `src/lib/sessie.ts`; server action `wisselGebruiker(gebruikerId)`.
  - `actie<T>(fn: () => Promise<T>): Promise<{ok:true; data:T}|{ok:false; fout:string}>` in `src/lib/acties.ts` — vangt `Fout` uit domein en geeft de Nederlandse melding terug voor weergave.
  - `StatusLabel({type, status})` — Nederlandse labels en kleur: concept grijs, ter_goedkeuring blauw, goedgekeurd/afgestemd mint, verwerkt/vastgesteld navy, afgewezen/vervallen rood, vervangen doorgestreept.
  - Zijbalk (navy met verloop naar blauw): Mijn werk, Inbox (met teller nieuw), Registraties, Objecten, Documenten, Fasen, Import; onderaan gebruikerswissel met naam + rol.
- Layout werkt op 390px breed (zijbalk wordt bovenbalk met menu).

- [ ] **Step 1: Write failing test** `actie vangt Fout en geeft tekst terug`.
- [ ] **Step 2–4:** FAIL → implement → PASS; `npm run build` slaagt.
- [ ] **Step 5: Commit** `feat: app-shell met huisstijl en rolwissel`

---

### Task 12: Schermen inbox en registraties

**Files:**
- Create: `src/app/(app)/project/[projectId]/inbox/page.tsx`, `.../inbox/acties.ts`, `src/components/MeldingInvoer.tsx`, `src/components/OmzetDialoog.tsx`, `.../registraties/page.tsx`, `.../registraties/[nummer]/page.tsx`, `.../registraties/[nummer]/acties.ts`, `src/components/VeldenFormulier.tsx`, `src/components/KoppelingKiezer.tsx`, `src/components/Historie.tsx`
- Test: via e2e (Task 14) en `npm run build`

Gedrag:
- Inbox: bovenaan één invoerregel (snelinvoer, Enter = melden; bij kandidaten keuzelijst), knop "Uitgebreid melden" (titel, omschrijving, objecten, bron). Lijst met nummer, titel, objecten, melder, bron-icoon, "X werkdagen" (rood boven drempel). Per melding (OL/OC): **Voorstel** (toont `stelVoor`, met "AI" of "Automatisch" label), **Omzetten** (dialoog: één of meer typen aanvinken, objecten en titel voorgevuld uit voorstel), **Samenvoegen**, **Vervallen** (reden verplicht). Teamleden zien de knoppen niet.
- Registraties: lijst met filters type, status, fase, object (zoekveld), tekst; kolommen nr, titel, objecten, status, eigenaar, fase.
- Detail: kop met nummer, titel, StatusLabel, fase; actieknoppen afhankelijk van type/status/rol (Aanbieden, Goedkeuren, Afwijzen, Markeer verwerkt, Vervangen, Tekstcorrectie (OL), Instemming OG, voor RV per kant Afgestemd/Verwerkt en Eindoordeel); formulier `VeldenFormulier` per type (alleen bewerkbaar als niet bevroren); `KoppelingKiezer` (boom tot niveau 3 met zoekveld; tab "Type" met objecttype+toepassing en bereik); blokken Relaties, Bronnen (meldingen, met bron OntwerpPeil zichtbaar), Opgenomen in, Historie (tijdlijn).
- Fouten uit `actie()` als melding bovenaan.

- [ ] **Step 1:** Bouw de schermen.
- [ ] **Step 2: Run** `npm run build` — Expected: geen type- of buildfouten.
- [ ] **Step 3: Handmatige check** met `npm run dev` + Playwright-script in scratch: melding omzetten naar afwijking, aanbieden als Fatma, goedkeuren als Sanne. Screenshot bekijken.
- [ ] **Step 4: Commit** `feat: schermen inbox en registraties`

---

### Task 13: Schermen objecten, import en fasen

**Files:**
- Create: `.../objecten/page.tsx`, `.../objecten/[code]/page.tsx`, `src/components/ObjectBoom.tsx`, `.../import/page.tsx`, `.../import/acties.ts`, `.../fasen/page.tsx`, `.../fasen/acties.ts`

Gedrag:
- Objecten: inklapbare boom met per object niveau-label, objecttype (toepassing), eigenaar (geërfd grijs), extern-badge, teller registraties inclusief onderliggend. Object-detail: schakelaars "Inclusief onderliggend" en "Deze fase / Alle fasen", lijst registraties met "via type"-markering, knop "Melden over dit object" (object voorgevuld), OL kan eigenaar wijzigen.
- Import (alleen OL): kies fase, upload CSV (of knop "Voorbeeld DO-import" die `src/seed/data/do.csv` laadt), toont fouten of diff (nieuw / gewijzigd / verdwenen met aantal koppelingen), knop "Import uitvoeren". Daaronder lijst **Te herkoppelen** met per item de voorstellen en een objectkiezer.
- Fasen: per fase overzicht (aantallen per type en status) en het blok "Vervangen registraties uit vorige fasen"; OL-knop "Start fase DO" opent de lijst open issues met per issue meenemen / vervallen + reden.

- [ ] **Step 1:** Bouw de schermen. **Step 2:** `npm run build` slaagt. **Step 3:** Handmatige check: DO-import uitvoeren, IS-0001 verschijnt op Te herkoppelen, herkoppelen naar `VN-SP-3A`. **Step 4: Commit** `feat: schermen objecten, import en fasen`

---

### Task 14: Schermen documenten en Mijn werk, plus e2e-demo

**Files:**
- Create: `.../documenten/page.tsx`, `.../documenten/[nummer]/page.tsx`, `.../documenten/[nummer]/export/route.ts` (GET `?formaat=docx|xlsx`), `.../mijn-werk/page.tsx`, `playwright.config.ts`, `tests/e2e/demo.spec.ts`, `README.md`

Gedrag:
- Documenten: lijst (nummer, titel, fase, revisie, objecten). Detail: per type de tabel met `KOLOMMEN`, per regel "Uitsluiten" (reden), blok vervangen, blok uitgesloten, knoppen "Download Word" / "Download Excel", "Revisie vastleggen" (invoer revisieletter) en "Verschil met rev. X" (nieuw / gewijzigd / vervallen).
- Mijn werk (startpagina van het project): de vijf blokken uit `mijnWerk` + `signalen` bovenaan.
- README: starten (`npm install`, `npm run seed`, `npm run dev`), demoscript met de 9 stappen uit spec §11, en hoe `DATABASE_URL` (Supabase) en `ANTHROPIC_API_KEY` in te stellen.

- [ ] **Step 1: Write failing e2e** `tests/e2e/demo.spec.ts` (webServer: `npm run seed && npm run dev`): (a) als Lotte snelinvoer `Sparing voor kabels in landhoofd #VN-SP-1` → verschijnt in inbox; (b) als Sanne omzetten naar afwijking; (c) als Fatma AF-0001 is ter goedkeuring zichtbaar, als Sanne goedkeuren → status "Goedgekeurd"; (d) DO-import uitvoeren → "Te herkoppelen" toont IS-0001; (e) document VN-NOT-001 → "Download Word" geeft een bestand `.docx`.
- [ ] **Step 2: Run** `npm run e2e` — FAIL. **Step 3:** Bouw de schermen. **Step 4: Run** `npm test && npm run e2e` — PASS.
- [ ] **Step 5: Commit** `feat: documenten, mijn werk en e2e-demoscript`
