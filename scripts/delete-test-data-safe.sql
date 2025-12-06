-- 安全なテスト用データ削除スクリプト（特定の条件のみ）
-- ⚠️ 実行前に必ずバックアップを取ってください
-- ⚠️ このスクリプトは明示的にテスト用とマークされたデータのみを削除します

BEGIN;

-- 1. テスト用企業の削除（より厳格な条件）
-- 企業名、コード、メールアドレスに"test"または"テスト"が含まれるもの
DO $$
DECLARE
  test_company_ids INT[];
  deleted_count INT;
BEGIN
  -- テスト用企業のIDを取得（より厳格な条件）
  SELECT ARRAY_AGG(id) INTO test_company_ids
  FROM companies
  WHERE 
    (name ILIKE '%test%' OR name ILIKE '%テスト%')
    AND (code ILIKE '%test%' OR code ILIKE '%テスト%' OR email ILIKE '%test%' OR email ILIKE '%テスト%');
  
  -- テスト用企業を削除
  IF test_company_ids IS NOT NULL THEN
    DELETE FROM companies WHERE id = ANY(test_company_ids);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '削除されたテスト用企業数: %', deleted_count;
  ELSE
    RAISE NOTICE '削除対象のテスト用企業はありません';
  END IF;
END $$;

-- 2. テスト用従業員の削除（emailに"test"が含まれるもの）
DELETE FROM employees
WHERE 
  email ILIKE '%test%'
  OR email ILIKE '%テスト%'
  OR (name ILIKE '%test%' AND email ILIKE '%test%')
  OR (name ILIKE '%テスト%' AND email ILIKE '%テスト%');

-- 3. 特定のテスト用adminアカウントの削除
-- 例: emailが"admin@test.com"や"test@admin.com"など
DELETE FROM employees
WHERE 
  role = 'admin'
  AND (
    email = 'admin@test.com'
    OR email = 'test@admin.com'
    OR email = 'admin@example.com'
    OR email ILIKE '%test.admin%'
    OR email ILIKE '%admin.test%'
  );

COMMIT;

-- 削除後の確認
SELECT '削除後の企業数' as info, COUNT(*) as count FROM companies;
SELECT '削除後の従業員数' as info, COUNT(*) as count FROM employees;
SELECT '削除後のadmin数' as info, COUNT(*) as count FROM employees WHERE role = 'admin';

