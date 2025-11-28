-- 従業員テーブルに生年月日と住所を追加
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "birthDate" DATE;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "address" TEXT;

