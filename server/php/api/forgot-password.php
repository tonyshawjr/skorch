<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = getInput();
$email = trim($input['email'] ?? '');

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['error' => 'Valid email required'], 400);
}

$db = getDB();


$stmt = $db->prepare('SELECT id, username, email FROM users WHERE email = :email');
$stmt->bindValue(':email', $email, PDO::PARAM_STR);
$stmt->execute();
$user = $stmt->fetch();

if (!$user) {
    
    jsonResponse(['success' => true, 'message' => 'If an account with that email exists, a reset link has been sent.']);
}


$token = bin2hex(random_bytes(32));
$expiresAt = date('Y-m-d H:i:s', time() + 3600); 


$stmt = $db->prepare('DELETE FROM password_resets WHERE user_id = :uid');
$stmt->bindValue(':uid', $user['id'], PDO::PARAM_INT);
$stmt->execute();


$stmt = $db->prepare('INSERT INTO password_resets (user_id, token, expires_at) VALUES (:uid, :token, :exp)');
$stmt->bindValue(':uid', $user['id'], PDO::PARAM_INT);
$stmt->bindValue(':token', $token, PDO::PARAM_STR);
$stmt->bindValue(':exp', $expiresAt, PDO::PARAM_STR);
$stmt->execute();


$resetUrl = "https://play.skorchthegame.com/forgot-password/?token=" . $token;
$subject = "Skorch - Reset Your Password";
$body = "Hey {$user['username']},\n\n";
$body .= "Someone requested a password reset for your Skorch account.\n\n";
$body .= "Click this link to reset your password:\n";
$body .= "{$resetUrl}\n\n";
$body .= "This link expires in 1 hour.\n\n";
$body .= "If you didn't request this, just ignore this email.\n\n";
$body .= "- Skorch";

$headers = "From: Skorch <noreply@skorchthegame.com>\r\n";
$headers .= "Reply-To: hello@skorchthegame.com\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$sent = mail($user['email'], $subject, $body, $headers);

jsonResponse(['success' => true, 'message' => 'If an account with that email exists, a reset link has been sent.']);
