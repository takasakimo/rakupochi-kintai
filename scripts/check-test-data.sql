-- テスト用データの確認クエリ

-- テスト用企業の確認
SELECT id, name, code, email, "isActive", "createdAt"
FROM companies
WHERE 
  name ILIKE '%test%' 
  OR name ILIKE '%テスト%'
  OR code ILIKE '%test%'
  OR code ILIKE '%demo%'
  OR email ILIKE '%test%'
  OR email ILIKE '%demo%'
ORDER BY "createdAt";

-- テスト用従業員（admin含む）の確認
SELECT e.id, e.name, e.email, e.role, e."employeeNumber", c.name as company_name, e."createdAt"
FROM employees e
JOIN companies c ON e."companyId" = c.id
WHERE 
  e.email ILIKE '%test%'
  OR e.email ILIKE '%admin%'
  OR e.email ILIKE '%demo%'
  OR e.name ILIKE '%test%'
  OR e.name ILIKE '%テスト%'
  OR e."employeeNumber" ILIKE '%test%'
  OR e."employeeNumber" ILIKE '%admin%'
ORDER BY e."createdAt";

-- 全てのadminアカウントの確認
SELECT e.id, e.name, e.email, e.role, e."employeeNumber", c.name as company_name, e."createdAt"
FROM employees e
JOIN companies c ON e."companyId" = c.id
WHERE e.role = 'admin'
ORDER BY e."createdAt";

