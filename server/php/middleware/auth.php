<?php
function requireAuth() {
    if (!isset($_SESSION['user_id'])) {
        jsonResponse(['error' => 'Not authenticated'], 401);
    }
    $uid = (int)$_SESSION['user_id'];
    getDB()->exec("UPDATE users SET last_active = NOW() WHERE id = $uid");
    return $uid;
}

function getCurrentUser() {
    return $_SESSION['user_id'] ?? null;
}
