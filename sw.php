<?php

declare (strict_types=1);
require_once __DIR__ . '/auth.php';
$config = require is_file(__DIR__ . '/config.php') ? __DIR__ . '/config.php' : __DIR__ . '/config.sample.php';
$worker = file_get_contents(__DIR__ . '/sw.js');
if ($worker === false) {
    http_response_code(500);
    exit;
}
header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('X-Content-Type-Options: nosniff');
echo str_replace('__BURNIGATOR_INSTANCE_ID__', appInstanceId($config), $worker);
