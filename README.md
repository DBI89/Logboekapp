# Ontwerp logboek — demo

Webapp voor het ontwerpteam om issues, afwijkingen, wijzigingen, ontwerpkeuzes en raakvlakafspraken vast te leggen, gekoppeld aan objecten uit de eigen OTL-decompositie. Functioneel ontwerp: `docs/superpowers/specs/2026-11-25-ontwerp-logboek-design.md`.

Deze demo draait met **fictieve data** (project Viaduct Noord) en **testgebruikers** waartussen je wisselt linksonder in de zijbalk. Er is geen Microsoft-login nodig.

## Starten

```bash
npm install
```

```bash
npm run seed
```

```bash
npm run dev
```

Open http://localhost:3000. `npm run seed` zet de lokale database (`.data/pglite`) terug naar de beginstand van de demo. Stop eerst de app voordat je opnieuw seedt.

## Demoscript

Testgebruikers: Sanne de Vries (ontwerpleider), Joris Bakker (ontwerpcoördinator, mag goedkeuren via delegatie), Fatma Yilmaz (constructeur, eigenaar Viaduct Noord), Pieter Jansen (wegontwerper, eigenaar Weglichaam), Lotte Visser (installaties).

1. **Melden in een halve minuut.** Als Lotte, Inbox: typ `Sparing voor kabels in landhoofd #VN-SP-1` en druk Enter. Of open een object en meld vanuit het object.
2. **Inbox beoordelen.** Als Sanne: klik *Voorstel* (AI-voorstel met API-sleutel, anders automatisch op trefwoorden) en *Omzetten*. Eén melding kan meerdere registraties worden; *Samenvoegen* en *Vervallen* (met reden) kan ook.
3. **Koppelen aan exemplaar en type.** AF-0001 hangt aan "alle Steunpunten in Viaduct Noord". Zie Objecten: de aantallen tellen door naar boven; op een objectpagina staat "via type".
4. **Goedkeuren.** AF-0001 staat ter goedkeuring (opgesteld door Fatma). Als Sanne: *Goedkeuren*. Als Fatma kan dat niet (opsteller), als Joris wel (delegatie). Daarna *Markeer als verwerkt*.
5. **Raakvlakafspraak.** RV-0002 (kabel van derden ↔ rijbaan): als Pieter per kant *Afgestemd* (bij de externe kant met bron), later *Verwerkt*, daarna eindoordeel door Sanne.
6. **Import per fase.** Als Sanne, Fasen: *Start fase DO* (open issue meenemen of laten vervallen). Import: *Voorbeeld DO-import laden* → *Controleren* → *Import uitvoeren*. IS-0001 staat op *Te herkoppelen* (steunpunt as-3 is gesplitst).
7. **Vervangen in een volgende fase.** Open OK-0001 (VO) → *Vervangen in actieve fase* → nieuwe ontwerpkeuze in DO; na goedkeuring is OK-0001 vervangen en zie je dit op Fasen.
8. **Rapporttabel.** Documenten → VN-NOT-001: tabellen per type, *Download Word/Excel*, regels uitsluiten met reden, *Revisie vastleggen* en het verschil met de vorige revisie.
9. **Uit OntwerpPeil.** In de inbox staat een melding met bron "OntwerpPeil · Ontwerpteamoverleg #8 · B-0012".

## Instellingen

| Variabele | Doel |
| --- | --- |
| `DATABASE_URL` | PostgreSQL (bijv. Supabase EU of Azure). Leeg = lokale PGlite in `.data/pglite`. Migraties draaien bij de start. |
| `ANTHROPIC_API_KEY` | Zet het AI-voorstel bij meldingen aan. Leeg = voorstel op trefwoorden. Alleen fictieve data gebruiken tot er akkoord is over AI op projectdata. |

## Ontwikkelen

```bash
npm test
```

```bash
npm run e2e
```

`npm test` draait de domeintests (Vitest, in-memory PGlite). `npm run e2e` seedt, bouwt en speelt het demoscenario na in Chromium.

Structuur: `src/domain` bevat alle regels (rechten, workflow, import, rapport); `src/app` de schermen en server-acties; `src/db/schema.ts` het datamodel.

## Browserversie (demo als link)

`npm run build:browser` maakt in `.data/browser-dist` een versie die volledig in de browser draait: dezelfde schermen en domeincode, met de database (PGlite) in de browser. Vite vervangt daarbij alleen de Next-onderdelen (zie `vite.config.ts` en `browser/shims`). Gegevens blijven per kijker in de browser bewaard; de knop *Beginstand herstellen* wist ze. Bekijk lokaal met `npm run preview:browser`.
