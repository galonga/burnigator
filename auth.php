<?php

declare (strict_types=1);
function appInstanceId(array $config): string
{
    $configured = (string) ($config['instance_id'] ?? '');
    if (preg_match('/^[a-f0-9]{32}$/D', $configured)) {
        return $configured;
    }
    $installationPath = realpath(__DIR__) ?: __DIR__;
    return substr(hash('sha256', $installationPath), 0, 32);
}

function startAppSession(array $config, bool $create = true): void
{
    $isHttps = !empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off' || (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443;
    $sessionSuffix = substr(appInstanceId($config), 0, 16);
    session_name('BURNIGATOR' . $sessionSuffix);
    if (!$create && !isset($_COOKIE[session_name()])) {
        return;
    }
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function appCanPreviewUnpublished(): bool
{
    return !empty($_SESSION['admin']) && in_array(appRole(), [
        'owner',
        'poi',
        'www',
    ], true);
}

function appUsers(array $config): array
{
    $path = __DIR__ . '/data/accounts.json';
    if (is_file($path)) {
        $saved = json_decode((string) file_get_contents($path), true);
        if (is_array($saved)) {
            return $saved;
        }
    }
    $hash = (string) ($config['password_hash'] ?? '');
    return $hash !== '' ? ['owner' => ['role' => 'owner', 'password_hash' => $hash]] : [];
}

function appRole(): string
{
    if (!empty($_SESSION['role'])) {
        return (string) $_SESSION['role'];
    }
    return !empty($_SESSION['admin']) ? 'owner' : '';
}

function loginAttemptKey(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    return hash('sha256', $ip . '|' . (string) ($_SERVER['HTTP_HOST'] ?? ''));
}

function loginIsLimited(): bool
{
    $path = __DIR__ . '/data/login-attempts.json';
    if (!is_file($path)) {
        return false;
    }
    $items = json_decode((string) @file_get_contents($path), true);
    $record = is_array($items) ? $items[loginAttemptKey()] ?? null : null;
    return is_array($record) && (int) ($record['count'] ?? 0) >= 5 && (int) ($record['until'] ?? 0) > time();
}

function beginLoginAttempt(): bool
{
    $path = __DIR__ . '/data/login-attempts.json';
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
        return false;
    }
    $fp = @fopen($path, 'c+');
    if (!$fp || !flock($fp, LOCK_EX)) {
        if ($fp) {
            fclose($fp);
        }
        return false;
    }
    $items = json_decode(stream_get_contents($fp) ?: '{}', true);
    if (!is_array($items)) {
        $items = [];
    }
    $key = loginAttemptKey();
    $now = time();
    foreach ($items as $entryKey => $entry) {
        if (!is_array($entry)) {
            unset($items[$entryKey]);
            continue;
        }
        $lastAttempt = (int) ($entry['lastAttempt'] ?? ((int) ($entry['until'] ?? 0) > 0 ? $entry['until'] : $now));
        if ($lastAttempt < $now - 3600) {
            unset($items[$entryKey]);
        }
    }
    $entry = $items[$key] ?? ['count' => 0, 'until' => 0];
    if ((int) ($entry['until'] ?? 0) > $now) {
        rewind($fp);
        ftruncate($fp, 0);
        fwrite($fp, json_encode($items, JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        return true;
    }
    // Start over only once a lockout has expired; resetting on every attempt kept the count at 1.
    if ((int) ($entry['until'] ?? 0) > 0) {
        $entry = ['count' => 0, 'until' => 0];
    }
    $entry['count'] = (int) ($entry['count'] ?? 0) + 1;
    $entry['lastAttempt'] = $now;
    if ($entry['count'] >= 5) {
        $entry['until'] = $now + 900;
    }
    $items[$key] = $entry;
    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($items, JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return false;
}

function recordLoginAttempt(bool $success): void
{
    $path = __DIR__ . '/data/login-attempts.json';
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
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
    $items = json_decode($raw ?: '{}', true);
    if (!is_array($items)) {
        $items = [];
    }
    $key = loginAttemptKey();
    $now = time();
    foreach ($items as $entryKey => $entry) {
        if (!is_array($entry)) {
            unset($items[$entryKey]);
            continue;
        }
        // Keep ordinary failed-attempt counters for an hour; only active lockouts
        // use the until field, so pruning by that field alone reset the counter each try.
        $lastAttempt = (int) ($entry['lastAttempt'] ?? ((int) ($entry['until'] ?? 0) > 0 ? $entry['until'] : $now));
        if ($lastAttempt < $now - 3600) {
            unset($items[$entryKey]);
        }
    }
    if ($success) {
        unset($items[$key]);
    } else {
        $entry = $items[$key] ?? ['count' => 0, 'until' => 0];
        if ((int) ($entry['until'] ?? 0) <= $now) {
            $entry = ['count' => 0, 'until' => 0];
        }
        $entry['count'] = (int) $entry['count'] + 1;
        $entry['lastAttempt'] = $now;
        if ($entry['count'] >= 5) {
            $entry['until'] = $now + 900;
        }
        $items[$key] = $entry;
    }
    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($items, JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
}

function saveAppUsers(array $users): bool
{
    $path = __DIR__ . '/data/accounts.json';
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        return false;
    }
    $clean = [];
    foreach ($users as $username => $account) {
        if (!is_string($username) || !preg_match('/^[a-zA-Z0-9_.-]{3,32}$/', $username) || !is_array($account)) {
            continue;
        }
        $role = (string) ($account['role'] ?? '');
        $hash = (string) ($account['password_hash'] ?? '');
        if (!in_array($role, [
            'owner',
            'poi',
            'www',
        ], true) || $hash === '') {
            continue;
        }
        $clean[strtolower($username)] = ['role' => $role, 'password_hash' => $hash];
    }
    if (!array_filter($clean, static fn($account) => $account['role'] === 'owner')) {
        return false;
    }
    $json = json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($json === false) {
        return false;
    }
    $tmp = $path . '.' . bin2hex(random_bytes(5)) . '.tmp';
    if (file_put_contents($tmp, $json, LOCK_EX) === false) {
        return false;
    }
    return rename($tmp, $path);
}

function withMapLock(callable $callback)
{
    $path = __DIR__ . '/data/map.lock';
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        return false;
    }
    $handle = fopen($path, 'c');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        return false;
    }
    try {
        return $callback();
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

/**
 * Origin (scheme://host[:port]) of the configured Matomo installation, or '' when tracking is off.
 */
function appMatomoOrigin(): string
{
    $map = json_decode((string) @file_get_contents(__DIR__ . '/data/map.json'), true);
    $url = is_array($map) && is_string($map['matomoUrl'] ?? null) ? trim($map['matomoUrl']) : '';
    $parts = $url !== '' ? parse_url($url) : false;
    if (!is_array($parts) || empty($parts['host']) || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true)) {
        return '';
    }
    $origin = strtolower($parts['scheme']) . '://' . $parts['host'];
    return isset($parts['port']) ? $origin . ':' . $parts['port'] : $origin;
}

/**
 * Sends the security headers for HTML pages. The Content-Security-Policy allows only this site,
 * the SoundCloud player and the optionally configured Matomo installation.
 */
function appSendSecurityHeaders(): void
{
    $matomo = appMatomoOrigin();
    $withMatomo = static function (string $directive) use ($matomo): string {
        return $matomo === '' ? $directive : $directive . ' ' . $matomo;
    };
    $policy = [
        "default-src 'self'",
        $withMatomo("script-src 'self' 'unsafe-inline' https://w.soundcloud.com"),
        "style-src 'self' 'unsafe-inline'",
        $withMatomo("img-src 'self' data: blob:"),
        "font-src 'self'",
        $withMatomo("connect-src 'self'"),
        'frame-src https://w.soundcloud.com',
        "media-src 'self'",
        "manifest-src 'self'",
        "worker-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
    ];
    header('Content-Security-Policy: ' . implode('; ', $policy));
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()');
}

/**
 * The application version from the VERSION file, in the form YEAR.MONTH.BUILD (for example 2026.11.1359).
 * The last number is the build number. Returns "dev" when the file is missing or malformed.
 */
function appVersion(): string
{
    static $version = null;
    if ($version === null) {
        $raw = trim((string) @file_get_contents(__DIR__ . '/VERSION'));
        $version = preg_match('/^[0-9]{4}\.(0[1-9]|1[0-2])\.[0-9]+$/D', $raw) ? $raw : 'dev';
    }
    return $version;
}

/**
 * URL of a local asset with a cache-busting parameter that changes whenever the file changes
 * (its modification time) or the version changes, so updated scripts and styles are never served stale.
 */
function assetUrl(string $path): string
{
    $file = __DIR__ . '/' . $path;
    $stamp = is_file($file) ? (string) filemtime($file) : '0';
    return $path . '?v=' . appVersion() . '-' . $stamp;
}
