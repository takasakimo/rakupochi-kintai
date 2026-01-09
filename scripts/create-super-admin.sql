-- スーパー管理者アカウント作成SQLスクリプト
-- SupabaseのSQLエディタなどで実行してください

-- 1. システム企業を取得または作成（スーパー管理者用）
DO $$
DECLARE
    system_company_id INTEGER;
    super_admin_email TEXT := 'superadmin@rakupochi.com';
    super_admin_password TEXT := '$2a$10$YourHashedPasswordHere'; -- bcryptハッシュ（後で更新）
    super_admin_name TEXT := 'スーパー管理者';
BEGIN
    -- システム企業を取得または作成
    SELECT id INTO system_company_id
    FROM companies
    WHERE code = 'SYSTEM'
    LIMIT 1;

    IF system_company_id IS NULL THEN
        INSERT INTO companies (name, code, "isActive", "createdAt", "updatedAt")
        VALUES ('システム管理', 'SYSTEM', true, NOW(), NOW())
        RETURNING id INTO system_company_id;
        
        RAISE NOTICE 'システム企業を作成しました: ID = %', system_company_id;
    ELSE
        RAISE NOTICE 'システム企業は既に存在します: ID = %', system_company_id;
    END IF;

    -- 既存のスーパー管理者を確認
    IF EXISTS (
        SELECT 1 FROM employees
        WHERE role = 'super_admin'
        LIMIT 1
    ) THEN
        RAISE NOTICE '既にスーパー管理者が存在します。';
    ELSE
        -- パスワードのハッシュ化はSQLでは難しいため、以下の方法を推奨:
        -- 方法1: Node.jsスクリプトでハッシュを生成してからSQLを実行
        -- 方法2: 一時的なパスワードを設定し、初回ログイン時に変更を促す
        
        -- デフォルトパスワード: SuperAdmin123!
        -- bcryptハッシュ（10ラウンド）
        INSERT INTO employees (
            "companyId",
            "employeeNumber",
            name,
            email,
            password,
            role,
            "isActive",
            "createdAt",
            "updatedAt"
        ) VALUES (
            system_company_id,
            'SUPERADMIN001',
            super_admin_name,
            super_admin_email,
            '$2a$10$OIv9BVqddYfdM3uHaYeKZu/sJ7VtvyxA2Q5Njxpy435ELkbd1j01u', -- SuperAdmin123!のハッシュ
            'super_admin',
            true,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'スーパー管理者アカウントを作成しました';
        RAISE NOTICE 'メールアドレス: %', super_admin_email;
        RAISE NOTICE 'パスワード: SuperAdmin123!';
        RAISE NOTICE '⚠️  初回ログイン後、パスワードを変更することを推奨します。';
    END IF;
END $$;

-- 2. 作成されたスーパー管理者を確認
SELECT 
    id,
    "employeeNumber",
    name,
    email,
    role,
    "isActive",
    "createdAt"
FROM employees
WHERE role = 'super_admin'
ORDER BY "createdAt" DESC;

