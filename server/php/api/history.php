<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$userId = requireAuth();
$db = getDB();
$limit = min((int)($_GET['limit'] ?? 20), 50);

$stmt = $db->prepare('SELECT m.id, m.game_type, m.duration_seconds, m.played_at, m.winner_id, u1.username as player1, u2.username as player2 FROM matches m LEFT JOIN users u1 ON m.player1_id = u1.id LEFT JOIN users u2 ON m.player2_id = u2.id WHERE m.player1_id = :id OR m.player2_id = :id ORDER BY m.played_at DESC LIMIT :lim');
$stmt->bindValue(':id', $userId, SQLITE3_INTEGER);
$stmt->bindValue(':lim', $limit, SQLITE3_INTEGER);
$result = $stmt->execute();

$matches = [];
while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
    $row['won'] = ($row['winner_id'] == $userId);
    $matches[] = $row;
}

jsonResponse($matches);
