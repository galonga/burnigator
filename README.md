# Bildkarte (Leaflet CRS.Simple)

Eine kleine, datenbankfreie Kartenanwendung für normales PHP-Webhosting wie ALL-INKL. Besucher sehen eine Bildkarte und POIs mit Kategorien und automatisch erzeugter Legende. Die Inhaberin oder der Inhaber pflegt Bild, Kategorien und Orte im Adminbereich.

## Voraussetzungen

- PHP 7.4 oder neuer, mit den üblichen Funktionen für JSON, Sessions, Datei-Uploads und GD/Fileinfo (Bildprüfung)
- HTTPS empfohlen
- Leaflet und Font Awesome Free sind lokal eingebunden. Die Karte und die Symbolauswahl funktionieren daher ohne externe CDN-Verbindung. SoundCloud-Musik und Matomo-Tracking benötigen weiterhin eine Internetverbindung.
- Die Oberfläche lässt sich über den Sprachschalter auf Deutsch oder Englisch umstellen; die Auswahl bleibt im Browser gespeichert. Font Awesome liefert die durchsuchbare Symbolauswahl.
- Kein Docker, keine Datenbank und kein Composer nötig

## Designsystem für UI-Änderungen

Vor jeder Änderung an der Besucher- oder Adminoberfläche bitte [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) und die zentralen Regeln in `assets/design-system.css` berücksichtigen. Farben werden über semantische `--color-*`-Tokens gesteuert; Typografie, Abstände, Formen und Control-Mindestgrößen über die jeweiligen `--type-*`, `--space-*`, `--shape-*` und `--control-height*`-Tokens. Neue oder geänderte interaktive Komponenten müssen ihre passenden Hover-, Fokus-, Aktiv-, Auswahl-, Aufklapp-, Deaktiviert-, Lade- und Fehlerzustände konsistent definieren und semantisch auszeichnen (z.B. `aria-selected`, `aria-pressed`, `aria-expanded`, `aria-invalid`, `aria-busy`). Bestehende Komponentenregeln sollen erweitert werden, statt parallele Einzellösungen für Buttons, Eingabefelder oder Karten einzuführen. `sources/` ist Referenzmaterial und bleibt unverändert.

Die sichtbare Build-Anzeige steht aktuell auf **1343**. Bei jeder folgenden App-Änderung muss die angezeigte Nummer um eins steigen; die Offline-Cache-Version in `sw.js` ist dabei ebenfalls zu aktualisieren.

Der optionale Impress-Link wird bei der Ersteinrichtung abgefragt und kann später unter **Konfiguration → Allgemeine Einstellungen** geändert werden. Ist das Feld leer, erscheint kein Impress-Link im Besucherfooter.

Im Adminbereich unter **Konfiguration → SoundCloud-Player** kann der Owner den Player in der Besucheransicht ein- oder ausblenden und die verwendete öffentliche SoundCloud-Playlist festlegen. Standardmäßig ist der Player sichtbar und verwendet die Minmon-Podcast-Playlist.

## Installation per FTP

