<?php
require_once __DIR__ . '/../config.php';

$q = trim($_GET['q'] ?? '');
$limit = min((int)($_GET['limit'] ?? 10), 20);

if (strlen($q) < 2) {
    jsonResponse(['results' => [], 'query' => $q]);
}

$db = getDB();
$searchTerm = '%' . $q . '%';

$stmt = $db->prepare("
    SELECT
        u.username,
        COALESCE(u.display_name, u.username) as display_name,
        u.avatar_color,
        u.avatar_url,
        s.elo_rating,
        s.level
    FROM users u
    LEFT JOIN stats s ON u.id = s.user_id
    WHERE u.username LIKE :q1
       OR u.display_name LIKE :q2
       OR u.first_name LIKE :q3
       OR u.last_name LIKE :q4
    ORDER BY s.elo_rating DESC
    LIMIT " . (int)$limit . "
");

$stmt->bindValue(':q1', $searchTerm, PDO::PARAM_STR);
$stmt->bindValue(':q2', $searchTerm, PDO::PARAM_STR);
$stmt->bindValue(':q3', $searchTerm, PDO::PARAM_STR);
$stmt->bindValue(':q4', $searchTerm, PDO::PARAM_STR);

$stmt->execute();
$results = [];

while ($row = $stmt->fetch()) {
    $results[] = $row;
}

jsonResponse(['results' => $results, 'query' => $q]);
