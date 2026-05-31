ALTER TABLE "Task" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Task" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "completedAt" TIMESTAMP(3);

ALTER TABLE "Task"
ADD CONSTRAINT "Task_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Task_tenantId_companyId_idx" ON "Task"("tenantId", "companyId");
CREATE INDEX "Task_tenantId_reminderAt_idx" ON "Task"("tenantId", "reminderAt");
