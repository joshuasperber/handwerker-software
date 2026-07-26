-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('GEPLANT', 'AKTIV', 'PAUSIERT', 'ABGESCHLOSSEN', 'ABGERECHNET', 'STORNIERT');

-- CreateEnum
CREATE TYPE "ProjectCostSource" AS ENUM ('MANUAL', 'INVENTORY', 'EXPENSE', 'ORDER_MATERIAL', 'RECEIPT', 'INVOICE', 'ORDER');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "addressStreet" TEXT,
    "addressZip" TEXT,
    "addressCity" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL DEFAULT 'GEPLANT',
    "description" TEXT,
    "notes" TEXT,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectNote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orderId" TEXT,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orderId" TEXT,
    "uploadedById" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "category" "FileCategory" NOT NULL DEFAULT 'BAUSTELLE',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectCost" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orderId" TEXT,
    "source" "ProjectCostSource" NOT NULL DEFAULT 'MANUAL',
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "vatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isReimbursable" BOOLEAN NOT NULL DEFAULT false,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "expenseId" TEXT,
    "articleId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectCost_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "Calculation" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

CREATE INDEX "Project_tenantId_status_idx" ON "Project"("tenantId", "status");
CREATE INDEX "Project_tenantId_createdAt_idx" ON "Project"("tenantId", "createdAt");
CREATE INDEX "Project_customerId_idx" ON "Project"("customerId");
CREATE UNIQUE INDEX "ProjectMember_projectId_employeeId_key" ON "ProjectMember"("projectId", "employeeId");
CREATE INDEX "ProjectMember_employeeId_idx" ON "ProjectMember"("employeeId");
CREATE INDEX "ProjectNote_projectId_createdAt_idx" ON "ProjectNote"("projectId", "createdAt");
CREATE INDEX "ProjectNote_orderId_idx" ON "ProjectNote"("orderId");
CREATE INDEX "ProjectFile_projectId_createdAt_idx" ON "ProjectFile"("projectId", "createdAt");
CREATE INDEX "ProjectFile_orderId_idx" ON "ProjectFile"("orderId");
CREATE INDEX "ProjectCost_projectId_createdAt_idx" ON "ProjectCost"("projectId", "createdAt");
CREATE INDEX "ProjectCost_orderId_idx" ON "ProjectCost"("orderId");
CREATE INDEX "ProjectCost_expenseId_idx" ON "ProjectCost"("expenseId");
CREATE INDEX IF NOT EXISTS "Order_projectId_idx" ON "Order"("projectId");
CREATE INDEX IF NOT EXISTS "Expense_projectId_idx" ON "Expense"("projectId");
CREATE INDEX IF NOT EXISTS "Calculation_projectId_idx" ON "Calculation"("projectId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectNote" ADD CONSTRAINT "ProjectNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectNote" ADD CONSTRAINT "ProjectNote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectNote" ADD CONSTRAINT "ProjectNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
