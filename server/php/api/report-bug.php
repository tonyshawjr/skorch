<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(['error' => 'Method not allowed'], 405); }
$userId = requireAuth();
$db = getDB();

$message = trim($_POST['message'] ?? '');
$pageUrl = trim($_POST['page_url'] ?? '');
if (strlen($message) < 3) { jsonResponse(['error' => 'Please describe the bug'], 400); }
if (strlen($message) > 2000) { $message = substr($message, 0, 2000); }
if (strlen($pageUrl) > 300) { $pageUrl = substr($pageUrl, 0, 300); }

$screenshotUrl = null;
if (isset($_FILES['screenshot']) && $_FILES['screenshot']['error'] === UPLOAD_ERR_OK) {
    $file = $_FILES['screenshot'];
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    if (in_array($mimeType, $allowedTypes) && $file['size'] <= 4 * 1024 * 1024) {
        $uploadDir = __DIR__ . '/../uploads/bugs/';
        if (!is_dir($uploadDir)) { mkdir($uploadDir, 0755, true); }
        $ext = match($mimeType) { 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp', default => 'jpg' };
        $filename = 'bug_' . $userId . '_' . time() . '.' . $ext;
        if (move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
            $screenshotUrl = "/server/php/uploads/bugs/{$filename}";
        }
    }
}

$stmt = $db->prepare("INSERT INTO bug_reports (user_id, message, page_url, screenshot_url) VALUES (:u, :m, :p, :s)");
$stmt->bindValue(':u', $userId, PDO::PARAM_INT);
$stmt->bindValue(':m', $message, PDO::PARAM_STR);
$stmt->bindValue(':p', $pageUrl, PDO::PARAM_STR);
$stmt->bindValue(':s', $screenshotUrl, $screenshotUrl ? PDO::PARAM_STR : PDO::PARAM_NULL);
$stmt->execute();
jsonResponse(['success' => true]);
