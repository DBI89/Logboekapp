# Ontwerp logboek — Functioneel ontwerp

Bron (levend document): https://claude.ai/artifact/TyH6oJo4hTUVrhvQ8BwFGE — goedgekeurd 2026-11-25.
Dit bestand is een kopie voor de bouw. Bij verschil geldt het levende document.

Het Ontwerp logboek legt tijdens de ontwerpuitwerking vast wat er speelt en besloten wordt: issues, afwijkingen, wijzigingen, ontwerpkeuzes en raakvlakafspraken, gekoppeld aan de objecten uit de eigen OTL-decompositie. Het team bewaakt er de opvolging mee; aan het eind levert het de tabellen voor ontwerpnota's en -rapporten.

## 1. Inleiding

Vandaag komt de ontwerpverantwoording pas aan het eind tot stand, gereconstrueerd uit mails, notulen en geheugen. Het logboek legt het vast op het moment dat het gebeurt.

Twee functies: (1) tijdens het ontwerp intern vastleggen en opvolging bewaken; (2) aan het eind verantwoording naar de opdrachtgever via tabellen in ontwerpnota's en -rapporten.

Gebruikers: interne collega's van het ontwerpteam (Microsoft-account). Gastaccounts mogelijk later.

Uitgangspunten:
- Vastleggen kost een halve minuut: één inbox, minimale velden, later aanvullen.
- Alles hangt aan objecten uit de eigen OTL-decompositie (niveau 0 t/m 3).
- Afwijkingen, wijzigingen en ontwerpkeuzes gelden pas na formele goedkeuring door de ontwerpleider (of de gedelegeerde ontwerpcoördinator).
- Goedgekeurde registraties worden niet overschreven, alleen vervangen. Alle wijzigingen worden gelogd met wie en wanneer.
- Elke registratie is direct rapportwaardig: vaste velden die één-op-één een tabelkolom worden.
- Nederlandstalig; huisstijl en techniek als de OntwerpPeil Tool.

Buiten scope: externe gebruikers, opslag van documenten, rapporttekst schrijven, Relatics-koppeling.

## 2. Werkwijze

Melding (elk teamlid) → Inbox (OL of OC deelt in) → Vervallen (met reden) óf:
- Issue: Open → In behandeling → Opgelost (via registratie) / Vervallen
- Afwijking, wijziging, ontwerpkeuze: Concept → Ter goedkeuring → Goedgekeurd (door OL of OC) / Afgewezen (terug naar concept) → Verwerkt
- Raakvlakafspraak: Concept → Afgestemd (akkoord elke kant) → Verwerkt (elke kant) → Vastgesteld (eindoordeel OL)
Alles → rapporttabel per document.

## 3. Objecten

Niveaus waarop gekoppeld wordt: 0 Bouwcomplex (Traject), 1 Bouwwerk (Viaduct), 2 Bouwelement (Overspanning A–B, Steunpunt as-1), 3 Bouwdeel (Landhoofd as-1, Dekconstructie). Niveau 4 en 5 niet.

### 3.1 Import per fase
Elke fase een nieuwe, diepere import (SO typisch niveau 0–2, DO tot 3). Bron: Excel/CSV met per object: vaste objectcode (import matcht hierop), naam, niveau, technisch objecttype, toepassing, locatiekenmerk, code bovenliggend object, intern/extern met eigenaar-organisatie bij extern.
Na import: vergelijking met vorige import: nieuw, gewijzigd (naam, toepassing, plaats in boom), verdwenen. Koppelingen aan objecten die blijven bestaan blijven staan.
Te herkoppelen: registraties waarvan het object verdwenen of gesplitst is komen op de lijst 'Te herkoppelen'. De app stelt voor items naar een dieper object te verplaatsen; de gebruiker bevestigt.

### 3.2 Exemplaar of type
- Exemplaar: één specifiek object.
- Type binnen bereik: technisch objecttype + toepassing, binnen een object of het hele project ("alle Landhoofden in Viaduct Noord"). Dynamisch: nieuwe objecten van dat type binnen bereik vallen er automatisch onder. Bij elk exemplaar zie je ook registraties via een type. Een registratie kan aan meerdere exemplaren en/of typen hangen.

### 3.3 Doortellen naar boven
Een registratie op een object telt mee bij alle bovenliggende objecten. Overzicht per object: 'alleen dit object' of 'inclusief onderliggend'.

### 3.4 Eigenaar per object
Elk object heeft een eigenaar (meestal disciplineleider), geldt ook voor onderliggende objecten tenzij daar iemand anders is aangewezen. Pakt meldingen op en geeft bij raakvlakken akkoord namens zijn kant.

