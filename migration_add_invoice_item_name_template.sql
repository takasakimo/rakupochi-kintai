-- 請求書費目テンプレートフィールドを追加
ALTER TABLE companies ADD COLUMN "invoiceItemNameTemplate" TEXT;

-- デフォルト値を設定（既存データ用）
UPDATE companies SET "invoiceItemNameTemplate" = '{employeeName}委託費用' WHERE "invoiceItemNameTemplate" IS NULL;
