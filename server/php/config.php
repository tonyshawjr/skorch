<?php
ini_set('display_errors', 0);
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Strict'
]);
session_start();

define('DB_PATH', __DIR__ . '/db/skorch.db');

function getDB() {
    $db = new SQLite3(DB_PATH);
    $db->busyTimeout(5000);
    $db->exec('PRAGMA journal_mode=WAL');
    $db->exec('PRAGMA foreign_keys=ON');
    return $db;
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
