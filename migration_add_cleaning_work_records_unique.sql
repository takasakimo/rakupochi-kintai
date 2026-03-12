-- cleaning_work_records に Prisma スキーマ相当の UNIQUE 制約を追加
-- Prisma の @@unique([companyId, employeeId, propertyId, workDate]) に相当
-- 実行前に重複レコードがないか確認すること（重複がある場合は先に解消が必要）
-- Supabase SQL Editor で実行

CREATE UNIQUE INDEX IF NOT EXISTS cleaning_work_records_company_id_employee_id_property_id_work_date_key
  ON cleaning_work_records (company_id, employee_id, property_id, work_date);
