<?php
require_once __DIR__ . '/../config.php';

$input = getInput();
$username = trim($input['username'] ?? '');
$password = $input['password'] ?? '';

if (!$username || !$password) {
    jsonResponse(['error' => 'Username and password required'], 400);
}

$db = getDB();
$stmt = $db->prepare('SELECT id, username, password_hash FROM users WHERE username = :u OR email = :u');
$stmt->bindValue(':u', $username, SQLITE3_TEXT);
$result = $stmt->execute();
$user = $result->fetchArray(SQLITE3_ASSOC);

if (!$user || !password_verify($password, $user['password_hash'])) {
    jsonResponse(['error' => 'Invalid credentials'], 401);
}

// Update last login
$db->exec("UPDATE users SET last_login = datetime('now') WHERE id = {$user['id']}");

$_SESSION['user_id'] = $user['id'];
$_SESSION['username'] = $user['username'];

jsonResponse(['success' => true, 'user' => ['id' => $user['id'], 'username' => $user['username']]]);
