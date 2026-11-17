<?php

declare (strict_types=1);
$config = require is_file(__DIR__ . '/config.php') ? __DIR__ . '/config.php' : __DIR__ . '/config.sample.php';
$GLOBALS['burnigatorConfig'] = $config;
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/event_auth.php';
startAppSession($config, false);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
function respond(int $status, array $body): void
{
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

function defaultTheme(): array
{
    return [
        'primary' => '#305EAA',
        'accent' => '#E94F85',
        'alert' => '#E63D1A',
        'background' => '#E6D0BB',
    ];
}

function cleanTheme($value): array
{
    $defaults = defaultTheme();
    $theme = [];
    foreach ($defaults as $key => $fallback) {
        $color = is_array($value) && is_string($value[$key] ?? null) ? $value[$key] : '';
        $theme[$key] = preg_match('/^#[0-9a-fA-F]{6}$/D', $color) ? strtoupper($color) : $fallback;
    }
    return $theme;
}

function cleanMatomoUrl($value): string
{
    $url = is_string($value) ? trim($value) : '';
    if ($url === '') {
        return '';
    }
    if (strlen($url) > 2048 || !filter_var($url, FILTER_VALIDATE_URL)) {
        return '';
    }
    $parts = parse_url($url);
    if (!is_array($parts) || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true) || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) {
        return '';
    }
    return rtrim($url, '/') . '/';
}

function cleanOptionalHttpUrl($value): string
{
    $url = is_string($value) ? trim($value) : '';
    if ($url === '' || strlen($url) > 2048 || !filter_var($url, FILTER_VALIDATE_URL)) {
        return '';
    }
    $parts = parse_url($url);
    if (!is_array($parts) || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true) || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) {
        return '';
    }
    return $url;
}

function cleanMatomoSiteId($value): string
{
    $id = (string) $value;
    return preg_match('/^[1-9][0-9]{0,8}$/D', $id) ? $id : '';
}

function defaultSoundCloudPlaylist(): string
{
    return '';
}

function cleanSoundCloudPlaylist($value): ?string
{
    $url = is_string($value) ? trim($value) : '';
    if ($url === '') {
        return '';
    }
    if (strlen($url) > 2048 || !filter_var($url, FILTER_VALIDATE_URL)) {
        return null;
    }
    $parts = parse_url($url);
    if (!is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https' || !in_array(strtolower((string) ($parts['host'] ?? '')), ['soundcloud.com', 'www.soundcloud.com'], true) || isset($parts['user']) || isset($parts['pass']) || !preg_match('~^/[^/]+/sets/[^/]+/?$~D', (string) ($parts['path'] ?? ''))) {
        return null;
    }
    return 'https://' . strtolower((string) $parts['host']) . rtrim((string) $parts['path'], '/');
}

function readMap(): array
{
    $p = __DIR__ . '/data/map.json';
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
        'soundcloudEnabled' => true,
        'soundcloudPlaylist' => defaultSoundCloudPlaylist(),
        'customButton' => ['label' => '', 'url' => ''],
        'qrUrl' => '',
        'impressUrl' => '',
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
    $m['theme'] = cleanTheme($m['theme'] ?? null);
    $m['matomoUrl'] = cleanMatomoUrl($m['matomoUrl'] ?? $fallback['matomoUrl']);
    $m['matomoSiteId'] = cleanMatomoSiteId($m['matomoSiteId'] ?? $fallback['matomoSiteId']);
    $m['impressUrl'] = cleanOptionalHttpUrl($m['impressUrl'] ?? '');
    $m['titleLinkUrl'] = cleanOptionalHttpUrl($m['titleLinkUrl'] ?? '');
    $m['soundcloudEnabled'] = ($m['soundcloudEnabled'] ?? true) !== false;
    $m['soundcloudPlaylist'] = cleanSoundCloudPlaylist($m['soundcloudPlaylist'] ?? $fallback['soundcloudPlaylist']) ?? $fallback['soundcloudPlaylist'];
    return $m;
}

function cleanText($v, int $max): string
{
    if (!is_string($v)) {
        return '';
    }
    $v = trim(strip_tags($v));
    return function_exists('mb_substr') ? mb_substr($v, 0, $max) : substr($v, 0, $max);
}

function recordHistory(string $action, int $count = 0, string $detail = ''): void
{
    $path = __DIR__ . '/data/history.json';
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
        'username' => (string) ($_SESSION['username'] ?? 'owner'),
        'role' => appRole(),
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

function snapshotFiles(): array
{
    $files = glob(__DIR__ . '/data/snapshots/*.json') ?: [];
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
    foreach (glob(__DIR__ . '/uploads/*') ?: [] as $path) {
        $name = basename($path);
        if (preg_match('/^(?:map-[a-f0-9]{24}\.(?:png|jpg)|(?:logo|favicon)-[a-f0-9]{24}\.png)$/', $name) && !isset($refs[$name])) {
            @unlink($path);
        }
    }
}

function createMapSnapshot(): void
{
    $source = __DIR__ . '/data/map.json';
    if (!is_file($source)) {
        return;
    }
    $current = json_decode((string) @file_get_contents($source), true);
    if (!is_array($current)) {
        return;
    }
    $dir = __DIR__ . '/data/snapshots';
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
    if (!preg_match($patterns[$kind] ?? '~$a~', $value) || !is_file(__DIR__ . '/' . $value)) {
        return '';
    }
    return $value;
}

function programHistoryDetail($value, string $poiName): string
{
    $labels = [];
    if (is_array($value)) {
        foreach ($value as $day => $events) {
            if (!is_array($events)) {
                continue;
            }
            foreach ($events as $event) {
                if (!is_array($event) || empty($event['text'])) {
                    continue;
                }
                $labels[] = (string) $day . ' ' . (string) ($event['start'] ?? $event['time'] ?? '') . ' ' . (string) $event['text'];
                if (count($labels) >= 4) {
                    break 2;
                }
            }
        }
    }
    return cleanText($poiName . ($labels ? ' · ' . implode(' | ', $labels) : ''), 180);
}

function invalidProgramTimes($value): bool
{
    if (!is_array($value)) {
        return false;
    }
    foreach ($value as $entries) {
        if (!is_array($entries)) {
            continue;
        }
        foreach ($entries as $event) {
            if (!is_array($event)) {
                continue;
            }
            $start = (string) ($event['start'] ?? $event['time'] ?? '');
            $end = (string) ($event['end'] ?? '');
            if ($end !== '' && preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $start) && preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $end) && $end <= $start) {
                return true;
            }
        }
    }
    return false;
}

function cleanIndependentTimelines($value): array
{
    if (!is_array($value)) {
        return [];
    }
    $out = [];
    foreach (array_slice($value, 0, 3) as $index => $timeline) {
        if (!is_array($timeline)) {
            continue;
        }
        $id = (string) ($timeline['id'] ?? '');
        if (!preg_match('/^[a-f0-9-]{1,40}$/', $id)) {
            $id = bin2hex(random_bytes(8));
        }
        $name = cleanText($timeline['name'] ?? '', 60);
        if ($name === '') {
            continue;
        }
        $out[] = [
            'id' => $id,
            'name' => $name,
            'program' => cleanProgram($timeline['program'] ?? []),
        ];
    }
    return $out;
}