### 3.5 Externe objecten
Komen mee in de import met externe partij als eigenaar-organisatie; meestal hoger abstractieniveau.

## 4. Inbox en meldingen

### 4.1 Melding vastleggen
Verplicht: titel en omschrijving. Optioneel: object(en), bron, bijlage/link. Melder, datum en actieve fase automatisch.
Bronnen: eigen waarneming, mail, overleg/notulen, document, OntwerpPeil. Melden vanuit inbox, vanuit object, of met één invoerregel: `Kabels passen niet door landhoofd #as-1` → melding met Landhoofd as-1 als object.

### 4.2 Beoordelen en omzetten (OL en OC)
- Omzetten naar één of meer registraties; titel, omschrijving, objecten en bron gaan mee; melding blijft gekoppeld.
- Samenvoegen met bestaande registratie (melding wordt extra bron).
- Vervallen met verplichte reden; blijven zichtbaar en doorzoekbaar.
Melding met status Nieuw > 5 werkdagen → signaal bij beoordelaars (termijn instelbaar per project).

### 4.3 AI-voorstel (optioneel)
Voorstel voor registratietype, object en mogelijke dubbele registraties. Beoordelaar beslist.

## 5. Registratietypen

### 5.1 Gemeenschappelijke velden
Nummer, titel, omschrijving, fase (waarin ontstaan), objecten (exemplaren/typen), discipline, eigenaar, bron(nen) met link, status, gerelateerde registraties, bijlagen/links, 'opgenomen in' (document + revisie), volledige historie.

### 5.2 Per type
| Type | Nummer | Specifieke velden | Statussen |
| --- | --- | --- | --- |
| Issue | IS-0001 | Prioriteit (hoog/normaal/laag), gevolg als niet opgelost, streefdatum, oplossing (verwijzing naar registratie) | Open → In behandeling → Opgelost / Vervallen |
| Afwijking | AF-0001 | Afwijking van (eis/norm/richtlijn met artikel), eis vs voorgestelde situatie, motivatie, gevolgen (veiligheid, kosten, planning, beheer en onderhoud), compenserende maatregelen, instemming opdrachtgever | Concept → Ter goedkeuring → Goedgekeurd / Afgewezen → Verwerkt; later evt. Vervangen |
| Wijziging | WZ-0001 | Aanleiding (opdrachtgever/intern/extern), situatie oud en nieuw, gevolgen (scope, kosten, planning, raakvlakken), geraakte documenten, instemming opdrachtgever | Als afwijking |
| Ontwerpkeuze | OK-0001 | Vraagstuk, alternatieven (elk met voor- en nadelen), afwegingscriteria, gekozen alternatief, motivatie, consequenties, instemming opdrachtgever (optioneel) | Als afwijking |
| Raakvlakafspraak | RV-0001 | Twee of meer objecten op hetzelfde niveau, soort (fysiek/functioneel/ruimtelijk), afspraak, per kant verantwoordelijke met akkoord 'afgestemd' en 'verwerkt', eindoordeel ontwerpleider | Concept → Afgestemd → Verwerkt → Vastgesteld; later evt. Vervangen |

### 5.3 Regels
- Verwerkt = zit in tekening/model/berekening; wie en wanneer vastgelegd. Goedgekeurd maar niet verwerkt = signaal.
- Goedgekeurd is bevroren; alleen vervangen door nieuwe registratie met verwijzing. Kleine tekstcorrectie door ontwerpleider mag, gelogd.
- Instemming opdrachtgever (AF, WZ; optioneel OK): nodig ja/nee; bij ja status (aangevraagd/verleend/geweigerd), datum, referentie.
- Ketens zichtbaar: gerelateerde registraties en oorspronkelijke melding(en).

## 6. Rollen en goedkeuring

| Rol | Mag |
| --- | --- |
| Teamlid | Melden; toegewezen registraties uitwerken; ter goedkeuring aanbieden; als objecteigenaar akkoord bij raakvlakken; markeren als verwerkt |
| Ontwerpcoördinator | Als teamlid + inbox beoordelen/omzetten; goedkeuren bij delegatie |
| Ontwerpleider | Alles + definitief goedkeuren/afwijzen; eindoordeel raakvlakken; delegeren; objecteigenaren aanwijzen; imports |

Rollen per project. Alle interne collega's mogen alle projecten lezen tenzij afgeschermd.

