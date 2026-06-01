<?php
/**
 * bot_api.php
 * API وسيط لبوت واتساب Baileys وبوت تلجرام.
 * يربط البوتات بنفس قاعدة بيانات الموقع: users + donors
 *
 * مكان الرفع: المجلد الرئيسي للموقع بجانب includes/Database.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-BOT-API-KEY');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// غيّر المفتاح هنا إذا أردت، ولازم يكون مطابقًا لقيمة BOT_API_KEY في Render
const BOT_API_KEY = 'horynet_secure_2026';

function json_response(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function get_api_key(): string {
    $key = $_SERVER['HTTP_X_BOT_API_KEY'] ?? '';
    if (!$key && function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $name => $value) {
            if (strtolower($name) === 'x-bot-api-key') {
                $key = $value;
                break;
            }
        }
    }
    return trim((string)$key);
}

function read_input(): array {
    $raw = file_get_contents('php://input');
    $json = json_decode($raw, true);
    if (is_array($json)) {
        return $json;
    }
    return $_POST ?: $_GET ?: [];
}

function clean_text($value, int $max = 255): string {
    $value = trim((string)$value);
    $value = preg_replace('/\s+/u', ' ', $value);
    return mb_substr($value, 0, $max, 'UTF-8');
}

function normalize_phone(string $phone): string {
    $phone = trim($phone);
    // تحويل الأرقام العربية/الهندية إلى إنجليزية
    $phone = strtr($phone, [
        '٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9',
        '۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9'
    ]);
    $phone = preg_replace('/[^0-9]/', '', $phone);

    // لو الرقم يبدأ بمفتاح اليمن 967 نحذف المفتاح ليطابق نظام الموقع 7xxxxxxxx
    if (strlen($phone) === 12 && str_starts_with($phone, '967')) {
        $phone = substr($phone, 3);
    }
    return $phone;
}

function normalize_blood(string $blood): string {
    $blood = strtoupper(trim($blood));
    $blood = str_replace([' ', 'او موجب', 'أو موجب'], ['', 'O+', 'O+'], $blood);
    $blood = str_replace(['او سالب', 'أو سالب'], 'O-', $blood);
    $allowed = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    return in_array($blood, $allowed, true) ? $blood : $blood;
}

if (get_api_key() !== BOT_API_KEY) {
    json_response(['ok' => false, 'error' => 'unauthorized'], 401);
}

$dbFile = __DIR__ . '/includes/Database.php';
if (!file_exists($dbFile)) {
    json_response(['ok' => false, 'error' => 'Database.php not found. ضع الملف في مجلد الموقع الرئيسي.'], 500);
}
require_once $dbFile;

try {
    $db = Database::getInstance()->getConnection();
} catch (Throwable $e) {
    json_response(['ok' => false, 'error' => 'database_connection_failed', 'details' => $e->getMessage()], 500);
}

$input = read_input();
$action = clean_text($input['action'] ?? '', 50);

if ($_SERVER['REQUEST_METHOD'] === 'GET' && !$action) {
    json_response(['ok' => true, 'message' => 'bot_api.php is running', 'actions' => ['register_donor', 'search_donors']]);
}

try {
    if ($action === 'register_donor') {
        $full_name = clean_text($input['full_name'] ?? '', 100);
        $blood_type = normalize_blood(clean_text($input['blood_type'] ?? '', 5));
        $phone = normalize_phone((string)($input['phone'] ?? ''));
        $whatsapp = normalize_phone((string)($input['whatsapp'] ?? $phone));
        $governorate = clean_text($input['governorate'] ?? '', 50);
        $district = clean_text($input['district'] ?? '', 50);

        // حقول الموقع المطلوبة. البوت الحالي لا يسأل عنها، لذلك نضع قيماً افتراضية آمنة.
        $nickname = clean_text($input['nickname'] ?? '', 50);
        $age = (int)($input['age'] ?? 25);
        $gender = clean_text($input['gender'] ?? 'male', 10);
        $address = clean_text($input['address'] ?? ($governorate . ' - ' . $district), 500);
        $nearest_center = clean_text($input['nearest_center'] ?? $district, 100);
        $best_call_time = clean_text($input['best_call_time'] ?? 'أي وقت', 50);
        $last_donation_date = clean_text($input['last_donation_date'] ?? '', 20);
        $last_donation_date = $last_donation_date ?: null;

        if ($full_name === '' || $blood_type === '' || $phone === '' || $governorate === '' || $district === '') {
            json_response(['ok' => false, 'error' => 'missing_required_fields'], 400);
        }
        if (!preg_match('/^7[0-9]{8}$/', $phone)) {
            json_response(['ok' => false, 'error' => 'رقم الهاتف يجب أن يكون 9 أرقام ويبدأ بـ 7'], 400);
        }
        if (!in_array($blood_type, ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], true)) {
            json_response(['ok' => false, 'error' => 'فصيلة الدم غير صحيحة'], 400);
        }
        if ($age < 18 || $age > 65) {
            $age = 25;
        }
        if (!in_array($gender, ['male', 'female'], true)) {
            $gender = 'male';
        }

        // هل الرقم مسجل مسبقاً؟
        $stmt = $db->prepare('SELECT u.id AS user_id, d.id AS donor_id FROM users u LEFT JOIN donors d ON d.user_id = u.id WHERE u.username = ? OR d.phone = ? LIMIT 1');
        $stmt->execute([$phone, $phone]);
        $exists = $stmt->fetch();
        if ($exists) {
            json_response([
                'ok' => true,
                'already_exists' => true,
                'message' => 'هذا الرقم مسجل مسبقاً',
                'user_id' => $exists['user_id'] ?? null,
                'donor_id' => $exists['donor_id'] ?? null
            ]);
        }

        $email = $phone . '@tehama.local';
        $passwordPlain = 'bot_' . bin2hex(random_bytes(4)) . '_' . $phone;
        $hashed = password_hash($passwordPlain, PASSWORD_BCRYPT);

        $db->beginTransaction();

        $stmt = $db->prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'donor')");
        $stmt->execute([$phone, $email, $hashed]);
        $user_id = (int)$db->lastInsertId();

        $stmt = $db->prepare("INSERT INTO donors
            (user_id, full_name, nickname, age, gender, blood_type, phone, whatsapp, governorate, district, address, nearest_center, last_donation_date, best_call_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $user_id, $full_name, $nickname, $age, $gender, $blood_type, $phone, $whatsapp,
            $governorate, $district, $address, $nearest_center, $last_donation_date, $best_call_time
        ]);
        $donor_id = (int)$db->lastInsertId();

        $db->commit();

        json_response([
            'ok' => true,
            'message' => 'تم تسجيل المتبرع بنجاح',
            'user_id' => $user_id,
            'donor_id' => $donor_id
        ]);
    }

    if ($action === 'search_donors') {
        $blood_type = normalize_blood(clean_text($input['blood_type'] ?? '', 5));
        $governorate = clean_text($input['governorate'] ?? '', 50);

        if ($blood_type === '') {
            json_response(['ok' => false, 'error' => 'blood_type_required'], 400);
        }

        $sql = "SELECT full_name, blood_type, phone, whatsapp, governorate, district, best_call_time, last_donation_date
                FROM donors
                WHERE blood_type = ?";
        $params = [$blood_type];

        if ($governorate !== '') {
            $sql .= " AND governorate LIKE ?";
            $params[] = '%' . $governorate . '%';
        }

        $sql .= " ORDER BY created_at DESC LIMIT 10";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $donors = $stmt->fetchAll(PDO::FETCH_ASSOC);

        json_response(['ok' => true, 'count' => count($donors), 'donors' => $donors]);
    }

    json_response(['ok' => false, 'error' => 'unknown_action'], 400);

} catch (Throwable $e) {
    if (isset($db) && $db instanceof PDO && $db->inTransaction()) {
        $db->rollBack();
    }
    json_response([
        'ok' => false,
        'error' => 'server_error',
        'details' => $e->getMessage()
    ], 500);
}
