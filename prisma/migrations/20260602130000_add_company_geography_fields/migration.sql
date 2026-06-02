ALTER TABLE "Company"
ADD COLUMN "region" TEXT,
ADD COLUMN "province" TEXT,
ADD COLUMN "postalCode" TEXT;

CREATE INDEX "Company_tenantId_region_idx" ON "Company"("tenantId", "region");
CREATE INDEX "Company_tenantId_province_idx" ON "Company"("tenantId", "province");
CREATE INDEX "Company_tenantId_postalCode_idx" ON "Company"("tenantId", "postalCode");
