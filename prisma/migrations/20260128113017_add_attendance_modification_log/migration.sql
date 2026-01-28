-- CreateTable
CREATE TABLE "attendance_modification_logs" (
    "id" SERIAL NOT NULL,
    "attendanceId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "modifiedBy" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "changedFields" TEXT[],
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_modification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_modification_logs_attendanceId_idx" ON "attendance_modification_logs"("attendanceId");

-- CreateIndex
CREATE INDEX "attendance_modification_logs_companyId_idx" ON "attendance_modification_logs"("companyId");

-- CreateIndex
CREATE INDEX "attendance_modification_logs_employeeId_idx" ON "attendance_modification_logs"("employeeId");

-- CreateIndex
CREATE INDEX "attendance_modification_logs_createdAt_idx" ON "attendance_modification_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "attendance_modification_logs" ADD CONSTRAINT "attendance_modification_logs_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_modification_logs" ADD CONSTRAINT "attendance_modification_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_modification_logs" ADD CONSTRAINT "attendance_modification_logs_modifiedBy_fkey" FOREIGN KEY ("modifiedBy") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
