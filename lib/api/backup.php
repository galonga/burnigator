<?php

declare(strict_types=1);

/** Owner: restore an uploaded asset from a snapshot. */
function apiRestoreAssetAction(string $role, $action): void
{
    if ($action === 'restore-asset' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        if ($role !== 'owner') {
            respond(403, ['error' => 'Keine Berechtigung']);
        }
        $kind = (string) ($_GET['kind'] ?? '');
        if (!in_array($kind, [
            'image',
            'logo',
            'favicon',
        ], true)) {
            respond(400, ['error' => 'Ungültiger Bildtyp.']);
        }
        if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            respond(400, ['error' => 'Upload fehlgeschlagen.']);
        }
        $f = $_FILES['image'];
        $limit = $kind === 'image' ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
        if ($f['size'] > $limit) {
            respond(400, ['error' => 'Datei zu groß.']);
        }
        $info = @getimagesize($f['tmp_name']);
        $allowed = $kind === 'image' ? ['image/png' => 'png', 'image/jpeg' => 'jpg'] : ['image/png' => 'png'];
        if (!$info || !isset($allowed[$info['mime']])) {
            respond(400, ['error' => 'Ungültiges Bildformat.']);
        }
        if ($kind === 'image' && ($info[0] < 1 || $info[1] < 1 || $info[0] > 30000 || $info[1] > 30000 || $info[0] * $info[1] > 100000000) || $kind !== 'image' && ($info[0] > 5000 || $info[1] > 2000 || $kind === 'favicon' && ($info[0] > 1024 || $info[1] > 1024))) {
            respond(400, ['error' => 'Die Bildabmessungen sind zu groß.']);
        }
        $prefix = $kind === 'image' ? 'map' : $kind;
        $name = $prefix . '-' . bin2hex(random_bytes(12)) . '.' . $allowed[$info['mime']];
        $dir = BURNIGATOR_ROOT . '/uploads';
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            respond(500, ['error' => 'Uploadverzeichnis konnte nicht erstellt werden.']);
        }
        if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) {
            respond(500, ['error' => 'Bild konnte nicht gespeichert werden.']);
        }
        respond(200, [
            'path' => 'uploads/' . $name,
            'width' => (int) $info[0],
            'height' => (int) $info[1],
        ]);
    }
}

/** Owner: restore a snapshot. */
function apiRestoreSnapshotAction(string $role, $action): void
{
    if ($action === 'restore-snapshot' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        if ($role !== 'owner') {
            respond(403, ['error' => 'Keine Berechtigung']);
        }
        $in = json_decode((string) file_get_contents('php://input'), true);
        $id = is_array($in) ? (string) ($in['id'] ?? '') : '';
        if (!preg_match('/^\d{8}-\d{6}-[a-f0-9]{8}$/', $id)) {
            respond(400, ['error' => 'Ungültiger Snapshot.']);
        }
        $path = BURNIGATOR_ROOT . '/data/snapshots/' . $id . '.json';
        $m = is_file($path) ? json_decode((string) file_get_contents($path), true) : null;
        if (!is_array($m) || !is_array($m['categories'] ?? null) || !is_array($m['pois'] ?? null)) {
            respond(404, ['error' => 'Snapshot nicht gefunden.']);
        }
        $GLOBALS['burnigatorEventOwners'] = eventOwnerMap($m);
        $m['timelines'] = cleanIndependentTimelines($m['timelines'] ?? []);
        $m['theme'] = cleanTheme($m['theme'] ?? null);
        $m['impressUrl'] = cleanOptionalHttpUrl($m['impressUrl'] ?? '');
        $m['weekStart'] = cleanWeekStart($m['weekStart'] ?? 'mon');
        $m['enabledDays'] = cleanEnabledDays($m['enabledDays'] ?? null);
        $m['titleLinkUrl'] = cleanOptionalHttpUrl($m['titleLinkUrl'] ?? '');
        $m['matomoUrl'] = cleanMatomoUrl($m['matomoUrl'] ?? readMap()['matomoUrl']);
        $m['matomoSiteId'] = cleanMatomoSiteId($m['matomoSiteId'] ?? readMap()['matomoSiteId']);
        $m['soundcloudEnabled'] = ($m['soundcloudEnabled'] ?? true) !== false;
        $m['soundcloudPlaylist'] = cleanSoundCloudPlaylist($m['soundcloudPlaylist'] ?? readMap()['soundcloudPlaylist']) ?? defaultSoundCloudPlaylist();
        foreach ([
            'image',
            'logo',
            'favicon',
        ] as $key) {
            $v = (string) ($m[$key] ?? '');
            if ($v !== '' && safeAssetPath($v, $key) === '') {
                respond(409, ['error' => 'Ein Bild dieses Snapshots fehlt.']);
            }
        }
        $expected = (string) ($in['expectedUpdatedAt'] ?? '');
        $saved = withMapLock(function () use (&$m, $expected) {
            $latest = readMap();
            if (mapRevisionStale($latest, $expected)) {
                return 'conflict';
            }
            $m['published'] = $latest['published'];
            $m['pinboardEnabled'] = $latest['pinboardEnabled'];
            return saveMap($m, false) ? $m : false;
        });
        if ($saved === 'conflict') {
            respond(409, ['error' => 'map_conflict']);
        }
        if (!is_array($saved)) {
            respond(500, ['error' => 'Snapshot konnte nicht wiederhergestellt werden.']);
        }
        $m = $saved;
        recordHistory('snapshot_restore', count((array) $m['pois']), 'Wiederhergestellt: ' . $id);
        respond(200, ['ok' => true, 'map' => $m]);
    }
}

