#!/usr/bin/env bash
# Controleert of alle basisonderdelen van Nutgraph er nog in zitten.
# Draait automatisch in GitHub bij elke wijziging. Faalt dit, dan komt er geen release.
set -u
cd "$(dirname "$0")/.."
fouten=0

fout() { echo "FOUT: $1"; fouten=$((fouten + 1)); }
ok()   { echo "ok:   $1"; }

# 1. Verplichte bestanden
for f in nutgraph.php includes/class-nutgraph-updater.php includes/class-nutgraph-settings.php \
         assets/nutgraph.js assets/nutgraph.css readme.txt; do
  [ -f "$f" ] && ok "bestand $f" || fout "bestand $f ontbreekt"
done

# 2. Basisonderdelen: markering => bestand
while IFS='|' read -r marker file; do
  [ -z "$marker" ] && continue
  if grep -q "@basis:$marker" "$file" 2>/dev/null || grep -q "@basis: $marker" "$file" 2>/dev/null; then
    ok "basisonderdeel '$marker'"
  else
    fout "basisonderdeel '$marker' ontbreekt in $file"
  fi
done <<'LIJST'
privacy|nutgraph.php
shortcode|nutgraph.php
adminmenu|nutgraph.php
updater|includes/class-nutgraph-updater.php
instellingen|includes/class-nutgraph-settings.php
opslag|assets/nutgraph.js
bronnen|assets/nutgraph.js
export|assets/nutgraph.js
import|assets/nutgraph.js
delen|assets/nutgraph.js
tekstoverzicht|assets/nutgraph.js
bibliotheek|assets/nutgraph.js
whiteboard|assets/nutgraph.js
slepen|assets/nutgraph.js
plusknop|assets/nutgraph.js
bewerken|assets/nutgraph.js
LIJST

# 3. Functies die er echt moeten zijn (niet alleen de markering)
for fn in exportProject exportLibrary readImport encodeShare decodeShare toMarkdown makeDraggable openPanel addNote renderLibrary; do
  grep -q "$fn" assets/nutgraph.js && ok "functie $fn" || fout "functie $fn ontbreekt in nutgraph.js"
done
grep -q "add_shortcode( 'nutgraph'" nutgraph.php && ok "shortcode [nutgraph]" || fout "shortcode [nutgraph] is niet geregistreerd"
grep -q "update_plugins_github.com" includes/class-nutgraph-updater.php && ok "GitHub-updatekoppeling" || fout "GitHub-updatekoppeling ontbreekt"
grep -q "^ \* Update URI: *https://github.com" nutgraph.php && ok "Update URI" || fout "regel 'Update URI: https://github.com/...' ontbreekt in de kop"

# 4. Versienummers moeten overeenkomen
kop=$(grep -m1 -E "^ \* Version:" nutgraph.php | sed -E 's/.*Version:[[:space:]]*//' | tr -d '[:space:]')
const=$(grep -m1 "NUTGRAPH_VERSION'," nutgraph.php | sed -E "s/.*'NUTGRAPH_VERSION', *'([^']+)'.*/\1/")
stable=$(grep -m1 -E "^Stable tag:" readme.txt | sed -E 's/Stable tag:[[:space:]]*//' | tr -d '[:space:]')
if [ -n "$kop" ] && [ "$kop" = "$const" ] && [ "$kop" = "$stable" ]; then
  ok "versie $kop staat overal gelijk"
else
  fout "versienummers verschillen: kop='$kop' constante='$const' readme='$stable'"
fi

# 5. Privacy: geen opslag of verzending van verhaalgegevens naar een server
if grep -nE "wp_ajax_|register_rest_route|\\\$wpdb|update_option\(|add_option\(" nutgraph.php includes/*.php | grep -v "nutgraph_github_repo"; then
  fout "PHP-code lijkt gegevens op de server op te slaan (zie regels hierboven)"
else
  ok "geen serveropslag in PHP"
fi
if grep -nE "fetch\(|XMLHttpRequest|sendBeacon|navigator\.sendBeacon|\\\$\.ajax" assets/*.js; then
  fout "JavaScript lijkt gegevens te versturen (zie regels hierboven)"
else
  ok "geen verzending vanuit JavaScript"
fi

# 6. Syntaxis
if command -v php >/dev/null; then
  for f in nutgraph.php includes/*.php; do
    php -l "$f" >/dev/null 2>&1 && ok "PHP-syntaxis $f" || fout "PHP-syntaxisfout in $f"
  done
else
  echo "let op: php niet gevonden, syntaxis overgeslagen"
fi
if command -v node >/dev/null; then
  node --check assets/nutgraph.js && ok "JavaScript-syntaxis" || fout "JavaScript-syntaxisfout"
else
  echo "let op: node niet gevonden, syntaxis overgeslagen"
fi

echo
if [ "$fouten" -gt 0 ]; then
  echo "$fouten fout(en). Deze versie wordt NIET uitgebracht."
  exit 1
fi
echo "Alle basisonderdelen aanwezig."
