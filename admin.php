<?php

declare (strict_types=1);
$config = require is_file(__DIR__ . '/config.php') ? __DIR__ . '/config.php' : __DIR__ . '/config.sample.php';
require_once __DIR__ . '/auth.php';
$appVersion = appVersion();
require_once __DIR__ . '/theme_bootstrap.php';
startAppSession($config);
appSendSecurityHeaders();
$role = appRole();
if (empty($config['installed'])) {
    header('Location: setup.php');
    exit;
}
if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
if (isset($_GET['logout'])) {
    $_SESSION = [];
    session_destroy();
    header('Location: admin.php');
    exit;
}
$error = '';
if (empty($_SESSION['admin']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (beginLoginAttempt()) {
        $error = 'loginRateLimited';
    } else {
        $username = strtolower(trim((string) ($_POST['username'] ?? 'owner')));
        $account = appUsers($config)[$username] ?? null;
        if (is_array($account) && !empty($account['password_hash']) && password_verify((string) ($_POST['password'] ?? ''), (string) $account['password_hash'])) {
            recordLoginAttempt(true);
            session_regenerate_id(true);
            $_SESSION['admin'] = true;
            $_SESSION['role'] = (string) $account['role'];
            $_SESSION['username'] = $username;
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
            header('Location: admin.php');
            exit;
        }
        $error = loginIsLimited() ? 'loginRateLimited' : 'badPassword';
    }
}
?><!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Burnigator — Administration</title>
    <link rel="stylesheet" href="assets/vendor/leaflet/leaflet.css" crossorigin="">
    <link rel="stylesheet" href="assets/vendor/fontawesome/css/all.min.css">
    <link rel="stylesheet" href="<?= assetUrl('assets/style.css') ?>">
    <link rel="stylesheet" href="<?= assetUrl('assets/design-system.css') ?>"><script src="<?= assetUrl('assets/matomo.js') ?>"></script>
  </head><body class="admin-page <?php 
echo empty($_SESSION['admin']) ? 'admin-login-page' : 'admin-console-page';
?>">
<?php 
if (empty($_SESSION['admin'])) {
    ?><form class="panel narrow" method="post">
  <header class="form-head">
    <h1 data-i18n="admin">Administration</h1>
    <select id="language-switch" aria-label="Language" data-i18n-aria="lang"><option value="de">DE</option><option value="en">EN</option></select>
  </header>
  <p><a href="index.php" data-i18n="backToMap">Zur Besucherkarte</a></p><?php 
    if ($error) {
        ?><p class="error" data-i18n="<?php 
        echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8');
        ?>"><?php 
        echo htmlspecialchars($error === 'loginRateLimited' ? 'Zu viele Versuche. Bitte 15 Minuten warten.' : 'Passwort nicht korrekt.', ENT_QUOTES, 'UTF-8');
        ?></p><?php 
    }
    ?><label><span data-i18n="username">Benutzername</span><input type="text" name="username" required minlength="3" maxlength="32" autocomplete="username" value="owner"></label>
<label><span data-i18n="password">Passwort</span><input type="password" name="password" required autocomplete="current-password"></label><button class="button button-primary" data-i18n="login">Anmelden</button>
</form><script src="<?= assetUrl('assets/i18n.js') ?>"></script>
<?php 
} else {
    ?>
<header class="topbar">
  <h1 data-i18n="adminTitle">Eventverwaltung</h1><span class="admin-app-name">Burnigator</span>
  <nav>
    <select id="language-switch" aria-label="Language" data-i18n-aria="lang"><option value="de">DE</option><option value="en">EN</option></select> <a class="button button-secondary subtle" href="index.php" data-i18n="visitorMap">Besucherkarte</a> <a class="button button-primary button-danger danger" href="?logout=1" data-i18n="logout">Abmelden</a>
  </nav>
</header>
<main class="admin-layout" data-role="<?php 
    echo htmlspecialchars($role, ENT_QUOTES, 'UTF-8');
    ?>">
<section class="editor">
<nav class="admin-view-tabs" role="tablist" aria-label="Admin views" data-i18n-aria="adminViews" <?php 
    echo $role === 'owner' ? '' : 'hidden';
    ?>>
<button id="admin-edit-tab" class="admin-view-tab chip-button active" type="button" role="tab" aria-selected="true" aria-controls="admin-edit-view" data-i18n="adminEditView">Orte und Programm</button>
<button id="admin-config-tab" class="admin-view-tab chip-button" type="button" role="tab" aria-selected="false" aria-controls="admin-config-view" data-i18n="adminConfigView">Konfiguration</button>
<button id="admin-pinboard-tab" class="admin-view-tab chip-button" type="button" role="tab" aria-selected="false" aria-controls="admin-pinboard-view" data-i18n="adminPinboardView">Pinnwand moderieren</button>
</nav>
<div id="admin-edit-view" role="tabpanel" aria-labelledby="admin-edit-tab">
  <h2 data-i18n="poiHeading">Orte</h2>
  <p class="hint" data-i18n="addPoiHint">Klicke auf die Karte, um einen Ort anzulegen. Ziehe Marker zum Verschieben.</p>
  <div id="poi-editor">
  </div>
<section id="independent-timelines" <?php 
    echo $role === 'poi' ? 'hidden' : '';
    ?>><hr>
<h2 data-i18n="independentTimelines">Event-wide timelines</h2>
<p class="hint" data-i18n="independentTimelinesHint">Add up to three timelines that are not linked to a location.</p>
<div id="timeline-editor">
</div>
</section>
<button id="save-pois" class="button button-primary" data-i18n="save" <?php 
    echo $role === 'poi' ? '' : 'hidden';
    ?>>Änderungen speichern</button>
</div>
<section id="admin-config-view" role="tabpanel" aria-labelledby="admin-config-tab" hidden>
  <nav id="config-section-tabs" class="config-section-tabs" role="tablist" aria-label="Konfigurationsbereiche" data-i18n-aria="configTabsLabel">
  </nav>
<div id="owner-settings" <?php 
    echo $role === 'owner' ? '' : 'hidden';
    ?>>
<section class="config-card" aria-labelledby="config-general-heading">
  <h2 id="config-general-heading" data-i18n="generalSettings">Allgemeine Einstellungen</h2>
  <label><span data-i18n="title">Event-Titel</span><input id="title" maxlength="100"></label>
  <label><span data-i18n="customButtonLabel">Zusatzbutton-Text (optional)</span><input id="custom-button-label" maxlength="40"></label>
  <label><span data-i18n="customButtonUrl">Zusatzbutton-Link (https://…)</span><input id="custom-button-url" type="url" maxlength="2048" placeholder="https://"></label>
  <label><span data-i18n="wwwQrUrl">QR-Code-URL für WWW-JPG (optional)</span><input id="www-qr-url" type="url" maxlength="2048" placeholder="https://"></label>
  <label><span data-i18n="titleLinkUrl">Titel-Link (optional)</span><input id="title-link-url" type="url" maxlength="2048" placeholder="https://"></label>
  <label><span data-i18n="weekStart">Erster Tag des Events</span><select id="week-start"><option value="mon" data-i18n="dayMon">Montag</option><option value="tue" data-i18n="dayTue">Dienstag</option><option value="wed" data-i18n="dayWed">Mittwoch</option><option value="thu" data-i18n="dayThu">Donnerstag</option><option value="fri" data-i18n="dayFri">Freitag</option><option value="sat" data-i18n="daySat">Samstag</option><option value="sun" data-i18n="daySun">Sonntag</option></select></label>
  <p class="hint" data-i18n="weekStartHint">Das Event dauert sieben Tage ab diesem Tag, zum Beispiel Donnerstag bis Mittwoch. Gilt für den Programm-Editor und die Besucheransicht.</p>
  <fieldset class="enabled-days"><legend data-i18n="enabledDays">Verfügbare Event-Tage</legend><label class="setting-toggle"><input type="checkbox" class="enabled-day" value="mon" checked><span data-i18n="dayMon">Montag</span></label><label class="setting-toggle"><input type="checkbox" class="enabled-day" value="tue" checked><span data-i18n="dayTue">Dienstag</span></label><label class="setting-toggle"><input type="checkbox" class="enabled-day" value="wed" checked><span data-i18n="dayWed">Mittwoch</span></label><label class="setting-toggle"><input type="checkbox" class="enabled-day" value="thu" checked><span data-i18n="dayThu">Donnerstag</span></label><label class="setting-toggle"><input type="checkbox" class="enabled-day" value="fri" checked><span data-i18n="dayFri">Freitag</span></label><label class="setting-toggle"><input type="checkbox" class="enabled-day" value="sat" checked><span data-i18n="daySat">Samstag</span></label><label class="setting-toggle"><input type="checkbox" class="enabled-day" value="sun" checked><span data-i18n="daySun">Sonntag</span></label></fieldset>
  <p class="hint" data-i18n="enabledDaysHint">Deaktivierte Tage erscheinen nicht im Programm-Editor für Orte. Bereits eingetragene Events bleiben gespeichert.</p>
  <label><span data-i18n="impressUrl">Impress-Link (optional)</span><input id="impress-url" type="url" maxlength="2048" placeholder="https://"></label>
  <label class="setting-toggle"><input id="browser-translation-enabled" type="checkbox"><span data-i18n="enableBrowserTranslation">Browserübersetzung für WWW-Beschreibungen anbieten</span></label>
  <p class="hint" data-i18n="browserTranslationHint">Nutzt die experimentelle Übersetzungsfunktion des Browsers. Sie erscheint nur in Browsern, die sie unterstützen.</p>
<button id="save-map" class="button button-primary" data-i18n="save">Änderungen speichern</button>
</section>
<section class="config-card" aria-labelledby="publication-heading">
  <h2 id="publication-heading" data-i18n="publicationSettings">Veröffentlichung</h2>
  <p id="publication-status" class="publication-state" role="status"></p>
  <p class="hint" data-i18n="publicationHint">Unveröffentlichte Festivals sind nur für angemeldete Teammitglieder sichtbar. Nur der Owner kann die Sichtbarkeit ändern.</p>
<button id="publication-toggle" type="button" class="button button-primary"></button>
</section>
<section class="config-card" aria-labelledby="config-soundcloud-heading">
  <h2 id="config-soundcloud-heading" data-i18n="soundcloudSettings">SoundCloud-Player</h2>
  <label class="setting-toggle"><input id="soundcloud-enabled" type="checkbox" checked><span data-i18n="showSoundcloudPlayer">SoundCloud-Player in der Besucheransicht anzeigen</span></label>
  <label><span data-i18n="soundcloudPlaylistUrl">SoundCloud-Playlist-URL</span><input id="soundcloud-playlist" type="url" maxlength="2048" placeholder="https://soundcloud.com/…/sets/…"></label>
  <p class="hint" data-i18n="soundcloudPlaylistHint">Es kann eine öffentliche SoundCloud-Playlist mit /sets/ im Link verwendet werden.</p>
<button id="save-soundcloud" type="button" class="button button-primary" data-i18n="saveSoundcloud">SoundCloud-Einstellungen speichern</button>
</section>
<section class="config-card" aria-labelledby="config-appearance-heading">
  <h2 id="config-appearance-heading" data-i18n="appearanceSettings">Erscheinungsbild</h2>
  <p class="hint" data-i18n="appearanceSettingsHint">Passe Farben, Logo und Kartendarstellung an.</p>
  <section class="theme-settings" aria-labelledby="theme-colors-heading">
    <h3 id="theme-colors-heading" data-i18n="themeColors">Hauptfarben der App</h3>
    <p class="hint" data-i18n="themeColorsHint">Diese Farben werden in der Besucheransicht und im Adminbereich verwendet.</p>
    <div class="theme-color-grid">
      <label><span data-i18n="themePrimary">Hauptfarbe</span><input id="theme-primary" type="color" value="#305EAA"></label>
      <label><span data-i18n="themeAccent">Akzentfarbe</span><input id="theme-accent" type="color" value="#E94F85"></label>
      <label><span data-i18n="themeAlert">Warnfarbe</span><input id="theme-alert" type="color" value="#E63D1A"></label>
      <label><span data-i18n="themeBackground">Hintergrundfarbe</span><input id="theme-background" type="color" value="#E6D0BB"></label>
    </div><button id="theme-reset" type="button" class="button button-outlined" data-i18n="themeReset">Standardfarben wiederherstellen</button>
  </section>
  <div class="branding-tools">
    <label><span data-i18n="titleLogo">Titel-Logo (PNG, optional)</span><input id="logo-file" type="file" accept="image/png"></label>
    <div class="branding-upload-row"><button id="upload-logo" type="button" class="button button-secondary subtle" data-i18n="uploadLogo">Logo hochladen</button><img id="logo-preview" class="branding-preview" alt="" hidden>
    </div>
    <label><span data-i18n="favicon">Favicon (PNG, optional)</span><input id="favicon-file" type="file" accept="image/png"></label>
    <div class="branding-upload-row"><button id="upload-favicon" type="button" class="button button-secondary subtle" data-i18n="uploadFavicon">Favicon hochladen</button><img id="favicon-preview" class="branding-preview favicon-preview" alt="" hidden>
    </div>
  </div>
  <label><span data-i18n="iconMode">Symbolfarben</span>
  <select id="icon-mode"><option value="monochrome" data-i18n="mono">Monochrom (schwarz)</option><option value="colored" data-i18n="color">Farbig</option></select></label>
  <label><span data-i18n="image">Veranstaltungskarte (PNG/JPG)</span><input id="image-file" type="file" accept="image/png,image/jpeg"></label>
<button id="upload-image" class="button button-secondary" data-i18n="upload">Bild hochladen</button>
<button id="save-appearance" type="button" class="button button-primary" data-i18n="saveAppearance">Erscheinungsbild speichern</button>
</section>
<section class="config-card" aria-labelledby="config-announcement-heading">
  <h2 id="config-announcement-heading" data-i18n="announcementTitle">Hinweis für Besucher</h2>
  <p class="hint" data-i18n="announcementIntro">Ein kurzer Hinweis, der oben auf der Besucherseite erscheint.</p>
  <label><span data-i18n="announcementText">Text (max. 300 Zeichen)</span><textarea id="announcement-text" maxlength="300" rows="3"></textarea></label>
  <label><span data-i18n="announcementLevel">Art</span><select id="announcement-level"><option value="info" data-i18n="announcementLevelInfo">Information</option><option value="warning" data-i18n="announcementLevelWarning">Warnung</option></select></label>
  <p id="announcement-status" class="hint" role="status" aria-live="polite"></p>
  <button id="announcement-save" type="button" class="button button-primary" data-i18n="announcementSave">Hinweis veröffentlichen</button>
  <button id="announcement-clear" type="button" class="button button-secondary" data-i18n="announcementClear">Hinweis entfernen</button>
</section>
<section class="config-card" aria-labelledby="config-categories-heading">
  <h2 id="config-categories-heading" data-i18n="categories">Kategorien</h2>
  <div id="category-editor">
  </div>
  <div class="inline"><input id="new-category" placeholder="Neue Kategorie" maxlength="60" data-i18n-placeholder="newCategory"><input id="new-color" type="color" value="#E94F85"><button id="add-category" class="button button-primary" data-i18n="add">Hinzufügen</button>
  </div>
<button id="save-categories" type="button" class="button button-primary" data-i18n="saveCategories">Kategorien speichern</button>
</section>
<section class="config-card" aria-labelledby="config-tracking-heading">
  <h2 id="config-tracking-heading" data-i18n="matomoSettings">Matomo-Tracking</h2>
  <p class="hint" data-i18n="matomoSettingsHint">Gib die Basisadresse deiner Matomo-Installation und die Website-ID ein. Eine leere Adresse deaktiviert das Tracking.</p>
  <label><span data-i18n="matomoUrl">Matomo-URL</span><input id="matomo-url" type="url" maxlength="2048" placeholder="https://example.org/matomo/"></label>
  <label><span data-i18n="matomoSiteId">Seiten-ID</span><input id="matomo-site-id" type="number" min="1" max="999999999" step="1" inputmode="numeric"></label>
<button id="save-tracking" type="button" class="button button-primary" data-i18n="saveTracking">Tracking-Einstellungen speichern</button>
</section>
</div>
<div id="owner-tools" <?php 
    echo $role === 'owner' ? '' : 'hidden';
    ?>>
<section class="config-card" aria-labelledby="database-heading">
  <h2 id="database-heading" data-i18n="databaseTitle">Datenbankverbindung</h2>
  <p class="hint" data-i18n="databaseIntro">Die Pinnwand und die Event-Authentifizierung speichern Bestellungen, Anmeldungen und Beiträge in einer MariaDB-/MySQL-Datenbank. Ohne Datenbankverbindung sind beide Funktionen nicht nutzbar. Die Karte und das Programm funktionieren auch ohne Datenbank.</p>
  <p id="database-status" class="database-status" role="status" aria-live="polite"></p>
  <p id="database-managed-note" class="hint" hidden data-i18n="databaseManagedByEnvironment">Die Zugangsdaten werden über Servervariablen (BURNIGATOR_DB_*) gesetzt und können hier nicht geändert werden.</p>
  <div id="database-form">
    <label><span data-i18n="setupDatabaseHost">Datenbank-Host</span><input id="database-host" maxlength="255" placeholder="localhost" autocomplete="off"></label>
    <label><span data-i18n="setupDatabaseName">Datenbankname</span><input id="database-name" maxlength="64" autocomplete="off"></label>
    <label><span data-i18n="setupDatabaseUser">Datenbank-Benutzer</span><input id="database-user" maxlength="128" autocomplete="off"></label>
    <label><span data-i18n="setupDatabasePassword">Datenbank-Passwort</span><input id="database-password" type="password" maxlength="256" autocomplete="new-password" placeholder="••••••••"></label>
    <p class="hint" data-i18n="databasePasswordHint">Ein leeres Passwortfeld behält das gespeicherte Passwort bei. Die Verbindung wird vor dem Speichern getestet und die benötigten Tabellen werden angelegt.</p>
    <p class="hint" data-i18n="databaseChangeHint">Wenn du eine andere Datenbank einträgst, bleiben bisherige Bestellungen und Beiträge in der alten Datenbank. Gäste müssen sich danach neu anmelden und die Bestellungen müssen neu synchronisiert werden.</p>
    <button id="save-database" type="button" class="button button-primary" data-i18n="databaseSave">Verbindung testen und speichern</button>
    <button id="remove-database" type="button" class="button button-outlined" data-i18n="databaseRemove" hidden>Verbindung entfernen</button>
  </div>
</section>
<section class="config-card" aria-labelledby="event-auth-heading">
  <h2 id="event-auth-heading" data-i18n="eventAuthTitle">Event-Authentifizierung</h2>
  <p class="hint" data-i18n="eventAuthIntro">Mit der Event-Authentifizierung melden sich Gäste mit ihrer Pretix-Bestellnummer an. Nur wer eine bezahlte Bestellung für dieses Event hat, kann auf der Pinnwand schreiben, und Event-Owner können damit ihr Event bearbeiten.</p>
  <p class="hint" data-i18n="eventAuthPrivacy">Bestellnummern werden nur beim Abgleich verwendet und als HMAC-Hash gespeichert.</p>
  <p id="event-auth-http-warning" class="error" role="alert" hidden data-i18n="eventAuthHttpWarning">Diese Seite wird ohne HTTPS ausgeliefert. Teilnehmer-Logins, Sitzungs-Cookies und der Pretix-Token werden dann unverschlüsselt übertragen. Bitte HTTPS aktivieren, sobald die Pinnwand live genutzt wird.</p>
  <p id="event-auth-database-notice" class="error" role="status" hidden><span data-i18n="databaseRequiredNotice">Dafür ist eine Datenbankverbindung erforderlich.</span> <button type="button" class="button button-text" data-goto-database data-i18n="databaseSetupLink">Datenbankverbindung einrichten</button></p>
  <section class="account-settings-group" aria-labelledby="pretix-heading">
    <h3 id="pretix-heading" data-i18n="pretixHeading">Pretix-Anbindung</h3>
    <p class="hint" data-i18n="pretixExplain">Pretix ist ein Ticketsystem. Burnigator fragt über die Pretix-API die Bestellnummern und deren Status ab (nur lesend) und erlaubt nur bezahlten Bestellungen den Zugang. Namen, E-Mail-Adressen und Zahlungsdaten werden nicht abgerufen oder gespeichert. Den Abgleich startest du mit „Jetzt synchronisieren“.</p>
    <label><span data-i18n="pretixBaseUrl">Pretix-Basisadresse</span><input id="pretix-base-url" type="url" maxlength="300" placeholder="https://pretix.eu"></label>
    <label><span data-i18n="pretixOrganizer">Organizer-Kennung</span><input id="pretix-organizer" maxlength="80"></label>
    <label><span data-i18n="pretixEvent">Event-Kennung</span><input id="pretix-event" maxlength="80"></label>
    <label><span data-i18n="pretixToken">Pretix API-Token</span><input id="pretix-token" type="password" maxlength="500" autocomplete="new-password" placeholder="••••••••"></label>
    <p class="hint" data-i18n="pretixTokenHint">Der Token wird serverseitig gespeichert. Ein leeres Feld behält den bestehenden Token bei.</p>
    <p class="hint"><span data-i18n="pretixTokenHelp">Du findest den Token in Pretix bei deinem Organizer-Team: Team öffnen und unterhalb der Teammitglieder einen API-Token mit Leserechten für Bestellungen anlegen. Den Token zeigt Pretix nur einmal an.</span> <a href="https://docs.pretix.eu/dev/api/tokenauth.html" target="_blank" rel="noopener noreferrer" data-i18n="pretixTokenDocs">Pretix-Anleitung öffnen</a></p>
    <div class="event-auth-actions"><button id="save-event-auth" type="button" class="button button-primary" data-i18n="save">Änderungen speichern</button>
<button id="sync-pretix" type="button" class="button button-secondary" data-i18n="syncPretix">Jetzt synchronisieren</button></div>
  </section>
  <section class="account-settings-group" aria-labelledby="csv-heading">
    <h3 id="csv-heading" data-i18n="csvHeading">CSV-Import statt Pretix</h3>
    <p class="hint" data-i18n="csvExplain">Ohne Pretix-Anbindung kannst du die Bestellungen als CSV-Datei hochladen, zum Beispiel aus einem anderen Ticketsystem.</p>
  <label><span data-i18n="csvFallback">CSV-Import (Fallback)</span><input id="orders-csv" type="file" accept=".csv,text/csv"></label>
  <div class="csv-format-help">
    <p class="hint" data-i18n="csvFormatHelp">UTF-8-CSV mit Kopfzeile und exakt zwei Spalten: Order code und Status. Eine Zeile je Bestellung.</p><pre>Order code,Status
RBJVJ,paid
XWDYD,canceled
9U7EN,expired</pre>
    <p class="hint" data-i18n="csvFormatValues">paid erlaubt das Schreiben, canceled und expired sperren. Erstattete Bestellungen dürfen nicht als paid importiert werden.</p>
  </div>
<button id="import-orders-csv" type="button" class="button button-secondary" data-i18n="importCsv">CSV importieren</button>

  </section>
  <p id="event-auth-status" class="hint" role="status" aria-live="polite"></p>
  <section class="event-auth-order-overview" aria-labelledby="event-auth-order-overview-title">
    <h3 id="event-auth-order-overview-title" data-i18n="eventAuthOrderOverviewTitle">Gespeicherte Buchungsdaten</h3>
    <p class="hint" data-i18n="eventAuthOrderOverviewHint">Gruppiert nach Status, Quelle und Postingberechtigung. Bestellnummern werden nicht angezeigt.</p>
    <div id="event-auth-order-overview" class="table-scroll">
    </div>
  </section>
</section>
<section class="config-card" aria-labelledby="database-heading">
  <h2 id="database-heading" data-i18n="databaseTitle">Datenbankverbindung</h2>
  <p class="hint" data-i18n="databaseIntro">Die Pinnwand und die Event-Authentifizierung speichern Bestellungen, Anmeldungen und Beiträge in einer MariaDB-/MySQL-Datenbank. Ohne Datenbankverbindung sind beide Funktionen nicht nutzbar. Die Karte und das Programm funktionieren auch ohne Datenbank.</p>
  <p id="database-status" class="database-status" role="status" aria-live="polite"></p>
  <p id="database-managed-note" class="hint" hidden data-i18n="databaseManagedByEnvironment">Die Zugangsdaten werden über Servervariablen (BURNIGATOR_DB_*) gesetzt und können hier nicht geändert werden.</p>
  <div id="database-form">
    <label><span data-i18n="setupDatabaseHost">Datenbank-Host</span><input id="database-host" maxlength="255" placeholder="localhost" autocomplete="off"></label>
    <label><span data-i18n="setupDatabaseName">Datenbankname</span><input id="database-name" maxlength="64" autocomplete="off"></label>
    <label><span data-i18n="setupDatabaseUser">Datenbank-Benutzer</span><input id="database-user" maxlength="128" autocomplete="off"></label>
    <label><span data-i18n="setupDatabasePassword">Datenbank-Passwort</span><input id="database-password" type="password" maxlength="256" autocomplete="new-password" placeholder="••••••••"></label>
    <p class="hint" data-i18n="databasePasswordHint">Ein leeres Passwortfeld behält das gespeicherte Passwort bei. Die Verbindung wird vor dem Speichern getestet und die benötigten Tabellen werden angelegt.</p>
    <p class="hint" data-i18n="databaseChangeHint">Wenn du eine andere Datenbank einträgst, bleiben bisherige Bestellungen und Beiträge in der alten Datenbank. Gäste müssen sich danach neu anmelden und die Bestellungen müssen neu synchronisiert werden.</p>
    <button id="save-database" type="button" class="button button-primary" data-i18n="databaseSave">Verbindung testen und speichern</button>
    <button id="remove-database" type="button" class="button button-outlined" data-i18n="databaseRemove" hidden>Verbindung entfernen</button>
  </div>
</section>
<section class="config-card" aria-labelledby="config-data-heading">
  <h2 id="config-data-heading" data-i18n="dataTools">Datensicherung</h2>
  <div class="data-tools"><button id="export-map" type="button" class="button button-secondary" data-i18n="exportData">Exportieren</button>
    <label class="import-file button-secondary"><span data-i18n="importData">Importieren</span><input id="import-map" type="file" accept="application/json,.json"></label>
  </div>
  <p class="hint" data-i18n="importHint">Import überschreibt Titel, Kategorien, Orte und Symboleinstellungen. Die Veranstaltungskarte bleibt erhalten.</p>
</section>
<section class="config-card" aria-labelledby="config-accounts-heading">
  <h2 id="config-accounts-heading" data-i18n="accountsHeading">Zusatzkonten</h2>
  <p class="hint" data-i18n="accountsHint">Erstelle ein eingeschränktes Konto für POIs und eines für das WWW-Programm. Ein leeres Passwort lässt das bestehende Passwort unverändert.</p>
  <section class="account-settings-group" aria-labelledby="poi-account-heading">
    <h3 id="poi-account-heading" data-i18n="poiAccount">POI-Konto</h3>
    <label><span data-i18n="accountUsername">Benutzername</span><input id="poi-account-username" maxlength="32" autocomplete="off"></label>
    <label><span data-i18n="newPassword">Neues Passwort (mindestens 12 Zeichen)</span><input id="poi-account-password" type="password" minlength="12" autocomplete="new-password"></label>
    <label><span data-i18n="repeatNewPassword">Neues Passwort wiederholen</span><input id="poi-account-password-repeat" type="password" minlength="12" autocomplete="new-password"></label>
  </section>
  <section class="account-settings-group" aria-labelledby="www-account-heading">
    <h3 id="www-account-heading" data-i18n="wwwAccount">WWW-Konto</h3>
    <label><span data-i18n="accountUsername">Benutzername</span><input id="www-account-username" maxlength="32" autocomplete="off"></label>
    <label><span data-i18n="newPassword">Neues Passwort (mindestens 12 Zeichen)</span><input id="www-account-password" type="password" minlength="12" autocomplete="new-password"></label>
    <label><span data-i18n="repeatNewPassword">Neues Passwort wiederholen</span><input id="www-account-password-repeat" type="password" minlength="12" autocomplete="new-password"></label>
  </section>
<button id="save-accounts" type="button" class="button button-secondary" data-i18n="saveAccounts">Konten speichern</button>
</section>
<section class="config-card" aria-labelledby="config-owner-password-heading">
  <h2 id="config-owner-password-heading" data-i18n="changeOwnerPassword">Owner-Passwort ändern</h2>
  <label><span data-i18n="currentPassword">Aktuelles Passwort</span><input id="owner-current-password" type="password" autocomplete="current-password" required></label>
  <label><span data-i18n="newOwnerPassword">Neues Passwort (mindestens 12 Zeichen)</span><input id="owner-new-password" type="password" minlength="12" autocomplete="new-password" required></label>
  <label><span data-i18n="repeatNewPassword">Neues Passwort wiederholen</span><input id="owner-new-password-repeat" type="password" minlength="12" autocomplete="new-password" required></label>
<button id="save-owner-password" type="button" class="button button-secondary" data-i18n="saveOwnerPassword">Passwort ändern</button>
</section>
<section class="config-card" aria-labelledby="config-history-heading">
  <h2 id="config-history-heading" data-i18n="historyHeading">Änderungsverlauf</h2>
  <div id="change-history" class="change-history" aria-live="polite">
  </div>
</section>
<section class="config-card reset-app-card" aria-labelledby="reset-app-heading">
  <h2 id="reset-app-heading" data-i18n="resetAppTitle">Anwendung zurücksetzen</h2>
  <p class="hint" data-i18n="resetAppDescription">Setzt Burnigator vollständig auf den Einrichtungszustand zurück. Eventdaten, Bilder, Konten, Pinnwand und Anmeldedaten werden gelöscht.</p>
  <p class="error" data-i18n="resetAppWarning">Diese Aktion kann nicht rückgängig gemacht werden. Erstelle vorher eine Sicherung.</p>
  <label><span data-i18n="resetAppPhraseLabel">Zur Bestätigung genau eingeben: RESET BURNIGATOR</span><input id="reset-app-confirm" maxlength="32" autocomplete="off"></label>
  <label><span data-i18n="currentPassword">Aktuelles Passwort</span><input id="reset-app-password" type="password" autocomplete="current-password"></label><button id="reset-application" type="button" class="button button-primary button-danger" data-i18n="resetAppButton">Anwendung endgültig zurücksetzen</button>
  <p id="reset-app-status" class="hint" role="status" aria-live="polite"></p>
</section>
</div>
</section>
<section id="admin-pinboard-view" role="tabpanel" aria-labelledby="admin-pinboard-tab" hidden>
<section class="config-card" aria-labelledby="pinboard-moderation-heading">
  <h2 id="pinboard-moderation-heading" data-i18n="pinboardModeration">Pinnwand moderieren</h2>
  <div id="pinboard-database-notice" class="pinboard-database-notice" role="status">
    <p class="hint" data-i18n="pinboardDatabaseRequired">Für die Pinnwand ist eine Datenbankverbindung erforderlich.</p>
    <p id="pinboard-database-state" class="database-status"></p>
    <button type="button" class="button button-secondary" data-goto-database data-i18n="databaseSetupLink">Datenbankverbindung einrichten</button>
  </div>
  <label class="setting-toggle"><input id="pinboard-enabled" type="checkbox"><span data-i18n="pinboardEnabledToggle">Pinnwand für Besucher aktivieren</span></label>
  <p class="hint" data-i18n="pinboardEnabledHint">Die Aktivierung blendet den Pinnwand-Tab ein. Zum Speichern von Beiträgen wird eine eingerichtete Datenbank benötigt.</p>
  <div id="admin-pinboard-posts" class="scroll-list" role="region" tabindex="0" aria-labelledby="pinboard-moderation-heading">
  </div>
</section>
</section>
<p id="status" role="status"></p>
</section>
<div id="map" aria-label="Karte bearbeiten" data-i18n-aria="mapLabel">
</div>
</main>
<script src="<?= assetUrl('assets/avatar.js') ?>"></script><script src="<?= assetUrl('assets/config-tabs.js') ?>"></script><script src="<?= assetUrl('assets/event-auth-admin.js') ?>"></script><script src="<?= assetUrl('assets/announcement-admin.js') ?>"></script>
<script>window.MAP_CSRF=<?php 
    echo json_encode($_SESSION['csrf']);
    ?>;window.ADMIN_ROLE=<?php 
    echo json_encode($role);
    ?>;</script><script src="assets/vendor/leaflet/leaflet.js" crossorigin=""></script><script src="<?= assetUrl('assets/fa-icons.js') ?>"></script><script src="<?= assetUrl('assets/i18n.js') ?>"></script><?php 
    echo appInitialThemeScript();
    ?><script src="<?= assetUrl('assets/theme.js') ?>"></script><script src="<?= assetUrl('assets/admin.js') ?>"></script><script src="<?= assetUrl('assets/backup-admin.js') ?>"></script><?php 
}
?></body>
</html>

