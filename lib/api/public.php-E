<?php

declare(strict_types=1);

/** Public: the event map (any other GET). */
function apiPublicMapAction(): void
{
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
        respond(200, publicEventMap($map));
    }
}

/** Public: anonymous counter hit (POST stat). */
function apiStatHitAction(array $config): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_GET['action'] ?? '') === 'stat') {
        // Anonymous counter hit from the visitor page. Always answers 204 so it reveals nothing.
        header('Cache-Control: no-store');
        $map = !empty($config['installed']) && empty($_SESSION['admin']) ? readMap() : [];
        // Browsers label cross-site requests; a counter hit from another site is never a real visitor.
        $crossSite = strtolower((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '')) === 'cross-site';
        if (!$crossSite && ($map['statsEnabled'] ?? false) === true && ($map['published'] ?? true) === true) {
            $in = json_decode((string) file_get_contents('php://input', false, null, 0, 512), true);
            $type = is_array($in) && is_string($in['type'] ?? null) ? $in['type'] : '';
            $id = is_array($in) && is_string($in['id'] ?? null) ? substr($in['id'], 0, 64) : '';
            if (statsValidHit($type, $id, statsTargets($map))) {
                statsMutate(BURNIGATOR_ROOT . '/data/stats.json', static function (array $stats) use ($type, $id) {
                    return statsRecord($stats, $type, $id, gmdate('Y-m-d'));
                });
            }
        }
        http_response_code(204);
        exit;
    }
}
