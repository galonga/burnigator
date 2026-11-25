<?php

declare(strict_types=1);

function respond(int $status, array $body): void
{
    if (isset($body['map']) && is_array($body['map'])) {
        $body['map'] = publicEventMap($body['map']);
    }
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function clearRuntimeDirectory(string $path, bool $preserveHtaccess = true): void
{
    if (is_link($path) || !is_dir($path)) {
        throw new RuntimeException('Runtime directory is unavailable.');
    }
    $entries = scandir($path);
    if (!is_array($entries)) {
        throw new RuntimeException('Runtime directory cannot be read.');
    }
    foreach ($entries as $name) {
        $target = $path . DIRECTORY_SEPARATOR . $name;
        if ($name === '.' || $name === '..' || $preserveHtaccess && $name === '.htaccess' && !is_link($target) || $preserveHtaccess && $name === 'map.lock' && !is_link($target)) {
            continue;
        }
        if (is_link($target) || !is_dir($target)) {
            if (!unlink($target)) {
                throw new RuntimeException('Could not remove runtime file.');
            }
            continue;
        }
        clearRuntimeDirectory($target, false);
        if (!rmdir($target)) {
            throw new RuntimeException('Could not remove runtime directory.');
        }
    }
}

function assertRuntimeDirectoryClearable(string $path): void
{
    if (is_link($path) || !is_dir($path) || !is_writable($path)) {
        throw new RuntimeException('Runtime directory is not writable.');
    }
    foreach (scandir($path) ?: [] as $name) {
        $target = $path . DIRECTORY_SEPARATOR . $name;
        if ($name !== '.' && $name !== '..' && !is_link($target) && is_dir($target)) {
            assertRuntimeDirectoryClearable($target);
        }
    }
}

function readMap(): array
{
    $p = BURNIGATOR_ROOT . '/data/map.json';
    $fallback = [
        'title' => 'Mein Event',
        'image' => '',
        'logo' => '',
        'favicon' => '',
        'width' => 0,
        'height' => 0,
        'updatedAt' => '',
        'published' => true,
        'pinboardEnabled' => false,
        'iconMode' => 'monochrome',
        'browserTranslationEnabled' => false,
        'liveTimetableEnabled' => false,
        'announcement' => null,
        'statsEnabled' => false,
        'soundcloudEnabled' => true,
        'soundcloudPlaylist' => defaultSoundCloudPlaylist(),
        'customButton' => ['label' => '', 'url' => ''],
        'qrUrl' => '',
        'impressUrl' => '',
        'weekStart' => 'mon',
        'enabledDays' => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        'titleLinkUrl' => '',
        'theme' => defaultTheme(),
        'matomoUrl' => '',
        'matomoSiteId' => '',
        'categories' => [],
        'pois' => [],
        'timelines' => [],
    ];
    if (!is_file($p)) {
        return $fallback;
    }
    $m = json_decode((string) file_get_contents($p), true);
    $m = is_array($m) ? array_merge($fallback, $m) : $fallback;
    $m['published'] = ($m['published'] ?? true) === true;
    $m['pinboardEnabled'] = ($m['pinboardEnabled'] ?? false) === true;
    $m['statsEnabled'] = ($m['statsEnabled'] ?? false) === true;
    $m['liveTimetableEnabled'] = ($m['liveTimetableEnabled'] ?? false) === true;
    // An announcement stored without a time gets the file's modification time, not "now", so the
    // time (which dismissed banners are keyed on) stays the same from one request to the next.
    $m['announcement'] = cleanAnnouncement($m['announcement'] ?? null, $m['announcement'] ?? null, gmdate('c', (int) @filemtime($p) ?: time()));
    $m['theme'] = cleanTheme($m['theme'] ?? null);
    $m['matomoUrl'] = cleanMatomoUrl($m['matomoUrl'] ?? $fallback['matomoUrl']);
    $m['matomoSiteId'] = cleanMatomoSiteId($m['matomoSiteId'] ?? $fallback['matomoSiteId']);
    $m['impressUrl'] = cleanOptionalHttpUrl($m['impressUrl'] ?? '');
    $m['weekStart'] = cleanWeekStart($m['weekStart'] ?? 'mon');
    $m['enabledDays'] = cleanEnabledDays($m['enabledDays'] ?? null);
    $m['titleLinkUrl'] = cleanOptionalHttpUrl($m['titleLinkUrl'] ?? '');
    $m['soundcloudEnabled'] = ($m['soundcloudEnabled'] ?? true) !== false;
    $m['soundcloudPlaylist'] = cleanSoundCloudPlaylist($m['soundcloudPlaylist'] ?? $fallback['soundcloudPlaylist']) ?? $fallback['soundcloudPlaylist'];
    return $m;
}

function recordHistory(string $action, int $count = 0, string $detail = '', ?array $actor = null): void
{
    $path = BURNIGATOR_ROOT . '/data/history.json';
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        return;
    }
    $fp = @fopen($path, 'c+');
    if (!$fp || !flock($fp, LOCK_EX)) {
        if ($fp) {
            fclose($fp);
        }
        return;
    }
    $raw = stream_get_contents($fp);
    $items = json_decode($raw ?: '[]', true);
    if (!is_array($items)) {
        $items = [];
    }
    array_unshift($items, [
        'at' => gmdate('c'),
        'username' => (string) ($actor['username'] ?? $_SESSION['username'] ?? 'owner'),
        'role' => (string) ($actor['role'] ?? appRole()),
        'action' => $action,
        'count' => $count,
        'detail' => cleanText($detail, 180),
    ]);
    $items = array_slice($items, 0, 250);
    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($items, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
}

/** Connection state of the optional event-auth database (shared by the settings card and the dashboard). */
function databaseHealth(array $config): array
{
    $environmentDsn = (string) getenv('BURNIGATOR_DB_DSN');
    $dsn = $environmentDsn !== '' ? $environmentDsn : (string) ($config['event_auth_db_dsn'] ?? '');
    $host = '';
    $name = '';
    if (preg_match('/(?:^|[:;])host=([^;]*)/', $dsn, $m)) {
        $host = $m[1];
    }
    if (preg_match('/(?:^|;)dbname=([^;]*)/', $dsn, $m)) {
        $name = $m[1];
    }
    $ready = false;
    $latency = null;
    if ($dsn !== '') {
        $started = microtime(true);
        try {
            eventAuthDb($config);
            $ready = true;
            $latency = (int) round((microtime(true) - $started) * 1000);
        } catch (Throwable $e) {
            $ready = false;
        }
    }
    return [
        'configured' => $dsn !== '',
        'ready' => $ready,
        'managedByEnvironment' => $environmentDsn !== '',
        'host' => $host,
        'name' => $name,
        'driverAvailable' => extension_loaded('pdo_mysql'),
        'latencyMs' => $latency,
    ];
}

/** Newest change-history entries (data/history.json is newest first). */
function readHistory(int $limit): array
{
    $path = BURNIGATOR_ROOT . '/data/history.json';
    $history = is_file($path) ? json_decode((string) file_get_contents($path), true) : [];
    return is_array($history) ? array_slice($history, 0, $limit) : [];
}

function snapshotFiles(): array
{
    $files = glob(BURNIGATOR_ROOT . '/data/snapshots/*.json') ?: [];
    rsort($files, SORT_STRING);
    return $files;
}

function pruneSnapshotFiles(): void
{
    $files = snapshotFiles();
    foreach (array_slice($files, 5) as $path) {
        @unlink($path);
    }
}

function pruneUploadedAssets(): void
{
    $refs = [];
    $maps = [readMap()];
    foreach (snapshotFiles() as $path) {
        $m = json_decode((string) @file_get_contents($path), true);
        if (is_array($m)) {
            $maps[] = $m;
        }
    }
    foreach ($maps as $m) {
        foreach ([
            'image',
            'logo',
            'favicon',
        ] as $key) {
            $value = (string) ($m[$key] ?? '');
            if (preg_match('~^uploads/(?:map-[a-f0-9]{24}\.(?:png|jpg)|(?:logo|favicon)-[a-f0-9]{24}\.png)$~', $value)) {
                $refs[basename($value)] = true;
            }
        }
    }
    foreach (glob(BURNIGATOR_ROOT . '/uploads/*') ?: [] as $path) {
        $name = basename($path);
        if (preg_match('/^(?:map-[a-f0-9]{24}\.(?:png|jpg)|(?:logo|favicon)-[a-f0-9]{24}\.png)$/', $name) && !isset($refs[$name])) {
            @unlink($path);
        }
    }
}

function createMapSnapshot(): void
{
    $source = BURNIGATOR_ROOT . '/data/map.json';
    if (!is_file($source)) {
        return;
    }
    $current = json_decode((string) @file_get_contents($source), true);
    if (!is_array($current)) {
        return;
    }
    $dir = BURNIGATOR_ROOT . '/data/snapshots';
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
        return;
    }
    $name = gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json';
    $json = json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($json !== false && @file_put_contents($dir . '/' . $name, $json, LOCK_EX) !== false) {
        pruneSnapshotFiles();
    }
}

