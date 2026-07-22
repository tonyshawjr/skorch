<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$userId = requireAuth();

if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
    jsonResponse(['error' => 'No file uploaded or upload error'], 400);
}

$file = $_FILES['avatar'];


$allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mimeType, $allowedTypes)) {
    jsonResponse(['error' => 'Only JPEG, PNG, GIF, and WebP images are allowed'], 400);
}


if ($file['size'] > 2 * 1024 * 1024) {
    jsonResponse(['error' => 'Image must be under 2MB'], 400);
}


$uploadDir = __DIR__ . '/../uploads/avatars/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}


$ext = match($mimeType) {
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/gif' => 'gif',
    'image/webp' => 'webp',
    default => 'jpg'
};
$filename = "avatar_{$userId}.{$ext}";


foreach (glob($uploadDir . "avatar_{$userId}.*") as $old) {
    unlink($old);
}


$destination = $uploadDir . $filename;
if (!move_uploaded_file($file['tmp_name'], $destination)) {
    jsonResponse(['error' => 'Failed to save file'], 500);
}


if (function_exists('imagecreatefromjpeg')) {
    $info = getimagesize($destination);
    $width = $info[0];
    $height = $info[1];

    if ($width > 256 || $height > 256) {
        $size = min($width, $height);
        $x = ($width - $size) / 2;
        $y = ($height - $size) / 2;

        $src = match($mimeType) {
            'image/jpeg' => imagecreatefromjpeg($destination),
            'image/png' => imagecreatefrompng($destination),
            'image/gif' => imagecreatefromgif($destination),
            'image/webp' => imagecreatefromwebp($destination),
            default => null
        };

        if ($src) {
            $dst = imagecreatetruecolor(256, 256);
            
            if (in_array($mimeType, ['image/png', 'image/gif', 'image/webp'])) {
                imagealphablending($dst, false);
                imagesavealpha($dst, true);
            }
            imagecopyresampled($dst, $src, 0, 0, (int)$x, (int)$y, 256, 256, $size, $size);

            match($mimeType) {
                'image/jpeg' => imagejpeg($dst, $destination, 85),
                'image/png' => imagepng($dst, $destination),
                'image/gif' => imagegif($dst, $destination),
                'image/webp' => imagewebp($dst, $destination, 85),
                default => null
            };

            imagedestroy($src);
            imagedestroy($dst);
        }
    }
}


$avatarUrl = "/server/php/uploads/avatars/{$filename}";
$db = getDB();
$stmt = $db->prepare('UPDATE users SET avatar_url = :url WHERE id = :id');
$stmt->bindValue(':url', $avatarUrl, PDO::PARAM_STR);
$stmt->bindValue(':id', $userId, PDO::PARAM_INT);
$stmt->execute();

jsonResponse(['success' => true, 'avatar_url' => $avatarUrl . '?t=' . time()]);
