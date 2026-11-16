<?php
declare(strict_types=1);

/** Event-scoped attendee authentication and pinboard persistence. */
const EVENT_AUTH_SCHEMA_VERSION = 1;
function eventAuthSecret(): string {
    $config = $GLOBALS['burnigatorConfig'] ?? [];
    $secret = (string)(getenv('BURNIGATOR_EVENT_AUTH_SECRET') ?: (is_array($config) ? ($config['event_auth_secret'] ?? '') : ''));
    return strlen($secret) >= 32 ? $secret : '';
}
function eventAuthEventId(): string {
    $config = $GLOBALS['burnigatorConfig'] ?? [];
    return appInstanceId(is_array($config) ? $config : []);
}

function eventAuthDb(array $config): PDO {
    static $db = null;
    if ($db instanceof PDO) return $db;
    $dsn = (string)(getenv('BURNIGATOR_DB_DSN') ?: ($config['event_auth_db_dsn'] ?? ''));
    $user = (string)(getenv('BURNIGATOR_DB_USER') ?: ($config['event_auth_db_user'] ?? ''));
    $pass = (string)(getenv('BURNIGATOR_DB_PASSWORD') ?: ($config['event_auth_db_password'] ?? ''));
    if ($dsn === '') throw new RuntimeException('Event authentication database is not configured.');
    $db = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]);
    // Migrations are idempotent, but checking them costs DB round trips. A small flag file
    // records the applied version so normal requests skip the check; if the flag cannot be
    // read or written we simply migrate (and re-check) every time.
    $flag = __DIR__ . '/data/event-auth-schema';
    if ((int)@file_get_contents($flag) !== EVENT_AUTH_SCHEMA_VERSION) {
        eventAuthMigrate($db);
        @file_put_contents($flag, (string)EVENT_AUTH_SCHEMA_VERSION, LOCK_EX);
    }
    return $db;
}

