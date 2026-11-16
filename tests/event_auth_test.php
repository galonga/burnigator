<?php
declare(strict_types=1);
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../event_auth.php';

function check(bool $condition, string $message): void {
    if (!$condition) { fwrite(STDERR, "FAIL: {$message}\n"); exit(1); }
}

putenv('BURNIGATOR_EVENT_AUTH_SECRET=unit-test-secret-with-at-least-thirty-two-characters');
$GLOBALS['burnigatorConfig'] = ['instance_id'=>str_repeat('a',32)];
$db = new PDO('sqlite::memory:', '', '', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
eventAuthMigrate($db);

check(eventOrderHash(' ab-123 cd ') === eventOrderHash('AB123CD'), 'order codes normalize consistently');
check(eventOrderHash('AB123') !== hash('sha256','AB123'), 'order identifiers use keyed HMAC');
check(eventAuthDecrypt(eventAuthEncrypt('private-pretix-token'))==='private-pretix-token','Pretix tokens are encrypted at rest with the server secret');
for($i=0;$i<20;$i++)check(!eventAuthWriteLimited($db,'order-a'),'first twenty writes per attendee stay within the limit');
check(eventAuthWriteLimited($db,'order-a'),'twenty-first write by the same attendee is rate limited');
check(!eventAuthWriteLimited($db,'order-b'),'write limits are per attendee, not shared across a NAT');
check(!eventAuthLoginBlocked($db,'192.0.2.1'),'a fresh client is not blocked');
for($i=0;$i<9;$i++)eventAuthLoginFailed($db,'192.0.2.1');
check(!eventAuthLoginBlocked($db,'192.0.2.1'),'nine failed logins do not block yet');
eventAuthLoginFailed($db,'192.0.2.1');
check(eventAuthLoginBlocked($db,'192.0.2.1'),'ten failed logins block the client');
check(!eventAuthLoginBlocked($db,'192.0.2.99'),'other clients on other addresses are unaffected');
check(eventAuthClientKey('2001:db8:1:2:aaaa::1')===eventAuthClientKey('2001:db8:1:2:bbbb::9'),'IPv6 clients in one /64 share a limit');
check(eventAuthClientKey('2001:db8:1:3::1')!==eventAuthClientKey('2001:db8:1:2::1'),'different IPv6 /64 networks are separate');
$db->prepare('UPDATE burnigator_event_auth_rate_limits SET window_started=? WHERE scope=?')->execute([gmdate('Y-m-d H:i:s',time()-1000),'auth-ip']);
check(!eventAuthLoginBlocked($db,'192.0.2.1'),'expired failure windows no longer block');
check(eventAuthRateHit($db,'auth-ip',eventAuthClientKey('192.0.2.1'))===1,'an expired window restarts at one hit');
check(pretixOrderEligible(['status'=>'p']), 'paid order is eligible without refunds');
check(!pretixOrderEligible(['status'=>'p','positions'=>[['canceled'=>true]]]), 'canceled ticket positions revoke access');
check(!pretixOrderEligible(['status'=>'n']), 'pending order is not eligible');
check(!pretixOrderEligible(['status'=>'c']), 'cancelled order is not eligible');
check(!pretixOrderEligible(['status'=>'p'],[['state'=>'done','amount'=>'1.00']]), 'completed refund revokes access');
check(pretixOrderEligible(['status'=>'p'],[['state'=>'canceled','amount'=>'1.00']]), 'canceled refund does not revoke access');

$marker=bin2hex(random_bytes(16));
eventAuthUpsertOrder($db,'AB-123','p',true,'csv',$marker);
$rows=$db->query('SELECT * FROM burnigator_event_auth_orders')->fetchAll();
check(count($rows)===1 && $rows[0]['order_hash']===eventOrderHash('AB123'), 'database stores only the HMAC order hash');
check($rows[0]['event_id']===str_repeat('a',32), 'order record is event scoped');
$pseudonym=eventAuthPseudonymForOrder($db,eventOrderHash('AB123'));
check(is_string($pseudonym)&&preg_match('/^[A-Za-z]+ [A-Za-z]+ [1-9][0-9]{2}$/D',$pseudonym)===1,'participant receives a two-word burner pseudonym with a three-digit number');
check(eventAuthPseudonymForOrder($db,eventOrderHash('AB123'))===$pseudonym,'same event order keeps its pseudonym after re-authentication');

$token=bin2hex(random_bytes(32));$tokenHash=hash('sha256',$token);$now=gmdate('Y-m-d H:i:s');
$db->prepare('INSERT INTO burnigator_event_auth_sessions(event_id,token_hash,order_hash,pseudonym,expires_at,created_at) VALUES(?,?,?,?,?,?)')->execute([eventAuthEventId(),$tokenHash,eventOrderHash('AB123'),'Copper Wren',gmdate('Y-m-d H:i:s',time()+3600),$now]);
$_COOKIE[eventAuthCookieName($GLOBALS['burnigatorConfig'])]=$token;
check((eventAuthCurrentSession($db,$GLOBALS['burnigatorConfig'])['pseudonym']??'')==='Copper Wren','event session validates while the order is eligible');
eventAuthUpsertOrder($db,'AB-123','c',false,'csv',bin2hex(random_bytes(16)));
check(eventAuthCurrentSession($db,$GLOBALS['burnigatorConfig'])===null,'order status change revokes existing sessions');

$csv=tempnam(sys_get_temp_dir(),'burnigator-orders-');
file_put_contents($csv,"\xEF\xBB\xBFOrder code,Status\nCSV-PAID,paid\nCSV-PAID,paid\nCSV-PENDING,pending\nCSV-CANCELLED,canceled\nCSV-EXPIRED,expired\n\n");
$counts=eventAuthCsvImport($db,$csv);unlink($csv);
check($counts===['imported'=>4,'eligible'=>1,'ineligible'=>3],'two-column CSV import accepts Pretix statuses, skips blanks, deduplicates, and counts');
$q=$db->prepare('SELECT eligible FROM burnigator_event_auth_orders WHERE event_id=? AND order_hash=?');$q->execute([eventAuthEventId(),eventOrderHash('CSV-CANCELLED')]);
check((int)$q->fetchColumn()===0,'CSV canceled status revokes posting access');
$q->execute([eventAuthEventId(),eventOrderHash('CSV-EXPIRED')]);
check((int)$q->fetchColumn()===0,'CSV expired status revokes posting access');

$GLOBALS['burnigatorConfig'] = ['instance_id'=>str_repeat('b',32)];
check(eventAuthSetting($db,'last_sync_at')===null, 'settings are isolated by installation');
check((int)$db->query('SELECT COUNT(*) FROM burnigator_schema_migrations')->fetchColumn()===1, 'versioned schema migration is recorded');
$GLOBALS['burnigatorConfig'] = ['instance_id'=>str_repeat('a',32)];
eventAuthUpsertOrder($db,'RESET-CURRENT','p',true,'csv',bin2hex(random_bytes(16)));
$GLOBALS['burnigatorConfig'] = ['instance_id'=>str_repeat('b',32)];
eventAuthUpsertOrder($db,'RESET-OTHER','p',true,'csv',bin2hex(random_bytes(16)));
$GLOBALS['burnigatorConfig'] = ['instance_id'=>str_repeat('a',32)];
eventAuthResetInstallation($db);
$q=$db->prepare('SELECT COUNT(*) FROM burnigator_event_auth_orders WHERE event_id=?');$q->execute([eventAuthEventId()]);
check((int)$q->fetchColumn()===0, 'application reset removes data scoped to the current installation');
$GLOBALS['burnigatorConfig'] = ['instance_id'=>str_repeat('b',32)];
$q->execute([eventAuthEventId()]);check((int)$q->fetchColumn()===1, 'application reset preserves records for other installations');
echo "Event authentication tests passed.\n";
