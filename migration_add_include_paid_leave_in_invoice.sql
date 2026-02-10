-- 有給休暇を請求書に反映するかの設定を追加
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS "includePaidLeaveInInvoice" BOOLEAN DEFAULT false;
