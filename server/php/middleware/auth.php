<?php
function requireAuth() {
    if (!isset($_SESSION['user_id'])) {
        jsonResponse(['error' => 'Not authenticated'], 401);
    }
    $uid = (int)$_SESSION['user_id'];
    $db = getDB();
    $tv = $db->query("SELECT token_version FROM users WHERE id = $uid")->fetchColumn();
    if ($tv === false || (int)$tv !== (int)($_SESSION['token_version'] ?? -1)) {
        jsonResponse(['error' => 'Not authenticated'], 401);
    }
    $db->exec("UPDATE users SET last_active = NOW() WHERE id = $uid");
    return $uid;
}

function getCurrentUser() {
    return $_SESSION['user_id'] ?? null;
}
