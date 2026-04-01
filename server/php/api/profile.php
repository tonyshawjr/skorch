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

$stmt = $db->prepare('SELECT u.id, u.username, u.email, u.created_at, u.last_login, s.wins, s.losses, s.games_played, s.win_streak, s.best_streak, s.total_skorches, s.total_shields, s.total_undeads FROM users u LEFT JOIN stats s ON u.id = s.user_id WHERE u.id = :id');
$stmt->bindValue(':id', $userId, SQLITE3_INTEGER);
$result = $stmt->execute();
$profile = $result->fetchArray(SQLITE3_ASSOC);

if (!$profile) {
    jsonResponse(['error' => 'User not found'], 404);
}

unset($profile['password_hash']);
jsonResponse($profile);
