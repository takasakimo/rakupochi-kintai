-- らくポチリザーブ連携設定を追加するマイグレーション
-- company_settings にリザーブ連携用カラムを追加

ALTER TABLE "company_settings"
ADD COLUMN IF NOT EXISTS "reserveIntegrationEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "company_settings"
ADD COLUMN IF NOT EXISTS "reserveTenantId" TEXT;
