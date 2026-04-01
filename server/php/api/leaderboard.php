<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$db = getDB();
$limit = min((int)($_GET['limit'] ?? 20), 50);
$sort = $_GET['sort'] ?? 'wins';
$validSorts = ['wins', 'best_streak', 'games_played'];
if (!in_array($sort, $validSorts)) $sort = 'wins';

$result = $db->query("SELECT u.username, s.wins, s.losses, s.games_played, s.best_streak, s.total_skorches, CASE WHEN s.games_played > 0 THEN ROUND(CAST(s.wins AS FLOAT) / s.games_played * 100, 1) ELSE 0 END as win_rate FROM stats s JOIN users u ON s.user_id = u.id WHERE s.games_played >= 1 ORDER BY s.$sort DESC LIMIT $limit");

$leaderboard = [];
while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
    $leaderboard[] = $row;
}

jsonResponse($leaderboard);
