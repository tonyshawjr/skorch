<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';

$userId = requireAuth();
$secret = serverSecret();
if ($secret === '') {
    jsonResponse(['error' => 'Server not configured'], 500);
}

$db = getDB();
$stmt = $db->prepare('SELECT username FROM users WHERE id = :id');
$stmt->bindValue(':id', $userId, PDO::PARAM_INT);
$stmt->execute();
$row = $stmt->fetch();
if (!$row) {
    jsonResponse(['error' => 'User not found'], 404);
}

$expiry = time() + 8 * 60 * 60;
$payload = json_encode(['uid' => (int)$userId, 'un' => $row['username'], 'exp' => $expiry]);
$body = rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
$sig = hash_hmac('sha256', $body, $secret);

jsonResponse(['ticket' => $body . '.' . $sig, 'expires' => $expiry]);
