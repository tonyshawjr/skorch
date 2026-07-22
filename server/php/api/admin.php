<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';

$userId = requireAuth();
$db = getDB();
$isAdmin = (int)$db->query("SELECT is_admin FROM users WHERE id = $userId")->fetchColumn();

$action = $_GET['action'] ?? null;
$input = getInput();
if (!$action) $action = $input['action'] ?? null;

if ($action === 'check') { jsonResponse(['is_admin' => (bool)$isAdmin]); }
if (!$isAdmin) { jsonResponse(['error' => 'Not authorized'], 403); }

switch ($action) {

    case 'stats':
        jsonResponse([
            'users' => (int)$db->query("SELECT COUNT(*) FROM users")->fetchColumn(),
            'clans' => (int)$db->query("SELECT COUNT(*) FROM clans")->fetchColumn(),
            'active_firestorms' => (int)$db->query("SELECT COUNT(*) FROM firestorms WHERE status = 'active'")->fetchColumn(),
            'new_bugs' => (int)$db->query("SELECT COUNT(*) FROM bug_reports WHERE status = 'new'")->fetchColumn(),
        ]);
        break;

    case 'users':
        $res = $db->query("SELECT u.id, u.username, u.email, u.created_at, u.last_active, u.is_admin, s.elo_rating, s.games_played FROM users u LEFT JOIN stats s ON u.id = s.user_id ORDER BY u.created_at DESC LIMIT 300");
        $out = [];
        while ($r = $res->fetch()) $out[] = $r;
        jsonResponse(['users' => $out]);
        break;

    case 'clans':
        $res = $db->query("SELECT c.id, c.name, c.tag, c.member_count, c.season_points, c.total_points, c.firestorm_wins, c.firestorm_losses, u.username as founder FROM clans c LEFT JOIN users u ON c.founder_id = u.id ORDER BY c.season_points DESC");
        $out = [];
        while ($r = $res->fetch()) $out[] = $r;
        jsonResponse(['clans' => $out]);
        break;

    case 'rename_clan':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $cid = (int)($input['clan_id'] ?? 0);
        $name = trim($input['name'] ?? '');
        if (strlen($name) < 3 || strlen($name) > 24) { jsonResponse(['error' => 'Name must be 3-24 characters'], 400); }
        $dup = $db->prepare("SELECT 1 FROM clans WHERE name = :n AND id != :id");
        $dup->bindValue(':n', $name, PDO::PARAM_STR);
        $dup->bindValue(':id', $cid, PDO::PARAM_INT);
        $dup->execute();
        if ($dup->fetch()) { jsonResponse(['error' => 'Name already taken'], 409); }
        $stmt = $db->prepare("UPDATE clans SET name = :n WHERE id = :id");
        $stmt->bindValue(':n', $name, PDO::PARAM_STR);
        $stmt->bindValue(':id', $cid, PDO::PARAM_INT);
        $stmt->execute();
        jsonResponse(['success' => true]);
        break;

    case 'delete_clan':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $cid = (int)($input['clan_id'] ?? 0);
        $res = $db->query("SELECT id FROM firestorms WHERE challenger_clan_id = $cid OR opponent_clan_id = $cid");
        while ($r = $res->fetch()) {
            $fid = (int)$r['id'];
            $db->exec("DELETE FROM firestorm_lineups WHERE firestorm_id = $fid");
            $db->exec("DELETE FROM firestorm_matches WHERE firestorm_id = $fid");
        }
        $db->exec("DELETE FROM firestorms WHERE challenger_clan_id = $cid OR opponent_clan_id = $cid");
        $db->exec("DELETE FROM clan_members WHERE clan_id = $cid");
        $db->exec("DELETE FROM clan_requests WHERE clan_id = $cid");
        $db->exec("DELETE FROM clans WHERE id = $cid");
        jsonResponse(['success' => true]);
        break;

    case 'bug_reports':
        $res = $db->query("SELECT b.id, b.message, b.page_url, b.screenshot_url, b.status, b.created_at, u.username FROM bug_reports b LEFT JOIN users u ON b.user_id = u.id ORDER BY CASE b.status WHEN 'new' THEN 0 ELSE 1 END, b.created_at DESC LIMIT 200");
        $out = [];
        while ($r = $res->fetch()) $out[] = $r;
        jsonResponse(['bugs' => $out]);
        break;

    case 'resolve_bug':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $id = (int)($input['bug_id'] ?? 0);
        $status = ($input['status'] ?? 'resolved') === 'new' ? 'new' : 'resolved';
        $db->exec("UPDATE bug_reports SET status = '$status' WHERE id = $id");
        jsonResponse(['success' => true]);
        break;

    case 'season_current':
        $s = $db->query("SELECT * FROM seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1")->fetch();
        $champ = null;
        $last = $db->query("SELECT s.name, s.ended_at, c.name as clan_name FROM seasons s LEFT JOIN clans c ON s.champion_clan_id = c.id WHERE s.status = 'ended' AND s.champion_clan_id IS NOT NULL ORDER BY s.id DESC LIMIT 1")->fetch();
        jsonResponse(['season' => $s ?: null, 'last_champion' => $last ?: null]);
        break;

    case 'season_start':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        if ($db->query("SELECT 1 FROM seasons WHERE status = 'active'")->fetchColumn()) { jsonResponse(['error' => 'A season is already active'], 400); }
        $count = (int)$db->query("SELECT COUNT(*) FROM seasons")->fetchColumn();
        $name = trim($input['name'] ?? '');
        if ($name === '') { $name = 'Season ' . ($count + 1); }
        $stmt = $db->prepare("INSERT INTO seasons (name, status) VALUES (:n, 'active')");
        $stmt->bindValue(':n', $name, PDO::PARAM_STR);
        $stmt->execute();
        jsonResponse(['success' => true]);
        break;

    case 'season_end':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $season = $db->query("SELECT id FROM seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1")->fetch();
        if (!$season) { jsonResponse(['error' => 'No active season'], 400); }
        $sid = (int)$season['id'];
        $champion = null;
        $rank = 0;
        $db->beginTransaction();
        $res = $db->query("SELECT id, season_points FROM clans ORDER BY season_points DESC, member_count DESC");
        while ($r = $res->fetch()) {
            $rank++;
            $stmt = $db->prepare("INSERT INTO clan_season_history (season_id, clan_id, final_points, final_rank) VALUES (:s, :c, :p, :r)");
            $stmt->bindValue(':s', $sid, PDO::PARAM_INT);
            $stmt->bindValue(':c', (int)$r['id'], PDO::PARAM_INT);
            $stmt->bindValue(':p', (int)$r['season_points'], PDO::PARAM_INT);
            $stmt->bindValue(':r', $rank, PDO::PARAM_INT);
            $stmt->execute();
            if ($rank === 1 && (int)$r['season_points'] > 0) { $champion = (int)$r['id']; }
        }
        if ($champion) {
            $db->exec("INSERT IGNORE INTO badges (id, name, description, category, xp_reward, icon) VALUES ('clan_champion', 'Clan Champion', 'Finished a season as part of the top clan', 'clan', 200, '&#128081;')");
            $res = $db->query("SELECT user_id FROM clan_members WHERE clan_id = $champion");
            while ($r = $res->fetch()) {
                $uid = (int)$r['user_id'];
                $db->exec("INSERT IGNORE INTO user_badges (user_id, badge_id) VALUES ($uid, 'clan_champion')");
            }
        }
        $db->exec("UPDATE clans SET season_points = 0");
        $db->exec("UPDATE clan_members SET season_points = 0");
        $champVal = $champion === null ? 'NULL' : $champion;
        $db->exec("UPDATE seasons SET status = 'ended', ended_at = NOW(), champion_clan_id = $champVal WHERE id = $sid");
        $db->commit();
        jsonResponse(['success' => true, 'champion_clan_id' => $champion]);
        break;

    case 'toggle_admin':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'POST required'], 405); }
        $targetId = (int)($input['user_id'] ?? 0);
        if ($targetId === $userId) { jsonResponse(['error' => 'You cannot change your own admin status'], 400); }
        $cur = (int)$db->query("SELECT is_admin FROM users WHERE id = $targetId")->fetchColumn();
        $new = $cur ? 0 : 1;
        $db->exec("UPDATE users SET is_admin = $new WHERE id = $targetId");
        jsonResponse(['success' => true, 'is_admin' => (bool)$new]);
        break;

    default:
        jsonResponse(['error' => 'Invalid action'], 400);
}
