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
$stmt = $db->prepare('SELECT id, username, password_hash FROM users WHERE username = :u OR email = :u');
$stmt->bindValue(':u', $username, PDO::PARAM_STR);
$stmt->execute();
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    jsonResponse(['error' => 'Invalid credentials'], 401);
}

$db->exec("UPDATE users SET last_login = NOW(), last_active = NOW() WHERE id = {$user['id']}");

session_regenerate_id(true);
$_SESSION['user_id'] = $user['id'];
$_SESSION['username'] = $user['username'];

jsonResponse(['success' => true, 'user' => ['id' => $user['id'], 'username' => $user['username']]]);
