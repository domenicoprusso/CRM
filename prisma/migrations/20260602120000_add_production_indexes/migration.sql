CREATE INDEX IF NOT EXISTS "Activity_tenantId_companyId_idx" ON "Activity"("tenantId", "companyId");
CREATE INDEX IF NOT EXISTS "Activity_tenantId_contactId_idx" ON "Activity"("tenantId", "contactId");
CREATE INDEX IF NOT EXISTS "Activity_tenantId_leadId_idx" ON "Activity"("tenantId", "leadId");
CREATE INDEX IF NOT EXISTS "Activity_tenantId_opportunityId_idx" ON "Activity"("tenantId", "opportunityId");

CREATE INDEX IF NOT EXISTS "Opportunity_tenantId_ownerId_idx" ON "Opportunity"("tenantId", "ownerId");

CREATE INDEX IF NOT EXISTS "Lead_tenantId_ownerId_idx" ON "Lead"("tenantId", "ownerId");

CREATE INDEX IF NOT EXISTS "Task_tenantId_ownerId_status_idx" ON "Task"("tenantId", "ownerId", "status");

CREATE INDEX IF NOT EXISTS "ImportJob_tenantId_createdById_idx" ON "ImportJob"("tenantId", "createdById");

CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_entityType_entityId_idx" ON "AuditLog"("tenantId", "entityType", "entityId");
