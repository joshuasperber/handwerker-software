CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEISTER', 'BUERO', 'MONTEUR', 'KUNDE');
CREATE TYPE "OrderStatus" AS ENUM ('NEUE_ANFRAGE', 'TERMIN_GEBUCHT', 'EINGEPLANT', 'UNTERWEGS', 'IN_ARBEIT', 'ABGESCHLOSSEN', 'ABRECHNUNGSBEREIT', 'ABGERECHNET', 'STORNIERT');
CREATE TYPE "OrderPriority" AS ENUM ('NORMAL', 'DRINGEND', 'NOTFALL');
CREATE TYPE "AppointmentStatus" AS ENUM ('GEPLANT', 'UNTERWEGS', 'ANGEKOMMEN', 'IN_ARBEIT', 'ABGESCHLOSSEN', 'STORNIERT');
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS');
CREATE TYPE "NotificationType" AS ENUM ('BUCHUNGSBESTAETIGUNG', 'TERMINERINNERUNG', 'VERSPAETUNG', 'ABSCHLUSS', 'STATUSAENDERUNG');
CREATE TYPE "FileCategory" AS ENUM ('KUNDENFOTO', 'VORHER', 'NACHHER', 'DOKUMENT', 'ABSCHLUSS', 'PLAN', 'GRUNDRISS');
CREATE TYPE "QuestionType" AS ENUM ('TEXT', 'TEXTAREA', 'SELECT', 'CHECKBOX', 'NUMBER');
CREATE TYPE "FixedCostCategory" AS ENUM ('MIETE', 'STROM', 'WASSER', 'HEIZUNG', 'INTERNET_TELEFON', 'BUEROSOFTWARE', 'HANDWERKERSOFTWARE', 'BUCHHALTUNG', 'STEUERBERATER', 'VERSICHERUNGEN', 'FAHRZEUGLEASING', 'FAHRZEUGVERSICHERUNG', 'FAHRZEUGWARTUNG', 'LAGERKOSTEN', 'WERBUNG', 'WEBSITE', 'ARBEITSKLEIDUNG', 'WERKZEUGE', 'MASCHINENRUECKLAGEN', 'WEITERBILDUNG', 'BEITRAEGE', 'BANKGEBUEHREN', 'SONSTIGE');
CREATE TYPE "OverheadCalculationMode" AS ENUM ('PERCENTAGE', 'HOURLY_ALLOCATION', 'HYBRID');
CREATE TYPE "LaborType" AS ENUM ('ONSITE_WORK', 'WORKSHOP_WORK', 'PREPARATION', 'DOCUMENTATION', 'PLANNING', 'CLEANUP', 'EMERGENCY_SERVICE', 'INSPECTION', 'MAINTENANCE', 'REPAIR', 'INSTALLATION');
CREATE TYPE "AdditionalCostCategory" AS ENUM ('SUBCONTRACTOR', 'DISPOSAL', 'PERMIT', 'DELIVERY', 'RENTAL_EQUIPMENT', 'SPECIAL_TRANSPORT', 'PARKING', 'TOLL', 'EXPRESS_FEE', 'EMERGENCY_FEE', 'OTHER');
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'VERY_HIGH', 'CUSTOM');
CREATE TYPE "ProfitStrategy" AS ENUM ('PERCENT', 'FIXED_AMOUNT', 'TARGET_MARGIN');
CREATE TYPE "IncomeTaxAllocationMode" AS ENUM ('PER_HOUR', 'PER_ORDER', 'PROFIT_CHECK_ONLY');
CREATE TYPE "TravelCalculationMode" AS ENUM ('ZONE_FLAT_FEE', 'FORMULA');
CREATE TYPE "CalculationStatus" AS ENUM ('DRAFT', 'CALCULATED', 'OFFER_CREATED', 'INVOICE_CREATED', 'ARCHIVED');
CREATE TYPE "CalculationDocumentType" AS ENUM ('OFFER', 'ORDER_CONFIRMATION', 'INVOICE');
CREATE TYPE "MachineCostMethod" AS ENUM ('AMORTIZATION', 'FLAT_RATE');
CREATE TYPE "OrderType" AS ENUM ('RENOVIERUNG', 'INNENAUSBAU', 'REPARATUR', 'MONTAGE', 'ELEKTRO', 'BESICHTIGUNG', 'NACHARBEIT', 'NOTDIENST', 'SONSTIGES');
CREATE TYPE "MaterialOrderStatus" AS ENUM ('NOT_CHECKED', 'COMPLETE', 'PARTLY_AVAILABLE', 'MISSING', 'ORDERED', 'DELIVERED', 'PACKED', 'CONSUMED');
CREATE TYPE "CompletionResult" AS ENUM ('COMPLETED', 'PARTIALLY_COMPLETED', 'NOT_STARTED', 'NOT_POSSIBLE', 'REQUIRES_FOLLOW_UP', 'REQUIRES_MATERIAL_ORDER', 'CUSTOMER_NOT_AVAILABLE');
CREATE TYPE "CustomerConfirmationStatus" AS ENUM ('OFFEN', 'BESTAETIGT', 'ABGESAGT', 'NICHT_ERREICHBAR');
CREATE TYPE "OrderPhaseType" AS ENUM ('BESICHTIGUNG', 'PLANUNG', 'MATERIALBESTELLUNG', 'VORFERTIGUNG', 'AUSFUEHRUNG_1', 'AUSFUEHRUNG_2', 'ABNAHME', 'RECHNUNG', 'SONSTIGES');
CREATE TYPE "OrderPhaseStatus" AS ENUM ('AUSSTEHEND', 'IN_ARBEIT', 'ABGESCHLOSSEN', 'STORNIERT');
CREATE TYPE "ArticleType" AS ENUM ('VERBRAUCH', 'MATERIAL', 'WERKZEUG', 'MASCHINE', 'MIETE', 'FREMDLEISTUNG');
CREATE TYPE "StorageLocationType" AS ENUM ('HAUPTLAGER', 'FAHRZEUG', 'MITARBEITER', 'BAUSTELLE', 'RESERVIERT', 'DEFEKTLAGER');
CREATE TYPE "ReservationStatus" AS ENUM ('VORGESCHLAGEN', 'RESERVIERT', 'FREIGEGEBEN', 'VERBRAUCHT');
CREATE TYPE "StockMovementType" AS ENUM ('ZUGANG', 'ABGANG', 'UMBUCHUNG', 'VERBRAUCH', 'RUECKGABE', 'KORREKTUR');
CREATE TYPE "ReorderStrategy" AS ENUM ('MANUELL', 'MINDESTBESTAND_FIX', 'MINDESTBESTAND_ZIEL', 'AUFTRAGSBEZOGEN', 'KOMBINIERT');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'CONFIRMED', 'PARTLY_DELIVERED', 'DELIVERED', 'DELAYED', 'CANCELLED', 'RETURNED');
CREATE TYPE "EmployeeOperationalStatus" AS ENUM ('VERFUEGBAR', 'UNTERWEGS', 'BEIM_KUNDEN', 'PAUSE', 'KRANK', 'URLAUB', 'ABGESCHLOSSEN');
CREATE TYPE "AbsenceType" AS ENUM ('URLAUB', 'KRANK', 'SONSTIGES');
CREATE TYPE "PlanMarkerType" AS ENUM ('SCHALTER', 'STECKDOSE', 'LEUCHTE', 'TUER', 'RAUM', 'MATERIAL', 'SONSTIGES');
CREATE TYPE "StaffRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "zipCode" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#2563eb',
    "privacyPolicyUrl" TEXT,
    "imprintUrl" TEXT,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "notes" TEXT,
    "gdprConsent" BOOLEAN NOT NULL DEFAULT false,
    "gdprConsentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "notes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "priceCents" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ServiceQuestion" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'TEXT',
    "options" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ServiceQuestion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ServiceQualification" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "ServiceQualification_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "operationalStatus" "EmployeeOperationalStatus" NOT NULL DEFAULT 'VERFUEGBAR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EmployeeQualification" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "EmployeeQualification_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WorkingHours" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "WorkingHours_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EmployeeWorkingHours" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "EmployeeWorkingHours_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ServiceArea" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "zipFrom" TEXT NOT NULL,
    "zipTo" TEXT NOT NULL,
    CONSTRAINT "ServiceArea_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "title" TEXT,
    "orderType" "OrderType" NOT NULL DEFAULT 'REPARATUR',
    "status" "OrderStatus" NOT NULL DEFAULT 'NEUE_ANFRAGE',
    "priority" "OrderPriority" NOT NULL DEFAULT 'NORMAL',
    "materialStatus" "MaterialOrderStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "completionResult" "CompletionResult",
    "customerConfirmationStatus" "CustomerConfirmationStatus" NOT NULL DEFAULT 'OFFEN',
    "description" TEXT,
    "internalNotes" TEXT,
    "customerNotes" TEXT,
    "questionAnswers" JSONB,
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "invoicedAt" TIMESTAMP(3),
    "teamId" TEXT,
    "vehicleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OrderService" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "OrderService_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "employeeId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'GEPLANT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceId" TEXT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OrderChecklist" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),
    "checkedBy" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "OrderChecklist_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FileUpload" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "category" "FileCategory" NOT NULL DEFAULT 'KUNDENFOTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileUpload_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MaterialUsage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'Stk',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialUsage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT,
    "senderId" TEXT,
    "recipient" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "street" TEXT,
    "houseNumber" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'DE',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "defaultVatRate" DOUBLE PRECISION NOT NULL DEFAULT 19,
    "defaultHourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 68,
    "defaultWorkshopHourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 55,
    "defaultMaterialMarkupPercent" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "defaultProcurementHourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 55,
    "defaultOverheadPercent" DOUBLE PRECISION,
    "defaultRiskPercent" DOUBLE PRECISION NOT NULL DEFAULT 7,
    "defaultProfitPercent" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "defaultIncomeTaxPercent" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "defaultKilometerRate" DOUBLE PRECISION NOT NULL DEFAULT 0.45,
    "defaultTravelHourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 45,
    "additionalOverheadPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MonthlyFixedCost" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "FixedCostCategory" NOT NULL,
    "amountNet" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MonthlyFixedCost_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OverheadSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productiveHoursPerMonth" DOUBLE PRECISION NOT NULL DEFAULT 160,
    "overheadCalculationMode" "OverheadCalculationMode" NOT NULL DEFAULT 'HYBRID',
    "overheadPercent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OverheadSettings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "machineType" TEXT,
    "costMethod" "MachineCostMethod" NOT NULL DEFAULT 'AMORTIZATION',
    "flatRatePerHourNet" DOUBLE PRECISION,
    "purchasePriceNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "residualValueNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedLifetimeHours" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "expectedRepairCostsNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedMaintenanceCostsNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedConsumablePartsNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "insuranceCostsNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "energyCostsTotalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "breakageRiskPercent" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "calculatedHourlyRateNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TravelZone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minKm" DOUBLE PRECISION NOT NULL,
    "maxKm" DOUBLE PRECISION,
    "flatFeeNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "useFormula" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TravelZone_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Calculation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "orderId" TEXT,
    "title" TEXT,
    "status" "CalculationStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "laborTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "materialTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "machineTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "procurementTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "travelTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "additionalTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "directCosts" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overheadAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "incomeTaxOwnerAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalBeforeRisk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalAfterRisk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalesPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossSalesPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contributionMargin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contributionMarginRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marginPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minimumPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitAfterTaxEstimate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBillableHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitabilityStatus" TEXT NOT NULL DEFAULT 'unknown',
    "snapshotJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Calculation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LaborItem" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "laborType" "LaborType" NOT NULL DEFAULT 'ONSITE_WORK',
    "hours" DOUBLE PRECISION NOT NULL,
    "hourlyRateNet" DOUBLE PRECISION NOT NULL,
    "quantityWorkers" INTEGER NOT NULL DEFAULT 1,
    "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isVisibleToCustomer" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LaborItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MaterialItem" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'Stk',
    "purchasePriceNet" DOUBLE PRECISION NOT NULL,
    "markupPercent" DOUBLE PRECISION NOT NULL,
    "wastePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplierName" TEXT,
    "articleNumber" TEXT,
    "totalPurchaseNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSalesNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isVisibleToCustomer" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaterialItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MachineUsageItem" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "machineId" TEXT,
    "description" TEXT NOT NULL,
    "usageHours" DOUBLE PRECISION NOT NULL,
    "hourlyRateNet" DOUBLE PRECISION NOT NULL,
    "breakageRiskPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isVisibleToCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MachineUsageItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProcurementCost" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "description" TEXT,
    "purchasingTimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "procurementHourlyRateNet" DOUBLE PRECISION NOT NULL,
    "pickupDistanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pickupKilometerRateNet" DOUBLE PRECISION NOT NULL,
    "supplierFeesNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "packagingHandlingNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherCostsNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isVisibleToCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProcurementCost_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TravelCost" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "startAddress" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "estimatedDriveTimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "selectedZoneId" TEXT,
    "zoneName" TEXT,
    "zoneFlatFeeNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kilometerRateNet" DOUBLE PRECISION NOT NULL,
    "travelHourlyRateNet" DOUBLE PRECISION NOT NULL,
    "parkingFeesNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tollFeesNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherTravelCostsNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculationMode" "TravelCalculationMode" NOT NULL DEFAULT 'ZONE_FLAT_FEE',
    "isVisibleToCustomer" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TravelCost_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AdditionalCostItem" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "category" "AdditionalCostCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amountNet" DOUBLE PRECISION NOT NULL,
    "markupPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isVisibleToCustomer" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdditionalCostItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RiskSettings" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'NORMAL',
    "riskPercent" DOUBLE PRECISION NOT NULL DEFAULT 7,
    "riskReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RiskSettings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProfitSettings" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "profitPercent" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "profitStrategy" "ProfitStrategy" NOT NULL DEFAULT 'PERCENT',
    "targetProfitAmountNet" DOUBLE PRECISION,
    "targetMarginPercent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProfitSettings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IncomeTaxSettings" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "includeIncomeTaxCalculation" BOOLEAN NOT NULL DEFAULT false,
    "estimatedIncomeTaxPercent" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "estimatedPrivateInsurancePercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "estimatedOtherPrivateObligationsPercent" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "desiredNetOwnerIncomeMonthly" DOUBLE PRECISION NOT NULL DEFAULT 4000,
    "productiveHoursPerMonth" DOUBLE PRECISION NOT NULL DEFAULT 160,
    "allocationMode" "IncomeTaxAllocationMode" NOT NULL DEFAULT 'PROFIT_CHECK_ONLY',
    "manualOwnerAmountPerOrder" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IncomeTaxSettings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "VATSettings" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "vatRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 19,
    "reverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "vatNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VATSettings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CalculationDocument" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "documentType" "CalculationDocumentType" NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "customerNote" TEXT,
    "internalNote" TEXT,
    "pdfStorageKey" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalculationDocument_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'Stk',
    "category" TEXT,
    "articleType" "ArticleType" NOT NULL DEFAULT 'MATERIAL',
    "minimumStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorderQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "packageSize" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "reorderStrategy" "ReorderStrategy" NOT NULL DEFAULT 'MANUELL',
    "supplierName" TEXT,
    "purchasePriceNet" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StorageLocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationType" "StorageLocationType" NOT NULL DEFAULT 'HAUPTLAGER',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StorageLocation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "storageLocationId" TEXT NOT NULL,
    "onHandQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reservedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orderedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "storageLocationId" TEXT NOT NULL,
    "orderId" TEXT,
    "movementType" "StockMovementType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderMaterialLineId" TEXT,
    "articleId" TEXT NOT NULL,
    "storageLocationId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'VORGESCHLAGEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ServiceMaterialTemplate" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "articleId" TEXT,
    "name" TEXT NOT NULL,
    "defaultQuantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'Stk',
    "isReservable" BOOLEAN NOT NULL DEFAULT true,
    "isTool" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ServiceMaterialTemplate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OrderPhase" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phaseType" "OrderPhaseType" NOT NULL DEFAULT 'SONSTIGES',
    "status" "OrderPhaseStatus" NOT NULL DEFAULT 'AUSSTEHEND',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderPhase_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OrderMaterialLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "articleId" TEXT,
    "sourceServiceId" TEXT,
    "name" TEXT NOT NULL,
    "quantityRequired" DOUBLE PRECISION NOT NULL,
    "quantityConsumed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'Stk',
    "isTool" BOOLEAN NOT NULL DEFAULT false,
    "isPacked" BOOLEAN NOT NULL DEFAULT false,
    "lineStatus" "MaterialOrderStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderMaterialLine_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT,
    "poNumber" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "orderedAt" TIMESTAMP(3),
    "expectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "quantityOrdered" DOUBLE PRECISION NOT NULL,
    "quantityReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPriceNet" DOUBLE PRECISION,
    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "deliveredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ManualReorderSuggestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "supplierName" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManualReorderSuggestion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vehicleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "isForeman" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "licensePlate" TEXT,
    "storageLocationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EmployeeAbsence" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "AbsenceType" NOT NULL DEFAULT 'URLAUB',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeAbsence_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PlanMarker" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "markerType" "PlanMarkerType" NOT NULL DEFAULT 'SONSTIGES',
    "label" TEXT,
    "posX" DOUBLE PRECISION NOT NULL,
    "posY" DOUBLE PRECISION NOT NULL,
    "articleId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanMarker_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StaffAssignmentRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "StaffRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffAssignmentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");
