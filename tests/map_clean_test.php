<?php

declare(strict_types=1);
// Run with: php tests/map_clean_test.php
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../lib/map_clean.php';

function check(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

// cleanProgram() reads the stored event owners and the role; keep both out of the way.
$GLOBALS['burnigatorEventOwners'] = [];
$_SESSION = ['role' => 'www'];

// Theme
check(cleanTheme(null) === defaultTheme(), 'missing theme falls back to defaults');
check(cleanTheme(['primary' => '#abcdef'])['primary'] === '#ABCDEF', 'valid colour is upper-cased');
check(cleanTheme(['primary' => 'red', 'accent' => '#12345'])['primary'] === defaultTheme()['primary'], 'named colour is rejected');
check(cleanTheme(['accent' => '#12345'])['accent'] === defaultTheme()['accent'], 'short hex is rejected');

// URLs
check(cleanMatomoUrl('https://stats.example.org/matomo') === 'https://stats.example.org/matomo/', 'Matomo URL gets one trailing slash');
check(cleanMatomoUrl('javascript:alert(1)') === '', 'Matomo URL must be http(s)');
check(cleanMatomoUrl('https://user:pw@stats.example.org/') === '', 'Matomo URL rejects credentials');
check(cleanMatomoUrl('https://stats.example.org/?x=1') === '', 'Matomo URL rejects a query string');
check(cleanMatomoSiteId('12') === '12' && cleanMatomoSiteId('0') === '' && cleanMatomoSiteId('1a') === '', 'Matomo site id is a positive integer');
check(cleanOptionalHttpUrl('https://example.org/a?b=1') === 'https://example.org/a?b=1', 'plain https URL is kept');
check(cleanOptionalHttpUrl('ftp://example.org') === '', 'non-http scheme is rejected');
check(cleanOptionalHttpUrl('https://u:p@example.org') === '', 'URL with credentials is rejected');
check(cleanSoundCloudPlaylist('') === '', 'empty playlist disables the player');
check(cleanSoundCloudPlaylist('https://soundcloud.com/artist/sets/mix/') === 'https://soundcloud.com/artist/sets/mix', 'playlist URL is normalised');
check(cleanSoundCloudPlaylist('https://soundcloud.com/artist/mix') === null, 'a track URL is not a playlist');
check(cleanSoundCloudPlaylist('http://soundcloud.com/artist/sets/mix') === null, 'playlist must use https');
check(cleanSoundCloudPlaylist('https://evil.example/artist/sets/mix') === null, 'playlist must be on soundcloud.com');

// Days
check(cleanEnabledDays(['fri', 'mon', 'bogus']) === ['mon', 'fri'], 'enabled days are validated and kept in week order');
check(count(cleanEnabledDays([])) === 7 && count(cleanEnabledDays('x')) === 7, 'at least one day stays enabled');
check(cleanWeekStart('thu') === 'thu' && cleanWeekStart('xyz') === 'mon' && cleanWeekStart(null) === 'mon', 'week start defaults to Monday');

// Text
check(cleanText('  <b>Hi</b> there ', 50) === 'Hi there', 'tags are stripped and text trimmed');
check(cleanText('äöüäöü', 3) === 'äöü', 'text is cut by characters, not bytes');
check(cleanText(['x'], 10) === '', 'non-strings become empty');

// Overnight events
check(invalidProgramTimes(['mon' => [['start' => '10:00', 'end' => '10:00']]]), 'equal start and end is invalid');
check(!invalidProgramTimes(['mon' => [['start' => '22:00', 'end' => '02:00']]]), 'an event past midnight is valid');
check(!invalidProgramTimes(['mon' => [['start' => '22:00', 'end' => '00:00']]]), 'an end of 00:00 is valid');
check(!invalidProgramTimes(['mon' => [['start' => '10:00']]]), 'a missing end time is valid');
check(!invalidProgramTimes('nonsense'), 'non-array input is not flagged');

// cleanProgram
$program = cleanProgram([
    'mon' => [
        ['id' => 'abc-123', 'start' => '22:00', 'end' => '02:00', 'text' => ' <i>Fire show</i> ', 'categories' => ['music', 'bogus', 'music'], 'linkUrl' => 'https://example.org/x'],
        ['start' => '25:00', 'text' => 'bad start'],
        ['start' => '10:00', 'end' => '9:99', 'text' => 'bad end'],
        ['start' => '10:00', 'text' => '   '],
        'not-an-event',
        ['start' => '11:00', 'text' => 'No id', 'linkUrl' => 'javascript:alert(1)', 'ownerCode' => 'AB123', 'ownerOrderHash' => str_repeat('f', 64)],
    ],
    'xyz' => [['start' => '10:00', 'text' => 'unknown day']],
]);
check(array_keys($program) === ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], 'every weekday key is present, unknown days are dropped');
check(count($program['mon']) === 2, 'invalid events are discarded');
check($program['mon'][0]['text'] === 'Fire show' && $program['mon'][0]['id'] === 'abc-123', 'valid event keeps its id and cleaned text');
check($program['mon'][0]['categories'] === ['music'], 'unknown and duplicate categories are removed');
check($program['mon'][0]['linkUrl'] === 'https://example.org/x', 'http(s) link is kept');
check(preg_match('/^[a-f0-9]{32}$/D', $program['mon'][1]['id']) === 1, 'missing id is generated');
check($program['mon'][1]['linkUrl'] === '', 'javascript: link is dropped');
check(!array_key_exists('ownerOrderHash', $program['mon'][1]), 'a programme editor cannot assign an event owner');
$many = array_fill(0, 150, ['start' => '10:00', 'text' => 'x']);
check(count(cleanProgram(['tue' => $many])['tue']) === 100, 'at most 100 events per day are kept');

