<?php

declare(strict_types=1);

// JSON API entry point: bootstrap, then dispatch to the action handlers in lib/api/.
// Every handler checks its own method/action condition and returns when it does not apply, so the
// order of the calls below is the order of the checks. A handler that matches ends the request via respond().
const BURNIGATOR_ROOT = __DIR__;
$config = require is_file(BURNIGATOR_ROOT . '/config.php') ? BURNIGATOR_ROOT . '/config.php' : BURNIGATOR_ROOT . '/config.sample.php';
$GLOBALS['burnigatorConfig'] = $config;
require_once BURNIGATOR_ROOT . '/auth.php';
require_once BURNIGATOR_ROOT . '/event_auth.php';
require_once BURNIGATOR_ROOT . '/lib/map_clean.php';
require_once BURNIGATOR_ROOT . '/lib/stats.php';
require_once BURNIGATOR_ROOT . '/lib/dashboard.php';
require_once BURNIGATOR_ROOT . '/lib/map_revision.php';
foreach (['support', 'owner_reads', 'pinboard', 'public', 'settings', 'backup', 'uploads', 'accounts', 'pois', 'program', 'map_save'] as $module) {
    require_once BURNIGATOR_ROOT . '/lib/api/' . $module . '.php';
}
startAppSession($config, false);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// Public and owner read endpoints (no admin CSRF token needed).
apiStatsAction($config);
apiAccountsAction($config);
apiDashboardAction($config);
apiHistoryAction($config);
apiSnapshotsAction($config);
apiPinboardStatusAction($config);
apiEventOwnerStatusAction($config);
apiEventAuthStatusAction($config);
apiEventAuthWriteAction($config);
apiPinboardModerateAction($config);
apiDatabaseStatusAction($config);
apiEventAuthAdminAction($config);
apiPublicMapAction();
apiStatHitAction($config);

// Everything below needs a signed-in admin session and a valid CSRF token.
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
apiOwnerSettingsAction($config, $role, $action);
apiRestoreAssetAction($role, $action);
apiRestoreSnapshotAction($role, $action);
apiRestoreBackupAction($role, $action);
apiUploadBrandingAction($role, $action);
apiUploadAction($role, $action);

// Map editing: POST with a JSON body. 'save' (whole map) is handled by apiSaveAction() below.
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
    switch ($action) {
        case 'set-publication':
            apiSetPublicationAction($in);
            break;
        case 'change-owner-password':
            apiChangeOwnerPasswordAction($config, $role, $in);
            break;
        case 'save-accounts':
            apiSaveAccountsAction($config, $in);
            break;
        case 'save-poi':
            apiSavePoiAction($role, $in);
            break;
        case 'save-pois':
            apiSavePoisAction($in);
            break;
        case 'delete-poi':
            apiDeletePoiAction($role, $in);
            break;
        case 'save-timelines':
            apiSaveTimelinesAction($in);
            break;
        case 'save-program':
            apiSaveProgramAction($in);
            break;
    }
}
apiSaveAction($action);
