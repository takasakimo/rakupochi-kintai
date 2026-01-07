-- テスト用データの削除スクリプト
-- ⚠️ 実行前に必ずバックアップを取ってください

BEGIN;

-- 1. テスト用企業に関連するデータを削除（CASCADEで自動削除される）
-- まず、テスト用企業のIDを確認
DO $$
DECLARE
  test_company_ids INT[];
BEGIN
  -- テスト用企業のIDを取得
  SELECT ARRAY_AGG(id) INTO test_company_ids
  FROM companies
  WHERE 
    name ILIKE '%test%' 
    OR name ILIKE '%テスト%'
    OR code ILIKE '%test%'
    OR code ILIKE '%demo%'
    OR email ILIKE '%test%'
    OR email ILIKE '%demo%';
  
  -- テスト用企業を削除（CASCADEで関連データも削除される）
  IF test_company_ids IS NOT NULL THEN
    DELETE FROM companies WHERE id = ANY(test_company_ids);
    RAISE NOTICE '削除されたテスト用企業数: %', array_length(test_company_ids, 1);
  ELSE
    RAISE NOTICE '削除対象のテスト用企業はありません';
  END IF;
END $$;

-- 2. テスト用従業員アカウントを削除（企業に属さない場合）
DELETE FROM employees
WHERE 
  (email ILIKE '%test%' OR email ILIKE '%demo%')
  AND "companyId" NOT IN (SELECT id FROM companies);

-- 3. テスト用adminアカウントの削除（本番環境で不要な場合）
-- ⚠️ 注意: 本番環境で必要なadminアカウントがある場合は、このクエリをスキップしてください
-- 特定のadminアカウントのみ削除する場合は、WHERE句を修正してください
DELETE FROM employees
WHERE 
  role = 'admin'
  AND (
    email ILIKE '%test%'
    OR email ILIKE '%admin%'
    OR email ILIKE '%demo%'
    OR name ILIKE '%test%'
    OR name ILIKE '%テスト%'
    OR "employeeNumber" ILIKE '%test%'
    OR "employeeNumber" ILIKE '%admin%'
  )
  AND "companyId" IN (SELECT id FROM companies); -- 存在する企業に属するもののみ

-- 4. 孤立したデータの削除（念のため）
-- 企業が削除されたが、関連データが残っている場合
DELETE FROM attendances WHERE "companyId" NOT IN (SELECT id FROM companies);
DELETE FROM shifts WHERE "companyId" NOT IN (SELECT id FROM companies);
DELETE FROM applications WHERE "companyId" NOT IN (SELECT id FROM companies);
DELETE FROM locations WHERE "companyId" NOT IN (SELECT id FROM companies);
DELETE FROM company_settings WHERE "companyId" NOT IN (SELECT id FROM companies);
DELETE FROM announcements WHERE "companyId" NOT IN (SELECT id FROM companies);

COMMIT;

-- 削除後の確認
SELECT '削除後の企業数' as info, COUNT(*) as count FROM companies;
SELECT '削除後の従業員数' as info, COUNT(*) as count FROM employees;
SELECT '削除後のadmin数' as info, COUNT(*) as count FROM employees WHERE role = 'admin';