// Owner hashes never leave the server
$hash = str_repeat('a', 64);
$map = ['pois' => [['program' => ['mon' => [['id' => 'e1', 'ownerOrderHash' => $hash], ['id' => 'e2']]]]]];
check(eventOwnerMap($map) === ['e1' => $hash], 'owner map lists only events with a valid owner hash');
$_SESSION = [];
$public = publicEventMap($map);
check(!array_key_exists('ownerOrderHash', $public['pois'][0]['program']['mon'][0]), 'public map has no owner hash');
check(!isset($public['pois'][0]['program']['mon'][0]['hasOwner']), 'guests do not see the hasOwner flag');
$_SESSION = ['admin' => true, 'role' => 'www'];
check(publicEventMap($map)['pois'][0]['program']['mon'][0]['hasOwner'] === true, 'programme editors see only a hasOwner flag');
$_SESSION = ['admin' => true, 'role' => 'poi'];
check(!isset(publicEventMap($map)['pois'][0]['program']['mon'][0]['hasOwner']), 'POI editors do not see the flag');

// Announcement banner
$now = '2026-11-24T12:00:00+00:00';
check(cleanAnnouncement(null, null, $now) === null, 'no input means no announcement');
check(cleanAnnouncement(['text' => '   '], ['text' => 'old', 'level' => 'info', 'updatedAt' => 'x'], $now) === null, 'empty text removes the announcement');
$a = cleanAnnouncement(['text' => ' <b>Stage 2</b> delayed ', 'level' => 'warning'], null, $now);
check($a === ['text' => 'Stage 2 delayed', 'level' => 'warning', 'updatedAt' => $now], 'announcement is cleaned and stamped');
check(cleanAnnouncement(['text' => 'x', 'level' => 'bogus'], null, $now)['level'] === 'info', 'unknown level falls back to info');
check(mb_strlen(cleanAnnouncement(['text' => str_repeat('ä', 500)], null, $now)['text']) === 300, 'text is limited to 300 characters');
$same = cleanAnnouncement(['text' => 'Stage 2 delayed', 'level' => 'warning'], $a, '2026-11-25T00:00:00+00:00');
check($same['updatedAt'] === $now, 'an unchanged announcement keeps its time, so dismissed banners stay dismissed');
$edited = cleanAnnouncement(['text' => 'Stage 2 open again', 'level' => 'warning'], $a, '2026-11-25T00:00:00+00:00');
check($edited['updatedAt'] === '2026-11-25T00:00:00+00:00', 'a changed announcement gets a new time');
check(cleanAnnouncement(['text' => 'Stage 2 delayed', 'level' => 'info'], $a, '2026-11-25T00:00:00+00:00')['updatedAt'] !== $now, 'changing only the level counts as a change');

