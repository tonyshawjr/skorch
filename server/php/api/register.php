<?php
require_once __DIR__ . '/../config.php';

$input = getInput();
$username = trim($input['username'] ?? '');
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if (strlen($username) < 3 || strlen($username) > 20) {
    jsonResponse(['error' => 'Username must be 3-20 characters'], 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['error' => 'Invalid email'], 400);
}
if (strlen($password) < 6) {
    jsonResponse(['error' => 'Password must be at least 6 characters'], 400);
}

$db = getDB();

// Check existing
$stmt = $db->prepare('SELECT id FROM users WHERE username = :u OR email = :e');
$stmt->bindValue(':u', $username, SQLITE3_TEXT);
$stmt->bindValue(':e', $email, SQLITE3_TEXT);
$result = $stmt->execute();
if ($result->fetchArray()) {
    jsonResponse(['error' => 'Username or email already taken'], 409);
}

// Create user
$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $db->prepare('INSERT INTO users (username, email, password_hash) VALUES (:u, :e, :p)');
$stmt->bindValue(':u', $username, SQLITE3_TEXT);
$stmt->bindValue(':e', $email, SQLITE3_TEXT);
$stmt->bindValue(':p', $hash, SQLITE3_TEXT);
$stmt->execute();

$userId = $db->lastInsertRowID();

// Create stats row
$db->exec("INSERT INTO stats (user_id) VALUES ($userId)");

// Auto-login
$_SESSION['user_id'] = $userId;
$_SESSION['username'] = $username;

jsonResponse(['success' => true, 'user' => ['id' => $userId, 'username' => $username]]);
