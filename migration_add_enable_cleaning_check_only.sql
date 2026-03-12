-- 本番DB向け: company_settings に enableCleaningCheck を追加
-- company_settings のカラムは camelCase（allowPreOvertime 等）が使われている
-- Supabase SQL Editor で実行してください

ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "enableCleaningCheck" BOOLEAN NOT NULL DEFAULT false;
