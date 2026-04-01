<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$username = isset($_GET['u']) ? trim($_GET['u']) : null;
if (!$username) {
    jsonResponse(['error' => 'Username required'], 400);
}

$db = getDB();
$stmt = $db->prepare('SELECT u.id, u.username, u.display_name, u.avatar_color, u.created_at, s.wins, s.losses, s.games_played, s.win_streak, s.best_streak, s.total_skorches FROM users u LEFT JOIN stats s ON u.id = s.user_id WHERE u.username = :username');
$stmt->bindValue(':username', $username, SQLITE3_TEXT);
$result = $stmt->execute();
$profile = $result->fetchArray(SQLITE3_ASSOC);

if (!$profile) {
    jsonResponse(['error' => 'Player not found'], 404);
}

jsonResponse($profile);
