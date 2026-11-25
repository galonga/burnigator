<?php

declare(strict_types=1);

/** Public: pinboard enabled flag (GET pinboard-status). */
function apiPinboardStatusAction(array $config): void
{
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
}

/** Public: event-owner session status (GET event-owner-status). */
function apiEventOwnerStatusAction(array $config): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'event-owner-status') {
        header('Cache-Control: private, no-store');
        if (empty($config['installed'])) {
            respond(404, ['error' => 'not_found']);
        }
        $map = readMap();
        if (!($map['published'] ?? true) && !appCanPreviewUnpublished()) {
            respond(404, ['error' => 'not_published']);
        }
        $none = ['authenticated' => false, 'ownedEventIds' => [], 'csrfCookie' => eventAuthCsrfCookieName($config)];
        if (empty($_COOKIE[eventAuthCookieName($config)])) {
            respond(200, $none);
        }
        try {
            $session = eventAuthTokenHash($config) !== null ? eventAuthCurrentSession(eventAuthDb($config), $config) : null;
        } catch (Throwable $e) {
            $session = null;
        }
        if (!$session) {
            respond(200, $none);
        }
        $owned = [];
        foreach (eventOwnerMap($map) as $id => $hash) {
            if (hash_equals($hash, (string) $session['order_hash'])) {
                $owned[] = (string) $id;
            }
        }
        respond(200, ['authenticated' => true, 'ownedEventIds' => $owned, 'csrfCookie' => eventAuthCsrfCookieName($config)]);
    }
}

/** Public: event-auth status and pinboard posts (GET event-auth-status, pinboard). */
function apiEventAuthStatusAction(array $config): void
{
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
}

/** Public: event-auth login/logout, event-owner save, pinboard writes (POST). */
function apiEventAuthWriteAction(array $config): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && in_array((string) ($_GET['action'] ?? ''), [
        'event-auth',
        'event-logout',
        'event-owner-save',
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
                'event-owner-save',
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
            if ($action === 'event-owner-save') {
                $eventId = (string) ($input['eventId'] ?? '');
                $start = (string) ($input['start'] ?? '');
                $end = (string) ($input['end'] ?? '');
                $validTime = static function (string $time): bool {
                    return (bool) preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/D', $time);
                };
                if (!preg_match('/^[a-f0-9-]{1,40}$/D', $eventId) || !$validTime($start) || ($end !== '' && (!$validTime($end) || $end === $start))) {
                    respond(400, ['error' => 'invalid_event_time']);
                }
                $description = cleanText($input['description'] ?? '', 1000);
                $host = cleanText($input['host'] ?? '', 200);
                $categories = array_values(array_unique(array_filter(
                    is_array($input['categories'] ?? null) ? $input['categories'] : [],
                    static function ($category): bool {
                        return is_string($category) && in_array($category, eventCategoryKeys(), true);
                    }
                )));
                $saved = withMapLock(function () use ($eventId, $start, $end, $description, $host, $categories, $session) {
                    $m = readMap();
                    foreach (['pois', 'timelines'] as $group) {
                        foreach ((array) $m[$group] as $i => $item) {
                            foreach ((array) ($item['program'] ?? []) as $day => $entries) {
                                foreach ((array) $entries as $j => $event) {
                                    if ((string) ($event['id'] ?? '') !== $eventId) {
                                        continue;
                                    }
                                    $hash = (string) ($event['ownerOrderHash'] ?? '');
                                    if ($hash === '' || !hash_equals($hash, (string) $session['order_hash'])) {
                                        return 'forbidden';
                                    }
                                    $m[$group][$i]['program'][$day][$j]['start'] = $start;
                                    $m[$group][$i]['program'][$day][$j]['end'] = $end;
                                    $m[$group][$i]['program'][$day][$j]['description'] = $description;
                                    $m[$group][$i]['program'][$day][$j]['host'] = $host;
                                    $m[$group][$i]['program'][$day][$j]['categories'] = $categories;
                                    return saveMap($m) ? (string) ($event['text'] ?? '') : false;
                                }
                            }
                        }
                    }
                    return 'not_found';
                });
                if ($saved === 'forbidden') {
                    respond(403, ['error' => 'event_owner_forbidden']);
                }
                if ($saved === 'not_found') {
                    respond(404, ['error' => 'event_not_found']);
                }
                if ($saved === false) {
                    respond(500, ['error' => 'event_save_failed']);
                }
                recordHistory('event_owner_save', 1, (string) $saved . ' · ' . $start . ($end !== '' ? '–' . $end : ''), ['username' => (string) $session['pseudonym'], 'role' => 'event-owner']);
                respond(200, ['ok' => true, 'event' => ['id' => $eventId, 'start' => $start, 'end' => $end, 'host' => $host, 'description' => $description, 'categories' => $categories]]);
            }
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
}

/** Owner: pinboard moderation (POST pinboard-moderate). */
function apiPinboardModerateAction(array $config): void
{
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
}
