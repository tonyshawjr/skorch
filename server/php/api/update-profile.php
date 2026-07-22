<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';

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


if (isset($data['display_name'])) {
    $name = trim(substr($data['display_name'], 0, 50));
    $updates[] = 'display_name = :display_name';
    $params[':display_name'] = $name ?: null;
}


if (isset($data['bio'])) {
    $bio = trim(substr($data['bio'], 0, 200));
    $updates[] = 'bio = :bio';
    $params[':bio'] = $bio ?: null;
}


if (isset($data['avatar_color'])) {
    $color = preg_match('/^#[0-9a-fA-F]{6}$/', $data['avatar_color']) ? $data['avatar_color'] : null;
    $updates[] = 'avatar_color = :avatar_color';
    $params[':avatar_color'] = $color;
}


if (isset($data['region'])) {
    $validRegions = ['NA-East', 'NA-West', 'EU-West', 'EU-East', 'Asia', 'Oceania', 'South America', 'Africa', 'Middle East'];
    $region = in_array($data['region'], $validRegions) ? $data['region'] : null;
    $updates[] = 'region = :region';
    $params[':region'] = $region;
}


if (isset($data['play_style'])) {
    $validStyles = ['Competitive', 'Casual', 'Just for Fun'];
    $style = in_array($data['play_style'], $validStyles) ? $data['play_style'] : null;
    $updates[] = 'play_style = :play_style';
    $params[':play_style'] = $style;
}


if (isset($data['birthday'])) {
    $bday = $data['birthday'];
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $bday)) {
        $updates[] = 'birthday = :birthday';
        $params[':birthday'] = $bday;
    }
}


if (isset($data['first_name'])) {
    $updates[] = 'first_name = :first_name';
    $params[':first_name'] = trim(substr($data['first_name'], 0, 50)) ?: null;
}
if (isset($data['last_name'])) {
    $updates[] = 'last_name = :last_name';
    $params[':last_name'] = trim(substr($data['last_name'], 0, 50)) ?: null;
}


if (isset($data['city'])) {
    $updates[] = 'city = :city';
    $params[':city'] = trim(substr($data['city'], 0, 100)) ?: null;
}
if (isset($data['state_region'])) {
    $updates[] = 'state_region = :state_region';
    $params[':state_region'] = trim(substr($data['state_region'], 0, 100)) ?: null;
}
if (isset($data['country'])) {
    $updates[] = 'country = :country';
    $params[':country'] = trim(substr($data['country'], 0, 100)) ?: null;
}


if (isset($data['social_links'])) {
    $allowed = ['youtube', 'twitch', 'instagram', 'discord', 'twitter', 'tiktok'];
    $links = [];
    foreach ($data['social_links'] as $platform => $handle) {
        if (in_array($platform, $allowed) && is_string($handle) && strlen($handle) <= 100) {
            $handle = trim($handle);
            if ($handle) $links[$platform] = $handle;
        }
    }
    $updates[] = 'social_links = :social_links';
    $params[':social_links'] = count($links) > 0 ? json_encode($links) : null;
}


if (isset($data['display_preference'])) {
    $pref = in_array($data['display_preference'], ['username', 'display_name']) ? $data['display_preference'] : 'username';
    
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