// Changed-event marks
$old = ['pois' => [['id' => 'p1', 'program' => ['fri' => [
    ['id' => 'e1', 'start' => '10:00', 'end' => '11:00', 'text' => 'Yoga'],
    ['id' => 'e2', 'start' => '12:00', 'end' => '', 'text' => 'Talk', 'changedAt' => '2026-11-20T08:00:00+00:00'],
    ['id' => 'e3', 'start' => '14:00', 'end' => '', 'text' => 'Gone'],
], 'sat' => []]]], 'timelines' => []];
$new = ['pois' => [['id' => 'p1', 'program' => ['fri' => [
    ['id' => 'e1', 'start' => '10:30', 'end' => '11:00', 'text' => 'Yoga'],
    ['id' => 'e2', 'start' => '12:00', 'end' => '', 'text' => 'Talk', 'description' => 'now with text'],
    ['id' => 'e4', 'start' => '15:00', 'end' => '', 'text' => 'Brand new'],
], 'sat' => []]]], 'timelines' => []];
$stamped = stampEventChanges($old, $new, $now);
$fri = $stamped['pois'][0]['program']['fri'];
check($fri[0]['changedAt'] === $now, 'a moved start time marks the event as changed');
check($fri[1]['changedAt'] === '2026-11-20T08:00:00+00:00', 'an unchanged schedule keeps its earlier mark, a description edit is not a change');
check(!array_key_exists('changedAt', $fri[2]), 'a new event gets no mark');
$moved = ['pois' => [['id' => 'p1', 'program' => ['fri' => [], 'sat' => [['id' => 'e1', 'start' => '10:00', 'end' => '11:00', 'text' => 'Yoga']]]]], 'timelines' => []];
check(stampEventChanges($old, $moved, $now)['pois'][0]['program']['sat'][0]['changedAt'] === $now, 'moving an event to another day marks it');
$otherPlace = ['pois' => [['id' => 'p2', 'program' => ['fri' => [['id' => 'e1', 'start' => '10:00', 'end' => '11:00', 'text' => 'Yoga']]]]], 'timelines' => []];
check(stampEventChanges($old, $otherPlace, $now)['pois'][0]['program']['fri'][0]['changedAt'] === $now, 'moving an event to another place marks it');
$renamed = ['pois' => [['id' => 'p1', 'program' => ['fri' => [['id' => 'e1', 'start' => '10:00', 'end' => '11:00', 'text' => 'Yoga flow']]]]], 'timelines' => []];
check(stampEventChanges($old, $renamed, $now)['pois'][0]['program']['fri'][0]['changedAt'] === $now, 'a new title marks the event');
$untouched = stampEventChanges($old, $old, $now);
check(!array_key_exists('changedAt', $untouched['pois'][0]['program']['fri'][0]), 'saving without changes marks nothing');
check(stampEventChanges(['pois' => [], 'timelines' => []], $new, $now) === $new, 'first save with no earlier events marks nothing');

// Duplicate event ids cannot be matched to one earlier event
$dupOld = ['pois' => [['id' => 'p1', 'program' => ['fri' => [
    ['id' => 'd1', 'start' => '10:00', 'end' => '', 'text' => 'Copy'],
    ['id' => 'd1', 'start' => '12:00', 'end' => '', 'text' => 'Copy'],
]]]], 'timelines' => []];
$dupNew = ['pois' => [['id' => 'p1', 'program' => ['fri' => [
    ['id' => 'd1', 'start' => '10:00', 'end' => '', 'text' => 'Copy'],
    ['id' => 'd1', 'start' => '12:00', 'end' => '', 'text' => 'Copy'],
]]]], 'timelines' => []];
check(stampEventChanges($dupOld, $dupNew, $now) === $dupNew, 'events sharing an id are never marked from an unrelated earlier event');
$dupNew['pois'][0]['program']['fri'][1]['start'] = '13:00';
check(stampEventChanges($dupOld, $dupNew, $now) === $dupNew, 'a duplicated id in the old map is left alone even if one copy moved');
$single = ['pois' => [['id' => 'p1', 'program' => ['fri' => [['id' => 'd1', 'start' => '10:00', 'end' => '', 'text' => 'Copy']]]]], 'timelines' => []];
$dupAdded = ['pois' => [['id' => 'p1', 'program' => ['fri' => [['id' => 'd1', 'start' => '11:00', 'end' => '', 'text' => 'Copy'], ['id' => 'd1', 'start' => '12:00', 'end' => '', 'text' => 'Copy']]]]], 'timelines' => []];
check(!array_key_exists('changedAt', stampEventChanges($single, $dupAdded, $now)['pois'][0]['program']['fri'][0]), 'ids duplicated in the new map are not marked');

// History detail
$detail = programHistoryDetail(['mon' => [['start' => '10:00', 'text' => 'Yoga']]], 'Tent');
check($detail === 'Tent · mon 10:00 Yoga', 'history detail names the place and event');

echo "map_clean tests passed\n";
