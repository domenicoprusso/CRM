ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "externalId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Company_tenantId_externalId_key" ON "Company"("tenantId", "externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_tenantId_externalId_key" ON "Contact"("tenantId", "externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_tenantId_externalId_key" ON "Lead"("tenantId", "externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "Opportunity_tenantId_externalId_key" ON "Opportunity"("tenantId", "externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "Activity_tenantId_externalId_key" ON "Activity"("tenantId", "externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "Task_tenantId_externalId_key" ON "Task"("tenantId", "externalId");