function cleanProgram($value): array
{
    $program = [];
    $allowed = [
        'performance',
        'music',
        'kink',
        'adultMind',
        'kidsMind',
        'movement',
        'quiet',
        'loud',
        'crafting',
    ];
    foreach ([
        'wed',
        'thu',
        'fri',
        'sat',
        'sun',
    ] as $day) {
        $program[$day] = [];
        $entries = is_array($value) ? $value[$day] ?? [] : [];
        if (!is_array($entries)) {
            continue;
        }
        foreach (array_slice($entries, 0, 100) as $event) {
            if (!is_array($event)) {
                continue;
            }
            $start = (string) ($event['start'] ?? $event['time'] ?? '');
            $end = (string) ($event['end'] ?? '');
            if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $start)) {
                continue;
            }
            if ($end !== '' && !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $end)) {
                continue;
            }
            $text = cleanText($event['text'] ?? '', 200);
            if ($text === '') {
                continue;
            }
            $eventId = (string) ($event['id'] ?? '');
            if (!preg_match('/^[a-f0-9-]{1,40}$/', $eventId)) {
                $eventId = bin2hex(random_bytes(16));
            }
            $selected = $event['categories'] ?? [];
            $selected = is_array($selected) ? array_values(array_unique(array_filter($selected, function ($category) use ($allowed) {
                return is_string($category) && in_array($category, $allowed, true);
            }))) : [];
            $linkUrl = cleanText($event['linkUrl'] ?? '', 2048);
            $parts = $linkUrl !== '' ? parse_url($linkUrl) : false;
            if (!$parts || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true) || !filter_var($linkUrl, FILTER_VALIDATE_URL)) {
                $linkUrl = '';
            }
            $program[$day][] = [
                'id' => $eventId,
                'start' => $start,
                'end' => $end,
                'text' => $text,
                'host' => cleanText($event['host'] ?? '', 200),
                'description' => cleanText($event['description'] ?? '', 1000),
                'linkUrl' => $linkUrl,
                'linkText' => cleanText($event['linkText'] ?? '', 120),
                'categories' => $selected,
            ];
        }
    }
    return $program;
}
if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'accounts') {
    if (empty($config['installed']) || empty($_SESSION['admin']) || appRole() !== 'owner') {
        respond(403, ['error' => 'Keine Berechtigung']);
    }
    $accounts = [];
    foreach (appUsers($config) as $username => $account) {
        if (in_array($account['role'] ?? '', ['poi', 'www'], true)) {
            $accounts[(string) $account['role']] = ['username' => (string) $username];
        }
    }
    respond(200, ['accounts' => $accounts]);
}
if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'history') {
    if (empty($config['installed']) || empty($_SESSION['admin']) || appRole() !== 'owner') {
        respond(403, ['error' => 'Keine Berechtigung']);
    }
    $path = __DIR__ . '/data/history.json';
    $history = is_file($path) ? json_decode((string) file_get_contents($path), true) : [];
    respond(200, ['history' => is_array($history) ? array_slice($history, 0, 100) : []]);
}
if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'snapshots') {
    if (empty($config['installed']) || empty($_SESSION['admin']) || appRole() !== 'owner') {
        respond(403, ['error' => 'Keine Berechtigung']);
    }
    $items = [];
    foreach (snapshotFiles() as $path) {
        $m = json_decode((string) @file_get_contents($path), true);
        if (!is_array($m)) {
            continue;
        }
        $items[] = [
            'id' => basename($path, '.json'),
            'at' => (string) ($m['updatedAt'] ?? gmdate('c', filemtime($path))),
            'title' => cleanText($m['title'] ?? 'Mein Event', 100),
            'pois' => count((array) ($m['pois'] ?? [])),
        ];
    }
    respond(200, ['snapshots' => $items]);
}
if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'pinboard-status') {
    header('Cache-Control: private, no-store');
    if (empty($config['installed'])) {
        respond(404, ['error' => 'not_found']);
    }
    $map = readMap();
    if (!($map['published'] ?? true) && !appCanPreviewUnpublished()) {
        respond(404, ['error' => 'not_published']);
    }
    respond(200, ['enabled' => ($map['pinboardEnabled'] ?? false) === true]);
}
if ($_SERVER['REQUEST_METHOD'] === 'GET' && in_array((string) ($_GET['action'] ?? ''), ['event-auth-status', 'pinboard'], true)) {
    header('Cache-Control: private, no-store');
    if (empty($config['installed'])) {
        respond(404, ['error' => 'not_found']);
    }
    if (!(readMap()['published'] ?? true) && !appCanPreviewUnpublished()) {
        respond(404, ['error' => 'not_published']);
    }
    try {
        $map = readMap();
        if (($_GET['action'] ?? '') === 'event-auth-status') {
            if (empty($_COOKIE[eventAuthCsrfCookieName($config)])) {
                setcookie(eventAuthCsrfCookieName($config), bin2hex(random_bytes(32)), [
                    'expires' => time() + 2592000,
                    'path' => '/',
                    'secure' => eventAuthHttps(),
                    'httponly' => false,
                    'samesite' => 'Strict',
                ]);
            }
            $session = eventAuthTokenHash($config) !== null ? eventAuthCurrentSession(eventAuthDb($config), $config) : null;
            respond(200, $session ? [
                'authenticated' => true,
                'pseudonym' => $session['pseudonym'],
                'csrfCookie' => eventAuthCsrfCookieName($config),
                'pinboardEnabled' => ($map['pinboardEnabled'] ?? false) === true,
            ] : [
                'authenticated' => false,
                'csrfCookie' => eventAuthCsrfCookieName($config),
                'pinboardEnabled' => ($map['pinboardEnabled'] ?? false) === true,
            ]);
        }
        $db = eventAuthDb($config);
        $owner = !empty($_SESSION['admin']) && appRole() === 'owner';
        if (!(($map['pinboardEnabled'] ?? false) === true) && !$owner) {
            respond(404, ['error' => 'not_found']);
        }
        $currentSession = eventAuthCurrentSession($db, $config);
        $sessionHash = (string) ($currentSession['order_hash'] ?? '');
        $sql = $owner ? 'SELECT id,pseudonym,body,created_at,updated_at,hidden,owner_hash FROM burnigator_pinboard_posts WHERE event_id=? ORDER BY created_at DESC LIMIT 200' : 'SELECT id,pseudonym,body,created_at,updated_at,hidden,owner_hash FROM burnigator_pinboard_posts WHERE event_id=? AND hidden=0 ORDER BY created_at DESC LIMIT 100';
        $posts = [];
        $q = $db->prepare($sql);
        $q->execute([eventAuthEventId()]);
        foreach ($q as $post) {
            $posts[] = [
                'id' => (int) $post['id'],
                'pseudonym' => $post['pseudonym'],
                'body' => $post['body'],
                'createdAt' => $post['created_at'],
                'updatedAt' => $post['updated_at'],
                'hidden' => (bool) $post['hidden'],
                'own' => $sessionHash !== '' && hash_equals((string) $post['owner_hash'], $sessionHash),
            ];
        }
        respond(200, ['posts' => $posts, 'owner' => $owner]);
    } catch (Throwable $e) {
        respond(503, ['error' => 'feature_unavailable']);
    }
}
if ($_SERVER['REQUEST_METHOD'] === 'POST' && in_array((string) ($_GET['action'] ?? ''), [
    'event-auth',
    'event-logout',
    'pinboard-create',
    'pinboard-update',
    'pinboard-delete',
], true)) {
    if (empty($config['installed'])) {
        respond(404, ['error' => 'not_found']);
    }
    if (!(readMap()['published'] ?? true) && !appCanPreviewUnpublished()) {
        respond(404, ['error' => 'not_published']);
    }
    $action = (string) $_GET['action'];
    if (in_array($action, [
        'event-auth',
        'pinboard-create',
        'pinboard-update',
        'pinboard-delete',
    ], true) && !(readMap()['pinboardEnabled'] ?? false)) {
        respond(404, ['error' => 'not_found']);
    }
    try {
        $db = eventAuthDb($config);
        if ($action === 'event-auth') {
            eventAuthRequireCsrf($config);
            $input = json_decode((string) file_get_contents('php://input'), true);
            $code = is_array($input) ? (string) ($input['orderCode'] ?? '') : '';
            $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
            if (eventAuthLoginBlocked($db, $ip)) {
                respond(429, ['error' => 'authentication_failed']);
            }
            if (!preg_match('/^[A-Z0-9\-\s]{3,100}$/iD', $code)) {
                eventAuthLoginFailed($db, $ip);
                respond(401, ['error' => 'authentication_failed']);
            }
            $hash = eventOrderHash($code);
            $pseudonym = eventAuthPseudonymForOrder($db, $hash);
            if ($pseudonym === null) {
                eventAuthLoginFailed($db, $ip);
                respond(401, ['error' => 'authentication_failed']);
            }
            $token = bin2hex(random_bytes(32));
            $csrf = bin2hex(random_bytes(32));
            $tokenHash = hash('sha256', $token);
            $now = gmdate('Y-m-d H:i:s');
            $db->prepare('DELETE FROM burnigator_event_auth_sessions WHERE event_id=? AND expires_at<=?')->execute([eventAuthEventId(), $now]);
            $db->prepare('INSERT INTO burnigator_event_auth_sessions(event_id,token_hash,order_hash,pseudonym,expires_at,created_at) VALUES(?,?,?,?,?,?)')->execute([
                eventAuthEventId(),
                $tokenHash,
                $hash,
                $pseudonym,
                gmdate('Y-m-d H:i:s', time() + 2592000),
                $now,
            ]);
            eventAuthSetCookies($config, $token, $csrf);
            respond(200, ['authenticated' => true, 'pseudonym' => $pseudonym]);
        }
        eventAuthRequireCsrf($config);
        if ($action === 'event-logout') {
            $hash = eventAuthTokenHash($config);
            if ($hash) {
                $db->prepare('DELETE FROM burnigator_event_auth_sessions WHERE event_id=? AND token_hash=?')->execute([eventAuthEventId(), $hash]);
            }
            eventAuthClearCookies($config);
            respond(200, ['ok' => true]);
        }
        $session = eventAuthCurrentSession($db, $config);
        if (!$session) {
            respond(401, ['error' => 'authentication_required']);
        }
        if (in_array($action, [
            'pinboard-create',
            'pinboard-update',
            'pinboard-delete',
        ], true) && eventAuthWriteLimited($db, (string) $session['order_hash'])) {
            respond(429, ['error' => 'rate_limited']);
        }
        $input = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($input)) {
            $input = [];
        }
        $now = gmdate('Y-m-d H:i:s');
        if ($action === 'pinboard-create') {
            $body = cleanText($input['body'] ?? '', 2000);
            if ($body === '') {
                respond(400, ['error' => 'post_invalid']);
            }
            $db->prepare('INSERT INTO burnigator_pinboard_posts(event_id,owner_hash,pseudonym,body,created_at,updated_at,hidden) VALUES(?,?,?,?,?,?,0)')->execute([
                eventAuthEventId(),
                $session['order_hash'],
                $session['pseudonym'],
                $body,
                $now,
                $now,
            ]);
            respond(200, ['ok' => true]);
        }
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id || $id < 1) {
            respond(400, ['error' => 'post_not_found']);
        }
        $owner = !empty($_SESSION['admin']) && appRole() === 'owner';
        $q = $db->prepare('SELECT owner_hash FROM burnigator_pinboard_posts WHERE event_id=? AND id=?');
        $q->execute([eventAuthEventId(), $id]);
        $post = $q->fetch();
        if (!$post) {
            respond(404, ['error' => 'post_not_found']);
        }
        if (!$owner && !hash_equals((string) $post['owner_hash'], (string) $session['order_hash'])) {
            respond(404, ['error' => 'post_not_found']);
        }
        if ($action === 'pinboard-delete') {
            $db->prepare('DELETE FROM burnigator_pinboard_posts WHERE event_id=? AND id=?')->execute([eventAuthEventId(), $id]);
            respond(200, ['ok' => true]);
        }
        $body = cleanText($input['body'] ?? '', 2000);
        if ($body === '') {
            respond(400, ['error' => 'post_invalid']);
        }
        $db->prepare('UPDATE burnigator_pinboard_posts SET body=?,updated_at=? WHERE event_id=? AND id=?')->execute([
            $body,
            $now,
            eventAuthEventId(),
            $id,
        ]);
        respond(200, ['ok' => true]);
    } catch (Throwable $e) {
        respond(503, ['error' => 'feature_unavailable']);
    }
}
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_GET['action'] ?? '') === 'pinboard-moderate') {
    if (empty($config['installed'])) {
        respond(404, ['error' => 'not_found']);
    }
    if (empty($_SESSION['admin']) || appRole() !== 'owner') {
        respond(403, ['error' => 'forbidden']);
    }
    if (!hash_equals((string) ($_SESSION['csrf'] ?? ''), (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        respond(403, ['error' => 'request_failed']);
    }
    try {
        $db = eventAuthDb($config);
        $input = json_decode((string) file_get_contents('php://input'), true);
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        $mode = (string) ($input['mode'] ?? '');
        if (!$id || $id < 1) {
            respond(400, ['error' => 'post_not_found']);
        }
        if ($mode === 'delete') {
            $db->prepare('DELETE FROM burnigator_pinboard_posts WHERE event_id=? AND id=?')->execute([eventAuthEventId(), $id]);
        } elseif (in_array($mode, ['hide', 'show'], true)) {
            $db->prepare('UPDATE burnigator_pinboard_posts SET hidden=? WHERE event_id=? AND id=?')->execute([
                $mode === 'hide' ? 1 : 0,
                eventAuthEventId(),
                $id,
            ]);
        } else {
            respond(400, ['error' => 'invalid_action']);
        }
        respond(200, ['ok' => true]);
    } catch (Throwable $e) {
        respond(503, ['error' => 'feature_unavailable']);
    }
}
if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'event-auth-admin') {
    header('Cache-Control: private, no-store');
    if (empty($_SESSION['admin']) || appRole() !== 'owner') {
        respond(403, ['error' => 'forbidden']);
    }
    try {
        $db = eventAuthDb($config);
        $settings = json_decode((string) (eventAuthSetting($db, 'pretix_settings') ?? '{}'), true);
        if (!is_array($settings)) {
            $settings = [];
        }
        $counts = [
            'total' => 0,
            'eligible' => 0,
            'ineligible' => 0,
        ];
        $q = $db->prepare('SELECT eligible,COUNT(*) AS amount FROM burnigator_event_auth_orders WHERE event_id=? GROUP BY eligible');
        $q->execute([eventAuthEventId()]);
        foreach ($q as $row) {
            $amount = (int) $row['amount'];
            $counts['total'] += $amount;
            $counts[(int) $row['eligible'] === 1 ? 'eligible' : 'ineligible'] = $amount;
        }
        $breakdown = $db->prepare('SELECT source,status,eligible,COUNT(*) AS amount FROM burnigator_event_auth_orders WHERE event_id=? GROUP BY source,status,eligible ORDER BY source,status,eligible DESC');
        $breakdown->execute([eventAuthEventId()]);
        $orderGroups = [];
        foreach ($breakdown as $row) {
            $orderGroups[] = [
                'source' => (string) $row['source'],
                'status' => (string) $row['status'],
                'eligible' => (int) $row['eligible'] === 1,
                'count' => (int) $row['amount'],
            ];
        }
        respond(200, [
            'settings' => [
                'pretix_base_url' => $settings['pretix_base_url'] ?? '',
                'pretix_organizer' => $settings['pretix_organizer'] ?? '',
                'pretix_event' => $settings['pretix_event'] ?? '',
                'tokenConfigured' => !empty($settings['pretix_token_encrypted']),
            ],
            'lastSyncAt' => eventAuthSetting($db, 'last_sync_at'),
            'lastSyncSource' => eventAuthSetting($db, 'last_sync_source'),
            'counts' => $counts,
            'orderGroups' => $orderGroups,
            'databaseReady' => true,
            'https' => eventAuthHttps(),
            'secretReady' => eventAuthSecret() !== '',
            'pinboardEnabled' => (readMap()['pinboardEnabled'] ?? false) === true,
        ]);
    } catch (Throwable $e) {
        respond(503, [
            'error' => 'feature_unavailable',
            'databaseReady' => false,
            'https' => eventAuthHttps(),
            'secretReady' => eventAuthSecret() !== '',
        ]);
    }
}
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $map = readMap();
    if (!$map['published']) {
        header('X-Burnigator-Published: false');
        header('Cache-Control: private, no-store');
        if (!appCanPreviewUnpublished()) {
            respond(404, ['error' => 'not_published']);
        }
    } else {
        header('X-Burnigator-Published: true');
    }
    respond(200, $map);
}
$role = appRole();
if (empty($config['installed']) || empty($_SESSION['admin']) || !in_array($role, [
    'owner',
    'poi',
    'www',
], true)) {
    respond(401, ['error' => 'Anmeldung erforderlich']);
}
if (!hash_equals((string) ($_SESSION['csrf'] ?? ''), (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
    respond(403, ['error' => 'Ungültige Anfrage. Bitte neu laden.']);
}
$action = $_GET['action'] ?? '';
if (in_array($action, [
    'event-auth-settings',
    'event-auth-sync',
    'event-auth-import',
    'pinboard-settings',
    'reset-application',
], true) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($role !== 'owner') {
        respond(403, ['error' => 'forbidden']);
    }
    if ($action === 'reset-application') {
        $input = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($input) || ($input['confirmation'] ?? '') !== 'RESET BURNIGATOR') {
            respond(400, ['error' => 'reset_confirmation_required']);
        }
        $username = strtolower((string) ($_SESSION['username'] ?? 'owner'));
        $account = appUsers($config)[$username] ?? null;
        if (!is_array($account) || ($account['role'] ?? '') !== 'owner' || !password_verify((string) ($input['password'] ?? ''), (string) ($account['password_hash'] ?? ''))) {
            respond(403, ['error' => 'reset_authentication_failed']);
        }
        $configPath = __DIR__ . '/config.php';
        $dataPath = __DIR__ . '/data';
        $uploadsPath = __DIR__ . '/uploads';
        if (!is_file($configPath) || !is_writable($configPath) || !is_dir($dataPath) || !is_writable($dataPath) || !is_dir($uploadsPath) || !is_writable($uploadsPath)) {
            respond(500, ['error' => 'reset_failed']);
        }
        $tempConfig = __DIR__ . '/.reset-config-' . bin2hex(random_bytes(8)) . '.php';
        $uninstalled = "<?php\ndeclare(strict_types=1);\nreturn ['installed' => false];\n";
        if (file_put_contents($tempConfig, $uninstalled, LOCK_EX) === false) {
            respond(500, ['error' => 'reset_failed']);
        }
        $dbCleared = false;
        try {
            // Verify the filesystem part can succeed before the irreversible database delete.
            assertRuntimeDirectoryClearable($dataPath);
            assertRuntimeDirectoryClearable($uploadsPath);
            $dsn = (string) (getenv('BURNIGATOR_DB_DSN') ?: $config['event_auth_db_dsn'] ?? '');
            if ($dsn !== '') {
                eventAuthResetInstallation(eventAuthDb($config));
                $dbCleared = true;
            }
            $cleared = withMapLock(function () use ($dataPath, $uploadsPath, $tempConfig, $configPath) {
                clearRuntimeDirectory($dataPath);
                clearRuntimeDirectory($uploadsPath);
                return rename($tempConfig, $configPath);
            });
            if ($cleared !== true) {
                throw new RuntimeException('Could not replace installation config.');
            }
        } catch (Throwable $e) {
            if (is_file($tempConfig)) {
                @unlink($tempConfig);
            }
            respond(500, ['error' => $dbCleared ? 'reset_partial' : 'reset_failed']);
        }
        $_SESSION = [];
        session_destroy();
        respond(200, ['ok' => true, 'redirect' => 'setup.php']);
    }
    if ($action === 'pinboard-settings') {
        $input = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($input) || !is_bool($input['enabled'] ?? null)) {
            respond(400, ['error' => 'invalid_settings']);
        }
        $enabled = $input['enabled'];
        $map = withMapLock(function () use ($enabled) {
            $current = readMap();
            $current['pinboardEnabled'] = $enabled;
            return saveMap($current) ? $current : false;
        });
        if (!is_array($map)) {
            respond(500, ['error' => 'settings_save_failed']);
        }
        recordHistory('pinboard_setting', 0, $enabled ? 'Pinboard enabled' : 'Pinboard disabled');
        respond(200, ['ok' => true, 'enabled' => $enabled]);
    }
    if ($action === 'event-auth-settings') {
        $input = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($input)) {
            respond(400, ['error' => 'invalid_settings']);
        }
        $base = trim((string) ($input['pretix_base_url'] ?? ''));
        $organizer = trim((string) ($input['pretix_organizer'] ?? ''));
        $event = trim((string) ($input['pretix_event'] ?? ''));
        if (($base === '' || $organizer === '' || $event === '') && ($base !== '' || $organizer !== '' || $event !== '')) {
            respond(400, ['error' => 'invalid_settings']);
        }
        if ($organizer !== '' && !preg_match('/^[a-z0-9_-]{1,80}$/iD', $organizer) || $event !== '' && !preg_match('/^[a-z0-9_-]{1,80}$/iD', $event)) {
            respond(400, ['error' => 'invalid_settings']);
        }
        try {
            if ($base !== '') {
                pretixApiUrl($base, '');
            }
            $db = eventAuthDb($config);
            $old = json_decode((string) (eventAuthSetting($db, 'pretix_settings') ?? '{}'), true);
            if (!is_array($old)) {
                $old = [];
            }
            $token = trim((string) ($input['pretix_token'] ?? ''));
            $settings = [
                'pretix_base_url' => rtrim($base, '/'),
                'pretix_organizer' => $organizer,
                'pretix_event' => $event,
                'pretix_token_encrypted' => $token !== '' ? eventAuthEncrypt($token) : (string) ($old['pretix_token_encrypted'] ?? ''),
            ];
            eventAuthSetting($db, 'pretix_settings', json_encode($settings, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
            respond(200, ['ok' => true]);
        } catch (Throwable $e) {
            respond(400, ['error' => 'invalid_settings']);
        }
    }
    if ($action === 'event-auth-sync') {
        try {
            $db = eventAuthDb($config);
            $settings = json_decode((string) (eventAuthSetting($db, 'pretix_settings') ?? '{}'), true);
            if (!is_array($settings)) {
                $settings = [];
            }
            $syncInput = json_decode((string) file_get_contents('php://input'), true);
            $counts = eventAuthSyncPretix($db, $settings, is_array($syncInput) && ($syncInput['force'] ?? false) === true);
            respond(200, [
                'ok' => true,
                'counts' => $counts,
                'lastSyncAt' => eventAuthSetting($db, 'last_sync_at'),
            ]);
        } catch (EventAuthSyncGuardException $e) {
            respond(409, [
                'error' => 'sync_guard',
                'eligibleBefore' => $e->eligibleBefore,
                'counts' => $e->counts,
            ]);
        } catch (Throwable $e) {
            respond(502, ['error' => 'sync_failed']);
        }
    }
    if (empty($_FILES['csv']) || ($_FILES['csv']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || ($_FILES['csv']['size'] ?? 0) > 10 * 1024 * 1024) {
        respond(400, ['error' => 'import_failed']);
    }
    try {
        $db = eventAuthDb($config);
        $counts = eventAuthCsvImport($db, (string) $_FILES['csv']['tmp_name'], ($_POST['force'] ?? '') === '1');
        respond(200, [
            'ok' => true,
            'counts' => $counts,
            'lastSyncAt' => eventAuthSetting($db, 'last_sync_at'),
        ]);
    } catch (EventAuthSyncGuardException $e) {
        respond(409, [
            'error' => 'sync_guard',
            'eligibleBefore' => $e->eligibleBefore,
            'counts' => $e->counts,
        ]);
    } catch (Throwable $e) {
        respond(400, ['error' => 'import_failed']);
    }
}
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
    $dir = __DIR__ . '/uploads';
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
if ($action === 'restore-snapshot' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($role !== 'owner') {
        respond(403, ['error' => 'Keine Berechtigung']);
    }
    $in = json_decode((string) file_get_contents('php://input'), true);
    $id = is_array($in) ? (string) ($in['id'] ?? '') : '';
    if (!preg_match('/^\d{8}-\d{6}-[a-f0-9]{8}$/', $id)) {
        respond(400, ['error' => 'Ungültiger Snapshot.']);
    }
    $path = __DIR__ . '/data/snapshots/' . $id . '.json';
    $m = is_file($path) ? json_decode((string) file_get_contents($path), true) : null;
    if (!is_array($m) || !is_array($m['categories'] ?? null) || !is_array($m['pois'] ?? null)) {
        respond(404, ['error' => 'Snapshot nicht gefunden.']);
    }
    $m['timelines'] = cleanIndependentTimelines($m['timelines'] ?? []);
    $m['theme'] = cleanTheme($m['theme'] ?? null);
    $m['impressUrl'] = cleanOptionalHttpUrl($m['impressUrl'] ?? '');
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
        if ($expected === '' || !hash_equals((string) ($latest['updatedAt'] ?? ''), $expected)) {
            return 'conflict';
        }
        $m['published'] = $latest['published'];
        $m['pinboardEnabled'] = $latest['pinboardEnabled'];
        return saveMap($m) ? $m : false;
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
        respond(400, ['error' => 'Die Sicherung enthält kein Kartenbild.']);
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
    $imageInfo = $paths['image'] !== '' ? @getimagesize(__DIR__ . '/' . $paths['image']) : false;
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
        'titleLinkUrl' => cleanOptionalHttpUrl($src['titleLinkUrl'] ?? ''),
        'image' => $paths['image'],
        'logo' => $paths['logo'],
        'favicon' => $paths['favicon'],
        'width' => $imageInfo ? (int) $imageInfo[0] : 0,
        'height' => $imageInfo ? (int) $imageInfo[1] : 0,
        'iconMode' => ($src['iconMode'] ?? '') === 'colored' ? 'colored' : 'monochrome',
        'browserTranslationEnabled' => !empty($src['browserTranslationEnabled']),
        'customButton' => ['label' => $url !== '' ? cleanText($custom['label'] ?? '', 40) : '', 'url' => $url],
        'categories' => $categories,
        'pois' => $pois,
        'timelines' => $timelines,
    ];
    $expected = (string) ($in['expectedUpdatedAt'] ?? '');
    $saved = withMapLock(function () use (&$map, $expected) {
        $latest = readMap();
        if ($expected === '' || !hash_equals((string) ($latest['updatedAt'] ?? ''), $expected)) {
            return 'conflict';
        }
        $map['published'] = $latest['published'];
        $map['pinboardEnabled'] = $latest['pinboardEnabled'];
        return saveMap($map) ? $map : false;
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
if ($action === 'upload-branding' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($role !== 'owner') {
        respond(403, ['error' => 'Keine Berechtigung']);
    }
    $kind = (string) ($_GET['kind'] ?? '');
    if (!in_array($kind, ['logo', 'favicon'], true)) {
        respond(400, ['error' => 'Ungültiger Bildtyp.']);
    }
    if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        respond(400, ['error' => 'Upload fehlgeschlagen.']);
    }
    $f = $_FILES['image'];
    if ($f['size'] > 5 * 1024 * 1024) {
        respond(400, ['error' => 'Das PNG darf höchstens 5 MB groß sein.']);
    }
    $info = @getimagesize($f['tmp_name']);
    if (!$info || $info['mime'] !== 'image/png') {
        respond(400, ['error' => 'Bitte eine gültige PNG-Datei wählen.']);
    }
    $maxWidth = $kind === 'favicon' ? 1024 : 5000;
    $maxHeight = $kind === 'favicon' ? 1024 : 2000;
    if ($info[0] > $maxWidth || $info[1] > $maxHeight) {
        respond(400, ['error' => 'Die Bildabmessungen sind zu groß.']);
    }
    $name = $kind . '-' . bin2hex(random_bytes(12)) . '.png';
    $dir = __DIR__ . '/uploads';
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        respond(500, ['error' => 'Uploadverzeichnis konnte nicht erstellt werden.']);
    }
    if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) {
        respond(500, ['error' => 'Bild konnte nicht gespeichert werden.']);
    }
    $field = $kind === 'logo' ? 'logo' : 'favicon';
    $m = withMapLock(function () use ($field, $name) {
        $current = readMap();
        $current[$field] = 'uploads/' . $name;
        return saveMap($current) ? $current : false;
    });
    if (!is_array($m)) {
        respond(500, ['error' => 'Kartendaten konnten nicht gespeichert werden.']);
    }
    recordHistory('branding_' . $kind);
    respond(200, ['ok' => true, 'map' => $m]);
}
if ($action === 'upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($role !== 'owner') {
        respond(403, ['error' => 'Keine Berechtigung']);
    }
    if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        respond(400, ['error' => 'Upload fehlgeschlagen.']);
    }
    $f = $_FILES['image'];
    if ($f['size'] > 20 * 1024 * 1024) {
        respond(400, ['error' => 'Das Bild darf höchstens 20 MB groß sein.']);
    }
    $info = @getimagesize($f['tmp_name']);
    if (!$info || !in_array($info['mime'], ['image/png', 'image/jpeg'], true)) {
        respond(400, ['error' => 'Bitte eine gültige PNG- oder JPG-Datei wählen.']);
    }
    if ($info[0] < 1 || $info[1] < 1 || $info[0] > 30000 || $info[1] > 30000 || $info[0] * $info[1] > 100000000) {
        respond(400, ['error' => 'Die Bildabmessungen sind zu groß. Bitte ein Bild mit höchstens 100 Megapixeln verwenden.']);
    }
    $ext = $info['mime'] === 'image/png' ? 'png' : 'jpg';
    $name = 'map-' . bin2hex(random_bytes(12)) . '.' . $ext;
    $dir = __DIR__ . '/uploads';
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        respond(500, ['error' => 'Uploadverzeichnis konnte nicht erstellt werden.']);
    }
    if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) {
        respond(500, ['error' => 'Bild konnte nicht gespeichert werden.']);
    }
    $m = withMapLock(function () use ($name, $info) {
        $current = readMap();
        $current['image'] = 'uploads/' . $name;
        $current['width'] = (int) $info[0];
        $current['height'] = (int) $info[1];
        return saveMap($current) ? $current : false;
    });
    if (!is_array($m)) {
        respond(500, ['error' => 'Kartendaten konnten nicht gespeichert werden.']);
    }
    recordHistory('map_image_upload');
    respond(200, ['ok' => true, 'map' => $m]);
}

