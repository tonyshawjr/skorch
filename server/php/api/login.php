<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = getInput();
$username = trim($input['username'] ?? '');
$password = $input['password'] ?? '';

if (!$username || !$password) {
    jsonResponse(['error' => 'Username and password required'], 400);
}

$db = getDB();
if (rateLimitHit($db, 'login:ip:' . clientIp(), 30, 600) || rateLimitHit($db, 'login:user:' . strtolower($username), 8, 600)) {
    jsonResponse(['error' => 'Too many attempts. Please wait and try again.'], 429);
}
$stmt = $db->prepare('SELECT id, username, password_hash, token_version FROM users WHERE username = :u OR email = :u');
$stmt->bindValue(':u', $username, PDO::PARAM_STR);
$stmt->execute();
$user = $stmt->fetch();

$dummyHash = '$2y$12$FYy/5AZSn6a7asmvP6RGqeQHvunN3xV2STKlJjvTkvcnga0s2YA1e';
$passwordOk = password_verify($password, $user ? $user['password_hash'] : $dummyHash);
if (!$user || !$passwordOk) {
    jsonResponse(['error' => 'Invalid credentials'], 401);
}

$db->exec("UPDATE users SET last_login = NOW(), last_active = NOW() WHERE id = {$user['id']}");

session_regenerate_id(true);
$_SESSION['user_id'] = $user['id'];
$_SESSION['username'] = $user['username'];
$_SESSION['token_version'] = (int)$user['token_version'];

jsonResponse(['success' => true, 'user' => ['id' => $user['id'], 'username' => $user['username']]]);
