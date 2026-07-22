<?php
ini_set('display_errors', 0);
$sessionLifetime = 60 * 60 * 24 * 30;
ini_set('session.gc_maxlifetime', $sessionLifetime);
session_set_cookie_params([
    'lifetime' => $sessionLifetime,
    'path' => '/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Strict'
]);
session_start();
if (isset($_SESSION['user_id'])) {
    setcookie(session_name(), session_id(), [
        'expires' => time() + $sessionLifetime,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
}

function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        $s = require __DIR__ . '/db-secrets.php';
        $pdo = new PDO(
            "mysql:host={$s['host']};dbname={$s['db']};charset=utf8mb4",
            $s['user'],
            $s['pass'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => true,
            ]
        );
    }
    return $pdo;
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    header('Cache-Control: no-store, no-cache, must-revalidate, private');
    header('Pragma: no-cache');
    header('Expires: 0');
    header('Vary: Cookie');
    header('Access-Control-Allow-Origin: https://play.skorchthegame.com');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }
    echo json_encode($data);
    exit;
}

function getInput() {
    $input = json_decode(file_get_contents('php://input'), true);
    return $input ?: $_POST;
}

function clientIp() {
    $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
    if ($xff !== '') {
        $parts = explode(',', $xff);
        $ip = trim($parts[0]);
        if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function rateLimitHit($db, $bucket, $max, $windowSeconds) {
    $w = (int)$windowSeconds;
    $db->exec("DELETE FROM rate_events WHERE created_at < (NOW() - INTERVAL 86400 SECOND)");
    $stmt = $db->prepare("SELECT COUNT(*) FROM rate_events WHERE bucket = :b AND created_at > (NOW() - INTERVAL $w SECOND)");
    $stmt->bindValue(':b', $bucket, PDO::PARAM_STR);
    $stmt->execute();
    $count = (int)$stmt->fetchColumn();
    $ins = $db->prepare("INSERT INTO rate_events (bucket) VALUES (:b)");
    $ins->bindValue(':b', $bucket, PDO::PARAM_STR);
    $ins->execute();
    return $count >= $max;
}
