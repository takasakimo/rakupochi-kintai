-- 請求書作成機能のON/OFF設定を追加するマイグレーション
-- SQLEditorで実行してください

-- company_settingsテーブルにenableInvoiceカラムを追加
ALTER TABLE "company_settings" 
ADD COLUMN IF NOT EXISTS "enableInvoice" BOOLEAN NOT NULL DEFAULT false;

-- 既存のレコードはfalse（無効）のまま
-- 必要に応じて、特定の企業を有効にする場合は以下のようにUPDATEしてください
-- UPDATE "company_settings" SET "enableInvoice" = true WHERE "companyId" = <企業ID>;
