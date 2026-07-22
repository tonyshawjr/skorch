<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';

$userId = requireAuth();
$db = getDB();

$action = $_GET['action'] ?? ($_POST['action'] ?? null);
$input = getInput();
if (!$action && $input) $action = $input['action'] ?? null;

switch ($action) {

    case 'list':
        $stmt = $db->prepare("
            SELECT u.id, u.username, COALESCE(u.display_name, u.username) as display_name, u.avatar_color, u.avatar_url, u.last_active, s.elo_rating, s.wins,
                (SELECT COUNT(*) FROM matches WHERE
                    ((player1_id = :me AND player2_id = u.id) OR (player1_id = u.id AND player2_id = :me2))
                ) as games_together
            FROM friends f
            JOIN users u ON (f.friend_id = u.id AND f.user_id = :me3) OR (f.user_id = u.id AND f.friend_id = :me4)
            LEFT JOIN stats s ON u.id = s.user_id
            WHERE f.status = 'accepted' AND u.id != :me5
            ORDER BY games_together DESC
        ");
        $stmt->bindValue(':me', $userId, PDO::PARAM_INT);
        $stmt->bindValue(':me2', $userId, PDO::PARAM_INT);
        $stmt->bindValue(':me3', $userId, PDO::PARAM_INT);
        $stmt->bindValue(':me4', $userId, PDO::PARAM_INT);
        $stmt->bindValue(':me5', $userId, PDO::PARAM_INT);
        $stmt->execute();
        $friends = [];
        while ($row = $stmt->fetch()) {
            $friends[] = $row;
        }
        jsonResponse(['friends' => $friends, 'count' => count($friends)]);
        break;

    case 'requests':
        $stmt = $db->prepare("
            SELECT f.id as request_id, u.id as user_id, u.username, COALESCE(u.display_name, u.username) as display_name, u.avatar_color, u.avatar_url, f.created_at
            FROM friends f
            JOIN users u ON f.user_id = u.id
            WHERE f.friend_id = :me AND f.status = 'pending'
            ORDER BY f.created_at DESC
        ");
        $stmt->bindValue(':me', $userId, PDO::PARAM_INT);
        $stmt->execute();
        $requests = [];
        while ($row = $stmt->fetch()) {
            $requests[] = $row;
        }
        jsonResponse(['requests' => $requests, 'count' => count($requests)]);
        break;

    case 'send':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $targetUsername = $input['username'] ?? null;
        if (!$targetUsername) { jsonResponse(['error' => 'Username required'], 400); }

        $stmt = $db->prepare('SELECT id FROM users WHERE username = :u');
        $stmt->bindValue(':u', $targetUsername, PDO::PARAM_STR);
        $stmt->execute();
        $target = $stmt->fetch();
        if (!$target) { jsonResponse(['error' => 'Player not found'], 404); }
        $targetId = $target['id'];

        if ($targetId == $userId) { jsonResponse(['error' => 'Cannot add yourself'], 400); }

        $stmt = $db->prepare("SELECT status FROM friends WHERE (user_id = :a AND friend_id = :b) OR (user_id = :c AND friend_id = :d)");
        $stmt->bindValue(':a', $userId, PDO::PARAM_INT);
        $stmt->bindValue(':b', $targetId, PDO::PARAM_INT);
        $stmt->bindValue(':c', $targetId, PDO::PARAM_INT);
        $stmt->bindValue(':d', $userId, PDO::PARAM_INT);
        $stmt->execute();
        $existing = $stmt->fetch();

        if ($existing) {
            if ($existing['status'] === 'accepted') { jsonResponse(['error' => 'Already friends']); }
            if ($existing['status'] === 'pending') { jsonResponse(['error' => 'Request already pending']); }
            if ($existing['status'] === 'blocked') { jsonResponse(['error' => 'Cannot send request']); }
        }

        $stmt = $db->prepare("INSERT INTO friends (user_id, friend_id, status) VALUES (:me, :them, 'pending')");
        $stmt->bindValue(':me', $userId, PDO::PARAM_INT);
        $stmt->bindValue(':them', $targetId, PDO::PARAM_INT);
        $stmt->execute();

        jsonResponse(['success' => true, 'message' => 'Friend request sent']);
        break;

    case 'accept':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $requestId = (int)($input['request_id'] ?? 0);
        if (!$requestId) { jsonResponse(['error' => 'Request ID required'], 400); }

        $stmt = $db->prepare("UPDATE friends SET status = 'accepted' WHERE id = :id AND friend_id = :me AND status = 'pending'");
        $stmt->bindValue(':id', $requestId, PDO::PARAM_INT);
        $stmt->bindValue(':me', $userId, PDO::PARAM_INT);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            jsonResponse(['success' => true]);
        } else {
            jsonResponse(['error' => 'Request not found'], 404);
        }
        break;

    case 'decline':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $requestId = (int)($input['request_id'] ?? 0);

        $stmt = $db->prepare("DELETE FROM friends WHERE id = :id AND friend_id = :me AND status = 'pending'");
        $stmt->bindValue(':id', $requestId, PDO::PARAM_INT);
        $stmt->bindValue(':me', $userId, PDO::PARAM_INT);
        $stmt->execute();

        jsonResponse(['success' => true]);
        break;

    case 'remove':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $targetUsername = $input['username'] ?? null;
        if (!$targetUsername) { jsonResponse(['error' => 'Username required'], 400); }

        $stmt = $db->prepare('SELECT id FROM users WHERE username = :u');
        $stmt->bindValue(':u', $targetUsername, PDO::PARAM_STR);
        $stmt->execute();
        $target = $stmt->fetch();
        if (!$target) { jsonResponse(['error' => 'Player not found'], 404); }
        $targetId = $target['id'];

        $stmt = $db->prepare("DELETE FROM friends WHERE (user_id = :a AND friend_id = :b) OR (user_id = :c AND friend_id = :d)");
        $stmt->bindValue(':a', $userId, PDO::PARAM_INT);
        $stmt->bindValue(':b', $targetId, PDO::PARAM_INT);
        $stmt->bindValue(':c', $targetId, PDO::PARAM_INT);
        $stmt->bindValue(':d', $userId, PDO::PARAM_INT);
        $stmt->execute();

        jsonResponse(['success' => true]);
        break;

    case 'status':
        $targetUsername = $_GET['username'] ?? null;
        if (!$targetUsername) { jsonResponse(['status' => 'none']); }

        $stmt = $db->prepare('SELECT id FROM users WHERE username = :u');
        $stmt->bindValue(':u', $targetUsername, PDO::PARAM_STR);
        $stmt->execute();
        $target = $stmt->fetch();
        if (!$target) { jsonResponse(['status' => 'none']); }
        $targetId = $target['id'];

        $stmt = $db->prepare("SELECT id, user_id, friend_id, status FROM friends WHERE (user_id = :a AND friend_id = :b) OR (user_id = :c AND friend_id = :d)");
        $stmt->bindValue(':a', $userId, PDO::PARAM_INT);
        $stmt->bindValue(':b', $targetId, PDO::PARAM_INT);
        $stmt->bindValue(':c', $targetId, PDO::PARAM_INT);
        $stmt->bindValue(':d', $userId, PDO::PARAM_INT);
        $stmt->execute();
        $row = $stmt->fetch();

        if (!$row) { jsonResponse(['status' => 'none']); }
        if ($row['status'] === 'accepted') { jsonResponse(['status' => 'friends']); }
        if ($row['status'] === 'pending' && $row['user_id'] == $userId) { jsonResponse(['status' => 'pending_sent']); }
        if ($row['status'] === 'pending' && $row['friend_id'] == $userId) { jsonResponse(['status' => 'pending_received', 'request_id' => $row['id'] ?? null]); }
        jsonResponse(['status' => $row['status']]);
        break;

    default:
        jsonResponse(['error' => 'Invalid action'], 400);
}
