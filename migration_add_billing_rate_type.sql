-- 請求単価タイプを追加するマイグレーション
-- SQLEditorで実行してください

-- employeesテーブルにbillingRateTypeカラムを追加
ALTER TABLE "employees" 
ADD COLUMN IF NOT EXISTS "billingRateType" TEXT DEFAULT 'daily';

-- 既存のレコードは'daily'（日給）のまま
-- 必要に応じて、特定の従業員を更新してください
-- UPDATE "employees" SET "billingRateType" = 'hourly' WHERE id = <従業員ID>;
-- UPDATE "employees" SET "billingRateType" = 'monthly' WHERE id = <従業員ID>;
