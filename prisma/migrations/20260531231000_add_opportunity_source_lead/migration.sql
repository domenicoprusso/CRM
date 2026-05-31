ALTER TABLE "Opportunity" ADD COLUMN "sourceLeadId" TEXT;

CREATE UNIQUE INDEX "Opportunity_sourceLeadId_key" ON "Opportunity"("sourceLeadId");

ALTER TABLE "Opportunity"
ADD CONSTRAINT "Opportunity_sourceLeadId_fkey"
FOREIGN KEY ("sourceLeadId") REFERENCES "Lead"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
