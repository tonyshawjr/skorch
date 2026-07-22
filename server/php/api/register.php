<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = getInput();
$username = trim($input['username'] ?? '');
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';
$firstName = trim($input['first_name'] ?? '');
$lastName = trim($input['last_name'] ?? '');
$birthday = trim($input['birthday'] ?? '');
$city = trim($input['city'] ?? '');
$stateRegion = trim($input['state_region'] ?? '');
$country = trim($input['country'] ?? '');

// Validation
if (strlen($username) < 3 || strlen($username) > 20) {
    jsonResponse(['error' => 'Username must be 3-20 characters'], 400);
}
if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
    jsonResponse(['error' => 'Username can only contain letters, numbers, and underscores'], 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['error' => 'Invalid email'], 400);
}
if (strlen($password) < 6) {
    jsonResponse(['error' => 'Password must be at least 6 characters'], 400);
}
if (!$firstName || !$lastName) {
    jsonResponse(['error' => 'First and last name required'], 400);
}
if (!$birthday || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $birthday)) {
    jsonResponse(['error' => 'Birthday required'], 400);
}
// Age check — must be 13+
$bday = new DateTime($birthday);
$now = new DateTime();
$age = $now->diff($bday)->y;
if ($age < 13) {
    jsonResponse(['error' => 'Must be 13 or older to play'], 400);
}
if (!$city || !$stateRegion || !$country) {
    jsonResponse(['error' => 'Location required'], 400);
}

$db = getDB();

// Check existing
$stmt = $db->prepare('SELECT id FROM users WHERE username = :u OR email = :e');
$stmt->bindValue(':u', $username, PDO::PARAM_STR);
$stmt->bindValue(':e', $email, PDO::PARAM_STR);
$stmt->execute();
if ($stmt->fetch()) {
    jsonResponse(['error' => 'Username or email already taken'], 409);
}

// Create user
$hash = password_hash($password, PASSWORD_BCRYPT);
$displayName = $firstName . ' ' . $lastName;
$stmt = $db->prepare('INSERT INTO users (username, email, password_hash, first_name, last_name, display_name, birthday, city, state_region, country, last_active) VALUES (:u, :e, :p, :fn, :ln, :dn, :bd, :ci, :sr, :co, NOW())');
$stmt->bindValue(':u', $username, PDO::PARAM_STR);
$stmt->bindValue(':e', $email, PDO::PARAM_STR);
$stmt->bindValue(':p', $hash, PDO::PARAM_STR);
$stmt->bindValue(':fn', $firstName, PDO::PARAM_STR);
$stmt->bindValue(':ln', $lastName, PDO::PARAM_STR);
$stmt->bindValue(':dn', $displayName, PDO::PARAM_STR);
$stmt->bindValue(':bd', $birthday, PDO::PARAM_STR);
$stmt->bindValue(':ci', $city, PDO::PARAM_STR);
$stmt->bindValue(':sr', $stateRegion, PDO::PARAM_STR);
$stmt->bindValue(':co', $country, PDO::PARAM_STR);
$stmt->execute();

$userId = (int)$db->lastInsertId();

// Create stats row
$db->exec("INSERT INTO stats (user_id) VALUES ($userId)");

// Auto-login
$_SESSION['user_id'] = $userId;
$_SESSION['username'] = $username;

jsonResponse(['success' => true, 'user' => ['id' => $userId, 'username' => $username]]);
