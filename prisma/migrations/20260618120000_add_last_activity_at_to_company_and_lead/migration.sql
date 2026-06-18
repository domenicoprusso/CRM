-- Add lastActivityAt to Company
ALTER TABLE "Company" ADD COLUMN "lastActivityAt" TIMESTAMPTZ;
CREATE INDEX "Company_tenantId_lastActivityAt_idx" ON "Company"("tenantId", "lastActivityAt");

-- Add lastActivityAt to Lead
ALTER TABLE "Lead" ADD COLUMN "lastActivityAt" TIMESTAMPTZ;
CREATE INDEX "Lead_tenantId_lastActivityAt_idx" ON "Lead"("tenantId", "lastActivityAt");

-- Populate existing Company records
UPDATE "Company" c
SET "lastActivityAt" = (
  SELECT MAX(a."occurredAt")
  FROM "Activity" a
  WHERE a."companyId" = c.id
);

-- Populate existing Lead records
UPDATE "Lead" l
SET "lastActivityAt" = (
  SELECT MAX(a."occurredAt")
  FROM "Activity" a
  WHERE a."leadId" = l.id
);
