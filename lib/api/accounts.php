<?php

declare(strict_types=1);

/** POST change-owner-password. */
function apiChangeOwnerPasswordAction(array $config, string $role, array $in): void
{
    if ($role !== 'owner') {
        respond(403, ['error' => 'Keine Berechtigung']);
    }
    $username = strtolower((string) ($_SESSION['username'] ?? ''));
    $users = appUsers($config);
    if (!isset($users[$username]) || ($users[$username]['role'] ?? '') !== 'owner') {
        foreach ($users as $candidate => $account) {
            if (($account['role'] ?? '') === 'owner') {
                $username = (string) $candidate;
                break;
            }
        }
    }
    $account = $users[$username] ?? null;
    $current = (string) ($in['currentPassword'] ?? '');
    $password = (string) ($in['password'] ?? '');
    $confirm = (string) ($in['passwordConfirm'] ?? '');
    if (!is_array($account) || empty($account['password_hash']) || !password_verify($current, (string) $account['password_hash'])) {
        respond(400, ['error' => 'current_password_invalid']);
    }
    if (strlen($password) < 12) {
        respond(400, ['error' => 'password_too_short']);
    }
    if (!hash_equals($password, $confirm)) {
        respond(400, ['error' => 'password_mismatch']);
    }
    $users[$username]['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
    if (!saveAppUsers($users)) {
        respond(500, ['error' => 'password_save_failed']);
    }
    session_regenerate_id(true);
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    recordHistory('owner_password_save', 0, 'Owner-Passwort geändert');
    respond(200, ['ok' => true, 'csrf' => $_SESSION['csrf']]);
}

/** POST save-accounts. */
function apiSaveAccountsAction(array $config, array $in): void
{
    $users = appUsers($config);
    $roles = ['poi', 'www'];
    $inputAccounts = (array) ($in['accounts'] ?? []);
    $existingByRole = [];
    foreach ($users as $username => $account) {
        if (in_array($account['role'] ?? '', $roles, true)) {
            $existingByRole[$account['role']] = ['username' => (string) $username, 'password_hash' => (string) ($account['password_hash'] ?? '')];
        }
    }
    foreach ($roles as $accountRole) {
        $entry = is_array($inputAccounts[$accountRole] ?? null) ? $inputAccounts[$accountRole] : [];
        $username = strtolower(trim((string) ($entry['username'] ?? '')));
        $password = (string) ($entry['password'] ?? '');
        $passwordConfirm = (string) ($entry['passwordConfirm'] ?? '');
        if (!hash_equals($password, $passwordConfirm)) {
            respond(400, ['error' => 'password_mismatch']);
        }
        if ($username === '' && $password === '') {
            if (isset($existingByRole[$accountRole])) {
                unset($users[$existingByRole[$accountRole]['username']]);
            }
            continue;
        }
        if (!preg_match('/^[a-zA-Z0-9_.-]{3,32}$/', $username)) {
            respond(400, ['error' => 'Benutzernamen müssen 3–32 Zeichen haben (Buchstaben, Zahlen, Punkt, _ oder -).']);
        }
        if (isset($users[$username]) && ($existingByRole[$accountRole]['username'] ?? null) !== $username) {
            respond(400, ['error' => 'Dieser Benutzername ist bereits vergeben.']);
        }
        $hash = $existingByRole[$accountRole]['password_hash'] ?? '';
        if ($password !== '') {
            if (strlen($password) < 12) {
                respond(400, ['error' => 'password_too_short']);
            }
            $hash = password_hash($password, PASSWORD_DEFAULT);
        }
        if ($hash === '') {
            respond(400, ['error' => 'Bitte für jedes neue Konto ein Passwort mit mindestens 12 Zeichen festlegen.']);
        }
        if (isset($existingByRole[$accountRole]['username'])) {
            unset($users[$existingByRole[$accountRole]['username']]);
        }
        $users[$username] = ['role' => $accountRole, 'password_hash' => $hash];
    }
    if (!saveAppUsers($users)) {
        respond(500, ['error' => 'Konten konnten nicht gespeichert werden. Prüfe die Schreibrechte für data/.']);
    }
    $accounts = [];
    foreach ($users as $username => $account) {
        if (in_array($account['role'] ?? '', $roles, true)) {
            $accounts[$account['role']] = ['username' => $username];
        }
    }
    recordHistory('accounts_save', 0, 'POI: ' . ($accounts['poi']['username'] ?? '—') . ' · WWW: ' . ($accounts['www']['username'] ?? '—'));
    respond(200, ['ok' => true, 'accounts' => $accounts]);
}
