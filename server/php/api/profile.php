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

$stmt = $db->prepare('SELECT u.id, u.username, u.email, u.display_name, u.avatar_color, u.avatar_url, u.bio, u.region, u.play_style, u.age, u.birthday, u.first_name, u.last_name, u.city, u.state_region, u.country, u.social_links, u.last_active, u.created_at, u.last_login, s.wins, s.losses, s.games_played, s.win_streak, s.best_streak, s.total_skorches, s.total_shields, s.total_undeads, s.elo_rating, s.xp, s.level FROM users u LEFT JOIN stats s ON u.id = s.user_id WHERE u.id = :id');
$stmt->bindValue(':id', $userId, PDO::PARAM_INT);
$stmt->execute();
$profile = $stmt->fetch();

if (!$profile) {
    jsonResponse(['error' => 'User not found'], 404);
}

unset($profile['password_hash']);

$db->exec("UPDATE users SET last_active = NOW() WHERE id = $userId");

if ($profile['social_links']) {
    $profile['social_links'] = json_decode($profile['social_links'], true);
}

jsonResponse($profile);