CREATE UNIQUE INDEX "Customer_tenantId_email_key" ON "Customer"("tenantId", "email");
CREATE INDEX "Property_tenantId_zipCode_idx" ON "Property"("tenantId", "zipCode");
CREATE INDEX "Service_tenantId_isActive_idx" ON "Service"("tenantId", "isActive");
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");
CREATE UNIQUE INDEX "WorkingHours_tenantId_dayOfWeek_key" ON "WorkingHours"("tenantId", "dayOfWeek");
CREATE UNIQUE INDEX "EmployeeWorkingHours_employeeId_dayOfWeek_key" ON "EmployeeWorkingHours"("employeeId", "dayOfWeek");
CREATE INDEX "ServiceArea_tenantId_idx" ON "ServiceArea"("tenantId");
CREATE INDEX "Order_tenantId_status_idx" ON "Order"("tenantId", "status");
CREATE INDEX "Order_tenantId_createdAt_idx" ON "Order"("tenantId", "createdAt");
CREATE INDEX "Order_tenantId_materialStatus_idx" ON "Order"("tenantId", "materialStatus");
CREATE UNIQUE INDEX "Order_tenantId_orderNumber_key" ON "Order"("tenantId", "orderNumber");
CREATE INDEX "Appointment_tenantId_startTime_idx" ON "Appointment"("tenantId", "startTime");
CREATE INDEX "Appointment_employeeId_startTime_idx" ON "Appointment"("employeeId", "startTime");
CREATE INDEX "FileUpload_orderId_idx" ON "FileUpload"("orderId");
CREATE INDEX "Message_tenantId_orderId_idx" ON "Message"("tenantId", "orderId");
CREATE INDEX "AuditLog_tenantId_entityType_entityId_idx" ON "AuditLog"("tenantId", "entityType", "entityId");
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");
CREATE INDEX "NotificationLog_tenantId_sentAt_idx" ON "NotificationLog"("tenantId", "sentAt");
CREATE UNIQUE INDEX "CompanySettings_tenantId_key" ON "CompanySettings"("tenantId");
CREATE INDEX "MonthlyFixedCost_tenantId_isActive_idx" ON "MonthlyFixedCost"("tenantId", "isActive");
CREATE UNIQUE INDEX "OverheadSettings_tenantId_key" ON "OverheadSettings"("tenantId");
CREATE INDEX "Machine_tenantId_isActive_idx" ON "Machine"("tenantId", "isActive");
CREATE INDEX "TravelZone_tenantId_idx" ON "TravelZone"("tenantId");
CREATE INDEX "Calculation_tenantId_status_idx" ON "Calculation"("tenantId", "status");
CREATE INDEX "Calculation_tenantId_createdAt_idx" ON "Calculation"("tenantId", "createdAt");
CREATE UNIQUE INDEX "TravelCost_calculationId_key" ON "TravelCost"("calculationId");
CREATE UNIQUE INDEX "RiskSettings_calculationId_key" ON "RiskSettings"("calculationId");
CREATE UNIQUE INDEX "ProfitSettings_calculationId_key" ON "ProfitSettings"("calculationId");
CREATE UNIQUE INDEX "IncomeTaxSettings_calculationId_key" ON "IncomeTaxSettings"("calculationId");
CREATE UNIQUE INDEX "VATSettings_calculationId_key" ON "VATSettings"("calculationId");
CREATE INDEX "CalculationDocument_calculationId_idx" ON "CalculationDocument"("calculationId");
CREATE INDEX "Article_tenantId_isActive_idx" ON "Article"("tenantId", "isActive");
CREATE INDEX "Article_tenantId_category_idx" ON "Article"("tenantId", "category");
CREATE INDEX "StorageLocation_tenantId_isActive_idx" ON "StorageLocation"("tenantId", "isActive");
CREATE UNIQUE INDEX "StockBalance_articleId_storageLocationId_key" ON "StockBalance"("articleId", "storageLocationId");
CREATE INDEX "StockMovement_tenantId_createdAt_idx" ON "StockMovement"("tenantId", "createdAt");
CREATE INDEX "StockMovement_articleId_idx" ON "StockMovement"("articleId");
CREATE INDEX "Reservation_orderId_idx" ON "Reservation"("orderId");
CREATE INDEX "Reservation_articleId_idx" ON "Reservation"("articleId");
CREATE INDEX "ServiceMaterialTemplate_serviceId_idx" ON "ServiceMaterialTemplate"("serviceId");
CREATE INDEX "OrderPhase_orderId_sortOrder_idx" ON "OrderPhase"("orderId", "sortOrder");
CREATE INDEX "OrderMaterialLine_orderId_idx" ON "OrderMaterialLine"("orderId");
CREATE INDEX "PurchaseOrder_tenantId_status_idx" ON "PurchaseOrder"("tenantId", "status");
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_poNumber_key" ON "PurchaseOrder"("tenantId", "poNumber");
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");
CREATE INDEX "Delivery_tenantId_idx" ON "Delivery"("tenantId");
CREATE INDEX "ManualReorderSuggestion_tenantId_idx" ON "ManualReorderSuggestion"("tenantId");
CREATE INDEX "Team_tenantId_idx" ON "Team"("tenantId");
CREATE UNIQUE INDEX "TeamMember_teamId_employeeId_key" ON "TeamMember"("teamId", "employeeId");
CREATE UNIQUE INDEX "Vehicle_storageLocationId_key" ON "Vehicle"("storageLocationId");
CREATE INDEX "Vehicle_tenantId_idx" ON "Vehicle"("tenantId");
CREATE INDEX "EmployeeAbsence_employeeId_startDate_idx" ON "EmployeeAbsence"("employeeId", "startDate");
CREATE INDEX "PlanMarker_orderId_idx" ON "PlanMarker"("orderId");
CREATE INDEX "PlanMarker_fileId_idx" ON "PlanMarker"("fileId");
CREATE INDEX "StaffAssignmentRequest_employeeId_status_idx" ON "StaffAssignmentRequest"("employeeId", "status");
CREATE INDEX "StaffAssignmentRequest_orderId_idx" ON "StaffAssignmentRequest"("orderId");
CREATE INDEX "StaffAssignmentRequest_tenantId_status_idx" ON "StaffAssignmentRequest"("tenantId", "status");

ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Property" ADD CONSTRAINT "Property_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Property" ADD CONSTRAINT "Property_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceQuestion" ADD CONSTRAINT "ServiceQuestion_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceQualification" ADD CONSTRAINT "ServiceQualification_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeQualification" ADD CONSTRAINT "EmployeeQualification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkingHours" ADD CONSTRAINT "WorkingHours_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeWorkingHours" ADD CONSTRAINT "EmployeeWorkingHours_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceArea" ADD CONSTRAINT "ServiceArea_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderService" ADD CONSTRAINT "OrderService_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderService" ADD CONSTRAINT "OrderService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderChecklist" ADD CONSTRAINT "OrderChecklist_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialUsage" ADD CONSTRAINT "MaterialUsage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialUsage" ADD CONSTRAINT "MaterialUsage_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthlyFixedCost" ADD CONSTRAINT "MonthlyFixedCost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OverheadSettings" ADD CONSTRAINT "OverheadSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelZone" ADD CONSTRAINT "TravelZone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LaborItem" ADD CONSTRAINT "LaborItem_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialItem" ADD CONSTRAINT "MaterialItem_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MachineUsageItem" ADD CONSTRAINT "MachineUsageItem_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MachineUsageItem" ADD CONSTRAINT "MachineUsageItem_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProcurementCost" ADD CONSTRAINT "ProcurementCost_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelCost" ADD CONSTRAINT "TravelCost_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdditionalCostItem" ADD CONSTRAINT "AdditionalCostItem_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskSettings" ADD CONSTRAINT "RiskSettings_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfitSettings" ADD CONSTRAINT "ProfitSettings_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncomeTaxSettings" ADD CONSTRAINT "IncomeTaxSettings_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VATSettings" ADD CONSTRAINT "VATSettings_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalculationDocument" ADD CONSTRAINT "CalculationDocument_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_orderMaterialLineId_fkey" FOREIGN KEY ("orderMaterialLineId") REFERENCES "OrderMaterialLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceMaterialTemplate" ADD CONSTRAINT "ServiceMaterialTemplate_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceMaterialTemplate" ADD CONSTRAINT "ServiceMaterialTemplate_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderPhase" ADD CONSTRAINT "OrderPhase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderMaterialLine" ADD CONSTRAINT "OrderMaterialLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderMaterialLine" ADD CONSTRAINT "OrderMaterialLine_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualReorderSuggestion" ADD CONSTRAINT "ManualReorderSuggestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualReorderSuggestion" ADD CONSTRAINT "ManualReorderSuggestion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeAbsence" ADD CONSTRAINT "EmployeeAbsence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanMarker" ADD CONSTRAINT "PlanMarker_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanMarker" ADD CONSTRAINT "PlanMarker_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanMarker" ADD CONSTRAINT "PlanMarker_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StaffAssignmentRequest" ADD CONSTRAINT "StaffAssignmentRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffAssignmentRequest" ADD CONSTRAINT "StaffAssignmentRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffAssignmentRequest" ADD CONSTRAINT "StaffAssignmentRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffAssignmentRequest" ADD CONSTRAINT "StaffAssignmentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;;