function saveMap(array &$m): bool
{
    createMapSnapshot();
    $path = __DIR__ . '/data/map.json';
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        return false;
    }
    $m['updatedAt'] = gmdate('c');
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
if ($_SERVER['REQUEST_METHOD'] === 'POST' && in_array($action, [
    'save',
    'save-poi',
    'save-pois',
    'delete-poi',
    'save-program',
    'save-timelines',
    'save-accounts',
    'change-owner-password',
    'set-publication',
], true)) {
    $in = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($in)) {
        respond(400, ['error' => 'Ungültige Daten.']);
    }
    if ($action === 'save' && $role !== 'owner') {
        respond(403, ['error' => 'Keine Berechtigung']);
    }
    if (in_array($action, [
        'save-poi',
        'save-pois',
        'delete-poi',
    ], true) && !in_array($role, ['owner', 'poi'], true)) {
        respond(403, ['error' => 'Keine Berechtigung']);
    }
    if (in_array($action, ['save-program', 'save-timelines'], true) && !in_array($role, ['owner', 'www'], true)) {
        respond(403, ['error' => 'Keine Berechtigung']);
    }
    if ($action === 'save-accounts' && $role !== 'owner') {
        respond(403, ['error' => 'Keine Berechtigung']);
    }
    if ($action === 'set-publication' && $role !== 'owner') {
        respond(403, ['error' => 'Keine Berechtigung']);
    }
    if ($action === 'set-publication') {
        if (!is_bool($in['published'] ?? null)) {
            respond(400, ['error' => 'invalid_publication_state']);
        }
        $expected = (string) ($in['expectedUpdatedAt'] ?? '');
        $map = withMapLock(function () use ($in, $expected) {
            $m = readMap();
            if ($expected === '' || !hash_equals((string) ($m['updatedAt'] ?? ''), $expected)) {
                return 'conflict';
            }
            $m['published'] = $in['published'];
            return saveMap($m) ? $m : false;
        });
        if ($map === 'conflict') {
            respond(409, ['error' => 'map_conflict']);
        }
        if (!is_array($map)) {
            respond(500, ['error' => 'publication_save_failed']);
        }
        recordHistory('publication_change', 0, $map['published'] ? 'Published' : 'Unpublished');
        respond(200, ['ok' => true, 'map' => $map]);
    }
    if ($action === 'change-owner-password') {
        if ($role !== 'owner') {
            respond(403, ['error' => 'Keine Berechtigung']);
        }
        $username = strtolower((string) ($_SESSION['username'] ?? ''));
        $users = appUsers($config);
        if (!isset($users[$username]) || ($users[$username]['role'] ?? '') !== 'owner') {
            foreach ($users as $candidate => $account) {
                if (($account['role'] ?? '') === 'owner') {
                    $username = (string) $candidate;
                    break;
                }
            }
        }
        $account = $users[$username] ?? null;
        $current = (string) ($in['currentPassword'] ?? '');
        $password = (string) ($in['password'] ?? '');
        $confirm = (string) ($in['passwordConfirm'] ?? '');
        if (!is_array($account) || empty($account['password_hash']) || !password_verify($current, (string) $account['password_hash'])) {
            respond(400, ['error' => 'current_password_invalid']);
        }
        if (strlen($password) < 12) {
            respond(400, ['error' => 'password_too_short']);
        }
        if (!hash_equals($password, $confirm)) {
            respond(400, ['error' => 'password_mismatch']);
        }
        $users[$username]['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
        if (!saveAppUsers($users)) {
            respond(500, ['error' => 'password_save_failed']);
        }
        session_regenerate_id(true);
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        recordHistory('owner_password_save', 0, 'Owner-Passwort geändert');
        respond(200, ['ok' => true, 'csrf' => $_SESSION['csrf']]);
    }
    if ($action === 'save-accounts') {
        $users = appUsers($config);
        $roles = ['poi', 'www'];
        $inputAccounts = (array) ($in['accounts'] ?? []);
        $existingByRole = [];
        foreach ($users as $username => $account) {
            if (in_array($account['role'] ?? '', $roles, true)) {
                $existingByRole[$account['role']] = ['username' => (string) $username, 'password_hash' => (string) ($account['password_hash'] ?? '')];
            }
        }
        foreach ($roles as $accountRole) {
            $entry = is_array($inputAccounts[$accountRole] ?? null) ? $inputAccounts[$accountRole] : [];
            $username = strtolower(trim((string) ($entry['username'] ?? '')));
            $password = (string) ($entry['password'] ?? '');
            $passwordConfirm = (string) ($entry['passwordConfirm'] ?? '');
            if (!hash_equals($password, $passwordConfirm)) {
                respond(400, ['error' => 'password_mismatch']);
            }
            if ($username === '' && $password === '') {
                if (isset($existingByRole[$accountRole])) {
                    unset($users[$existingByRole[$accountRole]['username']]);
                }
                continue;
            }
            if (!preg_match('/^[a-zA-Z0-9_.-]{3,32}$/', $username)) {
                respond(400, ['error' => 'Benutzernamen müssen 3–32 Zeichen haben (Buchstaben, Zahlen, Punkt, _ oder -).']);
            }
            if (isset($users[$username]) && ($existingByRole[$accountRole]['username'] ?? null) !== $username) {
                respond(400, ['error' => 'Dieser Benutzername ist bereits vergeben.']);
            }
            $hash = $existingByRole[$accountRole]['password_hash'] ?? '';
            if ($password !== '') {
                if (strlen($password) < 12) {
                    respond(400, ['error' => 'password_too_short']);
                }
                $hash = password_hash($password, PASSWORD_DEFAULT);
            }
            if ($hash === '') {
                respond(400, ['error' => 'Bitte für jedes neue Konto ein Passwort mit mindestens 12 Zeichen festlegen.']);
            }
            if (isset($existingByRole[$accountRole]['username'])) {
                unset($users[$existingByRole[$accountRole]['username']]);
            }
            $users[$username] = ['role' => $accountRole, 'password_hash' => $hash];
        }
        if (!saveAppUsers($users)) {
            respond(500, ['error' => 'Konten konnten nicht gespeichert werden. Prüfe die Schreibrechte für data/.']);
        }
        $accounts = [];
        foreach ($users as $username => $account) {
            if (in_array($account['role'] ?? '', $roles, true)) {
                $accounts[$account['role']] = ['username' => $username];
            }
        }
        recordHistory('accounts_save', 0, 'POI: ' . ($accounts['poi']['username'] ?? '—') . ' · WWW: ' . ($accounts['www']['username'] ?? '—'));
        respond(200, ['ok' => true, 'accounts' => $accounts]);
    }
    if ($action === 'save-poi') {
        $map = withMapLock(function () use ($in) {
            $m = readMap();
            $expected = (string) ($in['expectedUpdatedAt'] ?? '');
            if ($expected === '' || !hash_equals((string) ($m['updatedAt'] ?? ''), $expected)) {
                return 'conflict';
            }
            $p = $in['poi'] ?? null;
            if (!is_array($p)) {
                return false;
            }
            $id = (string) ($p['id'] ?? '');
            if (!preg_match('/^[a-f0-9-]{1,40}$/', $id)) {
                $id = bin2hex(random_bytes(8));
            }
            $index = null;
            $old = [];
            foreach ((array) $m['pois'] as $i => $candidate) {
                if ((string) ($candidate['id'] ?? '') === $id) {
                    $index = $i;
                    $old = $candidate;
                    break;
                }
            }
            $x = filter_var($p['x'] ?? $old['x'] ?? null, FILTER_VALIDATE_FLOAT);
            $y = filter_var($p['y'] ?? $old['y'] ?? null, FILTER_VALIDATE_FLOAT);
            if ($x === false || $y === false || $x < 0 || $y < 0 || $x > 1 || $y > 1) {
                return false;
            }
            $knownCats = array_column((array) $m['categories'], 'id');
            $cat = (string) ($p['categoryId'] ?? $old['categoryId'] ?? '');
            if (!in_array($cat, $knownCats, true)) {
                $cat = '';
            }
            $raw = $p['icon'] ?? $old['icon'] ?? 'fa-location-dot';
            $icon = is_string($raw) && preg_match('/^fa-[a-z0-9-]{2,60}$/', $raw) ? $raw : (cleanText($raw, 16) ?: '•');
            $saved = [
                'id' => $id,
                'x' => $x,
                'y' => $y,
                'name' => cleanText($p['name'] ?? $old['name'] ?? '', 100),
                'description' => cleanText($p['description'] ?? $old['description'] ?? '', 1000),
                'categoryId' => $cat,
                'icon' => $icon,
                'hasProgram' => (bool) ($old['hasProgram'] ?? false),
                'program' => (array) ($old['program'] ?? cleanProgram([])),
            ];
            if ($index === null) {
                if (count((array) $m['pois']) >= 2000) {
                    return 'poi_limit';
                }
                $m['pois'][] = $saved;
            } else {
                $m['pois'][$index] = $saved;
            }
            return saveMap($m) ? $m : false;
        });
        if ($map === 'poi_limit') {
            respond(400, ['error' => 'poi_limit']);
        }
        if ($map === 'conflict') {
            respond(409, ['error' => 'map_conflict']);
        }
        if (!is_array($map)) {
            respond(400, ['error' => 'POI konnte nicht gespeichert werden. Prüfe Position und Schreibrechte.']);
        }
        recordHistory('poi_save', 0, cleanText(($in['poi']['name'] ?? $in['poi']['id'] ?? 'POI') . ' · ' . round((float) ($in['poi']['x'] ?? 0) * 100) . '% / ' . round((float) ($in['poi']['y'] ?? 0) * 100) . '%', 180));
        respond(200, ['ok' => true, 'map' => $map]);
    }
    if ($action === 'save-pois') {
        $items = $in['pois'] ?? null;
        if (!is_array($items) || count($items) > 2000) {
            respond(400, ['error' => 'Ungültige POI-Daten.']);
        }
        foreach ($items as $incomingPoi) {
            if (is_array($incomingPoi) && invalidProgramTimes($incomingPoi['program'] ?? [])) {
                respond(400, ['error' => 'invalid_event_time']);
            }
        }
        $expected = (string) ($in['expectedUpdatedAt'] ?? '');
        $map = withMapLock(function () use ($items, $expected) {
            $m = readMap();
            if ($expected === '' || !hash_equals((string) ($m['updatedAt'] ?? ''), $expected)) {
                return 'conflict';
            }
            $knownCats = array_column((array) $m['categories'], 'id');
            foreach ($items as $p) {
                if (!is_array($p)) {
                    continue;
                }
                $id = (string) ($p['id'] ?? '');
                if (!preg_match('/^[a-f0-9-]{1,40}$/', $id)) {
                    continue;
                }
                $index = null;
                $old = [];
                foreach ((array) $m['pois'] as $i => $candidate) {
                    if ((string) ($candidate['id'] ?? '') === $id) {
                        $index = $i;
                        $old = $candidate;
                        break;
                    }
                }
                $x = filter_var($p['x'] ?? $old['x'] ?? null, FILTER_VALIDATE_FLOAT);
                $y = filter_var($p['y'] ?? $old['y'] ?? null, FILTER_VALIDATE_FLOAT);
                if ($x === false || $y === false || $x < 0 || $y < 0 || $x > 1 || $y > 1) {
                    return false;
                }
                $cat = (string) ($p['categoryId'] ?? $old['categoryId'] ?? '');
                if (!in_array($cat, $knownCats, true)) {
                    $cat = '';
                }
                $raw = $p['icon'] ?? $old['icon'] ?? 'fa-location-dot';
                $icon = is_string($raw) && preg_match('/^fa-[a-z0-9-]{2,60}$/', $raw) ? $raw : (cleanText($raw, 16) ?: '•');
                $saved = [
                    'id' => $id,
                    'x' => $x,
                    'y' => $y,
                    'name' => cleanText($p['name'] ?? $old['name'] ?? '', 100),
                    'description' => cleanText($p['description'] ?? $old['description'] ?? '', 1000),
                    'categoryId' => $cat,
                    'icon' => $icon,
                    'hasProgram' => (bool) ($old['hasProgram'] ?? false),
                    'program' => (array) ($old['program'] ?? cleanProgram([])),
                ];
                if ($index === null) {
                    if (count((array) $m['pois']) >= 2000) {
                        return 'poi_limit';
                    }
                    $m['pois'][] = $saved;
                } else {
                    $m['pois'][$index] = $saved;
                }
            }
            return saveMap($m) ? $m : false;
        });
        if ($map === 'poi_limit') {
            respond(400, ['error' => 'poi_limit']);
        }
        if ($map === 'conflict') {
            respond(409, ['error' => 'map_conflict']);
        }
        if (!is_array($map)) {
            respond(400, ['error' => 'POIs konnten nicht gespeichert werden. Prüfe Position und Schreibrechte.']);
        }
        recordHistory('poi_save_all', count($items), 'Bulk update');
        respond(200, ['ok' => true, 'map' => $map]);
    }
    if ($action === 'delete-poi') {
        $id = (string) ($in['id'] ?? '');
        $detail = cleanText($in['name'] ?? $id, 100);
        $expected = (string) ($in['expectedUpdatedAt'] ?? '');
        $map = withMapLock(function () use ($id, $role, $expected) {
            $m = readMap();
            if ($expected === '' || !hash_equals((string) ($m['updatedAt'] ?? ''), $expected)) {
                return 'conflict';
            }
            $found = false;
            foreach ((array) $m['pois'] as $p) {
                if ((string) ($p['id'] ?? '') === $id) {
                    $found = true;
                    if ($role === 'poi' && array_sum(array_map(static fn($day) => is_array($day) ? count($day) : 0, (array) ($p['program'] ?? []))) > 0) {
                        return 'poi_has_events';
                    }
                    break;
                }
            }
            if (!$found) {
                return false;
            }
            $m['pois'] = array_values(array_filter((array) $m['pois'], static fn($p) => (string) ($p['id'] ?? '') !== $id));
            return saveMap($m) ? $m : false;
        });
        if ($map === 'poi_has_events') {
            respond(409, ['error' => 'poi_has_events']);
        }
        if ($map === 'conflict') {
            respond(409, ['error' => 'map_conflict']);
        }
        if (!is_array($map)) {
            respond(404, ['error' => 'POI nicht gefunden oder konnte nicht gelöscht werden.']);
        }
        recordHistory('poi_delete', 0, $detail);
        respond(200, ['ok' => true, 'map' => $map]);
    }
    if ($action === 'save-timelines') {
        $inputTimelines = $in['timelines'] ?? null;
        if (!is_array($inputTimelines) || count($inputTimelines) > 3) {
            respond(400, ['error' => 'invalid_timelines']);
        }
        foreach ($inputTimelines as $timeline) {
            if (is_array($timeline) && invalidProgramTimes($timeline['program'] ?? [])) {
                respond(400, ['error' => 'invalid_event_time']);
            }
        }
        foreach ($inputTimelines as $timeline) {
            if (is_array($timeline) && cleanText($timeline['name'] ?? '', 60) === '') {
                respond(400, ['error' => 'timeline_name_required']);
            }
        }
        $cleanTimelines = cleanIndependentTimelines($inputTimelines);
        $expected = (string) ($in['expectedUpdatedAt'] ?? '');
        $map = withMapLock(function () use ($cleanTimelines, $expected) {
            $m = readMap();
            if ($expected === '' || !hash_equals((string) ($m['updatedAt'] ?? ''), $expected)) {
                return 'conflict';
            }
            $m['timelines'] = $cleanTimelines;
            return saveMap($m) ? $m : false;
        });
        if ($map === 'conflict') {
            respond(409, ['error' => 'map_conflict']);
        }
        if (!is_array($map)) {
            respond(500, ['error' => 'timelines_save_failed']);
        }
        recordHistory('timelines_save', count($cleanTimelines), implode(', ', array_column($cleanTimelines, 'name')));
        respond(200, ['ok' => true, 'map' => $map]);
    }
    if ($action === 'save-program') {
        if (invalidProgramTimes($in['program']['program'] ?? [])) {
            respond(400, ['error' => 'invalid_event_time']);
        }
        $map = withMapLock(function () use ($in) {
            $m = readMap();
            $expected = (string) ($in['expectedUpdatedAt'] ?? '');
            if ($expected === '' || !hash_equals((string) ($m['updatedAt'] ?? ''), $expected)) {
                return 'conflict';
            }
            $update = $in['program'] ?? null;
            if (!is_array($update)) {
                return false;
            }
            $id = (string) ($update['id'] ?? '');
            $found = false;
            foreach ($m['pois'] as &$poi) {
                if ((string) ($poi['id'] ?? '') === $id) {
                    $poi['hasProgram'] = !empty($update['hasProgram']);
                    $poi['program'] = cleanProgram($update['program'] ?? []);
                    $found = true;
                    break;
                }
            }
            unset($poi);
            return $found && saveMap($m) ? $m : false;
        });
        if ($map === 'conflict') {
            respond(409, ['error' => 'map_conflict']);
        }
        if (!is_array($map)) {
            respond(404, ['error' => 'POI nicht gefunden oder Programm konnte nicht gespeichert werden.']);
        }
        recordHistory('program_save', array_sum(array_map(static fn($day) => is_array($day) ? count($day) : 0, (array) ($in['program']['program'] ?? []))), programHistoryDetail($in['program']['program'] ?? [], (string) ($in['program']['name'] ?? $in['program']['id'] ?? 'POI')));
        respond(200, ['ok' => true, 'map' => $map]);
    }
}
if ($action !== 'save' || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(404, ['error' => 'Unbekannte Anfrage']);
}
$in = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($in)) {
    respond(400, ['error' => 'Ungültige Daten.']);
}
foreach ((array) ($in['pois'] ?? []) as $incomingPoi) {
    if (is_array($incomingPoi) && invalidProgramTimes($incomingPoi['program'] ?? [])) {
        respond(400, ['error' => 'invalid_event_time']);
    }
}
$cats = [];
foreach (array_slice((array) ($in['categories'] ?? []), 0, 100) as $c) {
    if (!is_array($c)) {
        continue;
    }
    $id = preg_match('/^[a-f0-9-]{1,40}$/', (string) ($c['id'] ?? '')) ? (string) $c['id'] : bin2hex(random_bytes(8));
    $color = (string) ($c['color'] ?? '#E94F85');
    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
        $color = '#E94F85';
    }
    $cats[] = [
        'id' => $id,
        'name' => cleanText($c['name'] ?? '', 60),
        'color' => $color,
    ];
}
$catIds = array_column($cats, 'id');
$pois = [];
foreach (array_slice((array) ($in['pois'] ?? []), 0, 2000) as $p) {
    if (!is_array($p)) {
        continue;
    }
    $x = filter_var($p['x'] ?? null, FILTER_VALIDATE_FLOAT);
    $y = filter_var($p['y'] ?? null, FILTER_VALIDATE_FLOAT);
    if ($x === false || $y === false || $x < 0 || $y < 0 || $x > 1 || $y > 1) {
        continue;
    }
    $cat = (string) ($p['categoryId'] ?? '');
    if (!in_array($cat, $catIds, true)) {
        $cat = '';
    }
    $rawIcon = $p['icon'] ?? 'fa-location-dot';
    $icon = is_string($rawIcon) && preg_match('/^fa-[a-z0-9-]{2,60}$/', $rawIcon) ? $rawIcon : (cleanText($rawIcon, 16) ?: '•');
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
$old = readMap();
$soundcloudPlaylist = array_key_exists('soundcloudPlaylist', $in) ? cleanSoundCloudPlaylist($in['soundcloudPlaylist']) : cleanSoundCloudPlaylist($old['soundcloudPlaylist'] ?? defaultSoundCloudPlaylist());
if ($soundcloudPlaylist === null) {
    respond(400, ['error' => 'soundcloud_playlist_invalid']);
}
$rawTimelines = $in['timelines'] ?? [];
if (!is_array($rawTimelines) || count($rawTimelines) > 3) {
    respond(400, ['error' => 'invalid_timelines']);
}
foreach ($rawTimelines as $timeline) {
    if (is_array($timeline)) {
        if (invalidProgramTimes($timeline['program'] ?? [])) {
            respond(400, ['error' => 'invalid_event_time']);
        }
        if (cleanText($timeline['name'] ?? '', 60) === '') {
            respond(400, ['error' => 'timeline_name_required']);
        }
    }
}
$timelines = array_key_exists('timelines', $in) ? cleanIndependentTimelines($rawTimelines) : (array) ($old['timelines'] ?? []);
$mode = (string) ($in['iconMode'] ?? 'monochrome');
if (!in_array($mode, ['monochrome', 'colored'], true)) {
    $mode = 'monochrome';
}
$custom = $in['customButton'] ?? [];
$custom = is_array($custom) ? $custom : [];
$customLabel = cleanText($custom['label'] ?? '', 40);
$customUrl = cleanText($custom['url'] ?? '', 2048);
$urlParts = $customUrl !== '' ? parse_url($customUrl) : false;
if (!$urlParts || !in_array(strtolower((string) ($urlParts['scheme'] ?? '')), ['http', 'https'], true) || !filter_var($customUrl, FILTER_VALIDATE_URL)) {
    $customLabel = '';
    $customUrl = '';
}
$qrUrl = cleanText($in['qrUrl'] ?? '', 2048);
$qrParts = $qrUrl !== '' ? parse_url($qrUrl) : false;
if (!$qrParts || !in_array(strtolower((string) ($qrParts['scheme'] ?? '')), ['http', 'https'], true) || !filter_var($qrUrl, FILTER_VALIDATE_URL)) {
    $qrUrl = '';
}
$m = [
    'title' => cleanText($in['title'] ?? 'Mein Event', 100) ?: 'Mein Event',
    'theme' => cleanTheme($in['theme'] ?? $old['theme'] ?? null),
    'matomoUrl' => cleanMatomoUrl($in['matomoUrl'] ?? $old['matomoUrl'] ?? ''),
    'matomoSiteId' => cleanMatomoSiteId($in['matomoSiteId'] ?? $old['matomoSiteId'] ?? ''),
    'image' => (string) ($old['image'] ?? ''),
    'logo' => (string) ($old['logo'] ?? ''),
    'favicon' => (string) ($old['favicon'] ?? ''),
    'width' => (int) ($old['width'] ?? 0),
    'height' => (int) ($old['height'] ?? 0),
    'iconMode' => $mode,
    'browserTranslationEnabled' => !empty($in['browserTranslationEnabled']),
    'soundcloudEnabled' => array_key_exists('soundcloudEnabled', $in) ? $in['soundcloudEnabled'] !== false : $old['soundcloudEnabled'] ?? true,
    'soundcloudPlaylist' => $soundcloudPlaylist,
    'customButton' => ['label' => $customLabel, 'url' => $customUrl],
    'qrUrl' => $qrUrl,
    'impressUrl' => cleanOptionalHttpUrl($in['impressUrl'] ?? $old['impressUrl'] ?? ''),
    'titleLinkUrl' => cleanOptionalHttpUrl($in['titleLinkUrl'] ?? $old['titleLinkUrl'] ?? ''),
    'published' => ($old['published'] ?? true) === true,
    'pinboardEnabled' => ($old['pinboardEnabled'] ?? false) === true,
    'categories' => $cats,
    'pois' => $pois,
    'timelines' => $timelines,
];
$expected = (string) ($in['expectedUpdatedAt'] ?? '');
$saved = withMapLock(function () use (&$m, $expected) {
    $latest = readMap();
    if ($expected === '' || !hash_equals((string) ($latest['updatedAt'] ?? ''), $expected)) {
        return 'conflict';
    }
    foreach ([
        'image',
        'logo',
        'favicon',
        'width',
        'height',
    ] as $key) {
        $m[$key] = $latest[$key] ?? $m[$key] ?? '';
    }
    return saveMap($m) ? $m : false;
});
if ($saved === 'conflict') {
    respond(409, ['error' => 'map_conflict']);
}
if (!is_array($saved)) {
    respond(500, ['error' => 'Speichern fehlgeschlagen. Prüfe die Schreibrechte für data/.']);
}
$m = $saved;
recordHistory('map_save', count($pois), 'Kategorien: ' . count($cats) . ' · POIs: ' . count($pois));
respond(200, ['ok' => true, 'map' => $m]);
