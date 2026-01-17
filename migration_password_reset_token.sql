-- ============================================
-- パスワードリセットトークンテーブルの作成
-- ============================================
-- このSQLをSQLエディタで実行してください

-- 1. テーブルの作成（既に存在する場合はスキップ）
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- 2. トークンにユニーク制約を追加（既に存在する場合はスキップ）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'password_reset_tokens_token_key'
    ) THEN
        CREATE UNIQUE INDEX "password_reset_tokens_token_key" 
        ON "password_reset_tokens"("token");
    END IF;
END $$;

-- 3. 外部キー制約を追加（既に存在する場合はスキップ）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'password_reset_tokens_employeeId_fkey'
    ) THEN
        ALTER TABLE "password_reset_tokens" 
        ADD CONSTRAINT "password_reset_tokens_employeeId_fkey" 
        FOREIGN KEY ("employeeId") 
        REFERENCES "employees"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. 確認用クエリ（テーブルが正しく作成されたか確認）
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'password_reset_tokens'
ORDER BY ordinal_position;

