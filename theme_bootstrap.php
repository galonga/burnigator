<?php
declare(strict_types=1);

/**
 * Inline script that hands the saved theme colors to assets/theme.js before first paint,
 * so pages do not flash the default palette while waiting for api.php.
 * Only validated #RRGGBB values are emitted.
 */
function appInitialThemeScript(?array $map = null): string {
    if ($map === null) $map = json_decode((string)@file_get_contents(__DIR__ . '/data/map.json'), true);
    $theme = is_array($map) && is_array($map['theme'] ?? null) ? $map['theme'] : [];
    $clean = [];
    foreach (['primary', 'accent', 'alert', 'background'] as $key) {
        $value = $theme[$key] ?? '';
        if (is_string($value) && preg_match('/^#[0-9a-fA-F]{6}$/D', $value)) $clean[$key] = strtoupper($value);
    }
    if (!$clean) return '';
    return '<script>window.BURNIGATOR_INITIAL_THEME=' . json_encode($clean, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';</script>';
}
