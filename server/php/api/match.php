<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$userId = requireAuth();
$input = getInput();

$won = (bool)($input['won'] ?? false);
$gameType = $input['game_type'] ?? 'ai';
$duration = (int)($input['duration'] ?? 0);
$skorches = (int)($input['skorches'] ?? 0);
$shields = (int)($input['shields'] ?? 0);
$undeads = (int)($input['undeads'] ?? 0);
$opponentId = $input['opponent_id'] ?? null;

$db = getDB();

// Record match
$stmt = $db->prepare('INSERT INTO matches (player1_id, player2_id, winner_id, game_type, duration_seconds) VALUES (:p1, :p2, :w, :t, :d)');
$stmt->bindValue(':p1', $userId, SQLITE3_INTEGER);
$stmt->bindValue(':p2', $opponentId, $opponentId ? SQLITE3_INTEGER : SQLITE3_NULL);
$stmt->bindValue(':w', $won ? $userId : ($opponentId ?: 0), SQLITE3_INTEGER);
$stmt->bindValue(':t', $gameType, SQLITE3_TEXT);
$stmt->bindValue(':d', $duration, SQLITE3_INTEGER);
$stmt->execute();

// Update stats
$field = $won ? 'wins' : 'losses';
$streakUpdate = $won
    ? "win_streak = win_streak + 1, best_streak = MAX(best_streak, win_streak + 1)"
    : "win_streak = 0";

$db->exec("UPDATE stats SET games_played = games_played + 1, $field = $field + 1, $streakUpdate, total_skorches = total_skorches + $skorches, total_shields = total_shields + $shields, total_undeads = total_undeads + $undeads WHERE user_id = $userId");

jsonResponse(['success' => true]);
