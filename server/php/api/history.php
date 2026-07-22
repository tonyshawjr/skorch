<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$db = getDB();
$limit = min((int)($_GET['limit'] ?? 20), 50);

// If username param provided, show that player's history (public)
// Otherwise require auth and show own history
$username = isset($_GET['u']) ? trim($_GET['u']) : null;

if ($username) {
    $stmt = $db->prepare('SELECT id FROM users WHERE username = :u');
    $stmt->bindValue(':u', $username, PDO::PARAM_STR);
    $stmt->execute();
    $user = $stmt->fetch();
    if (!$user) { jsonResponse(['error' => 'Player not found'], 404); }
    $userId = $user['id'];
} else {
    require_once __DIR__ . '/../middleware/auth.php';
    $userId = requireAuth();
}

$stmt = $db->prepare('SELECT m.id, m.game_type, m.difficulty, m.duration_seconds, m.played_at, m.winner_id, u1.username as player1, COALESCE(u1.display_name, u1.username) as player1_display, u2.username as player2, COALESCE(u2.display_name, u2.username) as player2_display FROM matches m LEFT JOIN users u1 ON m.player1_id = u1.id LEFT JOIN users u2 ON m.player2_id = u2.id WHERE m.player1_id = :id OR m.player2_id = :id ORDER BY m.played_at DESC LIMIT ' . (int)$limit);
$stmt->bindValue(':id', $userId, PDO::PARAM_INT);
$stmt->execute();

$matches = [];
while ($row = $stmt->fetch()) {
    $row['won'] = ($row['winner_id'] == $userId);
    $matches[] = $row;
}

jsonResponse($matches);
