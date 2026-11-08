<?php
declare(strict_types=1);
$configPath = __DIR__ . '/config.php';
$config = require $configPath;
if (!empty($config['installed'])) { header('Location: index.php'); exit; }
$error = '';
$errorKey = '';
$title = 'Meine Bildkarte';
$themeDefaults = ['primary'=>'var(--color-primary)','accent'=>'var(--color-accent)','alert'=>'var(--color-alert)','background'=>'var(--color-background)'];
$theme = $themeDefaults;
$customLabel = '';
$customUrl = '';
$qrUrl = '';
$impressUrl = '';
$iconMode = 'monochrome';
$browserTranslationEnabled = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = (string)($_POST['password'] ?? '');
    $confirm = (string)($_POST['confirm'] ?? '');
    $title = trim((string)($_POST['title'] ?? 'Meine Bildkarte'));
    $theme = [];
    foreach ($themeDefaults as $key => $fallback) {
        $value = (string)($_POST['theme_'.$key] ?? '');
        $theme[$key] = preg_match('/^#[0-9a-fA-F]{6}$/D', $value) ? strtoupper($value) : $fallback;
    }
    $customLabel = trim((string)($_POST['custom_button_label'] ?? ''));
    $customUrl = trim((string)($_POST['custom_button_url'] ?? ''));
    $qrUrl = trim((string)($_POST['qr_url'] ?? ''));
    $impressUrl = trim((string)($_POST['impress_url'] ?? ''));
    $iconMode = ($_POST['icon_mode'] ?? '') === 'colored' ? 'colored' : 'monochrome';
    $browserTranslationEnabled = isset($_POST['browser_translation_enabled']);
    foreach (['custom' => $customUrl, 'qr' => $qrUrl, 'impress' => $impressUrl] as $name => $url) {
        if ($url !== '' && (strlen($url) > 2048 || !filter_var($url, FILTER_VALIDATE_URL) || !in_array(strtolower((string)parse_url($url, PHP_URL_SCHEME)), ['http','https'], true) || parse_url($url, PHP_URL_HOST) === null || parse_url($url, PHP_URL_USER) !== null || parse_url($url, PHP_URL_PASS) !== null)) {
            $errorKey = $name === 'custom' ? 'setupCustomUrlError' : ($name === 'impress' ? 'setupImpressUrlError' : 'setupQrUrlError');
            $error = $name === 'custom' ? 'Der Zusatzbutton benötigt eine gültige HTTP- oder HTTPS-Adresse.' : ($name === 'impress' ? 'Der Impress-Link benötigt eine gültige HTTP- oder HTTPS-Adresse.' : 'Die QR-Code-Adresse benötigt eine gültige HTTP- oder HTTPS-Adresse.');
            break;
        }
    }
    if (strlen($password) < 12) { $errorKey = 'passwordShort'; $error = 'Bitte ein Passwort mit mindestens 12 Zeichen wählen.'; }
    elseif ($password !== $confirm) { $errorKey = 'passwordMismatch'; $error = 'Die Passwörter stimmen nicht überein.'; }
    elseif ($error === '') {
        $title = $title !== '' ? $title : 'Meine Bildkarte';
        $title = function_exists('mb_substr') ? mb_substr($title, 0, 100, 'UTF-8') : substr($title, 0, 400);
        $customLabel = function_exists('mb_substr') ? mb_substr($customLabel, 0, 40, 'UTF-8') : substr($customLabel, 0, 160);
        if ($customUrl === '') $customLabel = '';
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $instanceId = bin2hex(random_bytes(16));
        $contents = "<?php\ndeclare(strict_types=1);\nreturn [\n    'instance_id' => " . var_export($instanceId, true) . ",\n    'password_hash' => " . var_export($hash, true) . ",\n    'installed' => true,\n];\n";
        $setupReady = true;
        foreach (['data','uploads'] as $dir) {
            $path = __DIR__ . '/' . $dir;
            if (!is_dir($path) && !@mkdir($path, 0755, true) && !is_dir($path)) $setupReady = false;
            if (is_dir($path) && !is_writable($path)) $setupReady = false;
        }
        $initial = ['title'=>$title,'image'=>'','logo'=>'','favicon'=>'','width'=>0,'height'=>0,'updatedAt'=>gmdate('c'),'iconMode'=>$iconMode,'browserTranslationEnabled'=>$browserTranslationEnabled,'soundcloudEnabled'=>true,'soundcloudPlaylist'=>'https://soundcloud.com/minmon_kollektiv/sets/minmon-podcast','customButton'=>['label'=>$customLabel,'url'=>$customUrl],'qrUrl'=>$qrUrl,'impressUrl'=>$impressUrl,'theme'=>$theme,'categories'=>[],'pois'=>[],'timelines'=>[]];
        $mapPath = __DIR__.'/data/map.json';
        if ($setupReady && file_exists($mapPath) && !is_writable($mapPath)) $setupReady = false;
        if ($setupReady && !file_exists($mapPath)) {
            $initialJson = json_encode($initial, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
            if ($initialJson === false || file_put_contents($mapPath, $initialJson, LOCK_EX) === false) $setupReady = false;
        }
        if (!$setupReady) { $errorKey = 'setupDataWriteError'; $error = 'Datenverzeichnis oder uploads ist nicht beschreibbar. Bitte Dateirechte prüfen und erneut versuchen.'; }
        elseif (file_put_contents($configPath, $contents, LOCK_EX) === false) { $errorKey = 'configWrite'; $error = 'config.php ist nicht beschreibbar. Bitte Dateirechte prüfen.'; }
        else { header('Location: admin.php'); exit; }
    }
}
?><!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Einrichtung — Burnigator</title><link rel="stylesheet" href="assets/style.css?v=build-1344"><link rel="stylesheet" href="assets/design-system.css?v=build-1344"><style>.setup-wizard{max-width:720px}.setup-progress{display:flex;gap:8px;margin:20px 0}.setup-progress span{flex:1;padding:9px 12px;border-radius:999px;background:var(--color-surface-container);color:var(--color-on-surface-variant);font-size:.9rem;text-align:center}.setup-progress span[aria-current="step"]{background:var(--color-primary);color:var(--color-on-primary,var(--color-white));font-weight:700}.setup-step h2{margin:8px 0}.setup-colors{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.setup-colors label{padding:12px;border:1px solid var(--color-divider);border-radius:12px;background:var(--color-surface-high)}.setup-colors input[type=color]{display:block;width:100%;height:42px;margin-top:7px}.setup-actions{display:flex;justify-content:space-between;gap:10px;margin-top:24px}.setup-actions .button{min-width:130px}@media(max-width:520px){.setup-colors{grid-template-columns:1fr}.setup-progress span{font-size:.75rem;padding:8px 4px}}</style></head><body class="form-page"><form class="panel setup-wizard" method="post" id="setup-form"><header class="form-head"><div><h1 data-i18n="setupTitle">Burnigator einrichten</h1><p data-i18n="setupWizardIntro">In wenigen Schritten bereitest du die Grundkonfiguration vor.</p></div><select id="language-switch" aria-label="Language" data-i18n-aria="lang"><option value="de">DE</option><option value="en">EN</option></select></header><div class="setup-progress" aria-label="Setup progress"><span data-step-label="1" aria-current="step" data-i18n="setupStepAccount">1. Zugang</span><span data-step-label="2" data-i18n="setupStepAppearance">2. Aussehen</span><span data-step-label="3" data-i18n="setupStepOptions">3. Optionen</span></div><?php if ($error): ?><p class="error" role="alert" data-i18n="<?=htmlspecialchars($errorKey, ENT_QUOTES, 'UTF-8')?>"><?=htmlspecialchars($error, ENT_QUOTES, 'UTF-8')?></p><?php endif; ?><section class="setup-step" data-step="1"><h2 data-i18n="setupAccountHeading">Administratorzugang</h2><p data-i18n="setupAccountHint">Lege ein sicheres Passwort mit mindestens 12 Zeichen fest.</p><label><span data-i18n="password">Passwort</span><input type="password" name="password" required minlength="12" autocomplete="new-password"></label><label><span data-i18n="passwordAgain">Passwort wiederholen</span><input type="password" name="confirm" required minlength="12" autocomplete="new-password"></label><div class="setup-actions"><span></span><button class="button button-primary" type="button" data-next data-i18n="next">Weiter</button></div></section><section class="setup-step" data-step="2"><h2 data-i18n="setupAppearanceHeading">Grundaussehen</h2><p data-i18n="setupAppearanceHint">Diese Werte kannst du später jederzeit in der Konfiguration ändern.</p><label><span data-i18n="title">Kartentitel</span><input type="text" name="title" maxlength="100" value="<?=htmlspecialchars($title, ENT_QUOTES, 'UTF-8')?>"></label><div class="setup-colors"><label><span data-i18n="themePrimary">Hauptfarbe</span><input type="color" name="theme_primary" value="<?=htmlspecialchars($theme['primary'], ENT_QUOTES, 'UTF-8')?>"></label><label><span data-i18n="themeAccent">Akzentfarbe</span><input type="color" name="theme_accent" value="<?=htmlspecialchars($theme['accent'], ENT_QUOTES, 'UTF-8')?>"></label><label><span data-i18n="themeAlert">Warnfarbe</span><input type="color" name="theme_alert" value="<?=htmlspecialchars($theme['alert'], ENT_QUOTES, 'UTF-8')?>"></label><label><span data-i18n="themeBackground">Hintergrundfarbe</span><input type="color" name="theme_background" value="<?=htmlspecialchars($theme['background'], ENT_QUOTES, 'UTF-8')?>"></label></div><div class="setup-actions"><button class="button button-outlined" type="button" data-back data-i18n="back">Zurück</button><button class="button button-primary" type="button" data-next data-i18n="next">Weiter</button></div></section><section class="setup-step" data-step="3"><h2 data-i18n="setupOptionsHeading">Optionale Funktionen</h2><p data-i18n="setupOptionsHint">Alles lässt sich später im Adminbereich ergänzen oder ändern.</p><label><span data-i18n="customButtonLabel">Zusatzbutton-Text (optional)</span><input type="text" name="custom_button_label" maxlength="40" value="<?=htmlspecialchars($customLabel, ENT_QUOTES, 'UTF-8')?>"></label><label><span data-i18n="customButtonUrl">Zusatzbutton-Link (https://…)</span><input type="url" name="custom_button_url" maxlength="2048" placeholder="https://" value="<?=htmlspecialchars($customUrl, ENT_QUOTES, 'UTF-8')?>"></label><label><span data-i18n="wwwQrUrl">QR-Code-URL für WWW-JPG (optional)</span><input type="url" name="qr_url" maxlength="2048" placeholder="https://" value="<?=htmlspecialchars($qrUrl, ENT_QUOTES, 'UTF-8')?>"></label><label><span data-i18n="impressUrl">Impress-Link (optional)</span><input type="url" name="impress_url" maxlength="2048" placeholder="https://" value="<?=htmlspecialchars($impressUrl, ENT_QUOTES, 'UTF-8')?>"></label><label class="setting-toggle"><input type="checkbox" name="browser_translation_enabled" <?= $browserTranslationEnabled ? 'checked' : '' ?>><span data-i18n="enableBrowserTranslation">Browserübersetzung für WWW-Beschreibungen anbieten</span></label><label><span data-i18n="iconMode">Symbolfarben</span><select name="icon_mode"><option value="monochrome" <?= $iconMode === 'monochrome' ? 'selected' : '' ?> data-i18n="mono">Monochrom (schwarz)</option><option value="colored" <?= $iconMode === 'colored' ? 'selected' : '' ?> data-i18n="color">Farbig</option></select></label><div class="setup-actions"><button class="button button-outlined" type="button" data-back data-i18n="back">Zurück</button><button class="button button-primary" type="submit" data-i18n="setupButton">Einrichtung abschließen</button></div></section></form><script src="assets/i18n.js?v=build-1344"></script><script>(function(){const form=document.getElementById('setup-form'),steps=[...form.querySelectorAll('.setup-step')],labels=[...form.querySelectorAll('[data-step-label]')];let active=1;function show(step){active=step;steps.forEach(section=>section.hidden=Number(section.dataset.step)!==step);labels.forEach(label=>{if(Number(label.dataset.stepLabel)===step)label.setAttribute('aria-current','step');else label.removeAttribute('aria-current');});steps[step-1].querySelector('input,select')?.focus({preventScroll:true});}form.querySelectorAll('[data-next]').forEach(button=>button.addEventListener('click',()=>{const fields=[...steps[active-1].querySelectorAll('input,select')];for(const field of fields){if(!field.reportValidity())return;}if(active===1&&form.elements.password.value!==form.elements.confirm.value){form.elements.confirm.setCustomValidity(window.AppI18n.t('passwordMismatch'));form.elements.confirm.reportValidity();form.elements.confirm.setCustomValidity('');return;}show(Math.min(3,active+1));}));form.querySelectorAll('[data-back]').forEach(button=>button.addEventListener('click',()=>show(Math.max(1,active-1))));form.addEventListener('submit',event=>{if(active!==3){event.preventDefault();show(3);}});show(1);})();</script></body></html>
