-- 交通経路と交通費のフィールドを追加
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "transportationRoutes" JSONB;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "transportationCost" INTEGER;

