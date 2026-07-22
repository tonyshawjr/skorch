<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/xp-helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$username = isset($_GET['user']) ? trim($_GET['user']) : null;
if (!$username) {
    jsonResponse(['error' => 'user parameter required'], 400);
}

$db = getDB();

$stmt = $db->prepare('SELECT s.xp, s.level FROM stats s JOIN users u ON s.user_id = u.id WHERE u.username = :username');
$stmt->bindValue(':username', $username, PDO::PARAM_STR);
$stmt->execute();
$row = $stmt->fetch();

if (!$row) {
    jsonResponse(['error' => 'Player not found'], 404);
}

$xp    = (int)$row['xp'];
$level = (int)$row['level'];

$xpCurrentLevel = xpForLevel($level);
$xpNextLevel    = xpForLevel(min($level + 1, 100));
$xpNeeded       = xpForNextLevel($xp, $level);
$levelRange     = $xpNextLevel - $xpCurrentLevel;
$progressPct    = $level >= 100 ? 100 : ($levelRange > 0 ? round(($xp - $xpCurrentLevel) / $levelRange * 100, 1) : 0);

jsonResponse([
    'username'             => $username,
    'xp'                   => $xp,
    'level'                => $level,
    'xp_for_current_level' => $xpCurrentLevel,
    'xp_for_next_level'    => $xpNextLevel,
    'xp_needed'            => $xpNeeded,
    'progress_percent'     => $progressPct,
]);
