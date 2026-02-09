-- 請求書テーブルに請求先企業名フィールドを追加（編集可能、便宜上名前を変える場合に使用）
-- Prismaのスキーマに合わせてbillingClientName（キャメルケース）を使用
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "billingClientName" TEXT;
