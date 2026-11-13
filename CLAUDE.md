# Nutgraph — werkafspraken voor Claude

Dit is een WordPress-plugin. Lees dit bestand helemaal voordat je iets verandert.

## Wat de plugin doet
Een whiteboard met plakbriefjes om verhaalstructuren te bouwen. Kolom 1 is de
ruggengraat (van boven naar beneden), de kolommen ernaast zijn details per onderdeel.
Gebruikers zijn Nederlandstalige journalisten zonder technische kennis.

## Basisonderdelen: deze mogen NOOIT verdwijnen
Elk onderdeel heeft een markering `@basis:<naam>` in de code. `tools/check-basis.sh`
controleert ze; ontbreekt er één, dan komt er geen release.

| Markering      | Wat het is |
|----------------|------------|
| privacy        | Geen verhaalgegevens op de server. Geen database-tabellen, AJAX- of REST-opslag. |
| shortcode      | `[nutgraph]` zet het bord op een pagina |
| adminmenu      | Menu "Nutgraph" in wp-admin |
| updater        | Updates via GitHub-releases (`Update URI` + filter `update_plugins_github.com`) |
| instellingen   | Instellingen → Nutgraph, met het veld voor de GitHub-repository |
| opslag         | Bibliotheek in localStorage (`verhaalbord.v1.library`, oude naam: niet wijzigen) |
| bronnen        | Links en documenten per briefje; documenten in IndexedDB |
| bibliotheek    | Meerdere verhalen: openen, nieuw, hernoemen, dupliceren, verwijderen |
| whiteboard     | Raster met ruggengraat links en detailkolommen rechts |
| plusknop       | Plusknop in de balk én in elk leeg vak |
| slepen         | Slepen en neerzetten in het raster; bezette plek = wisselen |
| bewerken       | Paneel met titel, kleur, beschrijving, bronnen |
| export         | JSON-export van één verhaal en van de hele bibliotheek, inclusief documenten |
| import         | JSON-import van beide formaten |
| delen          | Deellink met de gecomprimeerde structuur in `#vb=` (zonder documenten) |
| tekstoverzicht | Download als Markdown-schets |

Je mag deze onderdelen verbeteren, maar niet weghalen of hun markering verwijderen.

## Vaste regels
1. **Verhoog bij elke wijziging het versienummer** op drie plekken tegelijk:
   `Version:` in `nutgraph.php`, `NUTGRAPH_VERSION` in `nutgraph.php`
   en `Stable tag:` in `readme.txt`. Kleine fix: 1.0.0 → 1.0.1. Nieuwe functie: 1.0.0 → 1.1.0.
2. **Schrijf een regel in de Changelog** van `readme.txt` onder de nieuwe versie.
3. **Bestaande gegevens blijven werken.** Verander je het datamodel, voeg dan een
   omzetting toe in `normalizeProject()`; oude borden en oude exportbestanden moeten
   blijven openen. Verander de opslagsleutels niet: localStorage `verhaalbord.v1.*` en IndexedDB `verhaalbord` houden hun oude naam, zodat bestaande borden blijven werken. Importeer ook oude exportbestanden met formaat `verhaalbord`.
4. **Geen externe bronnen laden** (geen CDN's, geen Google Fonts, geen trackers).
   Alles zit in de plugin zelf.
5. **Geen `fetch`, `XMLHttpRequest` of `sendBeacon`** in de JavaScript van het bord.
6. **Alle tekst in de interface is Nederlands**, in gewone taal.
7. **Draai `bash tools/check-basis.sh`** voordat je commit. Moet eindigen met
   "Alle basisonderdelen aanwezig."
8. Werk in een aparte branch en open een pull request, tenzij de eigenaar zegt
   dat je direct op `main` mag zetten. Een push naar `main` met een nieuw versienummer
   wordt automatisch uitgebracht naar alle websites.

## Bestanden
- `nutgraph.php` — hoofdbestand, shortcode, menu
- `includes/class-nutgraph-updater.php` — haalt releases van GitHub
- `includes/class-nutgraph-settings.php` — instellingenpagina
- `assets/nutgraph.js` — het hele bord (geen build-stap, gewone JavaScript)
- `assets/nutgraph.css` — opmaak, alles onder `.vb-scope`
- `tools/check-basis.sh` — controle van de basisonderdelen
- `.github/workflows/controle-en-release.yml` — controle en automatische release