function safeAssetPath($value, string $kind): string
{
    $value = is_string($value) ? $value : '';
    $patterns = [
        'image' => '~^uploads/map-[a-f0-9]{24}\.(?:png|jpg)$~',
        'logo' => '~^uploads/logo-[a-f0-9]{24}\.png$~',
        'favicon' => '~^uploads/favicon-[a-f0-9]{24}\.png$~',
    ];
    if ($value === '') {
        return '';
    }
    if (!preg_match($patterns[$kind] ?? '~$a~', $value) || !is_file(BURNIGATOR_ROOT . '/' . $value)) {
        return '';
    }
    return $value;
}

/** $markChanges is false for restores: a restored map is not a fresh schedule change for visitors. */
function saveMap(array &$m, bool $markChanges = true): bool
{
    createMapSnapshot();
    $path = BURNIGATOR_ROOT . '/data/map.json';
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        return false;
    }
    $m['updatedAt'] = gmdate('c');
    if ($markChanges) {
        $m = stampEventChanges(readMap(), $m, $m['updatedAt']);
    }
    $tmp = $path . '.' . bin2hex(random_bytes(5)) . '.tmp';
    $json = json_encode($m, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($json === false || file_put_contents($tmp, $json, LOCK_EX) === false) {
        return false;
    }
    if (!rename($tmp, $path)) {
        return false;
    }
    pruneSnapshotFiles();
    pruneUploadedAssets();
    return true;
}
