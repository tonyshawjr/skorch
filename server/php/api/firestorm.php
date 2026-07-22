<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';

$userId = requireAuth();
$db = getDB();

function fsMyClan($db, $userId) {
    return $db->query("SELECT clan_id, role FROM clan_members WHERE user_id = $userId")->fetch() ?: null;
}

function fsClanInfo($db, $clanId) {
    $stmt = $db->prepare("SELECT id, name, tag, color, member_count, season_points, firestorm_wins, firestorm_losses FROM clans WHERE id = :id");
    $stmt->bindValue(':id', $clanId, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->fetch() ?: null;
}

function fsResolveLineup($db, $clanId, $usernames, $rosterSize) {
    if (!is_array($usernames)) return null;
    $seen = [];
    $lineup = [];
    $seed = 1;
    foreach ($usernames as $uname) {
        $uname = trim((string)$uname);
        if ($uname === '') return null;
        $stmt = $db->prepare("SELECT u.id FROM users u JOIN clan_members cm ON cm.user_id = u.id WHERE u.username = :u AND cm.clan_id = :c");
        $stmt->bindValue(':u', $uname, PDO::PARAM_STR);
        $stmt->bindValue(':c', $clanId, PDO::PARAM_INT);
        $stmt->execute();
        $row = $stmt->fetch();
        if (!$row) return null;
        if (isset($seen[$row['id']])) return null;
        $seen[$row['id']] = true;
        $lineup[] = ['seed' => $seed, 'user_id' => (int)$row['id']];
        $seed++;
    }
    if (count($lineup) !== (int)$rosterSize) return null;
    return $lineup;
}

function fsRecomputeScores($db, $firestormId) {
    $c = 0; $o = 0;
    $res = $db->query("SELECT fm.seed, fm.winner_user_id, fm.challenger_user_id, fm.opponent_user_id FROM firestorm_matches fm WHERE fm.firestorm_id = $firestormId AND fm.status = 'complete'");
    while ($r = $res->fetch()) {
        if ($r['winner_user_id'] === null) continue;
        if ((int)$r['winner_user_id'] === (int)$r['challenger_user_id']) $c++;
        elseif ((int)$r['winner_user_id'] === (int)$r['opponent_user_id']) $o++;
    }
    $db->exec("UPDATE firestorms SET challenger_score = $c, opponent_score = $o WHERE id = $firestormId");
    return ['c' => $c, 'o' => $o];
}

function fsFinalize($db, $firestormId) {
    $fs = $db->query("SELECT challenger_clan_id, opponent_clan_id, challenger_score, opponent_score, status FROM firestorms WHERE id = $firestormId")->fetch();
    if (!$fs || $fs['status'] === 'complete') return;
    $cc = (int)$fs['challenger_clan_id'];
    $oc = (int)$fs['opponent_clan_id'];
    $winner = null; $loser = null;
    if ((int)$fs['challenger_score'] > (int)$fs['opponent_score']) { $winner = $cc; $loser = $oc; }
    elseif ((int)$fs['opponent_score'] > (int)$fs['challenger_score']) { $winner = $oc; $loser = $cc; }
    $db->exec("UPDATE firestorms SET status = 'complete', winner_clan_id = " . ($winner === null ? 'NULL' : $winner) . " WHERE id = $firestormId");
    if ($winner !== null) {
        $db->exec("UPDATE clans SET firestorm_wins = firestorm_wins + 1, season_points = season_points + 25, total_points = total_points + 25 WHERE id = $winner");
        $db->exec("UPDATE clans SET firestorm_losses = firestorm_losses + 1 WHERE id = $loser");
    }
}

function fsFinalizeExpired($db) {
    $now = date('Y-m-d H:i:s');
    $res = $db->query("SELECT id FROM firestorms WHERE status = 'active' AND ends_at IS NOT NULL AND ends_at <= '$now'");
    $ids = [];
    while ($r = $res->fetch()) $ids[] = (int)$r['id'];
    foreach ($ids as $id) { fsRecomputeScores($db, $id); fsFinalize($db, $id); }
}

function fsMatchesFor($db, $firestormId) {
    $res = $db->query("
        SELECT fm.seed, fm.status, fm.winner_user_id, fm.room_code,
               fm.challenger_user_id, fm.opponent_user_id,
               cu.username as challenger_name, cu.avatar_color as challenger_color, cu.avatar_url as challenger_avatar,
               ou.username as opponent_name, ou.avatar_color as opponent_color, ou.avatar_url as opponent_avatar
        FROM firestorm_matches fm
        LEFT JOIN users cu ON fm.challenger_user_id = cu.id
        LEFT JOIN users ou ON fm.opponent_user_id = ou.id
        WHERE fm.firestorm_id = $firestormId ORDER BY fm.seed ASC
    ");
    $out = [];
    while ($r = $res->fetch()) $out[] = $r;
    return $out;
}

$action = $_GET['action'] ?? null;
$input = getInput();
if (!$action) $action = $input['action'] ?? null;

switch ($action) {

    case 'open':
        fsFinalizeExpired($db);
        $m = fsMyClan($db, $userId);
        $myClan = $m ? (int)$m['clan_id'] : 0;
        $res = $db->query("
            SELECT f.id, f.roster_size, f.created_at, c.id as clan_id, c.name, c.tag, c.color, c.member_count, c.firestorm_wins
            FROM firestorms f JOIN clans c ON f.challenger_clan_id = c.id
            WHERE f.status = 'open' AND f.challenger_clan_id != $myClan
            ORDER BY f.created_at DESC LIMIT 50
        ");
        $out = [];
        while ($r = $res->fetch()) $out[] = $r;
        jsonResponse(['firestorms' => $out]);
        break;

    case 'mine':
        fsFinalizeExpired($db);
        $m = fsMyClan($db, $userId);
        if (!$m) { jsonResponse(['firestorms' => [], 'clan' => null]); }
        $clanId = (int)$m['clan_id'];
        $res = $db->query("
            SELECT f.*, cc.name as challenger_name, cc.tag as challenger_tag, cc.color as challenger_color,
                   oc.name as opponent_name, oc.tag as opponent_tag, oc.color as opponent_color
            FROM firestorms f
            LEFT JOIN clans cc ON f.challenger_clan_id = cc.id
            LEFT JOIN clans oc ON f.opponent_clan_id = oc.id
            WHERE f.challenger_clan_id = $clanId OR f.opponent_clan_id = $clanId
            ORDER BY CASE f.status WHEN 'active' THEN 0 WHEN 'open' THEN 1 ELSE 2 END, f.created_at DESC LIMIT 20
        ");
        $out = [];
        while ($r = $res->fetch()) {
            $r['is_challenger'] = ((int)$r['challenger_clan_id'] === $clanId);
            $r['matches'] = fsMatchesFor($db, (int)$r['id']);
            $out[] = $r;
        }
        jsonResponse(['firestorms' => $out, 'my_clan_id' => $clanId, 'my_role' => $m['role']]);
        break;

    case 'get':
        fsFinalizeExpired($db);
        $id = (int)($_GET['id'] ?? 0);
        $fs = $db->query("SELECT * FROM firestorms WHERE id = $id")->fetch();
        if (!$fs) { jsonResponse(['error' => 'Firestorm not found'], 404); }
        $fs['challenger'] = fsClanInfo($db, (int)$fs['challenger_clan_id']);
        $fs['opponent'] = $fs['opponent_clan_id'] ? fsClanInfo($db, (int)$fs['opponent_clan_id']) : null;
        $fs['matches'] = fsMatchesFor($db, $id);
        jsonResponse(['firestorm' => $fs]);
        break;

    case 'create':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $m = fsMyClan($db, $userId);
        if (!$m || !in_array($m['role'], ['leader', 'officer'], true)) { jsonResponse(['error' => 'Only a leader or officer can start a Firestorm'], 403); }
        $clanId = (int)$m['clan_id'];
        $existing = $db->query("SELECT id FROM firestorms WHERE (challenger_clan_id = $clanId OR opponent_clan_id = $clanId) AND status IN ('open','active')")->fetchColumn();
        if ($existing) { jsonResponse(['error' => 'Your clan already has an active Firestorm'], 400); }
        $rosterSize = (int)($input['roster_size'] ?? 5);
        if ($rosterSize < 1 || $rosterSize > 10) { jsonResponse(['error' => 'Roster size must be 1-10'], 400); }
        $memberCount = (int)$db->query("SELECT member_count FROM clans WHERE id = $clanId")->fetchColumn();
        if ($memberCount < $rosterSize) { jsonResponse(['error' => 'Not enough members for that roster size'], 400); }
        $lineup = fsResolveLineup($db, $clanId, $input['lineup'] ?? [], $rosterSize);
        if (!$lineup) { jsonResponse(['error' => 'Invalid lineup — pick ' . $rosterSize . ' distinct clan members in seed order'], 400); }

        $stmt = $db->prepare("INSERT INTO firestorms (challenger_clan_id, roster_size, status) VALUES (:c, :r, 'open')");
        $stmt->bindValue(':c', $clanId, PDO::PARAM_INT);
        $stmt->bindValue(':r', $rosterSize, PDO::PARAM_INT);
        $stmt->execute();
        $fid = (int)$db->lastInsertId();
        foreach ($lineup as $slot) {
            $stmt = $db->prepare("INSERT INTO firestorm_lineups (firestorm_id, clan_id, user_id, seed) VALUES (:f, :c, :u, :s)");
            $stmt->bindValue(':f', $fid, PDO::PARAM_INT);
            $stmt->bindValue(':c', $clanId, PDO::PARAM_INT);
            $stmt->bindValue(':u', $slot['user_id'], PDO::PARAM_INT);
            $stmt->bindValue(':s', $slot['seed'], PDO::PARAM_INT);
            $stmt->execute();
        }
        jsonResponse(['success' => true, 'firestorm_id' => $fid]);
        break;

    case 'accept':
    case 'random':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $m = fsMyClan($db, $userId);
        if (!$m || !in_array($m['role'], ['leader', 'officer'], true)) { jsonResponse(['error' => 'Only a leader or officer can accept a Firestorm'], 403); }
        $clanId = (int)$m['clan_id'];
        $existing = $db->query("SELECT id FROM firestorms WHERE (challenger_clan_id = $clanId OR opponent_clan_id = $clanId) AND status IN ('open','active')")->fetchColumn();
        if ($existing) { jsonResponse(['error' => 'Your clan already has an active Firestorm'], 400); }
        $memberCount = (int)$db->query("SELECT member_count FROM clans WHERE id = $clanId")->fetchColumn();

        if ($action === 'random') {
            $wantSize = is_array($input['lineup'] ?? null) ? count($input['lineup']) : 0;
            if ($wantSize < 1 || $wantSize > 10) { jsonResponse(['error' => 'Invalid lineup'], 400); }
            if ($memberCount < $wantSize) { jsonResponse(['error' => 'Not enough members'], 400); }
            $fs = $db->query("
                SELECT id, roster_size FROM firestorms
                WHERE status = 'open' AND challenger_clan_id != $clanId AND roster_size = $wantSize
                ORDER BY ABS((SELECT member_count FROM clans WHERE id = firestorms.challenger_clan_id) - $memberCount) ASC, created_at ASC
                LIMIT 1")->fetch();
            if (!$fs) { jsonResponse(['error' => 'No open Firestorm of that size to match'], 404); }
            $fid = (int)$fs['id'];
            $rosterSize = (int)$fs['roster_size'];
        } else {
            $fid = (int)($input['firestorm_id'] ?? 0);
            $fs = $db->query("SELECT id, roster_size, status, challenger_clan_id FROM firestorms WHERE id = $fid")->fetch();
            if (!$fs || $fs['status'] !== 'open') { jsonResponse(['error' => 'Firestorm not available'], 404); }
            if ((int)$fs['challenger_clan_id'] === $clanId) { jsonResponse(['error' => 'You cannot accept your own Firestorm'], 400); }
            $rosterSize = (int)$fs['roster_size'];
        }
        if ($memberCount < $rosterSize) { jsonResponse(['error' => 'Not enough members for this roster size'], 400); }
        $lineup = fsResolveLineup($db, $clanId, $input['lineup'] ?? [], $rosterSize);
        if (!$lineup) { jsonResponse(['error' => 'Invalid lineup — pick ' . $rosterSize . ' distinct clan members in seed order'], 400); }

        $endsAt = date('Y-m-d H:i:s', time() + 86400);
        $db->beginTransaction();
        $affected = $db->exec("UPDATE firestorms SET opponent_clan_id = $clanId, status = 'active', started_at = NOW(), ends_at = '$endsAt' WHERE id = $fid AND status = 'open'");
        if ($affected === 0) { $db->rollBack(); jsonResponse(['error' => 'Firestorm was just taken'], 409); }
        foreach ($lineup as $slot) {
            $stmt = $db->prepare("INSERT INTO firestorm_lineups (firestorm_id, clan_id, user_id, seed) VALUES (:f, :c, :u, :s)");
            $stmt->bindValue(':f', $fid, PDO::PARAM_INT);
            $stmt->bindValue(':c', $clanId, PDO::PARAM_INT);
            $stmt->bindValue(':u', $slot['user_id'], PDO::PARAM_INT);
            $stmt->bindValue(':s', $slot['seed'], PDO::PARAM_INT);
            $stmt->execute();
        }
        for ($seed = 1; $seed <= $rosterSize; $seed++) {
            $cu = (int)$db->query("SELECT user_id FROM firestorm_lineups WHERE firestorm_id = $fid AND seed = $seed AND clan_id = (SELECT challenger_clan_id FROM firestorms WHERE id = $fid)")->fetchColumn();
            $ou = (int)$db->query("SELECT user_id FROM firestorm_lineups WHERE firestorm_id = $fid AND seed = $seed AND clan_id = $clanId")->fetchColumn();
            $stmt = $db->prepare("INSERT INTO firestorm_matches (firestorm_id, seed, challenger_user_id, opponent_user_id, status) VALUES (:f, :s, :cu, :ou, 'pending')");
            $stmt->bindValue(':f', $fid, PDO::PARAM_INT);
            $stmt->bindValue(':s', $seed, PDO::PARAM_INT);
            $stmt->bindValue(':cu', $cu, PDO::PARAM_INT);
            $stmt->bindValue(':ou', $ou, PDO::PARAM_INT);
            $stmt->execute();
        }
        $db->commit();
        jsonResponse(['success' => true, 'firestorm_id' => $fid]);
        break;

    case 'cancel':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $m = fsMyClan($db, $userId);
        if (!$m || !in_array($m['role'], ['leader', 'officer'], true)) { jsonResponse(['error' => 'Not authorized'], 403); }
        $fid = (int)($input['firestorm_id'] ?? 0);
        $fs = $db->query("SELECT challenger_clan_id, status FROM firestorms WHERE id = $fid")->fetch();
        if (!$fs || (int)$fs['challenger_clan_id'] !== (int)$m['clan_id'] || $fs['status'] !== 'open') { jsonResponse(['error' => 'Cannot cancel'], 400); }
        $db->exec("DELETE FROM firestorm_lineups WHERE firestorm_id = $fid");
        $db->exec("DELETE FROM firestorms WHERE id = $fid");
        jsonResponse(['success' => true]);
        break;

    case 'publish_room':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $fid = (int)($input['firestorm_id'] ?? 0);
        $seed = (int)($input['seed'] ?? 0);
        $roomCode = strtoupper(trim($input['room_code'] ?? ''));
        if (!preg_match('/^[A-Z0-9]{4}$/', $roomCode)) { jsonResponse(['error' => 'Invalid room code'], 400); }
        $fm = $db->query("SELECT challenger_user_id, opponent_user_id, status FROM firestorm_matches WHERE firestorm_id = $fid AND seed = $seed")->fetch();
        if (!$fm) { jsonResponse(['error' => 'Match not found'], 404); }
        if ((int)$fm['challenger_user_id'] !== $userId && (int)$fm['opponent_user_id'] !== $userId) { jsonResponse(['error' => 'Not your match'], 403); }
        $db->exec("UPDATE firestorm_matches SET room_code = '$roomCode' WHERE firestorm_id = $fid AND seed = $seed AND status != 'complete'");
        jsonResponse(['success' => true]);
        break;

    case 'get_room':
        $fid = (int)($_GET['firestorm_id'] ?? 0);
        $seed = (int)($_GET['seed'] ?? 0);
        $fm = $db->query("SELECT challenger_user_id, opponent_user_id, room_code, status FROM firestorm_matches WHERE firestorm_id = $fid AND seed = $seed")->fetch();
        if (!$fm) { jsonResponse(['error' => 'Match not found'], 404); }
        if ((int)$fm['challenger_user_id'] !== $userId && (int)$fm['opponent_user_id'] !== $userId) { jsonResponse(['error' => 'Not your match'], 403); }
        jsonResponse(['room_code' => $fm['room_code'], 'status' => $fm['status']]);
        break;

    case 'report':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $fid = (int)($input['firestorm_id'] ?? 0);
        $seed = (int)($input['seed'] ?? 0);
        $won = (bool)($input['won'] ?? false);
        $fs = $db->query("SELECT status FROM firestorms WHERE id = $fid")->fetch();
        if (!$fs || $fs['status'] !== 'active') { jsonResponse(['error' => 'Firestorm not active'], 400); }
        $fm = $db->query("SELECT challenger_user_id, opponent_user_id, status FROM firestorm_matches WHERE firestorm_id = $fid AND seed = $seed")->fetch();
        if (!$fm) { jsonResponse(['error' => 'Match not found'], 404); }
        $isChallenger = ((int)$fm['challenger_user_id'] === $userId);
        $isOpponent = ((int)$fm['opponent_user_id'] === $userId);
        if (!$isChallenger && !$isOpponent) { jsonResponse(['error' => 'Not your match'], 403); }
        if ($fm['status'] === 'complete') { jsonResponse(['success' => true, 'already' => true]); }
        $winnerId = $won ? $userId : ($isChallenger ? (int)$fm['opponent_user_id'] : (int)$fm['challenger_user_id']);
        $db->exec("UPDATE firestorm_matches SET status = 'complete', winner_user_id = $winnerId, played_at = NOW() WHERE firestorm_id = $fid AND seed = $seed AND status != 'complete'");
        fsRecomputeScores($db, $fid);
        $pending = (int)$db->query("SELECT COUNT(*) FROM firestorm_matches WHERE firestorm_id = $fid AND status != 'complete'")->fetchColumn();
        if ($pending === 0) { fsFinalize($db, $fid); }
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Invalid action'], 400);
}
