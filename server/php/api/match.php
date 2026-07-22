<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/xp-helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$userId = requireAuth();
$input = getInput();

$won = (bool)($input['won'] ?? false);
$gameType = $input['game_type'] ?? 'ai';
$duration = (int)($input['duration'] ?? 0);
$skorches = (int)($input['skorches'] ?? 0);
$shields = (int)($input['shields'] ?? 0);
$undeads = (int)($input['undeads'] ?? 0);
$eludes = (int)($input['eludes'] ?? 0);
$opponentId = isset($input['opponent_id']) ? (int)$input['opponent_id'] : null;
if ($opponentId !== null && $opponentId <= 0) $opponentId = null;
$opponentName = $input['opponent_name'] ?? null;
$allowedDifficulties = ['easy', 'medium', 'hard', 'insane'];
$difficulty = in_array($input['difficulty'] ?? '', $allowedDifficulties, true) ? $input['difficulty'] : null;

$db = getDB();

// Look up opponent by username if no ID provided
if (!$opponentId && $opponentName) {
    $stmt = $db->prepare('SELECT id FROM users WHERE username = :name');
    $stmt->bindValue(':name', $opponentName, PDO::PARAM_STR);
    $stmt->execute();
    $row = $stmt->fetch();
    if ($row) $opponentId = $row['id'];
}

// Record match
$stmt = $db->prepare('INSERT INTO matches (player1_id, player2_id, winner_id, game_type, duration_seconds, difficulty) VALUES (:p1, :p2, :w, :t, :d, :diff)');
$stmt->bindValue(':p1', $userId, PDO::PARAM_INT);
$stmt->bindValue(':p2', $opponentId, $opponentId ? PDO::PARAM_INT : PDO::PARAM_NULL);
$stmt->bindValue(':w', $won ? $userId : ($opponentId ?: 0), PDO::PARAM_INT);
$stmt->bindValue(':t', $gameType, PDO::PARAM_STR);
$stmt->bindValue(':d', $duration, PDO::PARAM_INT);
$stmt->bindValue(':diff', $difficulty, $difficulty ? PDO::PARAM_STR : PDO::PARAM_NULL);
$stmt->execute();

// Update stats
$field = $won ? 'wins' : 'losses';
$streakUpdate = $won
    ? "win_streak = win_streak + 1, best_streak = GREATEST(best_streak, win_streak + 1)"
    : "win_streak = 0";

$db->exec("UPDATE stats SET games_played = games_played + 1, $field = $field + 1, $streakUpdate, total_skorches = total_skorches + $skorches, total_shields = total_shields + $shields, total_undeads = total_undeads + $undeads, total_skorch_plays = total_skorch_plays + $skorches, total_shield_plays = total_shield_plays + $shields, total_undead_plays = total_undead_plays + $undeads, total_elude_plays = total_elude_plays + $eludes WHERE user_id = $userId");

// Elo calculation for multiplayer matches
$eloChange = 0;
if (($gameType === 'multiplayer' || $gameType === 'pvp') && $opponentId) {
    // Get both players' Elo ratings
    $myElo = $db->query("SELECT elo_rating FROM stats WHERE user_id = $userId")->fetchColumn() ?: 1200;
    $oppElo = $db->query("SELECT elo_rating FROM stats WHERE user_id = $opponentId")->fetchColumn() ?: 1200;

    // Elo formula: K-factor = 32 (standard for new rating systems)
    $K = 32;
    $expectedScore = 1 / (1 + pow(10, ($oppElo - $myElo) / 400));
    $actualScore = $won ? 1 : 0;
    $eloChange = round($K * ($actualScore - $expectedScore));

    // Update my Elo
    $newElo = max(100, $myElo + $eloChange); // Floor at 100
    $db->exec("UPDATE stats SET elo_rating = $newElo WHERE user_id = $userId");

    // Update opponent's Elo (opposite result)
    $oppChange = -$eloChange;
    $newOppElo = max(100, $oppElo + $oppChange);
    $db->exec("UPDATE stats SET elo_rating = $newOppElo WHERE user_id = $opponentId");
} elseif ($gameType === 'ai') {
    // Small Elo adjustment for AI games (+5 win, -3 loss) so single-player still matters
    $eloChange = $won ? 5 : -3;
    $myElo = $db->query("SELECT elo_rating FROM stats WHERE user_id = $userId")->fetchColumn() ?: 1200;
    $newElo = max(100, $myElo + $eloChange);
    $db->exec("UPDATE stats SET elo_rating = $newElo WHERE user_id = $userId");
}

if ($won) {
    if ($gameType === 'pvp' || $gameType === 'multiplayer') {
        $clanPoints = 10;
    } else {
        $diffPoints = ['easy' => 1, 'medium' => 2, 'hard' => 4, 'insane' => 8];
        $clanPoints = $diffPoints[$difficulty] ?? 1;
    }
    $clanId = $db->query("SELECT clan_id FROM clan_members WHERE user_id = $userId")->fetchColumn();
    if ($clanId) {
        $cid = (int)$clanId;
        $db->exec("UPDATE clans SET season_points = season_points + $clanPoints, total_points = total_points + $clanPoints WHERE id = $cid");
        $db->exec("UPDATE clan_members SET season_points = season_points + $clanPoints, total_points = total_points + $clanPoints WHERE user_id = $userId");
    }
}

// --- XP Awards ---
$xpGained = 0;

// Base XP for match outcome
if ($won) {
    $xpGained += ($gameType === 'pvp' || $gameType === 'multiplayer') ? 40 : 15;
} else {
    $xpGained += 10;
}

// Win streak bonus (3+)
if ($won) {
    $currentStreak = (int)$db->query("SELECT win_streak FROM stats WHERE user_id = $userId")->fetchColumn();
    if ($currentStreak >= 3) {
        $xpGained += 15;
    }
}

// First game today bonus + daily streak tracking
$today = date('Y-m-d');
$statsRow = $db->query("SELECT last_game_date, daily_streak FROM stats WHERE user_id = $userId")->fetch();
$lastGameDate = $statsRow['last_game_date'] ?? null;
$dailyStreak  = (int)($statsRow['daily_streak'] ?? 0);

if ($lastGameDate !== $today) {
    // First game of the day
    $xpGained += 20;

    // Update daily streak
    if ($lastGameDate === date('Y-m-d', strtotime('-1 day'))) {
        $dailyStreak++;
    } else {
        $dailyStreak = 1;
    }

    $stmtStreak = $db->prepare("UPDATE stats SET last_game_date = :today, daily_streak = :streak WHERE user_id = :uid");
    $stmtStreak->bindValue(':today', $today, PDO::PARAM_STR);
    $stmtStreak->bindValue(':streak', $dailyStreak, PDO::PARAM_INT);
    $stmtStreak->bindValue(':uid', $userId, PDO::PARAM_INT);
    $stmtStreak->execute();
}

// Skorch card plays bonus (+5 XP per Skorch card played)
$xpGained += $skorches * 5;

// Award the XP
$xpResult = awardXP($db, $userId, $xpGained);

// Check and award badges
require_once __DIR__ . '/check-badges.php';
$newBadges = checkAndAwardBadges($db, $userId);

jsonResponse([
    'success'    => true,
    'elo_change' => $eloChange,
    'xp'         => $xpResult['xp'],
    'level'      => $xpResult['level'],
    'xp_gained'  => $xpResult['xp_gained'],
    'leveled_up' => $xpResult['leveled_up'],
    'new_badges' => $newBadges,
]);
