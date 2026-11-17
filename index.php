<?php

declare (strict_types=1);
$config = require is_file(__DIR__ . '/config.php') ? __DIR__ . '/config.php' : __DIR__ . '/config.sample.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/theme_bootstrap.php';
startAppSession($config, false);
appSendSecurityHeaders();
if (empty($config['installed'])) {
    header('Location: setup.php');
    exit;
}
$publicMap = json_decode((string) @file_get_contents(__DIR__ . '/data/map.json'), true);
$isPublished = !is_array($publicMap) || ($publicMap['published'] ?? true) === true;
$previewOnly = !$isPublished && appCanPreviewUnpublished();
header('X-Burnigator-Published: ' . ($isPublished ? 'true' : 'false'));
if (!$isPublished && !$previewOnly) {
    http_response_code(404);
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow');
    ?><!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Burnigator</title>
    <link rel="stylesheet" href="assets/style.css?v=build-1358">
    <link rel="stylesheet" href="assets/design-system.css?v=build-1358">
  </head>
  <body class="form-page">
    <main class="panel narrow">
      <h1>Burnigator</h1>
      <p data-i18n="festivalUnpublished">Dieses Festival ist noch nicht veröffentlicht.|This festival has not been published yet.</p>
      <label><span data-i18n="lang">Sprache|Language</span>
      <select id="language-switch"><option value="de">DE</option><option value="en">EN</option></select></label>
    </main><script src="assets/i18n.js?v=build-1358"></script>
  </body>
</html><?php 
    exit;
}
if ($previewOnly) {
    header('Cache-Control: private, no-store');
    header('X-Robots-Tag: noindex, nofollow');
}
/**
 * Returns a trimmed http(s) URL from the public map settings, or '' when it is missing or invalid.
 */
function publicSettingUrl($publicMap, string $key): string
{
    $url = is_array($publicMap) && is_string($publicMap[$key] ?? null) ? trim($publicMap[$key]) : '';
    if ($url === '') {
        return '';
    }
    $parts = parse_url($url);
    $valid = strlen($url) <= 2048
        && filter_var($url, FILTER_VALIDATE_URL)
        && is_array($parts)
        && in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true)
        && !empty($parts['host'])
        && !isset($parts['user'])
        && !isset($parts['pass']);
    return $valid ? $url : '';
}

$impressUrl = publicSettingUrl($publicMap, 'impressUrl');
$titleLinkUrl = publicSettingUrl($publicMap, 'titleLinkUrl');
if ($titleLinkUrl !== '') {
    $brandOpen = '<a class="home-brand" href="' . htmlspecialchars($titleLinkUrl, ENT_QUOTES, 'UTF-8') . '" target="_blank" rel="noopener noreferrer">';
    $brandClose = '</a>';
} else {
    $brandOpen = '<div class="home-brand">';
    $brandClose = '</div>';
}
?><!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="theme-color" content="#305EAA">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="Burnigator">
    <title>Burnigator</title>
    <link rel="manifest" href="manifest.php">
    <link rel="apple-touch-icon" href="app-icon.php?size=180">
    <link id="site-favicon" rel="icon">
    <link rel="stylesheet" href="assets/vendor/leaflet/leaflet.css" crossorigin="">
    <link rel="stylesheet" href="assets/vendor/fontawesome/css/all.min.css">
    <link rel="stylesheet" href="assets/style.css?v=build-1358">
    <link rel="stylesheet" href="assets/design-system.css?v=build-1358"><script src="assets/matomo.js?v=admin-matomo-1"></script><?php 
