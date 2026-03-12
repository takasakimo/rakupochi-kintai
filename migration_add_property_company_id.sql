-- 本番DB向け: properties テーブルに company_id を追加
-- Supabase SQL Editor で実行してください

-- 1. company_id カラムを追加（既存レコードがある場合は一時的にNULL許可）
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "company_id" INTEGER;

-- 2. 既存レコードがあれば、最初の企業IDを設定
UPDATE "properties"
SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1)
WHERE "company_id" IS NULL;

-- 3. NOT NULL 制約を付与（companies にレコードがある前提）
ALTER TABLE "properties" ALTER COLUMN "company_id" SET NOT NULL;

-- 4. 外部キー制約を追加（存在しない場合）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'properties_company_id_fkey'
    AND table_name = 'properties'
  ) THEN
    ALTER TABLE "properties"
    ADD CONSTRAINT "properties_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- 5. company_id のインデックスを追加（存在しない場合）
CREATE INDEX IF NOT EXISTS "properties_company_id_idx" ON "properties"("company_id");
