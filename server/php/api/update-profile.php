<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

requireAuth();

$data = json_decode(file_get_contents('php://input'), true);
$userId = $_SESSION['user_id'];
$db = getDB();

$updates = [];
$params = [];

// Display name (optional, max 50 chars)
if (isset($data['display_name'])) {
    $name = trim(substr($data['display_name'], 0, 50));
    $updates[] = 'display_name = :display_name';
    $params[':display_name'] = $name ?: null;
}

// Avatar color (hex color)
if (isset($data['avatar_color'])) {
    $color = preg_match('/^#[0-9a-fA-F]{6}$/', $data['avatar_color']) ? $data['avatar_color'] : null;
    $updates[] = 'avatar_color = :avatar_color';
    $params[':avatar_color'] = $color;
}

// Display preference: 'username' or 'display_name'
if (isset($data['display_preference'])) {
    $pref = in_array($data['display_preference'], ['username', 'display_name']) ? $data['display_preference'] : 'username';
    // Store in session for now, could add DB column later
    $_SESSION['display_preference'] = $pref;
}

if (count($updates) > 0) {
    $sql = 'UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = :id';
    $params[':id'] = $userId;
    $stmt = $db->prepare($sql);
    foreach ($params as $key => $val) {
        $stmt->bindValue($key, $val);
    }
    $stmt->execute();
}

echo json_encode(['success' => true]);