1. Entpacke `image-map.zip` auf deinem Rechner.
2. Lade den Inhalt des Ordners `image-map/` per FTP in einen eigenen Webordner, zum Beispiel `www/karte/`.
3. Öffne `https://deine-domain.example/karte/setup.php` und lege ein starkes Passwort mit mindestens 12 Zeichen fest.
4. Melde dich unter `/karte/admin.php` mit Benutzername `owner` und dem bei der Einrichtung gewählten Passwort an.
5. Lade ein PNG- oder JPG-Hintergrundbild hoch. Lege Kategorien mit Namen und Farbe an. Klicke anschließend auf die Karte, um Orte zu setzen. Ziehe vorhandene Marker direkt an die gewünschte Stelle. Optional kannst du im Adminbereich ein PNG-Titellogo und ein PNG-Favicon hochladen. Das Logo ersetzt die Titelzeile; ein Klick auf Titel oder Logo öffnet hamburn.de in einem neuen Tab.
6. Trage Name, Font Awesome Symbol, Beschreibung und Kategorie ein und wähle **Änderungen speichern**. Die durchsuchbare Symbolsammlung enthält zahlreiche freie Symbole. Bereits gespeicherte Unicode-Symbole bleiben sichtbar. Den Symbolmodus stellst du oben im Adminbereich ein; die Einstellung gilt für alle POIs und Besucher. Im Adminbereich sind Orte nach Kategorien gruppiert; mit **Alle einklappen**/**Alle ausklappen** kannst du die Übersicht steuern. Eingeklappte Einträge zeigen Icon und Namen. Aktiviere **Hat Programm**, wenn ein Ort Programmpunkte hat, und füge je Tag von Mittwoch bis Sonntag Startzeit, Endzeit, Veranstaltung und optional eine Beschreibung hinzu. Zusätzlich lassen sich bis zu drei frei benannte Timelines ohne Ortsbindung anlegen; sie erscheinen im WWW als eigene, abgeteilte Zeilen. Das Owner- und das WWW-Konto können diese Timelines bearbeiten. Optional kannst du eine externe URL und einen Linktext ergänzen; nur gültige HTTP- und HTTPS-Links werden gespeichert. Für Veranstaltungen lassen sich im Kategorien-Dropdown mehrere passende Symbole auswählen, etwa Musik, Performance, Bewegung, Ruhe, Lautstärke, Basteln oder 18+-Inhalte. Besucher sehen diese Orte im Tab **WWW (Verpassungsschutz)**; Veranstaltungen liegen auf einer 24-Stunden-Zeitleiste mit kompakteren Ortsnamen, damit mehr vom Zeitraster sichtbar bleibt. Beim Überfahren eines Programmpunkts erscheinen die Eventkategorien mit Symbol und Namen, Beschreibung sowie ein optionaler Link. Die Orte in der Seitenliste und der POI-Popup auf der Karte verlinken direkt zum WWW-Eintrag. In der Besucher-Topbar neben dem Titel spielt ein kompakter SoundCloud-Player die Playlist [minmon podcast](https://soundcloud.com/minmon_kollektiv/sets/minmon-podcast) ab; Play, Pause, nächster Titel und ein Lautstärkeregler stehen bereit. Nach einem Klick auf Play wird ein zufälliger Titel geladen; der aktuelle Titel ist als Link zu seiner SoundCloud-Seite anklickbar. Der Player zeigt **Lust auf Groove?** / **Need some groove?**, benötigt eine Internetverbindung zu SoundCloud und startet erst nach Klick auf **Play**. Die Schaltfläche **Vollsicherung exportieren** lädt Kartendaten, POIs, ortsgebundene Programme, zusätzliche Timelines, Logo, Favicon und Hintergrundbild gemeinsam herunter; **Vollsicherung importieren** kann diese Sicherung wiederherstellen. Die fünf letzten Kartenstände lassen sich im Owner-Adminbereich automatisch wiederherstellen. Über den Sprachschalter kannst du die Oberfläche zwischen Deutsch und Englisch umschalten. Die Besucherkarte liegt unter `/karte/`.

## Eingeschränkte Zusatzkonten

Im Adminbereich des Owner-Kontos kannst du zwei zusätzliche Konten einrichten: ein POI-Konto und ein WWW-Konto. Vergib jeweils einen Benutzernamen und ein Passwort mit mindestens 12 Zeichen. Das POI-Konto kann POIs anlegen, verschieben, bearbeiten und löschen, aber keine Kategorien, Bilder oder Programmdaten ändern. Das WWW-Konto kann ausschließlich die Programmfreigabe und die Veranstaltungen bearbeiten. Leere Passwortfelder behalten ein vorhandenes Passwort; einen Benutzernamen leer lassen und speichern entfernt dieses Konto.

Das Owner-Adminprotokoll zeigt die letzten Änderungen mit Benutzername, Rolle und Zeitstempel; Einträge werden in `data/history.json` gespeichert. Im Owner-Bereich kannst du außerdem eine eigene Beschriftung und HTTP(S)-URL für einen zusätzlichen Besucher-Topbar-Button festlegen.

Die Berechtigungen werden in der PHP-API geprüft, nicht nur durch ausgeblendete Admin-Steuerelemente. Konten und Passwort-Hashes liegen in `data/accounts.json`; `.htaccess` sperrt den direkten Zugriff auf `data/`. Schreibzugriffe der eingeschränkten Konten aktualisieren nur ihre eigenen Datenfelder. Jede Änderung trägt zusätzlich die geladene Datenrevision mit; wenn zwischenzeitlich jemand gespeichert hat, wird der Speichervorgang abgelehnt und die Oberfläche fordert zum Neuladen auf, statt fremde Änderungen zu überschreiben. Nach fünf falschen Anmeldeversuchen von derselben IP-Adresse wird der Login für 15 Minuten gesperrt. Sitzungscookies sind `HttpOnly`, `SameSite=Lax` und bei HTTPS `Secure`.

## Schreibrechte auf ALL-INKL

PHP muss `config.php` während der Ersteinrichtung sowie die Ordner `data/` und `uploads/` beschreiben dürfen. Normalerweise erstellt das Setup die Unterordner selbst. Falls es wegen der Rechte scheitert, lege `data` und `uploads` im FTP-Programm an und gib nur diesen Ordnern die vom Hosting geforderten Schreibrechte (typischerweise 755 oder 775). Stelle danach möglichst restriktive Rechte ein. `config.php` muss nach dem Setup nicht mehr beschreibbar sein.

## Dateien und Schutz

- `index.php`: öffentliche Karte, ausschließlich lesend
- `admin.php`: Anmeldung, Rollenoberflächen und Kontoverwaltung
- `auth.php`: Sitzungsrollen, Kontenspeicherung und Dateisperre
- `api.php`: öffentliche Leseantwort und angemeldete, CSRF-geschützte Schreibaktionen
- `data/map.json` und `data/accounts.json`: Kartendaten (einschließlich bis zu drei ortsunabhängigen Timelines) und Konten; durch `.htaccess` gegen direkten Abruf geschützt
- `uploads/`: hochgeladene Bilder; PHP-Ausführung und direkter Zugriff sind per `.htaccess` gesperrt. Die Bilder werden über die Kartenansicht eingebettet, deshalb muss der Webserver Bilddateien aus diesem Ordner ausliefern können. Falls der Hoster Regeln in `.htaccess` ignoriert, verschiebe `uploads/` außerhalb des Webroots und konfiguriere die Pfade entsprechend.

Das Setup ist für Apache-kompatibles Hosting mit `.htaccess` gedacht. Sichere `data/map.json`, `config.php` und `uploads/` regelmäßig über FTP. Zusätzlich erstellt die Anwendung vor Kartenänderungen automatisch Snapshots der Kartendaten; der Owner kann die letzten fünf Snapshots im Adminbereich wiederherstellen. Die Snapshots liegen geschützt in `data/snapshots/`. Ein Vollbackup aus dem Adminbereich enthält auch Bilddateien, sodass es unabhängig von der vorhandenen Installation wiederhergestellt werden kann. Das Administratorpasswort wird nur als Hash gespeichert. Schreibzugriffe erfordern eine aktive Sitzung mit passender Rolle und einen CSRF-Token; Uploads sind auf PNG/JPG und 20 MB begrenzt.

## Offline-Besucheransicht

Die Besucheransicht lädt lokale Kopien von Leaflet und Font Awesome und kann nach dem ersten Online-Aufruf als Offline-Kopie im Browser verfügbar bleiben. Ein Service Worker speichert die Oberfläche, Bibliotheken, Kartendaten und aktuelle Kartenbilder zwischen. Die Offline-Nutzung setzt einen Browser mit Service-Worker-Unterstützung und HTTPS voraus (localhost ist für Tests ebenfalls erlaubt). Admin-Anmeldung, Änderungen und SoundCloud-Wiedergabe benötigen eine Netzwerkverbindung.

Neben den JPG-Exporten auf der Karte und im WWW steht **Als App installieren** bereit. Android/Chromium öffnet den nativen Installationsdialog; auf iPhone/iPad zeigt der Button den Weg über Safari **Teilen → Zum Home-Bildschirm**. Das hochgeladene PNG-Favicon wird auf Installationssymbolgröße skaliert und als App-Symbol verwendet. Beim Öffnen der installierten App werden Kartendaten immer frisch vom Server geladen, wenn eine Verbindung verfügbar ist; offline startet sie mit den zuletzt zwischengespeicherten Daten. Matomo protokolliert POI-Klicks nach Ortsnamen, POI-Detailansichten und Klicks auf Programmpunkte als Ereignisse.

## Bedienhinweise

Die Bildkarte nutzt Leaflet `CRS.Simple`. POI-Positionen werden relativ zur Bildbreite und -höhe gespeichert, damit sie beim Vergrößern und Verkleinern korrekt bleiben. Die Karte ist nicht georeferenziert. Besucher können je Kategorie die POI-Namen auf der Karte einblenden und Kategorien aus Karte und Ortsliste ausblenden. Diese Anzeigeauswahl wird lokal im jeweiligen Browser gespeichert. Der Timetable zeigt POIs mit aktiviertem Programm als Zeilen und die Tage Mittwoch bis Sonntag als Spalten; Zellen listen zeitlich sortierte Veranstaltungen. Die Endzeit einer Veranstaltung muss nach ihrer Startzeit am selben Tag liegen. Im Fußbereich wird sichtbar angezeigt, ob die Daten gerade vom Server geladen wurden oder aus dem Offline-Cache stammen. Ein Admin kann POIs anlegen, benennen, ein Font Awesome Symbol im Kartenpunkt auswählen oder einen eigenen Unicode-Zeichenwert verwenden, beschreiben, Kategorien zuweisen, auf der Karte verschieben und löschen sowie Programmpunkte mit Uhrzeit erfassen.
