-- 請求書機能追加マイグレーション
-- SQLEditorで実行してください

-- 1. 請求先企業マスタテーブルの作成
CREATE TABLE IF NOT EXISTS "billing_clients" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "contactPerson" TEXT,
    "bankName" TEXT,
    "bankBranch" TEXT,
    "accountNumber" TEXT,
    "accountHolder" TEXT,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "invoiceNumberPrefix" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_clients_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. 請求書テーブルの作成
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "billingClientId" INTEGER NOT NULL,
    "invoiceNumber" TEXT NOT NULL UNIQUE,
    "subject" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "paymentTerms" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "transportationCost" INTEGER DEFAULT 0,
    "adjustmentAmount" INTEGER DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoices_billingClientId_fkey" FOREIGN KEY ("billingClientId") REFERENCES "billing_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. 請求明細テーブルの作成
CREATE TABLE IF NOT EXISTS "invoice_details" (
    "id" SERIAL PRIMARY KEY,
    "invoiceId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "workDays" INTEGER NOT NULL,
    "basicRate" INTEGER NOT NULL,
    "basicAmount" INTEGER NOT NULL,
    "overtimeHours" DOUBLE PRECISION DEFAULT 0,
    "overtimeRate" DOUBLE PRECISION,
    "overtimeAmount" INTEGER DEFAULT 0,
    "absenceDays" INTEGER DEFAULT 0,
    "absenceDeduction" INTEGER DEFAULT 0,
    "lateEarlyDeduction" INTEGER DEFAULT 0,
    "subtotal" INTEGER NOT NULL,
    CONSTRAINT "invoice_details_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoice_details_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 4. employeesテーブルに請求関連カラムを追加
ALTER TABLE "employees" 
ADD COLUMN IF NOT EXISTS "billingClientId" INTEGER,
ADD COLUMN IF NOT EXISTS "billingRate" INTEGER,
ADD COLUMN IF NOT EXISTS "overtimeRate" DOUBLE PRECISION DEFAULT 1.25,
ADD COLUMN IF NOT EXISTS "hasOvertime" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "baseWorkDays" INTEGER DEFAULT 22;

-- 5. employeesテーブルに外部キー制約を追加
ALTER TABLE "employees"
ADD CONSTRAINT "employees_billingClientId_fkey" 
FOREIGN KEY ("billingClientId") REFERENCES "billing_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. インデックスの作成
CREATE INDEX IF NOT EXISTS "invoices_companyId_idx" ON "invoices"("companyId");
CREATE INDEX IF NOT EXISTS "invoices_billingClientId_idx" ON "invoices"("billingClientId");
CREATE INDEX IF NOT EXISTS "invoices_periodStart_idx" ON "invoices"("periodStart");
CREATE INDEX IF NOT EXISTS "invoices_periodEnd_idx" ON "invoices"("periodEnd");
CREATE INDEX IF NOT EXISTS "invoice_details_invoiceId_idx" ON "invoice_details"("invoiceId");
CREATE INDEX IF NOT EXISTS "invoice_details_employeeId_idx" ON "invoice_details"("employeeId");

-- 7. updatedAtカラムの自動更新トリガー（既に存在する場合はスキップ）
-- billing_clientsテーブル
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_billing_clients_updated_at ON "billing_clients";
CREATE TRIGGER update_billing_clients_updated_at
    BEFORE UPDATE ON "billing_clients"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- invoicesテーブル
DROP TRIGGER IF EXISTS update_invoices_updated_at ON "invoices";
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON "invoices"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
