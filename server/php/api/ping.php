<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';

$userId = requireAuth();
jsonResponse(['ok' => true]);
