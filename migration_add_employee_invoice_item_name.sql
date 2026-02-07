-- 従業員テーブルに請求書費目フィールドを追加
ALTER TABLE employees ADD COLUMN "invoiceItemName" TEXT;
