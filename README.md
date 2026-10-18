# ferien-countdown-bayern
    Web-App mit Countdown bis zu den nächsten bayerischen Schulferien

## Automatische PWA-Updates

Die Service-Worker-Adresse und der Manifest-Scope bleiben unverändert. Bereits
installierte Apps können daher weiterverwendet werden; eine Neuinstallation ist
nicht nötig. Design und Countdown-Berechnung bleiben unverändert.

- `pwa-update.js` registriert mit `updateViaCache: "none"` und prüft beim Start,
  bei `pageshow`, beim Zurückkehren in den Vordergrund (`visibilitychange`) und
  beim Wiederherstellen der Verbindung. Prüfungen sind auf höchstens einmal pro
  Minute begrenzt; es gibt kein permanentes Polling.
- Ein neuer Worker lädt zuerst die vollständige Offline-App mit `cache: "reload"`.
  Erst nach erfolgreicher Installation folgen `skipWaiting()` und beim Aktivieren
  `clients.claim()`. Schlägt ein Download fehl, bleibt der bisherige Worker aktiv.
- HTML, CSS, JavaScript, Manifest und Bilder werden zuerst aus dem Netz mit
  `cache: "no-cache"` geladen: Der HTTP-Cache muss revalidieren. Bei Netzfehlern,
  HTTP-Fehlern oder nach fünf Sekunden ohne Antwort greift die Offline-Kopie.
  CSS und JavaScript bekommen niemals HTML als Ersatz. Andere Pfade und fremde
  Domains werden nicht in den App-Cache aufgenommen. Speicherfehler beim
  Aktualisieren des Caches verhindern keine erfolgreiche Online-Antwort.
- Nur eigene alte App-Caches werden entfernt, einschließlich der bisherigen
  `ferien-countdown-vN`-Caches. Caches anderer Anwendungen bleiben erhalten.
- Ein tatsächlicher Controller-Wechsel lädt eine bereits kontrollierte Seite
  höchstens einmal pro Dokument neu. Die Erstinstallation löst keinen Reload aus.
  Hintergrundfenster warten bis zur nächsten Sichtbarkeit. Unveränderte Worker
  lösen keinen Reload aus.

### Künftige Veröffentlichungen

Bei jeder Änderung am Offline-App-Shell (HTML, CSS, JS, Manifest, Icon) die
`VERSION` in `service-worker.js` erhöhen und alle Dateien gemeinsam über GitHub
Pages veröffentlichen. Neue benötigte Dateien außerdem in `APP_SHELL` aufnehmen.
Dadurch wird die Veröffentlichung auch bei bereits geöffneten Apps als
Worker-Update erkannt und die neue Offline-Kopie vollständig vorbereitet.
Ohne Versionswechsel werden neue Dateien zwar beim nächsten Online-Laden
revalidiert, eine schon geöffnete Seite erhält aber keinen sofortigen Reload.
Service-Worker-Dateiname, Scope und `start_url` sollten erhalten bleiben.

### iOS und iPadOS

Safari und eine installierte Home-Bildschirm-App können getrennte Laufzeit- und
Speicherzustände haben. Ein Update in Safari beweist deshalb nicht, dass die
installierte App bereits aktualisiert wurde. iOS kann Hintergrund-Apps und Worker
anhalten; zuverlässige Hintergrund-Updates oder sofortige Updates bei geschlossener
App sind nicht erzwingbar. Die zusätzliche Prüfung beim erneuten Öffnen bzw.
Vordergrundwechsel hilft, sobald iOS die App wieder ausführt und Netz verfügbar ist.

Beim **ersten Übergang von der alten Version** läuft möglicherweise noch altes
HTML ohne den neuen Update-Listener. Der Browser kann den neuen Worker bereits
übernehmen, die Anzeige bleibt dann aber bis zur nächsten Seitennavigation alt.
Gegebenenfalls die installierte App einmal vollständig schließen und wieder öffnen
(mit Internet); Löschen oder Neuinstallieren ist nicht erforderlich. Danach greift
auch der automatische, einmalige Reload bei künftigen Worker-Updates.

Offline-Verfügbarkeit setzt einen erfolgreichen ersten Online-Start voraus. iOS
kann Website-Speicher bei Speicherdruck entfernen; dagegen kann eine PWA keine
Garantie geben. Nach einer solchen Bereinigung ist zunächst wieder Netz nötig.

## Tests

Ohne zusätzliche Abhängigkeiten:

```sh
node --test tests/countdown.test.cjs tests/pwa.test.cjs
```

Die Lifecycle-Tests prüfen Installation/Fehler, Cache-Bereinigung, Revalidierung,
Offline- und HTTP-Fehler-Rückfall, Zeitlimit, Controller-Wechsel, Reload-Begrenzung
und Vordergrund-Prüfungen. Die bestehenden Countdown-Tests bleiben erhalten.

Optionaler echter Browser-Test (nur Entwicklungsabhängigkeit, kein App-Framework):

```sh
npm install --no-save --package-lock=false playwright
# Chromium installieren oder CHROMIUM_PATH auf ein vorhandenes Binary setzen.
CHROMIUM_PATH=/usr/bin/chromium node tests/pwa-browser.cjs
```

Der lokale HTTP-Testserver simuliert GitHub-Pages-Unterpfad, lange HTTP-Cache-
Laufzeiten, alten Worker, zwei Folgeversionen, fehlgeschlagene Installation und
Offline-Neustarts. Keine Verbindung zur produktiven App wird dafür verändert.

Manuell auf echtem iPhone/iPad vor dem Merge bzw. nach einem Test-Deployment:

1. Alte Version vom Home-Bildschirm online öffnen, dann in den Hintergrund legen.
2. Neue Version veröffentlichen und die installierte App wieder öffnen; beim
   ersten Übergang gegebenenfalls einmal vollständig schließen und erneut öffnen.
3. Flugmodus aktivieren und die installierte App erneut öffnen: Design und
   Countdown müssen weiterhin funktionieren.
4. Eine weitere Version mit erhöhter `VERSION` veröffentlichen. Online zur App
   zurückkehren: einmalige Aktualisierung, keine Reload-Schleife; anschließend
   erneut offline testen. Auch Safari und zwei offene App-Fenster prüfen.

Der automatisierte Chromium-Test ersetzt keinen Test einer installierten
Home-Bildschirm-App auf echtem iOS/iPadOS.
