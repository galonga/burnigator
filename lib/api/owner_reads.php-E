<?php

declare(strict_types=1);

/** Owner: visitor statistics (GET stats). */
function apiStatsAction(array $config): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'stats') {
        header('Cache-Control: private, no-store');
        if (empty($config['installed']) || empty($_SESSION['admin']) || appRole() !== 'owner') {
            respond(403, ['error' => 'Keine Berechtigung']);
        }
        $map = readMap();
        $days = (int) ($_GET['days'] ?? 30);
        respond(200, ['enabled' => ($map['statsEnabled'] ?? false) === true] + statsSummary(statsRead(BURNIGATOR_ROOT . '/data/stats.json'), statsTargets($map), gmdate('Y-m-d'), $days));
    }
}

/** Owner: sub-account names (GET accounts). */
function apiAccountsAction(array $config): void
{
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
}

/** Owner: dashboard summary (GET dashboard). */
function apiDashboardAction(array $config): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'dashboard') {
        header('Cache-Control: private, no-store');
        if (empty($config['installed']) || empty($_SESSION['admin']) || appRole() !== 'owner') {
            respond(403, ['error' => 'Keine Berechtigung']);
        }
        $map = readMap();
        $database = databaseHealth($config);
        $pinboard = ['enabled' => ($map['pinboardEnabled'] ?? false) === true, 'available' => false, 'posts' => 0, 'hidden' => 0, 'lastPostAt' => null];
        $orders = ['available' => false, 'total' => 0, 'eligible' => 0, 'ineligible' => 0, 'groups' => [], 'lastSyncAt' => null, 'lastSyncSource' => null];
        if ($database['ready']) {
            try {
                $db = eventAuthDb($config);
                $eventId = eventAuthEventId();
                $q = $db->prepare('SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN hidden=1 THEN 1 ELSE 0 END),0) AS hidden, MAX(created_at) AS last_at FROM burnigator_pinboard_posts WHERE event_id=?');
                $q->execute([$eventId]);
                $row = $q->fetch(PDO::FETCH_ASSOC) ?: [];
                $pinboard['available'] = true;
                $pinboard['posts'] = (int) ($row['total'] ?? 0);
                $pinboard['hidden'] = (int) ($row['hidden'] ?? 0);
                $pinboard['lastPostAt'] = !empty($row['last_at']) ? gmdate('c', (int) strtotime((string) $row['last_at'] . ' UTC')) : null;
                $summary = eventAuthOrderSummary($db);
                $orders = ['available' => true, 'lastSyncAt' => null, 'lastSyncSource' => null] + $summary;
                $orders['lastSyncAt'] = eventAuthSetting($db, 'last_sync_at');
                $orders['lastSyncSource'] = eventAuthSetting($db, 'last_sync_source');
            } catch (Throwable $e) {
                // Connected, but a table could not be read: keep the connection state, flag the failure.
                $database['queryFailed'] = true;
            }
        }
        $stats = ['enabled' => ($map['statsEnabled'] ?? false) === true];
        if ($stats['enabled']) {
            $summary = statsSummary(statsRead(BURNIGATOR_ROOT . '/data/stats.json'), statsTargets($map), gmdate('Y-m-d'), 7);
            $stats['totals'] = $summary['totals'];
            $stats['perDay'] = $summary['perDay'];
        }
        $owners = dashboardProgramOwners($map);
        respond(200, [
            'title' => (string) ($map['title'] ?? ''),
            'published' => ($map['published'] ?? true) === true,
            'updatedAt' => (string) ($map['updatedAt'] ?? ''),
            'counts' => dashboardCounts($map, $owners),
            'owners' => $owners,
            'database' => $database,
            'pinboard' => $pinboard,
            'orders' => $orders,
            'stats' => $stats,
            'history' => readHistory(8),
        ]);
    }
}

/** Owner: change history (GET history). */
function apiHistoryAction(array $config): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'history') {
        if (empty($config['installed']) || empty($_SESSION['admin']) || appRole() !== 'owner') {
            respond(403, ['error' => 'Keine Berechtigung']);
        }
        respond(200, ['history' => readHistory(100)]);
    }
}

/** Owner: snapshot list (GET snapshots). */
function apiSnapshotsAction(array $config): void
{
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
}

/** Owner: event-auth database status (GET database-status). */
function apiDatabaseStatusAction(array $config): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'database-status') {
        header('Cache-Control: private, no-store');
        if (empty($_SESSION['admin']) || appRole() !== 'owner') {
            respond(403, ['error' => 'forbidden']);
        }
        $health = databaseHealth($config);
        respond(200, [
            'configured' => $health['configured'],
            'ready' => $health['ready'],
            'managedByEnvironment' => $health['managedByEnvironment'],
            'host' => $health['host'],
            'name' => $health['name'],
            'user' => (string) ($health['managedByEnvironment'] ? getenv('BURNIGATOR_DB_USER') : ($config['event_auth_db_user'] ?? '')),
            'passwordSet' => (string) ($config['event_auth_db_password'] ?? '') !== '' || (string) getenv('BURNIGATOR_DB_PASSWORD') !== '',
            'driverAvailable' => $health['driverAvailable'],
            'pinboardEnabled' => (readMap()['pinboardEnabled'] ?? false) === true,
        ]);
    }
}

/** Owner: event-auth admin overview (GET event-auth-admin). */
function apiEventAuthAdminAction(array $config): void
{
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
            $summary = eventAuthOrderSummary($db);
            $counts = ['total' => $summary['total'], 'eligible' => $summary['eligible'], 'ineligible' => $summary['ineligible']];
            $orderGroups = $summary['groups'];
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
}
