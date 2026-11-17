<?php

// Template for the installation config. setup.php writes the real config.php
// (owner password hash, event-auth secret, optional database credentials).
// config.php is never committed: keep it private and out of version control.
return [
    'instance_id' => '',
    'password_hash' => '',
    'installed' => false,
];
