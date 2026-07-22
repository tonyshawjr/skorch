<?php















function xpForLevel($level) {
    if ($level <= 1) return 0;

    $xp = 0;
    for ($l = 2; $l <= $level; $l++) {
        if ($l <= 10) {
            $xp += 100;
        } elseif ($l <= 25) {
            $xp += 250;
        } elseif ($l <= 50) {
            $xp += 500;
        } elseif ($l <= 75) {
            $xp += 1000;
        } else {
            $xp += 2000;
        }
    }
    return $xp;
}





function calculateLevel($xp) {
    $level = 1;
    while ($level < 100) {
        $needed = xpForLevel($level + 1);
        if ($xp < $needed) break;
        $level++;
    }
    return $level;
}





function xpForNextLevel($currentXp, $currentLevel) {
    if ($currentLevel >= 100) return 0;
    $nextLevelXp = xpForLevel($currentLevel + 1);
    return max(0, $nextLevelXp - $currentXp);
}









function awardXP($db, $userId, $amount) {
    
    $row = $db->query("SELECT xp, level FROM stats WHERE user_id = $userId")->fetch();
    $oldXp    = (int)($row['xp'] ?? 0);
    $oldLevel = (int)($row['level'] ?? 1);

    $newXp    = $oldXp + $amount;
    $newLevel = calculateLevel($newXp);

    
    if ($newLevel > 100) $newLevel = 100;

    $db->exec("UPDATE stats SET xp = $newXp, level = $newLevel WHERE user_id = $userId");

    return [
        'xp'        => $newXp,
        'level'     => $newLevel,
        'leveled_up' => $newLevel > $oldLevel,
        'xp_gained' => $amount,
    ];
}
