<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = getInput();
$token = trim($input['token'] ?? '');
$password = $input['password'] ?? '';

if (!$token) { jsonResponse(['error' => 'Token required'], 400); }
if (strlen($password) < 6) { jsonResponse(['error' => 'Password must be 6+ characters'], 400); }

$db = getDB();

$stmt = $db->prepare("SELECT pr.id, pr.user_id FROM password_resets pr WHERE pr.token = :token AND pr.used = 0 AND pr.expires_at > NOW()");
$stmt->bindValue(':token', hash('sha256', $token), PDO::PARAM_STR);
$stmt->execute();
$reset = $stmt->fetch();

if (!$reset) {
    jsonResponse(['error' => 'Invalid or expired reset link. Request a new one.'], 400);
}

$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $db->prepare('UPDATE users SET password_hash = :hash, token_version = token_version + 1 WHERE id = :id');
$stmt->bindValue(':hash', $hash, PDO::PARAM_STR);
$stmt->bindValue(':id', $reset['user_id'], PDO::PARAM_INT);
$stmt->execute();

$stmt = $db->prepare('UPDATE password_resets SET used = 1 WHERE id = :id');
$stmt->bindValue(':id', $reset['id'], PDO::PARAM_INT);
$stmt->execute();

jsonResponse(['success' => true, 'message' => 'Password updated. You can now log in.']);
