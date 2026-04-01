<?php
function requireAuth() {
    if (!isset($_SESSION['user_id'])) {
        jsonResponse(['error' => 'Not authenticated'], 401);
    }
    return $_SESSION['user_id'];
}

function getCurrentUser() {
    return $_SESSION['user_id'] ?? null;
}
