<?php

function checkAndAwardBadges($db, $userId) {
    $stmt = $db->prepare("SELECT * FROM stats WHERE user_id = :uid");
    $stmt->bindValue(':uid', $userId, PDO::PARAM_INT);
    $stmt->execute();
    $stats = $stmt->fetch();

    if (!$stats) return [];

    $friendCount = $db->query(
        "SELECT COUNT(*) FROM friends WHERE (user_id = $userId OR friend_id = $userId) AND status = 'accepted'"
    )->fetchColumn() ?: 0;

    $earnedStmt = $db->prepare("SELECT badge_id FROM user_badges WHERE user_id = :uid");
    $earnedStmt->bindValue(':uid', $userId, PDO::PARAM_INT);
    $earnedStmt->execute();
    $earned = [];
    while ($row = $earnedStmt->fetch()) {
        $earned[$row['badge_id']] = true;
    }

    $monthStart = date('Y-m-01');
    $gamesThisMonth = $db->query(
        "SELECT COUNT(*) FROM matches WHERE player1_id = $userId AND played_at >= '$monthStart'"
    )->fetchColumn() ?: 0;

    $conditions = [
        'first_blood'    => ($stats['wins'] ?? 0) >= 1,
        'insane_slayer'  => (bool)$db->query("SELECT 1 FROM matches WHERE player1_id = $userId AND winner_id = $userId AND game_type = 'ai' AND difficulty = 'insane' LIMIT 1")->fetchColumn(),
        'hot_streak'     => ($stats['best_streak'] ?? 0) >= 5,
        'inferno'        => ($stats['best_streak'] ?? 0) >= 10,
        'centurion'      => ($stats['games_played'] ?? 0) >= 100,
        'veteran'        => ($stats['games_played'] ?? 0) >= 500,
        'skorch_master'  => ($stats['games_played'] ?? 0) >= 1000,
        'burn_notice'    => ($stats['total_skorches'] ?? 0) >= 50,
        'arsonist'       => ($stats['total_skorches'] ?? 0) >= 200,
        'shield_wall'    => ($stats['total_shields'] ?? 0) >= 100,
        'undead_army'    => ($stats['total_undeads'] ?? 0) >= 100,
        'elude_artist'   => ($stats['total_elude_plays'] ?? 0) >= 100,

        'friendly'           => $friendCount >= 1,
        'social_butterfly'   => $friendCount >= 10,
        'popular'            => $friendCount >= 25,
        'chatty'             => ($stats['total_chat_messages'] ?? 0) >= 100,

        'elo_rising'  => ($stats['elo_rating'] ?? 1200) >= 1300,
        'elo_elite'   => ($stats['elo_rating'] ?? 1200) >= 1400,
        'elo_legend'  => ($stats['elo_rating'] ?? 1200) >= 1500,

        'day_one'          => true,
        'weekly_warrior'   => ($stats['daily_streak'] ?? 0) >= 7,
        'monthly_grinder'  => $gamesThisMonth >= 50,
    ];

    $newBadges = [];
    $insertStmt = $db->prepare("INSERT IGNORE INTO user_badges (user_id, badge_id) VALUES (:uid, :bid)");

    foreach ($conditions as $badgeId => $met) {
        if ($met && !isset($earned[$badgeId])) {
            $insertStmt->bindValue(':uid', $userId, PDO::PARAM_INT);
            $insertStmt->bindValue(':bid', $badgeId, PDO::PARAM_STR);
            $insertStmt->execute();

            if ($insertStmt->rowCount() > 0) {
                $newBadges[] = $badgeId;

                $xpReward = $db->query("SELECT xp_reward FROM badges WHERE id = '$badgeId'")->fetchColumn() ?: 0;
                if ($xpReward > 0) {
                    $db->exec("UPDATE stats SET xp = xp + $xpReward WHERE user_id = $userId");
                }
            }
        }
    }

    return $newBadges;
}
