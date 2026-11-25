<?php

declare(strict_types=1);

/** Owner: upload logo/favicon. */
function apiUploadBrandingAction(string $role, $action): void
{
    if ($action === 'upload-branding' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        if ($role !== 'owner') {
            respond(403, ['error' => 'Keine Berechtigung']);
        }
        $kind = (string) ($_GET['kind'] ?? '');
        if (!in_array($kind, ['logo', 'favicon'], true)) {
            respond(400, ['error' => 'Ungültiger Bildtyp.']);
        }
        if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            respond(400, ['error' => 'Upload fehlgeschlagen.']);
        }
        $f = $_FILES['image'];
        if ($f['size'] > 5 * 1024 * 1024) {
            respond(400, ['error' => 'Das PNG darf höchstens 5 MB groß sein.']);
        }
        $info = @getimagesize($f['tmp_name']);
        if (!$info || $info['mime'] !== 'image/png') {
            respond(400, ['error' => 'Bitte eine gültige PNG-Datei wählen.']);
        }
        $maxWidth = $kind === 'favicon' ? 1024 : 5000;
        $maxHeight = $kind === 'favicon' ? 1024 : 2000;
        if ($info[0] > $maxWidth || $info[1] > $maxHeight) {
            respond(400, ['error' => 'Die Bildabmessungen sind zu groß.']);
        }
        $name = $kind . '-' . bin2hex(random_bytes(12)) . '.png';
        $dir = BURNIGATOR_ROOT . '/uploads';
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            respond(500, ['error' => 'Uploadverzeichnis konnte nicht erstellt werden.']);
        }
        if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) {
            respond(500, ['error' => 'Bild konnte nicht gespeichert werden.']);
        }
        $field = $kind === 'logo' ? 'logo' : 'favicon';
        $m = withMapLock(function () use ($field, $name) {
            $current = readMap();
            $current[$field] = 'uploads/' . $name;
            return saveMap($current) ? $current : false;
        });
        if (!is_array($m)) {
            respond(500, ['error' => 'Kartendaten konnten nicht gespeichert werden.']);
        }
        recordHistory('branding_' . $kind);
        respond(200, ['ok' => true, 'map' => $m]);
    }
}

/** Owner: upload the map image. */
function apiUploadAction(string $role, $action): void
{
    if ($action === 'upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        if ($role !== 'owner') {
            respond(403, ['error' => 'Keine Berechtigung']);
        }
        if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            respond(400, ['error' => 'Upload fehlgeschlagen.']);
        }
        $f = $_FILES['image'];
        if ($f['size'] > 20 * 1024 * 1024) {
            respond(400, ['error' => 'Das Bild darf höchstens 20 MB groß sein.']);
        }
        $info = @getimagesize($f['tmp_name']);
        if (!$info || !in_array($info['mime'], ['image/png', 'image/jpeg'], true)) {
            respond(400, ['error' => 'Bitte eine gültige PNG- oder JPG-Datei wählen.']);
        }
        if ($info[0] < 1 || $info[1] < 1 || $info[0] > 30000 || $info[1] > 30000 || $info[0] * $info[1] > 100000000) {
            respond(400, ['error' => 'Die Bildabmessungen sind zu groß. Bitte ein Bild mit höchstens 100 Megapixeln verwenden.']);
        }
        $ext = $info['mime'] === 'image/png' ? 'png' : 'jpg';
        $name = 'map-' . bin2hex(random_bytes(12)) . '.' . $ext;
        $dir = BURNIGATOR_ROOT . '/uploads';
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            respond(500, ['error' => 'Uploadverzeichnis konnte nicht erstellt werden.']);
        }
        if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) {
            respond(500, ['error' => 'Bild konnte nicht gespeichert werden.']);
        }
        $m = withMapLock(function () use ($name, $info) {
            $current = readMap();
            $current['image'] = 'uploads/' . $name;
            $current['width'] = (int) $info[0];
            $current['height'] = (int) $info[1];
            return saveMap($current) ? $current : false;
        });
        if (!is_array($m)) {
            respond(500, ['error' => 'Kartendaten konnten nicht gespeichert werden.']);
        }
        recordHistory('map_image_upload');
        respond(200, ['ok' => true, 'map' => $m]);
    }
}
