-- らくポチ勤怠 シードデータ投入SQL
-- SupabaseのSQL Editorで実行してください

-- 1. 企業の作成
INSERT INTO companies (name, code, email, phone, address, "isActive", "createdAt", "updatedAt")
VALUES (
  'テスト株式会社',
  'TEST001',
  'test@example.com',
  '03-1234-5678',
  '',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (code) DO NOTHING
RETURNING id;

-- 2. 企業IDを取得（上記のクエリで返されたIDを使用）
-- 例: 企業IDが1の場合

-- 3. 管理者アカウントの作成
-- パスワード: admin123
-- 注意: 以下のハッシュは例です。実際のハッシュを生成する必要があります
INSERT INTO employees (
  "companyId",
  "employeeNumber",
  name,
  email,
  password,
  role,
  department,
  position,
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  (SELECT id FROM companies WHERE code = 'TEST001'),
  'EMP001',
  '管理者',
  'admin@example.com',
  '$2a$10$pt6bJXgyhSO6gF9/RLntven0/ko.H4dRGUBUVTomnVmCpHPiqpa8C', -- admin123のハッシュ
  'admin',
  '管理部',
  '管理者',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  "updatedAt" = NOW();

-- 4. 従業員アカウントの作成
-- パスワード: employee123
INSERT INTO employees (
  "companyId",
  "employeeNumber",
  name,
  email,
  password,
  role,
  department,
  position,
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  (SELECT id FROM companies WHERE code = 'TEST001'),
  'EMP002',
  '従業員',
  'employee@example.com',
  '$2a$10$Xku.FvVXikxeZ59nZacaDef1ET0/9gliFu.NdSRLrcYK5o5an.eg6', -- employee123のハッシュ
  'employee',
  '営業部',
  '営業',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  "updatedAt" = NOW();

-- 5. 店舗・事業所の作成
DELETE FROM locations WHERE "companyId" = (SELECT id FROM companies WHERE code = 'TEST001');

INSERT INTO locations (
  "companyId",
  name,
  address,
  latitude,
  longitude,
  radius,
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  (SELECT id FROM companies WHERE code = 'TEST001'),
  '店舗名',
  '',
  35.6812,
  139.7671,
  500,
  true,
  NOW(),
  NOW()
);

-- 6. 企業設定の作成
INSERT INTO company_settings (
  "companyId",
  payday,
  "overtimeThreshold40",
  "overtimeThreshold60",
  "consecutiveWorkAlert",
  "leaveExpiryAlertDays",
  "createdAt",
  "updatedAt"
)
VALUES (
  (SELECT id FROM companies WHERE code = 'TEST001'),
  25,
  40,
  60,
  6,
  30,
  NOW(),
  NOW()
)
ON CONFLICT ("companyId") DO UPDATE SET
  "updatedAt" = NOW();

-- 確認用クエリ
SELECT 
  c.name as company_name,
  e.name as employee_name,
  e.email,
  e.role
FROM companies c
JOIN employees e ON e."companyId" = c.id
WHERE c.code = 'TEST001';

