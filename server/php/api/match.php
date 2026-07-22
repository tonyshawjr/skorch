<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/match-helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$userId = requireAuth();
$input = getInput();

$won = (bool)($input['won'] ?? false);
$gameType = $input['game_type'] ?? 'ai';

if ($gameType === 'multiplayer' || $gameType === 'pvp') {
    jsonResponse(['error' => 'Ranked results are recorded by the game server'], 403);
}

$gameType = 'ai';
$duration = min(max((int)($input['duration'] ?? 0), 0), 86400);
$counters = [
    'skorches' => $input['skorches'] ?? 0,
    'shields'  => $input['shields'] ?? 0,
    'undeads'  => $input['undeads'] ?? 0,
    'eludes'   => $input['eludes'] ?? 0,
];
$allowedDifficulties = ['easy', 'medium', 'hard', 'insane'];
$difficulty = in_array($input['difficulty'] ?? '', $allowedDifficulties, true) ? $input['difficulty'] : null;

$db = getDB();
if (rateLimitHit($db, 'match:' . $userId, 30, 300)) {
    jsonResponse(['error' => 'Too many matches submitted. Please slow down.'], 429);
}

$eloChange = $won ? 5 : -3;

$db->beginTransaction();
try {
    $stmt = $db->prepare('INSERT INTO matches (player1_id, player2_id, winner_id, game_type, duration_seconds, difficulty) VALUES (:p1, NULL, :w, :t, :d, :diff)');
    $stmt->bindValue(':p1', $userId, PDO::PARAM_INT);
    $stmt->bindValue(':w', $won ? $userId : 0, PDO::PARAM_INT);
    $stmt->bindValue(':t', $gameType, PDO::PARAM_STR);
    $stmt->bindValue(':d', $duration, PDO::PARAM_INT);
    $stmt->bindValue(':diff', $difficulty, $difficulty ? PDO::PARAM_STR : PDO::PARAM_NULL);
    $stmt->execute();

    $myElo = $db->query("SELECT elo_rating FROM stats WHERE user_id = $userId")->fetchColumn() ?: 1200;
    $newElo = max(100, $myElo + $eloChange);
    $db->exec("UPDATE stats SET elo_rating = $newElo WHERE user_id = $userId");

    $xpResult = applyMatchStatsXP($db, $userId, $won, $gameType, $counters, $difficulty);
    $db->commit();
} catch (Exception $e) {
    $db->rollBack();
    jsonResponse(['error' => 'Could not record match'], 500);
}

jsonResponse([
    'success'    => true,
    'elo_change' => $eloChange,
    'xp'         => $xpResult['xp'],
    'level'      => $xpResult['level'],
    'xp_gained'  => $xpResult['xp_gained'],
    'leveled_up' => $xpResult['leveled_up'],
    'new_badges' => $xpResult['new_badges'],
]);
