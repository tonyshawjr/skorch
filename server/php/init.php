<?php
require_once __DIR__ . '/config.php';

$db = getDB();
$schema = file_get_contents(__DIR__ . '/db/schema.sql');
$db->exec($schema);

echo "Database initialized successfully.\n";