Goedkeuren (AF/WZ/OK): teamlid biedt aan (verplichte velden gevuld) → OL (of gedelegeerde OC) keurt goed of wijst af met toelichting → wie goedkeurde en of onder delegatie wordt vastgelegd → instemming OG blijft open punt tot verleend/geweigerd. Delegeren per project, intrekbaar. Opsteller mag niet zelf goedkeuren.

Raakvlakken: (1) objecten op hetzelfde niveau; bij extern object is het niveau van het externe object leidend. (2) Per kant geeft de objecteigenaar 'afgestemd'; bij externe kant legt de interne verantwoordelijke het akkoord van de externe partij vast met bron. (3) Alle kanten afgestemd → status Afgestemd. (4) Per kant 'verwerkt'; alle kanten → status Verwerkt. Daarna eindoordeel OL: akkoord → Vastgesteld; anders terug naar de kant die nog actie heeft. Verfijnen tot afspraken een niveau lager, gekoppeld aan de oorspronkelijke.

## 7. Fasen en vervanging

Registratie hoort bij fase van ontstaan en blijft daar. Fasen gelijk aan OntwerpPeil (SO, VO, DO, UO).
- Vervangen in volgende fase: nieuwe registratie met "vervangt OK-0012 (VO)"; oude gemarkeerd "vervangen in DO door OK-0031".
- Fase-overzicht heeft blok "Vervangen registraties uit vorige fasen".
- Bij object: 'deze fase' of 'alle fasen'.
- Open issues bij faseovergang: OL kiest per issue meenemen (krijgt nieuwe fase) of vervallen met reden.

## 8. Rapporten en documentenlijst

8.1 Documentenlijst import: nummer, titel, discipline, revisie, status, fase, objecten die het document behandelt.
8.2 Selectie per document: objecten van het document incl. onderliggend + typekoppelingen; fase van het document; status standaard goedgekeurd, afgestemd, verwerkt of vastgesteld, issues met actuele status (per document aan te passen); apart blok vervangen registraties uit eerdere fasen. Per regel uitsluiten met reden (gelogd).
8.3 Export: per type een tabel met vaste kolommen; Word (.docx) en Excel; ook naar SharePoint-projectmap (release 1).
8.4 Vastleggen per revisie: welke registraties in welke versie; bij volgende revisie nieuw/gewijzigd/vervallen tonen.

## 9. Samenhang met OntwerpPeil

Gedeeld: projecten, fasen, projectteam, objectstructuur, documentenlijst. Logboek: meldingen en registraties (projectteam). Knop "Naar logboek" in OntwerpPeil maakt een melding met bron (release 1; in de demo een voorbeeldmelding met bron OntwerpPeil).

## 10. Platform en techniek

Aparte webapp (Next.js + TypeScript), gedeelde PostgreSQL-database (demo: Supabase EU; terugval Azure PostgreSQL). Uitvoer naar SharePoint-projectmap (release 1). Inloggen Entra ID (release 1); demo: testgebruikers met rolwissel. Historie per wijziging. Export .docx en Excel server-side. AI: Claude API, optioneel. Hosting Vercel. Huisstijl Nobleo: navy #004168, blauw #0077BC, mint #38D6B2. Laptop; leesbaar en melden op telefoon. Geen offline.

## 11. Demo

Fictief project Viaduct Noord in Traject N-weg; fictieve gebruikers; geen Microsoft-koppeling. Twee imports: SO-structuur (0–2) en DO-structuur (tot 3) met één hernoemd en één gesplitst object. Eén extern object (kabels en leidingen van derden).

De demo laat zien:
1. Melding in een halve minuut, ook vanuit een object.
2. Inbox beoordelen en omzetten met AI-voorstel voor type en object.
3. Koppelen aan exemplaar en type (alle landhoofden), doortellen naar boven.
4. Afwijking ter goedkeuring aanbieden en goedkeuren via rolwissel teamlid/ontwerpleider.
5. Raakvlakafspraak afstemmen tussen twee objecteigenaren, met eindoordeel.
6. DO-import met lijst 'Te herkoppelen'.
7. Ontwerpkeuze uit VO vervangen in DO.
8. Rapporttabel voor een document, export Word, revisie vastleggen.
9. Melding vanuit OntwerpPeil (voorbeeldmelding).

## 12. Voorstellen (goedgekeurd met het ontwerp)

Koppelen niveau 0–3; eigenaar per object erft naar beneden; nummering IS-/AF-/WZ-/OK-/RV- per project; kleine tekstcorrecties door OL gelogd; iedereen intern leest alle projecten; opsteller keurt niet zelf goed; open issues alleen mee na keuze OL; signaal inbox > 5 werkdagen; overzicht 'Mijn werk'; geen offline; demo zonder Microsoft-login.