echo appInitialThemeScript(is_array($publicMap) ? $publicMap : null);
?><script src="assets/theme.js?v=build-1358"></script></head>
<body class="public-page">
  <header class="topbar">
    <div class="topbar-brand"><?= $brandOpen ?>
      <h1 id="map-title">Event</h1><img id="map-logo" alt="" hidden><?= $brandClose ?>
      <select id="language-switch" aria-label="Language" data-i18n-aria="lang"><option value="de">DE</option><option value="en">EN</option></select>
      <div class="soundcloud-controls" role="group" aria-label="SoundCloud player" data-i18n-aria="musicPlayer"><button id="music-toggle" type="button" class="music-control button-light" aria-label="Play music" title="Play" data-i18n-aria="musicPlay" data-i18n-title="musicPlay"><i class="fa-solid fa-play" aria-hidden="true"></i></button><button id="music-next" type="button" class="music-control button-light" aria-label="Next track" title="Next track" data-i18n-aria="musicNext" data-i18n-title="musicNext"><i class="fa-solid fa-forward-step" aria-hidden="true"></i></button><button id="music-forward-30" type="button" class="music-control button-light music-forward-30" aria-label="Skip forward 30 seconds" title="+30 sec" data-i18n-aria="musicForward30" data-i18n-title="musicForward30">+30</button>
        <label class="music-volume"><i class="fa-solid fa-volume-high" aria-hidden="true"></i><input id="music-volume" type="range" min="0" max="100" value="40" aria-label="Volume" title="Volume" data-i18n-aria="musicVolume" data-i18n-title="musicVolume"></label><a id="music-status" class="music-status" aria-live="polite">Need some groove?</a>
      </div>
    </div>
    <nav class="visitor-nav">
      <div class="visitor-tabs" role="tablist"><span id="custom-topbar-button"></span><button id="timetable-tab" class="visitor-tab chip-button active" type="button" role="tab" aria-selected="true" data-i18n="timetableTab">WWW</button><button id="map-tab" class="visitor-tab chip-button" type="button" role="tab" aria-selected="false" data-i18n="mapTab">Karte</button><button id="refresh-data" class="visitor-tab chip-button refresh-button" type="button" data-i18n-aria="refreshData" data-i18n-title="refreshData" aria-label="Aktualisieren" title="Aktualisieren"><i class="fa-solid fa-rotate" aria-hidden="true"></i><span data-i18n="refreshData">Aktualisieren</span></button>
      </div>
    </nav><iframe id="soundcloud-widget" class="soundcloud-widget" title="SoundCloud festival playlist" aria-hidden="true" tabindex="-1" allow="autoplay" scrolling="no" frameborder="no" src="about:blank"></iframe>
  </header>
  <main>
    <section id="map-view" class="map-layout" role="tabpanel" hidden>
      <div id="map" aria-label="Interaktive Bildkarte" data-i18n-aria="mapLabel">
      </div>
      <aside class="sidebar">
        <section class="category-section">
          <h2 data-i18n="categories">Kategorien</h2>
          <div id="legend">
          </div>
        </section>
        <hr class="sidebar-divider">
        <section class="places-section">
          <h2 data-i18n="places">Orte</h2><input id="poi-search" type="search" placeholder="Orte suchen…" aria-label="Orte suchen" data-i18n-placeholder="searchPlaces" data-i18n-aria="searchPlacesLabel">
          <div id="place-list">
          </div>
        </section><button id="map-export-jpg" class="button button-secondary subtle export-jpg-button" type="button" data-i18n="exportMapJpg">JPG: Karte + POI-Index</button>
      </aside>
    </section>
    <section id="timetable-view" class="timetable-view" role="tabpanel">
      <h2 data-i18n="timetable">Timetable</h2>
      <section class="timetable-filter-section">
        <h3 class="timetable-section-label" data-i18n="timetableFilters">Filter</h3>
        <div id="timetable-filters" class="timetable-filter-row">
        </div>
      </section>
      <section class="timetable-day-section">
        <h3 class="timetable-section-label" data-i18n="timetableDayHeading">Tag auswählen</h3>
        <div id="timetable-days" class="timetable-days" role="tablist" aria-label="Tag auswählen" data-i18n-aria="timetableDayHeading">
        </div>
      </section>
      <div id="timetable-content">
      </div><button id="export-day-jpg" class="button button-secondary subtle export-jpg-button" type="button" data-i18n="exportDayJpg">Diesen Tag als JPG exportieren</button>
    </section>
  </main>
  <footer class="owner-credit"><span data-i18n="ownerHint">Powered by|Powered by</span> <a href="https://burnigator.com" target="_blank" rel="noopener noreferrer">burnigator.com</a><span aria-hidden="true">·</span><a href="https://burnigator.com" target="_blank" rel="noopener noreferrer" data-i18n="sourceLink">Quellcode</a><?php 
if ($impressUrl !== '') {
    ?><span aria-hidden="true">·</span><a href="<?php 
    echo htmlspecialchars($impressUrl, ENT_QUOTES, 'UTF-8');
    ?>" target="_blank" rel="noopener noreferrer" data-i18n="impressLink">Impressum</a><?php 
}
?><span aria-hidden="true">·</span><button id="install-app" type="button" class="install-app-button button-outlined" aria-label="App installieren" data-i18n-aria="installApp" hidden><i class="fa-solid fa-download" aria-hidden="true"></i><span data-i18n="installApp">App installieren</span></button><span id="install-app-divider" aria-hidden="true" hidden>·</span><button id="burnigator-easter-trigger" type="button" class="burnigator-brand button-text" aria-label="Burnigator">Burnigator</button><span aria-hidden="true">·</span><small id="last-updated" class="last-updated">…</small><span class="build-number" aria-label="Build 1358">Build 1358</span></footer>
<div id="burnigator-easter-toast" class="burnigator-toast" role="status" aria-live="polite" hidden>
</div>
<script src="assets/vendor/leaflet/leaflet.js" crossorigin=""></script><script src="assets/i18n.js?v=build-1358"></script><script src="assets/easter-egg.js?v=persistent-sparks-1"></script><script src="assets/pwa.js?v=install-2"></script><script src="https://w.soundcloud.com/player/api.js" async></script><script src="assets/vendor/qrcode.min.js"></script><script src="assets/map.js?v=build-1358"></script>
<script src="assets/pinboard.js?v=2"></script>
</body>
</html>

