<?php
require_once __DIR__ . '/../config.php';

$action = $_GET['action'] ?? '';
$db = getDB();

switch ($action) {
    case 'all':
        // Return all badge definitions
        $result = $db->query("SELECT id, name, description, category, xp_reward, icon FROM badges ORDER BY category, xp_reward");
        $badges = [];
        while ($row = $result->fetch()) {
            $badges[] = $row;
        }
        jsonResponse(['badges' => $badges]);
        break;

    case 'user':
        $username = $_GET['username'] ?? '';
        if (!$username) {
            jsonResponse(['error' => 'Username required'], 400);
        }

        // Look up user
        $stmt = $db->prepare("SELECT id FROM users WHERE username = :name");
        $stmt->bindValue(':name', $username, PDO::PARAM_STR);
        $stmt->execute();
        $user = $stmt->fetch();

        if (!$user) {
            jsonResponse(['error' => 'User not found'], 404);
        }

        // Get earned badges with definitions
        $stmt = $db->prepare("
            SELECT b.id, b.name, b.description, b.category, b.xp_reward, b.icon, ub.earned_at
            FROM user_badges ub
            JOIN badges b ON b.id = ub.badge_id
            WHERE ub.user_id = :uid
            ORDER BY ub.earned_at DESC
        ");
        $stmt->bindValue(':uid', $user['id'], PDO::PARAM_INT);
        $stmt->execute();

        $badges = [];
        while ($row = $stmt->fetch()) {
            $badges[] = $row;
        }
        jsonResponse(['badges' => $badges, 'count' => count($badges)]);
        break;

    case 'count':
        $username = $_GET['username'] ?? '';
        if (!$username) {
            jsonResponse(['error' => 'Username required'], 400);
        }

        $stmt = $db->prepare("SELECT id FROM users WHERE username = :name");
        $stmt->bindValue(':name', $username, PDO::PARAM_STR);
        $stmt->execute();
        $user = $stmt->fetch();

        if (!$user) {
            jsonResponse(['error' => 'User not found'], 404);
        }

        $count = $db->query("SELECT COUNT(*) FROM user_badges WHERE user_id = " . $user['id'])->fetchColumn();
        jsonResponse(['count' => $count ?: 0]);
        break;

    default:
        jsonResponse(['error' => 'Invalid action. Use: all, user, count'], 400);
}