function eventAuthMigrate(PDO $db): void {
    $driver = (string)$db->getAttribute(PDO::ATTR_DRIVER_NAME);
    if (!in_array($driver, ['mysql', 'sqlite'], true)) throw new RuntimeException('Unsupported event authentication database.');
    if ($driver === 'mysql') {
        $db->exec("CREATE TABLE IF NOT EXISTS burnigator_schema_migrations (version INT NOT NULL PRIMARY KEY, applied_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        if ((int)$db->query('SELECT COALESCE(MAX(version),0) FROM burnigator_schema_migrations')->fetchColumn() >= 1) return;
        $db->exec("CREATE TABLE IF NOT EXISTS burnigator_event_auth_orders (event_id CHAR(32) NOT NULL, order_hash CHAR(64) NOT NULL, status VARCHAR(24) NOT NULL, eligible TINYINT(1) NOT NULL DEFAULT 0, pseudonym VARCHAR(80) NULL, source VARCHAR(16) NOT NULL, sync_marker CHAR(32) NOT NULL, updated_at DATETIME NOT NULL, PRIMARY KEY(event_id,order_hash), UNIQUE KEY uq_auth_pseudonym(event_id,pseudonym), INDEX idx_auth_eligible (event_id,eligible)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $db->exec("CREATE TABLE IF NOT EXISTS burnigator_event_auth_sessions (event_id CHAR(32) NOT NULL, token_hash CHAR(64) NOT NULL, order_hash CHAR(64) NOT NULL, pseudonym VARCHAR(80) NOT NULL, expires_at DATETIME NOT NULL, created_at DATETIME NOT NULL, PRIMARY KEY(event_id,token_hash), INDEX idx_auth_session_order (event_id,order_hash), INDEX idx_auth_session_expiry (event_id,expires_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $db->exec("CREATE TABLE IF NOT EXISTS burnigator_pinboard_posts (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, event_id CHAR(32) NOT NULL, owner_hash CHAR(64) NOT NULL, pseudonym VARCHAR(80) NOT NULL, body TEXT NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, hidden TINYINT(1) NOT NULL DEFAULT 0, INDEX idx_pinboard_visible (event_id,hidden,created_at), INDEX idx_pinboard_owner (event_id,owner_hash)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $db->exec("CREATE TABLE IF NOT EXISTS burnigator_event_auth_settings (event_id CHAR(32) NOT NULL, setting_key VARCHAR(64) NOT NULL, setting_value MEDIUMTEXT NOT NULL, updated_at DATETIME NOT NULL, PRIMARY KEY(event_id,setting_key)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $db->exec("CREATE TABLE IF NOT EXISTS burnigator_event_auth_rate_limits (event_id CHAR(32) NOT NULL, scope VARCHAR(16) NOT NULL, ip_hash CHAR(64) NOT NULL, window_started DATETIME NOT NULL, hits INT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY(event_id,scope,ip_hash)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    } else {
        $db->exec('CREATE TABLE IF NOT EXISTS burnigator_schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
        if ((int)$db->query('SELECT COALESCE(MAX(version),0) FROM burnigator_schema_migrations')->fetchColumn() >= 1) return;
        $db->exec('CREATE TABLE IF NOT EXISTS burnigator_event_auth_orders (event_id CHAR(32) NOT NULL, order_hash CHAR(64) NOT NULL, status TEXT NOT NULL, eligible INTEGER NOT NULL DEFAULT 0, pseudonym TEXT NULL, source TEXT NOT NULL, sync_marker TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(event_id,order_hash))');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_auth_eligible ON burnigator_event_auth_orders (event_id,eligible)');
        $db->exec('CREATE UNIQUE INDEX IF NOT EXISTS uq_auth_pseudonym ON burnigator_event_auth_orders (event_id,pseudonym)');
        $db->exec('CREATE TABLE IF NOT EXISTS burnigator_event_auth_sessions (event_id CHAR(32) NOT NULL, token_hash CHAR(64) NOT NULL, order_hash CHAR(64) NOT NULL, pseudonym TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(event_id,token_hash))');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_auth_session_order ON burnigator_event_auth_sessions (event_id,order_hash)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_auth_session_expiry ON burnigator_event_auth_sessions (event_id,expires_at)');
        $db->exec('CREATE TABLE IF NOT EXISTS burnigator_pinboard_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id CHAR(32) NOT NULL, owner_hash CHAR(64) NOT NULL, pseudonym TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_pinboard_visible ON burnigator_pinboard_posts (event_id,hidden,created_at)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_pinboard_owner ON burnigator_pinboard_posts (event_id,owner_hash)');
        $db->exec('CREATE TABLE IF NOT EXISTS burnigator_event_auth_settings (event_id CHAR(32) NOT NULL, setting_key TEXT NOT NULL, setting_value TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(event_id,setting_key))');
        $db->exec('CREATE TABLE IF NOT EXISTS burnigator_event_auth_rate_limits (event_id CHAR(32) NOT NULL, scope TEXT NOT NULL, ip_hash CHAR(64) NOT NULL, window_started TEXT NOT NULL, hits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(event_id,scope,ip_hash))');
    }
    $db->prepare('INSERT ' . ($driver === 'mysql' ? 'IGNORE' : 'OR IGNORE') . ' INTO burnigator_schema_migrations(version,applied_at) VALUES(1,?)')->execute([gmdate('Y-m-d H:i:s')]);
}

function eventOrderNormalize(string $code): string {
    $code = strtoupper(trim($code));
    return preg_replace('/[\s-]+/', '', $code) ?? '';
}

function eventOrderHash(string $code): string {
    $secret = eventAuthSecret();
    if ($secret === '') throw new RuntimeException('Event authentication secret is not configured.');
    return hash_hmac('sha256', eventOrderNormalize($code), $secret);
}
function eventAuthEncrypt(string $value): string {
    $secret=eventAuthSecret();if($secret===''||!function_exists('openssl_encrypt'))throw new RuntimeException('Server-side encryption is unavailable.');
    $iv=random_bytes(12);$tag='';$cipher=openssl_encrypt($value,'aes-256-gcm',hash('sha256',$secret,true),OPENSSL_RAW_DATA,$iv,$tag);
    if(!is_string($cipher)||strlen($tag)!==16)throw new RuntimeException('Could not encrypt Pretix token.');
    return 'v1:'.base64_encode($iv.$tag.$cipher);
}
function eventAuthDecrypt(string $value): string {
    if(strpos($value,'v1:')!==0||!function_exists('openssl_decrypt'))throw new RuntimeException('Pretix token cannot be decrypted.');
    $packed=base64_decode(substr($value,3),true);if(!is_string($packed)||strlen($packed)<29)throw new RuntimeException('Pretix token is invalid.');
    $secret=eventAuthSecret();if($secret==='')throw new RuntimeException('Event authentication secret is not configured.');
    $plain=openssl_decrypt(substr($packed,28),'aes-256-gcm',hash('sha256',$secret,true),OPENSSL_RAW_DATA,substr($packed,0,12),substr($packed,12,16));
    if(!is_string($plain))throw new RuntimeException('Pretix token cannot be decrypted.');
    return $plain;
}

function eventAuthSetting(PDO $db, string $key, ?string $value = null): ?string {
    if ($value !== null) {
        $sql = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
            ? 'INSERT INTO burnigator_event_auth_settings (event_id,setting_key, setting_value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(event_id,setting_key) DO UPDATE SET setting_value=excluded.setting_value, updated_at=excluded.updated_at'
            : 'INSERT INTO burnigator_event_auth_settings (event_id,setting_key, setting_value, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), updated_at=VALUES(updated_at)';
        $q = $db->prepare($sql);
        $q->execute([eventAuthEventId(),$key, $value, gmdate('Y-m-d H:i:s')]);
        return $value;
    }
    $q = $db->prepare('SELECT setting_value FROM burnigator_event_auth_settings WHERE event_id=? AND setting_key = ?'); $q->execute([eventAuthEventId(),$key]);
    $result = $q->fetchColumn(); return $result === false ? null : (string)$result;
}

function eventAuthResetInstallation(PDO $db): void {
    $eventId = eventAuthEventId();
    $tables = [
        'burnigator_event_auth_orders',
        'burnigator_event_auth_sessions',
        'burnigator_pinboard_posts',
        'burnigator_event_auth_settings',
        'burnigator_event_auth_rate_limits',
    ];
    $db->beginTransaction();
    try {
        foreach ($tables as $table) {
            $db->prepare("DELETE FROM {$table} WHERE event_id=?")->execute([$eventId]);
        }
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

function eventAuthCookieName(array $config): string { return 'BURNER' . substr(appInstanceId($config), 0, 16); }
function eventAuthCsrfCookieName(array $config): string { return 'BURNERCSRF' . substr(appInstanceId($config), 0, 16); }
function eventAuthHttps(): bool { return (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443; }
function eventAuthTokenHash(array $config): ?string {
    $token = (string)($_COOKIE[eventAuthCookieName($config)] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/D', $token)) return null;
    return hash('sha256', $token);
}
function eventAuthCurrentSession(PDO $db, array $config): ?array {
    $hash = eventAuthTokenHash($config); if ($hash === null) return null;
    $q = $db->prepare('SELECT s.token_hash, s.order_hash, s.pseudonym, s.expires_at FROM burnigator_event_auth_sessions s JOIN burnigator_event_auth_orders o ON o.event_id=s.event_id AND o.order_hash=s.order_hash WHERE s.event_id=? AND s.token_hash=? AND s.expires_at>? AND o.eligible=1');
    $q->execute([eventAuthEventId(),$hash, gmdate('Y-m-d H:i:s')]); $row = $q->fetch(); return is_array($row) ? $row : null;
}
function eventAuthRequireCsrf(array $config): void {
    $cookie = (string)($_COOKIE[eventAuthCsrfCookieName($config)] ?? '');
    $header = (string)($_SERVER['HTTP_X_EVENT_CSRF'] ?? '');
    if ($cookie === '' || !hash_equals($cookie, $header)) { http_response_code(403); echo json_encode(['error' => 'request_failed']); exit; }
}
function eventAuthSetCookies(array $config, string $token, string $csrf): void {
    setcookie(eventAuthCookieName($config), $token, ['expires' => time() + 2592000, 'path' => '/', 'secure' => eventAuthHttps(), 'httponly' => true, 'samesite' => 'Strict']);
    setcookie(eventAuthCsrfCookieName($config), $csrf, ['expires' => time() + 2592000, 'path' => '/', 'secure' => eventAuthHttps(), 'httponly' => false, 'samesite' => 'Strict']);
}
function eventAuthClearCookies(array $config): void {
    foreach ([eventAuthCookieName($config), eventAuthCsrfCookieName($config)] as $name) setcookie($name, '', ['expires' => time() - 3600, 'path' => '/', 'secure' => eventAuthHttps(), 'httponly' => $name === eventAuthCookieName($config), 'samesite' => 'Strict']);
}
function eventAuthPseudonym(): string {
    $first = ['Amber','Ash','Blazing','Bright','Burning','Calm','Charcoal','Copper','Crackling','Dancing','Dawn','Deep','Distant','Electric','Ember','Feral','Fierce','Flaming','Flickering','Foxfire','Golden','Glowing','Hidden','Indigo','Kindled','Lively','Lone','Lunar','Mellow','Midnight','Molten','Neon','Nimble','Northern','Quiet','Radiant','Restless','Rising','Scarlet','Secret','Shimmering','Shy','Silver','Smoky','Solar','Sooty','Southern','Steady','Stellar','Stray','Summer','Sunlit','Swift','Tender','Velvet','Violet','Wandering','Warm','Wild','Winter','Wise','Witty','Yellow','Young'];
    $second = ['Badger','Bat','Beetle','Bison','Bumblebee','Caracal','Cat','Chinchilla','Cicada','Comet','Crane','Cricket','Crow','Deer','Dingo','Dolphin','Dragon','Eagle','Echidna','Falcon','Ferret','Finch','Firefly','Fox','Gecko','Gibbon','Hare','Heron','Hedgehog','Ibis','Jackal','Kestrel','Koala','Lemur','Lynx','Marten','Meerkat','Mole','Moth','Newt','Ocelot','Octopus','Owl','Panda','Panther','Parrot','Peacock','Penguin','Phoenix','Pika','Puffin','Quokka','Raccoon','Raven','Robin','Salamander','Seal','Sparrow','Starling','Stoat','Tiger','Tortoise','Viper','Wren'];
    // 64 x 64 words x 900 numbers = ~3.7 million combinations per event.
    return $first[random_int(0,count($first)-1)] . ' ' . $second[random_int(0,count($second)-1)] . ' ' . random_int(100,999);
}
function eventAuthPseudonymForOrder(PDO $db, string $orderHash): ?string {
    $q=$db->prepare('SELECT pseudonym,eligible FROM burnigator_event_auth_orders WHERE event_id=? AND order_hash=?');$q->execute([eventAuthEventId(),$orderHash]);$row=$q->fetch();
    if(!is_array($row)||(int)$row['eligible']!==1)return null;
    $name=(string)($row['pseudonym']??'');
    if($name===''){for($attempt=0;$attempt<64;$attempt++){$candidate=eventAuthPseudonym();$check=$db->prepare('SELECT 1 FROM burnigator_event_auth_orders WHERE event_id=? AND pseudonym=?');$check->execute([eventAuthEventId(),$candidate]);if($check->fetchColumn())continue;try{$db->prepare('UPDATE burnigator_event_auth_orders SET pseudonym=? WHERE event_id=? AND order_hash=? AND pseudonym IS NULL')->execute([$candidate,eventAuthEventId(),$orderHash]);}catch(PDOException $e){if((string)$e->getCode()!=='23000')throw $e;continue;}$q->execute([eventAuthEventId(),$orderHash]);$row=$q->fetch();$name=(string)($row['pseudonym']??'');if($name!=='')break;}if($name==='')throw new RuntimeException('Could not assign a unique pseudonym.');}
    return $name;
}
/** Scope => [max hits, window in seconds]. Scope names must fit the VARCHAR(16) column. */
function eventAuthRateLimits(): array {
    return [
        'auth-ip' => [10, 900],     // failed logins per client network (NAT-tolerant: successes are not counted)
        'auth-event' => [300, 900], // failed logins for the whole event: throttles distributed guessing
        'write-user' => [20, 600],  // pinboard writes per attendee order, independent of shared IPs
    ];
}
/** Client identity for rate limiting: IPv6 clients are grouped by /64 so rotating addresses does not help. */
function eventAuthClientKey(string $ip): string {
    $packed = @inet_pton($ip);
    return ($packed !== false && strlen($packed) === 16) ? 'v6:' . bin2hex(substr($packed, 0, 8)) : $ip;
}
function eventAuthRateKey(string $subject): string {
    $secret = eventAuthSecret(); if ($secret === '') throw new RuntimeException('Event authentication secret is not configured.');
    return hash_hmac('sha256', $subject, $secret);
}
/** Current hit count for a scope/subject without recording a hit. */
function eventAuthRateCount(PDO $db, string $scope, string $subject): int {
    $limits = eventAuthRateLimits(); if (!isset($limits[$scope])) throw new InvalidArgumentException('Invalid rate-limit scope.');
    $q = $db->prepare('SELECT window_started,hits FROM burnigator_event_auth_rate_limits WHERE event_id=? AND scope=? AND ip_hash=?');
    $q->execute([eventAuthEventId(), $scope, eventAuthRateKey($subject)]); $row = $q->fetch();
    return (is_array($row) && time() - (int)strtotime((string)$row['window_started'] . ' UTC') < $limits[$scope][1]) ? (int)$row['hits'] : 0;
}
/** Atomically record one hit (the increment and the window reset happen in a single statement) and return the new count. */
function eventAuthRateHit(PDO $db, string $scope, string $subject): int {
    $limits = eventAuthRateLimits(); if (!isset($limits[$scope])) throw new InvalidArgumentException('Invalid rate-limit scope.');
    $eventId = eventAuthEventId(); $key = eventAuthRateKey($subject); $now = time();
    $stamp = gmdate('Y-m-d H:i:s', $now); $cutoff = gmdate('Y-m-d H:i:s', $now - $limits[$scope][1]);
    $sql = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
        ? 'INSERT INTO burnigator_event_auth_rate_limits(event_id,scope,ip_hash,window_started,hits) VALUES(?,?,?,?,1) ON CONFLICT(event_id,scope,ip_hash) DO UPDATE SET hits=CASE WHEN window_started<=? THEN 1 ELSE hits+1 END, window_started=CASE WHEN window_started<=? THEN excluded.window_started ELSE window_started END'
        : 'INSERT INTO burnigator_event_auth_rate_limits(event_id,scope,ip_hash,window_started,hits) VALUES(?,?,?,?,1) ON DUPLICATE KEY UPDATE hits=IF(window_started<=?,1,hits+1), window_started=IF(window_started<=?,VALUES(window_started),window_started)';
    $db->prepare($sql)->execute([$eventId, $scope, $key, $stamp, $cutoff, $cutoff]);
    if (random_int(1, 50) === 1) $db->prepare('DELETE FROM burnigator_event_auth_rate_limits WHERE event_id=? AND window_started<?')->execute([$eventId, gmdate('Y-m-d H:i:s', $now - 86400)]);
    return eventAuthRateCount($db, $scope, $subject);
}
/** True when this client (or the whole event) has used up its failed-login budget. */
function eventAuthLoginBlocked(PDO $db, string $ip): bool {
    $limits = eventAuthRateLimits();
    return eventAuthRateCount($db, 'auth-ip', eventAuthClientKey($ip)) >= $limits['auth-ip'][0] || eventAuthRateCount($db, 'auth-event', 'event') >= $limits['auth-event'][0];
}
function eventAuthLoginFailed(PDO $db, string $ip): void {
    eventAuthRateHit($db, 'auth-ip', eventAuthClientKey($ip)); eventAuthRateHit($db, 'auth-event', 'event');
}
/** Records a pinboard write for this attendee order and reports whether it exceeds the budget. */
function eventAuthWriteLimited(PDO $db, string $orderHash): bool {
    return eventAuthRateHit($db, 'write-user', $orderHash) > eventAuthRateLimits()['write-user'][0];
}

function pretixApiUrl(string $base, string $path): string {
    $parts = parse_url($base);
    if (!is_array($parts) || strtolower((string)($parts['scheme'] ?? '')) !== 'https' || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) throw new RuntimeException('Pretix URL must be an HTTPS origin.');
    $host = strtolower((string)$parts['host']);
    if ($host === 'localhost' || substr($host, -6) === '.local' || substr($host, -10) === '.internal' || filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false && filter_var($host, FILTER_VALIDATE_IP)) throw new RuntimeException('Pretix host is not a public address.');
    return rtrim($base, '/') . '/api/v1/' . ltrim($path, '/');
}
function pretixGetJson(string $url, string $token): array {
    if (!function_exists('curl_init')) throw new RuntimeException('PHP cURL is required for Pretix synchronization.');
    $ch = curl_init($url); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_TIMEOUT => 25, CURLOPT_HTTPHEADER => ['Accept: application/json', 'Authorization: Token ' . $token]]);
    $body = curl_exec($ch); $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $error = curl_error($ch); curl_close($ch);
    if (!is_string($body) || $status < 200 || $status >= 300) throw new RuntimeException('Pretix request failed (' . $status . '): ' . substr($error, 0, 120));
    $payload = json_decode($body, true); if (!is_array($payload)) throw new RuntimeException('Pretix returned invalid JSON.'); return $payload;
}
function pretixOrderEligible(array $order, array $refunds = []): bool {
    if ((string)($order['status'] ?? '') !== 'p') return false;
    if (isset($order['positions']) && is_array($order['positions'])) {
        if (!$order['positions']) return false;
        foreach ($order['positions'] as $position) if (is_array($position) && !empty($position['canceled'])) return false;
    }
    foreach ($refunds as $refund) if (is_array($refund) && in_array((string)($refund['state'] ?? ''), ['done','external'], true) && (float)($refund['amount'] ?? 0) > 0) return false;
    return true;
}
function eventAuthUpsertOrder(PDO $db, string $code, string $status, bool $eligible, string $source, string $marker): void {
    $sql = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
        ? 'INSERT INTO burnigator_event_auth_orders(event_id,order_hash,status,eligible,source,sync_marker,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(event_id,order_hash) DO UPDATE SET status=excluded.status,eligible=excluded.eligible,source=excluded.source,sync_marker=excluded.sync_marker,updated_at=excluded.updated_at'
        : 'INSERT INTO burnigator_event_auth_orders(event_id,order_hash,status,eligible,source,sync_marker,updated_at) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),eligible=VALUES(eligible),source=VALUES(source),sync_marker=VALUES(sync_marker),updated_at=VALUES(updated_at)';
    $db->prepare($sql)->execute([eventAuthEventId(),eventOrderHash($code), $status, $eligible ? 1 : 0, $source, $marker, gmdate('Y-m-d H:i:s')]);
}
function eventAuthSyncPretix(PDO $db, array $settings): array {
    $base = (string)($settings['pretix_base_url'] ?? ''); $organizer = rawurlencode((string)($settings['pretix_organizer'] ?? '')); $event = rawurlencode((string)($settings['pretix_event'] ?? '')); $token = eventAuthDecrypt((string)($settings['pretix_token_encrypted'] ?? ''));
    if ($organizer === '' || $event === '' || $token === '') throw new RuntimeException('Pretix settings are incomplete.');
    $prefix = 'organizers/' . $organizer . '/events/' . $event . '/orders/'; $next = pretixApiUrl($base, $prefix); $marker = bin2hex(random_bytes(16)); $counts = ['imported'=>0,'eligible'=>0,'ineligible'=>0];
    // Fetch every page before touching the database so a slow Pretix server never holds a write transaction open.
    $orders = []; $pages = 0;
    while ($next !== null && ++$pages <= 1000) {
        $payload = pretixGetJson($next, $token);
        foreach ((array)($payload['results'] ?? []) as $order) {
            if (!is_array($order) || empty($order['code'])) continue;
            // The documented order-list resource includes a refunds array. Fail closed
            // if a Pretix deployment omits it rather than requesting by order code.
            $refundsKnown = is_array($order['refunds'] ?? null); $positionsKnown = is_array($order['positions'] ?? null);
            $orders[] = [(string)$order['code'], (string)($order['status'] ?? 'unknown'), $refundsKnown && $positionsKnown && pretixOrderEligible($order, $refundsKnown ? $order['refunds'] : [])];
        }
        $next = isset($payload['next']) && is_string($payload['next']) && $payload['next'] !== '' ? $payload['next'] : null;
        if ($next !== null) { $origin = parse_url($base); $nextParts = parse_url($next); if (!is_array($nextParts) || strtolower((string)($nextParts['scheme'] ?? '')) !== 'https' || strtolower((string)($nextParts['host'] ?? '')) !== strtolower((string)($origin['host'] ?? ''))) throw new RuntimeException('Pretix pagination left the configured host.'); }
    }
    if ($next !== null) throw new RuntimeException('Pretix sync exceeded the page limit.');
    $db->beginTransaction();
    try {
        foreach ($orders as [$code, $status, $eligible]) { eventAuthUpsertOrder($db, $code, $status, $eligible, 'pretix', $marker); $counts['imported']++; $counts[$eligible ? 'eligible' : 'ineligible']++; }
        $db->prepare('UPDATE burnigator_event_auth_orders SET eligible=0, updated_at=? WHERE event_id=? AND sync_marker<>?')->execute([gmdate('Y-m-d H:i:s'),eventAuthEventId(), $marker]);
        eventAuthSetting($db, 'last_sync_at', gmdate('c')); eventAuthSetting($db, 'last_sync_source', 'pretix'); $db->commit(); return $counts;
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
}
function eventAuthCsvImport(PDO $db, string $path): array {
    $fh = fopen($path, 'rb'); if (!$fh) throw new RuntimeException('CSV upload could not be read.');
    $header = fgetcsv($fh, 0, ',', '"', ''); $header = is_array($header) ? array_map(static fn($v) => strtolower(trim((string)$v)), $header) : [];
    if (isset($header[0])) $header[0] = ltrim($header[0], "\xEF\xBB\xBF");
    $codeIndex = array_search('order code', $header, true); if ($codeIndex === false) $codeIndex = array_search('order_code', $header, true); if ($codeIndex === false) $codeIndex = array_search('ordercode', $header, true);
    $statusIndex = array_search('status', $header, true);
    if ($codeIndex === false || $statusIndex === false) { fclose($fh); throw new RuntimeException('CSV must include Order code and Status columns.'); }
    $marker = bin2hex(random_bytes(16)); $counts = ['imported'=>0,'eligible'=>0,'ineligible'=>0]; $seen=[]; $db->beginTransaction();
    try {
        while (($row = fgetcsv($fh, 0, ',', '"', '')) !== false) {
            $code = trim((string)($row[$codeIndex] ?? '')); if ($code === '' || strlen($code) > 100) continue;
            $hash=eventOrderHash($code);if(isset($seen[$hash]))continue;$seen[$hash]=true;
            $status = strtolower(trim((string)($row[$statusIndex] ?? 'unknown')));
            $eligible = in_array($status, ['p','paid','bezahlt'], true);
            eventAuthUpsertOrder($db, $code, $status, $eligible, 'csv', $marker); $counts['imported']++; $counts[$eligible ? 'eligible' : 'ineligible']++;
        }
        fclose($fh); $db->prepare('UPDATE burnigator_event_auth_orders SET eligible=0, updated_at=? WHERE event_id=? AND sync_marker<>?')->execute([gmdate('Y-m-d H:i:s'),eventAuthEventId(), $marker]);
        eventAuthSetting($db, 'last_sync_at', gmdate('c')); eventAuthSetting($db, 'last_sync_source', 'csv'); $db->commit(); return $counts;
    } catch (Throwable $e) { if(is_resource($fh))fclose($fh);if($db->inTransaction())$db->rollBack();throw $e; }
}
