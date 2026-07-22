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
$stmt = $db->prepare('SELECT u.id, u.username, u.display_name, u.avatar_color, u.avatar_url, u.bio, u.region, u.play_style, u.age, u.birthday, u.city, u.state_region, u.country, u.social_links, u.last_active, u.created_at, s.wins, s.losses, s.games_played, s.win_streak, s.best_streak, s.total_skorches, s.elo_rating, s.xp, s.level FROM users u LEFT JOIN stats s ON u.id = s.user_id WHERE u.username = :username');
$stmt->bindValue(':username', $username, PDO::PARAM_STR);
$stmt->execute();
$profile = $stmt->fetch();

if (!$profile) {
    jsonResponse(['error' => 'Player not found'], 404);
}

if ($profile['social_links']) {
    $profile['social_links'] = json_decode($profile['social_links'], true);
}

$uid = $profile['id'];
$friendCount = $db->query("SELECT COUNT(*) FROM friends WHERE status = 'accepted' AND (user_id = $uid OR friend_id = $uid)")->fetchColumn();
$profile['friend_count'] = (int)$friendCount;

$fStmt = $db->prepare("
    SELECT u.username, COALESCE(u.display_name, u.username) as display_name, u.avatar_color, u.avatar_url
    FROM friends f
    JOIN users u ON (f.friend_id = u.id AND f.user_id = :me) OR (f.user_id = u.id AND f.friend_id = :me2)
    WHERE f.status = 'accepted' AND u.id != :me3
    LIMIT 5
");
$fStmt->bindValue(':me', $uid, PDO::PARAM_INT);
$fStmt->bindValue(':me2', $uid, PDO::PARAM_INT);
$fStmt->bindValue(':me3', $uid, PDO::PARAM_INT);
$fStmt->execute();
$topFriends = [];
while ($f = $fStmt->fetch()) {
    $topFriends[] = $f;
}
$profile['top_friends'] = $topFriends;

jsonResponse($profile);
