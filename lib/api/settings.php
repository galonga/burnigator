<?php

declare(strict_types=1);

/** Owner: settings, database, event-auth and reset actions (POST). */
function apiOwnerSettingsAction(array $config, string $role, $action): void
{
    if (in_array($action, [
        'event-auth-settings',
        'event-auth-sync',
        'event-auth-import',
        'database-settings',
        'pinboard-settings',
        'announcement-save',
        'stats-settings',
        'stats-reset',
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
            $configPath = BURNIGATOR_ROOT . '/config.php';
            $dataPath = BURNIGATOR_ROOT . '/data';
            $uploadsPath = BURNIGATOR_ROOT . '/uploads';
            if (!is_file($configPath) || !is_writable($configPath) || !is_dir($dataPath) || !is_writable($dataPath) || !is_dir($uploadsPath) || !is_writable($uploadsPath)) {
                respond(500, ['error' => 'reset_failed']);
            }
            $tempConfig = BURNIGATOR_ROOT . '/.reset-config-' . bin2hex(random_bytes(8)) . '.php';
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
        if ($action === 'announcement-save') {
            $input = json_decode((string) file_get_contents('php://input'), true);
            if (!is_array($input)) {
                respond(400, ['error' => 'invalid_settings']);
            }
            $map = withMapLock(function () use ($input) {
                $current = readMap();
                $current['announcement'] = cleanAnnouncement($input, $current['announcement'] ?? null, gmdate('c'));
                return saveMap($current) ? $current : false;
            });
            if (!is_array($map)) {
                respond(500, ['error' => 'settings_save_failed']);
            }
            recordHistory('announcement_save', 0, $map['announcement'] ? cleanText($map['announcement']['text'], 120) : 'Cleared');
            respond(200, ['ok' => true, 'announcement' => $map['announcement']]);
        }
        if ($action === 'stats-settings') {
            $input = json_decode((string) file_get_contents('php://input'), true);
            if (!is_array($input) || !is_bool($input['enabled'] ?? null)) {
                respond(400, ['error' => 'invalid_settings']);
            }
            $enabled = $input['enabled'];
            $map = withMapLock(function () use ($enabled) {
                $current = readMap();
                $current['statsEnabled'] = $enabled;
                return saveMap($current) ? $current : false;
            });
            if (!is_array($map)) {
                respond(500, ['error' => 'settings_save_failed']);
            }
            recordHistory('stats_setting', 0, $enabled ? 'Statistics enabled' : 'Statistics disabled');
            respond(200, ['ok' => true, 'enabled' => $enabled]);
        }
        if ($action === 'stats-reset') {
            $path = BURNIGATOR_ROOT . '/data/stats.json';
            if (is_file($path) && !@unlink($path)) {
                respond(500, ['error' => 'stats_reset_failed']);
            }
            recordHistory('stats_reset');
            respond(200, ['ok' => true]);
        }
        if ($action === 'database-settings') {
            $input = json_decode((string) file_get_contents('php://input'), true);
            if (!is_array($input)) {
                respond(400, ['error' => 'database_incomplete']);
            }
            if ((string) getenv('BURNIGATOR_DB_DSN') !== '') {
                respond(409, ['error' => 'database_managed_by_environment']);
            }
            $configPath = BURNIGATOR_ROOT . '/config.php';
            if (!is_file($configPath) || !is_writable($configPath) || !is_writable(BURNIGATOR_ROOT)) {
                respond(500, ['error' => 'database_config_not_writable']);
            }
            $values = $config;
            if (($input['remove'] ?? false) === true) {
                unset($values['event_auth_db_dsn'], $values['event_auth_db_user'], $values['event_auth_db_password']);
            } else {
                $host = trim((string) ($input['host'] ?? ''));
                $name = trim((string) ($input['name'] ?? ''));
                $user = trim((string) ($input['user'] ?? ''));
                $password = (string) ($input['password'] ?? '');
                if ($password === '') {
                    $password = (string) ($config['event_auth_db_password'] ?? '');
                }
                if ($host === '' || $name === '' || $user === '' || !preg_match('/^[A-Za-z0-9.-]{1,255}$/D', $host) || !preg_match('/^[A-Za-z0-9_]{1,64}$/D', $name)) {
                    respond(400, ['error' => 'database_incomplete']);
                }
                if (!extension_loaded('pdo_mysql')) {
                    respond(400, ['error' => 'database_driver_missing']);
                }
                $dsn = 'mysql:host=' . $host . ';dbname=' . $name . ';charset=utf8mb4';
                try {
                    $test = new PDO($dsn, $user, $password, [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_TIMEOUT => 5,
                    ]);
                    eventAuthMigrate($test);
                } catch (Throwable $e) {
                    respond(400, ['error' => 'database_connection_failed']);
                }
                $values['event_auth_db_dsn'] = $dsn;
                $values['event_auth_db_user'] = $user;
                $values['event_auth_db_password'] = $password;
            }
            $tempConfig = BURNIGATOR_ROOT . '/.config-' . bin2hex(random_bytes(8)) . '.php';
            $contents = "<?php\ndeclare(strict_types=1);\nreturn " . var_export($values, true) . ";\n";
            $mode = @fileperms($configPath);
            if (file_put_contents($tempConfig, $contents, LOCK_EX) === false) {
                respond(500, ['error' => 'database_config_not_writable']);
            }
            if ($mode !== false) {
                @chmod($tempConfig, $mode & 0777);
            }
            if (!@rename($tempConfig, $configPath)) {
                @unlink($tempConfig);
                respond(500, ['error' => 'database_config_not_writable']);
            }
            if (function_exists('opcache_invalidate')) {
                @opcache_invalidate($configPath, true);
            }
            $schemaFlag = BURNIGATOR_ROOT . '/data/event-auth-schema';
            if (isset($values['event_auth_db_dsn'])) {
                @file_put_contents($schemaFlag, (string) EVENT_AUTH_SCHEMA_VERSION, LOCK_EX);
            } else {
                @unlink($schemaFlag);
            }
            respond(200, ['ok' => true]);
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
}
