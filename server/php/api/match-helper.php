<?php
require_once __DIR__ . '/xp-helper.php';
require_once __DIR__ . '/check-badges.php';

function applyMatchStatsXP($db, $userId, $won, $gameType, $counters, $difficulty) {
    $skorches = min(max((int)($counters['skorches'] ?? 0), 0), 20);
    $shields  = min(max((int)($counters['shields'] ?? 0), 0), 20);
    $undeads  = min(max((int)($counters['undeads'] ?? 0), 0), 20);
    $eludes   = min(max((int)($counters['eludes'] ?? 0), 0), 20);

    $field = $won ? 'wins' : 'losses';
    $streakUpdate = $won
        ? "win_streak = win_streak + 1, best_streak = GREATEST(best_streak, win_streak + 1)"
        : "win_streak = 0";

    $db->exec("UPDATE stats SET games_played = games_played + 1, $field = $field + 1, $streakUpdate, total_skorches = total_skorches + $skorches, total_shields = total_shields + $shields, total_undeads = total_undeads + $undeads, total_skorch_plays = total_skorch_plays + $skorches, total_shield_plays = total_shield_plays + $shields, total_undead_plays = total_undead_plays + $undeads, total_elude_plays = total_elude_plays + $eludes WHERE user_id = $userId");

    $isPvp = ($gameType === 'multiplayer' || $gameType === 'pvp');

    if ($won) {
        if ($isPvp) {
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

    $xpGained = $won ? ($isPvp ? 40 : 15) : 10;

    if ($won) {
        $currentStreak = (int)$db->query("SELECT win_streak FROM stats WHERE user_id = $userId")->fetchColumn();
        if ($currentStreak >= 3) {
            $xpGained += 15;
        }
    }

    $today = date('Y-m-d');
    $statsRow = $db->query("SELECT last_game_date, daily_streak FROM stats WHERE user_id = $userId")->fetch();
    $lastGameDate = $statsRow['last_game_date'] ?? null;
    $dailyStreak  = (int)($statsRow['daily_streak'] ?? 0);

    if ($lastGameDate !== $today) {
        $xpGained += 20;
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

    $xpGained += $skorches * 5;

    $xpResult = awardXP($db, $userId, $xpGained);
    $xpResult['new_badges'] = checkAndAwardBadges($db, $userId);
    return $xpResult;
}
