<?php

declare(strict_types=1);

/** POST save-timelines. */
function apiSaveTimelinesAction(array $in): void
{
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

/** POST save-program. */
function apiSaveProgramAction(array $in): void
{
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
