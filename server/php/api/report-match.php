<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/match-helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$secret = serverSecret();
if ($secret === '') {
    http_response_code(500);
    echo json_encode(['error' => 'Server not configured']);
    exit;
}

$raw = file_get_contents('php://input');
$sig = $_SERVER['HTTP_X_SKORCH_SIGN'] ?? '';
$expected = hash_hmac('sha256', $raw, $secret);
if ($sig === '' || !hash_equals($expected, $sig)) {
    http_response_code(401);
    echo json_encode(['error' => 'Bad signature']);
    exit;
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'Bad request']);
    exit;
}

$ts = (int)($data['ts'] ?? 0);
if (abs(time() - $ts) > 600) {
    http_response_code(400);
    echo json_encode(['error' => 'Stale report']);
    exit;
}

$nonce = (string)($data['nonce'] ?? '');
if ($nonce === '' || strlen($nonce) > 190) {
    http_response_code(400);
    echo json_encode(['error' => 'Bad nonce']);
    exit;
}

$winnerSlot = $data['winner'] ?? '';
if (!in_array($winnerSlot, ['player1', 'player2'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Bad winner']);
    exit;
}

$verifyTicket = function ($ticket) use ($secret) {
    if (!is_string($ticket) || strpos($ticket, '.') === false) return null;
    [$body, $tsig] = explode('.', $ticket, 2);
    $expect = hash_hmac('sha256', $body, $secret);
    if (!hash_equals($expect, $tsig)) return null;
    $json = base64_decode(strtr($body, '-_', '+/'));
    $p = json_decode($json, true);
    if (!is_array($p) || !isset($p['uid'], $p['exp'])) return null;
    if (time() > (int)$p['exp']) return null;
    return ['uid' => (int)$p['uid'], 'un' => (string)($p['un'] ?? '')];
};

$p1 = $verifyTicket($data['p1_ticket'] ?? null);
$p2 = $verifyTicket($data['p2_ticket'] ?? null);

if ($p1 && $p2 && $p1['uid'] === $p2['uid']) {
    jsonResponse(['error' => 'Invalid pairing'], 400);
}

if (!$p1 && !$p2) {
    jsonResponse(['success' => true, 'recorded' => false]);
}

$won1 = ($winnerSlot === 'player1');
$won2 = ($winnerSlot === 'player2');
$uid1 = $p1['uid'] ?? null;
$uid2 = $p2['uid'] ?? null;
$winnerUid = $winnerSlot === 'player1' ? $uid1 : $uid2;
$ranked = ($p1 && $p2);

$db = getDB();
$db->beginTransaction();
try {
    $ins = $db->prepare('INSERT IGNORE INTO match_reports (nonce) VALUES (:n)');
    $ins->bindValue(':n', $nonce, PDO::PARAM_STR);
    $ins->execute();
    if ($ins->rowCount() === 0) {
        $db->commit();
        jsonResponse(['success' => true, 'duplicate' => true]);
    }

    $stmt = $db->prepare('INSERT INTO matches (player1_id, player2_id, winner_id, game_type, duration_seconds, difficulty) VALUES (:p1, :p2, :w, :t, 0, NULL)');
    $stmt->bindValue(':p1', $uid1, $uid1 ? PDO::PARAM_INT : PDO::PARAM_NULL);
    $stmt->bindValue(':p2', $uid2, $uid2 ? PDO::PARAM_INT : PDO::PARAM_NULL);
    $stmt->bindValue(':w', $winnerUid ?: 0, PDO::PARAM_INT);
    $stmt->bindValue(':t', 'multiplayer', PDO::PARAM_STR);
    $stmt->execute();

    if ($p1) applyMatchStatsXP($db, $uid1, $won1, 'multiplayer', [], null);
    if ($p2) applyMatchStatsXP($db, $uid2, $won2, 'multiplayer', [], null);

    if ($ranked) {
        $e1 = $db->query("SELECT elo_rating FROM stats WHERE user_id = $uid1")->fetchColumn() ?: 1200;
        $e2 = $db->query("SELECT elo_rating FROM stats WHERE user_id = $uid2")->fetchColumn() ?: 1200;
        $K = 32;
        $s1 = $won1 ? 1 : 0;
        $exp1 = 1 / (1 + pow(10, ($e2 - $e1) / 400));
        $c1 = round($K * ($s1 - $exp1));
        $new1 = max(100, $e1 + $c1);
        $new2 = max(100, $e2 - $c1);
        $db->exec("UPDATE stats SET elo_rating = $new1 WHERE user_id = $uid1");
        $db->exec("UPDATE stats SET elo_rating = $new2 WHERE user_id = $uid2");
    }

    $db->exec("DELETE FROM match_reports WHERE created_at < (NOW() - INTERVAL 7 DAY)");
    $db->commit();
} catch (Exception $e) {
    $db->rollBack();
    jsonResponse(['error' => 'Could not record match'], 500);
}

jsonResponse(['success' => true, 'recorded' => true, 'ranked' => $ranked]);
