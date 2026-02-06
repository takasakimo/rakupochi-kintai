-- 請求書設定用のCompanyテーブルフィールド追加マイグレーション
-- SQLEditorで実行してください

-- Companyテーブルに請求書関連フィールドを追加
ALTER TABLE "companies" 
ADD COLUMN IF NOT EXISTS "issuerName" TEXT,
ADD COLUMN IF NOT EXISTS "taxId" TEXT,
ADD COLUMN IF NOT EXISTS "bankName" TEXT,
ADD COLUMN IF NOT EXISTS "bankBranch" TEXT,
ADD COLUMN IF NOT EXISTS "accountNumber" TEXT,
ADD COLUMN IF NOT EXISTS "accountHolder" TEXT;
