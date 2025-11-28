-- シフトテーブルに追加フィールドを追加（既に存在する場合はスキップ）
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "isPublicHoliday" BOOLEAN DEFAULT false;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "workLocation" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "workType" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "workingHours" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "timeSlot" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "directDestination" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "approvalNumber" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "leavingLocation" TEXT;
