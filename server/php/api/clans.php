<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';

$userId = requireAuth();
$db = getDB();

define('CLAN_MAX_MEMBERS', 20);

function myMembership($db, $userId) {
    $row = $db->query("SELECT clan_id, role FROM clan_members WHERE user_id = $userId")->fetch();
    return $row ?: null;
}

function clanById($db, $clanId) {
    $stmt = $db->prepare("SELECT * FROM clans WHERE id = :id");
    $stmt->bindValue(':id', $clanId, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->fetch() ?: null;
}

function clanMembers($db, $clanId) {
    $stmt = $db->prepare("
        SELECT u.username, COALESCE(u.display_name, u.username) as display_name, u.avatar_color, u.avatar_url, u.last_active,
               cm.role, cm.season_points, cm.total_points, cm.joined_at, s.elo_rating
        FROM clan_members cm
        JOIN users u ON cm.user_id = u.id
        LEFT JOIN stats s ON u.id = s.user_id
        WHERE cm.clan_id = :id
        ORDER BY CASE cm.role WHEN 'leader' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END, cm.season_points DESC
    ");
    $stmt->bindValue(':id', $clanId, PDO::PARAM_INT);
    $stmt->execute();
    $out = [];
    while ($r = $stmt->fetch()) $out[] = $r;
    return $out;
}

$action = $_GET['action'] ?? null;
$input = getInput();
if (!$action) $action = $input['action'] ?? null;

switch ($action) {

    case 'list':
        $res = $db->query("
            SELECT c.id, c.name, c.tag, c.color, c.emblem, c.member_count, c.season_points, c.total_points, c.firestorm_wins, c.firestorm_losses,
                   u.username as founder
            FROM clans c LEFT JOIN users u ON c.founder_id = u.id
            ORDER BY c.season_points DESC, c.member_count DESC, c.total_points DESC
            LIMIT 100
        ");
        $clans = [];
        $rank = 0;
        while ($r = $res->fetch()) { $r['rank'] = ++$rank; $clans[] = $r; }
        jsonResponse(['clans' => $clans]);
        break;

    case 'mine':
        $m = myMembership($db, $userId);
        if (!$m) { jsonResponse(['clan' => null]); }
        $clan = clanById($db, (int)$m['clan_id']);
        if (!$clan) { jsonResponse(['clan' => null]); }
        $clan['members'] = clanMembers($db, (int)$m['clan_id']);
        $clan['my_role'] = $m['role'];
        $clan['pending_count'] = (int)$db->query("SELECT COUNT(*) FROM clan_requests WHERE clan_id = " . (int)$m['clan_id'])->fetchColumn();
        jsonResponse(['clan' => $clan]);
        break;

    case 'get':
        $clanId = (int)($_GET['id'] ?? 0);
        if (!$clanId) { jsonResponse(['error' => 'Clan ID required'], 400); }
        $clan = clanById($db, $clanId);
        if (!$clan) { jsonResponse(['error' => 'Clan not found'], 404); }
        $clan['members'] = clanMembers($db, $clanId);
        $m = myMembership($db, $userId);
        if ($m && (int)$m['clan_id'] === $clanId) {
            $clan['relation'] = 'member';
            $clan['my_role'] = $m['role'];
        } elseif ($m) {
            $clan['relation'] = 'in_other_clan';
        } else {
            $requested = $db->query("SELECT 1 FROM clan_requests WHERE clan_id = $clanId AND user_id = $userId")->fetchColumn();
            $clan['relation'] = $requested ? 'requested' : 'can_join';
        }
        jsonResponse(['clan' => $clan]);
        break;

    case 'create':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        if (myMembership($db, $userId)) { jsonResponse(['error' => 'You are already in a clan'], 400); }
        $name = trim($input['name'] ?? '');
        $tag = strtoupper(trim($input['tag'] ?? ''));
        $description = trim($input['description'] ?? '');
        $color = trim($input['color'] ?? '#b11f24');
        $isOpen = isset($input['is_open']) ? (int)(bool)$input['is_open'] : 1;
        if (strlen($name) < 3 || strlen($name) > 24) { jsonResponse(['error' => 'Name must be 3-24 characters'], 400); }
        if (strlen($tag) > 5) { jsonResponse(['error' => 'Tag must be 5 characters or fewer'], 400); }
        if (strlen($description) > 200) { $description = substr($description, 0, 200); }
        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) { $color = '#b11f24'; }

        $exists = $db->prepare("SELECT 1 FROM clans WHERE name = :n");
        $exists->bindValue(':n', $name, PDO::PARAM_STR);
        $exists->execute();
        if ($exists->fetch()) { jsonResponse(['error' => 'That clan name is taken'], 409); }

        $stmt = $db->prepare("INSERT INTO clans (name, tag, description, color, founder_id, is_open, member_count) VALUES (:n, :t, :d, :c, :f, :o, 1)");
        $stmt->bindValue(':n', $name, PDO::PARAM_STR);
        $stmt->bindValue(':t', $tag, PDO::PARAM_STR);
        $stmt->bindValue(':d', $description, PDO::PARAM_STR);
        $stmt->bindValue(':c', $color, PDO::PARAM_STR);
        $stmt->bindValue(':f', $userId, PDO::PARAM_INT);
        $stmt->bindValue(':o', $isOpen, PDO::PARAM_INT);
        $stmt->execute();
        $clanId = (int)$db->lastInsertId();

        $stmt = $db->prepare("INSERT INTO clan_members (clan_id, user_id, role) VALUES (:c, :u, 'leader')");
        $stmt->bindValue(':c', $clanId, PDO::PARAM_INT);
        $stmt->bindValue(':u', $userId, PDO::PARAM_INT);
        $stmt->execute();

        jsonResponse(['success' => true, 'clan_id' => $clanId]);
        break;

    case 'join':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        if (myMembership($db, $userId)) { jsonResponse(['error' => 'You are already in a clan'], 400); }
        $clanId = (int)($input['clan_id'] ?? 0);
        $clan = clanById($db, $clanId);
        if (!$clan) { jsonResponse(['error' => 'Clan not found'], 404); }
        if ((int)$clan['member_count'] >= CLAN_MAX_MEMBERS) { jsonResponse(['error' => 'That clan is full'], 400); }

        if ((int)$clan['is_open'] === 1) {
            $stmt = $db->prepare("INSERT INTO clan_members (clan_id, user_id, role) VALUES (:c, :u, 'member')");
            $stmt->bindValue(':c', $clanId, PDO::PARAM_INT);
            $stmt->bindValue(':u', $userId, PDO::PARAM_INT);
            $stmt->execute();
            $db->exec("UPDATE clans SET member_count = member_count + 1 WHERE id = $clanId");
            $db->exec("DELETE FROM clan_requests WHERE user_id = $userId");
            jsonResponse(['success' => true, 'joined' => true]);
        } else {
            $stmt = $db->prepare("INSERT IGNORE INTO clan_requests (clan_id, user_id) VALUES (:c, :u)");
            $stmt->bindValue(':c', $clanId, PDO::PARAM_INT);
            $stmt->bindValue(':u', $userId, PDO::PARAM_INT);
            $stmt->execute();
            jsonResponse(['success' => true, 'requested' => true]);
        }
        break;

    case 'requests':
        $m = myMembership($db, $userId);
        if (!$m || !in_array($m['role'], ['leader', 'officer'], true)) { jsonResponse(['requests' => []]); }
        $stmt = $db->prepare("
            SELECT cr.id as request_id, u.username, COALESCE(u.display_name, u.username) as display_name, u.avatar_color, u.avatar_url, s.elo_rating, cr.created_at
            FROM clan_requests cr
            JOIN users u ON cr.user_id = u.id
            LEFT JOIN stats s ON u.id = s.user_id
            WHERE cr.clan_id = :c
            ORDER BY cr.created_at DESC
        ");
        $stmt->bindValue(':c', (int)$m['clan_id'], PDO::PARAM_INT);
        $stmt->execute();
        $out = [];
        while ($r = $stmt->fetch()) $out[] = $r;
        jsonResponse(['requests' => $out]);
        break;

    case 'approve':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $m = myMembership($db, $userId);
        if (!$m || !in_array($m['role'], ['leader', 'officer'], true)) { jsonResponse(['error' => 'Not authorized'], 403); }
        $requestId = (int)($input['request_id'] ?? 0);
        $req = $db->query("SELECT user_id, clan_id FROM clan_requests WHERE id = $requestId")->fetch();
        if (!$req || (int)$req['clan_id'] !== (int)$m['clan_id']) { jsonResponse(['error' => 'Request not found'], 404); }
        $targetId = (int)$req['user_id'];
        if ($db->query("SELECT 1 FROM clan_members WHERE user_id = $targetId")->fetchColumn()) {
            $db->exec("DELETE FROM clan_requests WHERE id = $requestId");
            jsonResponse(['error' => 'Player already joined a clan'], 400);
        }
        $clan = clanById($db, (int)$m['clan_id']);
        if ((int)$clan['member_count'] >= CLAN_MAX_MEMBERS) { jsonResponse(['error' => 'Clan is full'], 400); }
        $stmt = $db->prepare("INSERT INTO clan_members (clan_id, user_id, role) VALUES (:c, :u, 'member')");
        $stmt->bindValue(':c', (int)$m['clan_id'], PDO::PARAM_INT);
        $stmt->bindValue(':u', $targetId, PDO::PARAM_INT);
        $stmt->execute();
        $db->exec("UPDATE clans SET member_count = member_count + 1 WHERE id = " . (int)$m['clan_id']);
        $db->exec("DELETE FROM clan_requests WHERE user_id = $targetId");
        jsonResponse(['success' => true]);
        break;

    case 'decline':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $m = myMembership($db, $userId);
        if (!$m || !in_array($m['role'], ['leader', 'officer'], true)) { jsonResponse(['error' => 'Not authorized'], 403); }
        $requestId = (int)($input['request_id'] ?? 0);
        $db->exec("DELETE FROM clan_requests WHERE id = $requestId AND clan_id = " . (int)$m['clan_id']);
        jsonResponse(['success' => true]);
        break;

    case 'leave':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $m = myMembership($db, $userId);
        if (!$m) { jsonResponse(['error' => 'You are not in a clan'], 400); }
        $clanId = (int)$m['clan_id'];
        $db->exec("DELETE FROM clan_members WHERE user_id = $userId");
        $remaining = (int)$db->query("SELECT COUNT(*) FROM clan_members WHERE clan_id = $clanId")->fetchColumn();
        if ($remaining === 0) {
            $db->exec("DELETE FROM clan_requests WHERE clan_id = $clanId");
            $db->exec("DELETE FROM clans WHERE id = $clanId");
        } else {
            $db->exec("UPDATE clans SET member_count = $remaining WHERE id = $clanId");
            if ($m['role'] === 'leader') {
                $successor = $db->query("SELECT user_id FROM clan_members WHERE clan_id = $clanId ORDER BY CASE role WHEN 'officer' THEN 0 ELSE 1 END, joined_at ASC LIMIT 1")->fetchColumn();
                if ($successor) { $db->exec("UPDATE clan_members SET role = 'leader' WHERE user_id = " . (int)$successor); }
            }
        }
        jsonResponse(['success' => true]);
        break;

    case 'kick':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $m = myMembership($db, $userId);
        if (!$m || !in_array($m['role'], ['leader', 'officer'], true)) { jsonResponse(['error' => 'Not authorized'], 403); }
        $targetUsername = $input['username'] ?? '';
        $stmt = $db->prepare("SELECT id FROM users WHERE username = :u");
        $stmt->bindValue(':u', $targetUsername, PDO::PARAM_STR);
        $stmt->execute();
        $target = $stmt->fetch();
        if (!$target) { jsonResponse(['error' => 'Player not found'], 404); }
        $targetId = (int)$target['id'];
        $tm = $db->query("SELECT clan_id, role FROM clan_members WHERE user_id = $targetId")->fetch();
        if (!$tm || (int)$tm['clan_id'] !== (int)$m['clan_id']) { jsonResponse(['error' => 'Not in your clan'], 400); }
        if ($tm['role'] === 'leader') { jsonResponse(['error' => 'Cannot remove the leader'], 400); }
        if ($m['role'] === 'officer' && $tm['role'] === 'officer') { jsonResponse(['error' => 'Officers cannot remove officers'], 400); }
        $db->exec("DELETE FROM clan_members WHERE user_id = $targetId");
        $db->exec("UPDATE clans SET member_count = member_count - 1 WHERE id = " . (int)$m['clan_id']);
        jsonResponse(['success' => true]);
        break;

    case 'promote':
    case 'demote':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $m = myMembership($db, $userId);
        if (!$m || $m['role'] !== 'leader') { jsonResponse(['error' => 'Only the leader can change roles'], 403); }
        $targetUsername = $input['username'] ?? '';
        $stmt = $db->prepare("SELECT id FROM users WHERE username = :u");
        $stmt->bindValue(':u', $targetUsername, PDO::PARAM_STR);
        $stmt->execute();
        $target = $stmt->fetch();
        if (!$target) { jsonResponse(['error' => 'Player not found'], 404); }
        $targetId = (int)$target['id'];
        $tm = $db->query("SELECT clan_id FROM clan_members WHERE user_id = $targetId")->fetch();
        if (!$tm || (int)$tm['clan_id'] !== (int)$m['clan_id']) { jsonResponse(['error' => 'Not in your clan'], 400); }
        $newRole = $action === 'promote' ? 'officer' : 'member';
        $db->exec("UPDATE clan_members SET role = '$newRole' WHERE user_id = $targetId");
        jsonResponse(['success' => true]);
        break;

    case 'update':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $m = myMembership($db, $userId);
        if (!$m || $m['role'] !== 'leader') { jsonResponse(['error' => 'Only the leader can edit the clan'], 403); }
        $description = trim($input['description'] ?? '');
        if (strlen($description) > 200) { $description = substr($description, 0, 200); }
        $color = trim($input['color'] ?? '#b11f24');
        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) { $color = '#b11f24'; }
        $isOpen = isset($input['is_open']) ? (int)(bool)$input['is_open'] : 1;
        $stmt = $db->prepare("UPDATE clans SET description = :d, color = :c, is_open = :o WHERE id = :id");
        $stmt->bindValue(':d', $description, PDO::PARAM_STR);
        $stmt->bindValue(':c', $color, PDO::PARAM_STR);
        $stmt->bindValue(':o', $isOpen, PDO::PARAM_INT);
        $stmt->bindValue(':id', (int)$m['clan_id'], PDO::PARAM_INT);
        $stmt->execute();
        jsonResponse(['success' => true]);
        break;

    case 'disband':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $m = myMembership($db, $userId);
        if (!$m || $m['role'] !== 'leader') { jsonResponse(['error' => 'Only the leader can disband'], 403); }
        $clanId = (int)$m['clan_id'];
        $db->exec("DELETE FROM clan_members WHERE clan_id = $clanId");
        $db->exec("DELETE FROM clan_requests WHERE clan_id = $clanId");
        $db->exec("DELETE FROM clans WHERE id = $clanId");
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Invalid action'], 400);
}
