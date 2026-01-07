-- 特定のアカウントを削除するスクリプト
-- ⚠️ 実行前に必ずバックアップを取ってください
-- このスクリプトを編集して、削除したいアカウントのemailやIDを指定してください

BEGIN;

-- 削除したいアカウントのemailを指定（複数可）
-- 例: 'test@example.com', 'admin@test.com', 'demo@example.com'
DO $$
DECLARE
  target_emails TEXT[] := ARRAY[
    -- ここに削除したいemailを追加してください
    -- 'test@example.com',
    -- 'admin@test.com'
  ];
  deleted_employee_ids INT[];
  deleted_company_ids INT[];
BEGIN
  -- 指定されたemailの従業員を削除
  IF array_length(target_emails, 1) > 0 THEN
    -- 削除対象の従業員IDを取得
    SELECT ARRAY_AGG(id) INTO deleted_employee_ids
    FROM employees
    WHERE email = ANY(target_emails);
    
    -- 従業員を削除（CASCADEで関連データも削除）
    IF deleted_employee_ids IS NOT NULL THEN
      DELETE FROM employees WHERE id = ANY(deleted_employee_ids);
      RAISE NOTICE '削除された従業員数: %', array_length(deleted_employee_ids, 1);
    END IF;
  END IF;
  
  -- 削除したい企業のIDを指定（複数可）
  -- 例: ARRAY[1, 2, 3]
  DECLARE
    target_company_ids INT[] := ARRAY[
      -- ここに削除したい企業IDを追加してください
      -- 1,
      -- 2
    ];
  BEGIN
    IF array_length(target_company_ids, 1) > 0 THEN
      -- 企業を削除（CASCADEで関連データも削除）
      DELETE FROM companies WHERE id = ANY(target_company_ids);
      GET DIAGNOSTICS deleted_company_ids = ROW_COUNT;
      RAISE NOTICE '削除された企業数: %', array_length(target_company_ids, 1);
    END IF;
  END;
END $$;

COMMIT;

-- 削除後の確認
SELECT '削除後の企業数' as info, COUNT(*) as count FROM companies;
SELECT '削除後の従業員数' as info, COUNT(*) as count FROM employees;
SELECT '削除後のadmin数' as info, COUNT(*) as count FROM employees WHERE role = 'admin';




