<?php

declare(strict_types=1);

/** POST save-poi. */
function apiSavePoiAction(string $role, array $in): void
{
    $canEditProgram = $role === 'owner';
    if ($canEditProgram && invalidProgramTimes($in['poi']['program'] ?? [])) {
        respond(400, ['error' => 'invalid_event_time']);
    }
    $map = withMapLock(function () use ($in, $canEditProgram) {
        $m = readMap();
        $expected = (string) ($in['expectedUpdatedAt'] ?? '');
        if (mapRevisionStale($m, $expected)) {
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
            'hasProgram' => $canEditProgram && array_key_exists('hasProgram', $p)
                ? !empty($p['hasProgram'])
                : (bool) ($old['hasProgram'] ?? false),
            'program' => $canEditProgram && array_key_exists('program', $p)
                ? cleanProgram($p['program'])
                : (array) ($old['program'] ?? cleanProgram([])),
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

/** POST save-pois. */
function apiSavePoisAction(array $in): void
{
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
        if (mapRevisionStale($m, $expected)) {
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

/** POST delete-poi. */
function apiDeletePoiAction(string $role, array $in): void
{
    $id = (string) ($in['id'] ?? '');
    $detail = cleanText($in['name'] ?? $id, 100);
    $expected = (string) ($in['expectedUpdatedAt'] ?? '');
    $map = withMapLock(function () use ($id, $role, $expected) {
        $m = readMap();
        if (mapRevisionStale($m, $expected)) {
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