/** Owner: restore a full backup. */
function apiRestoreBackupAction(string $role, $action): void
{
    if ($action === 'restore-backup' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        if ($role !== 'owner') {
            respond(403, ['error' => 'Keine Berechtigung']);
        }
        $in = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($in) || !is_array($in['map'] ?? null) || !is_array($in['assets'] ?? null)) {
            respond(400, ['error' => 'Ungültige Sicherungsdatei.']);
        }
        $src = $in['map'];
        $assets = $in['assets'];
        if (!is_array($src['categories'] ?? null) || count($src['categories']) > 100 || !is_array($src['pois'] ?? null) || count($src['pois']) > 2000 || count((array) ($src['timelines'] ?? [])) > 3) {
            respond(400, ['error' => 'Ungültige Sicherungsdaten.']);
        }
        $paths = [];
        foreach ([
            'image',
            'logo',
            'favicon',
        ] as $key) {
            $candidate = (string) ($assets[$key] ?? '');
            if ($candidate !== '' && safeAssetPath($candidate, $key) === '') {
                respond(400, ['error' => 'Ein Sicherungsbild fehlt oder ist ungültig.']);
            }
            $paths[$key] = $candidate;
        }
        foreach ((array) ($src['timelines'] ?? []) as $timeline) {
            if (is_array($timeline)) {
                if (invalidProgramTimes($timeline['program'] ?? [])) {
                    respond(400, ['error' => 'invalid_event_time']);
                }
                if (cleanText($timeline['name'] ?? '', 60) === '') {
                    respond(400, ['error' => 'timeline_name_required']);
                }
            }
        }
        if (($src['image'] ?? '') !== '' && $paths['image'] === '') {
            respond(400, ['error' => 'Die Sicherung enthält keine Veranstaltungskarte.']);
        }
        $categories = [];
        $catIds = [];
        foreach ($src['categories'] as $c) {
            if (!is_array($c)) {
                continue;
            }
            $id = preg_match('/^[a-f0-9-]{1,40}$/', (string) ($c['id'] ?? '')) ? (string) $c['id'] : bin2hex(random_bytes(8));
            $color = (string) ($c['color'] ?? '#E94F85');
            if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
                $color = '#E94F85';
            }
            $categories[] = [
                'id' => $id,
                'name' => cleanText($c['name'] ?? '', 60),
                'color' => $color,
            ];
            $catIds[] = $id;
        }
        $pois = [];
        foreach ($src['pois'] as $p) {
            if (!is_array($p)) {
                continue;
            }
            $x = filter_var($p['x'] ?? null, FILTER_VALIDATE_FLOAT);
            $y = filter_var($p['y'] ?? null, FILTER_VALIDATE_FLOAT);
            if ($x === false || $y === false || $x < 0 || $y < 0 || $x > 1 || $y > 1) {
                respond(400, ['error' => 'Ungültige POI-Position in der Sicherung.']);
            }
            $cat = (string) ($p['categoryId'] ?? '');
            if (!in_array($cat, $catIds, true)) {
                $cat = '';
            }
            $iconRaw = $p['icon'] ?? 'fa-location-dot';
            $icon = is_string($iconRaw) && preg_match('/^fa-[a-z0-9-]{2,60}$/', $iconRaw) ? $iconRaw : (cleanText($iconRaw, 16) ?: '•');
            $pois[] = [
                'id' => preg_match('/^[a-f0-9-]{1,40}$/', (string) ($p['id'] ?? '')) ? (string) $p['id'] : bin2hex(random_bytes(8)),
                'x' => $x,
                'y' => $y,
                'name' => cleanText($p['name'] ?? '', 100),
                'description' => cleanText($p['description'] ?? '', 1000),
                'categoryId' => $cat,
                'icon' => $icon,
                'hasProgram' => !empty($p['hasProgram']),
                'program' => cleanProgram($p['program'] ?? []),
            ];
        }
        foreach ((array) ($src['timelines'] ?? []) as $timeline) {
            if (is_array($timeline) && invalidProgramTimes($timeline['program'] ?? [])) {
                respond(400, ['error' => 'invalid_event_time']);
            }
        }
        $timelines = cleanIndependentTimelines($src['timelines'] ?? []);
        $custom = is_array($src['customButton'] ?? null) ? $src['customButton'] : [];
        $url = cleanText($custom['url'] ?? '', 2048);
        $parts = $url !== '' ? parse_url($url) : false;
        if (!$parts || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true) || !filter_var($url, FILTER_VALIDATE_URL)) {
            $url = '';
        }
        $imageInfo = $paths['image'] !== '' ? @getimagesize(BURNIGATOR_ROOT . '/' . $paths['image']) : false;
        $qrUrl = cleanText($src['qrUrl'] ?? '', 2048);
        $qrParts = $qrUrl !== '' ? parse_url($qrUrl) : false;
        if (!$qrParts || !in_array(strtolower((string) ($qrParts['scheme'] ?? '')), ['http', 'https'], true) || !filter_var($qrUrl, FILTER_VALIDATE_URL)) {
            $qrUrl = '';
        }
        $map = [
            'title' => cleanText($src['title'] ?? 'Mein Event', 100) ?: 'Mein Event',
            'theme' => cleanTheme($src['theme'] ?? null),
            'matomoUrl' => cleanMatomoUrl($src['matomoUrl'] ?? readMap()['matomoUrl']),
            'matomoSiteId' => cleanMatomoSiteId($src['matomoSiteId'] ?? readMap()['matomoSiteId']),
            'soundcloudEnabled' => ($src['soundcloudEnabled'] ?? true) !== false,
            'soundcloudPlaylist' => cleanSoundCloudPlaylist($src['soundcloudPlaylist'] ?? defaultSoundCloudPlaylist()) ?? defaultSoundCloudPlaylist(),
            'qrUrl' => $qrUrl,
            'impressUrl' => cleanOptionalHttpUrl($src['impressUrl'] ?? ''),
            'weekStart' => cleanWeekStart($src['weekStart'] ?? 'mon'),
            'enabledDays' => cleanEnabledDays($src['enabledDays'] ?? null),
            'titleLinkUrl' => cleanOptionalHttpUrl($src['titleLinkUrl'] ?? ''),
            'image' => $paths['image'],
            'logo' => $paths['logo'],
            'favicon' => $paths['favicon'],
            'width' => $imageInfo ? (int) $imageInfo[0] : 0,
            'height' => $imageInfo ? (int) $imageInfo[1] : 0,
            'iconMode' => ($src['iconMode'] ?? '') === 'colored' ? 'colored' : 'monochrome',
            'browserTranslationEnabled' => !empty($src['browserTranslationEnabled']),
            'liveTimetableEnabled' => ($src['liveTimetableEnabled'] ?? false) === true,
            'announcement' => cleanAnnouncement($src['announcement'] ?? null, null, gmdate('c')),
            'statsEnabled' => ($src['statsEnabled'] ?? false) === true,
            'customButton' => ['label' => $url !== '' ? cleanText($custom['label'] ?? '', 40) : '', 'url' => $url],
            'categories' => $categories,
            'pois' => $pois,
            'timelines' => $timelines,
        ];
        $expected = (string) ($in['expectedUpdatedAt'] ?? '');
        $saved = withMapLock(function () use (&$map, $expected) {
            $latest = readMap();
            if (mapRevisionStale($latest, $expected)) {
                return 'conflict';
            }
            $map['published'] = $latest['published'];
            $map['pinboardEnabled'] = $latest['pinboardEnabled'];
            return saveMap($map, false) ? $map : false;
        });
        if ($saved === 'conflict') {
            respond(409, ['error' => 'map_conflict']);
        }
        if (!is_array($saved)) {
            respond(500, ['error' => 'Sicherung konnte nicht wiederhergestellt werden.']);
        }
        $map = $saved;
        recordHistory('backup_restore', count($pois), 'Vollständige Sicherung wiederhergestellt');
        respond(200, ['ok' => true, 'map' => $map]);
    }
}
