import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPrismaClient } from "../src/lib/prisma";
import { calcMachineHourlyRate } from "../src/lib/calculation/formulas";
import { normalizeEmployeeColors } from "../src/lib/employee-colors";

const prisma = createPrismaClient();

async function seedInventory(tenantId: string) {
  const mainLocation = await prisma.storageLocation.upsert({
    where: { id: `demo-hauptlager-${tenantId}` },
    update: {},
    create: {
      id: `demo-hauptlager-${tenantId}`,
      tenantId,
      name: "Hauptlager Werkstatt",
      locationType: "HAUPTLAGER",
      description: "Zentraler Lagerort",
    },
  });

  await prisma.storageLocation.upsert({
    where: { id: `demo-fahrzeug-${tenantId}` },
    update: {},
    create: {
      id: `demo-fahrzeug-${tenantId}`,
      tenantId,
      name: "Transporter 1",
      locationType: "FAHRZEUG",
    },
  });

  const articleDefs = [
    { name: "Türzarge", sku: "TUR-ZRG", category: "Türen", unit: "Stk", min: 2, target: 10, stock: 6 },
    { name: "Türblatt", sku: "TUR-BLT", category: "Türen", unit: "Stk", min: 2, target: 8, stock: 4 },
    { name: "Montageschaum", sku: "SCH-AUM", category: "Verbrauch", unit: "Stk", min: 5, target: 20, stock: 12 },
    { name: "Spachtelmasse 25 kg", sku: "SPA-25", category: "Trockenbau", unit: "Sack", min: 3, target: 15, stock: 8 },
    { name: "Gipskartonplatte", sku: "GKP-12", category: "Trockenbau", unit: "Stk", min: 10, target: 50, stock: 30 },
    { name: "Schrauben/Dübel Set", sku: "SCH-SET", category: "Verbrauch", unit: "Set", min: 10, target: 40, stock: 25 },
  ];

  const articleIds: Record<string, string> = {};

  for (const def of articleDefs) {
    const existing = await prisma.article.findFirst({
      where: { tenantId, sku: def.sku },
    });
    const article =
      existing ??
      (await prisma.article.create({
        data: {
          tenantId,
          name: def.name,
          sku: def.sku,
          category: def.category,
          unit: def.unit,
          minimumStock: def.min,
          targetStock: def.target,
          reorderStrategy: "MINDESTBESTAND_ZIEL",
          packageSize: 1,
        },
      }));
    articleIds[def.sku] = article.id;

    await prisma.stockBalance.upsert({
      where: {
        articleId_storageLocationId: {
          articleId: article.id,
          storageLocationId: mainLocation.id,
        },
      },
      update: {},
      create: {
        articleId: article.id,
        storageLocationId: mainLocation.id,
        onHandQuantity: def.stock,
      },
    });
  }

  let turService = await prisma.service.findFirst({
    where: { tenantId, name: "Tür montieren" },
  });

  if (!turService) {
    turService = await prisma.service.create({
      data: {
        tenantId,
        name: "Tür montieren",
        description: "Zarge setzen, Tür einhängen, Funktion prüfen",
        durationMinutes: 180,
        bufferMinutes: 15,
        priceCents: 45000,
        sortOrder: 10,
        qualifications: { create: [{ name: "Innenausbau" }] },
      },
    });
  }

  const templateCount = await prisma.serviceMaterialTemplate.count({
    where: { serviceId: turService.id },
  });

  if (templateCount === 0) {
    await prisma.serviceMaterialTemplate.createMany({
      data: [
        { serviceId: turService.id, articleId: articleIds["TUR-ZRG"], name: "Türzarge", defaultQuantity: 1, unit: "Stk" },
        { serviceId: turService.id, articleId: articleIds["TUR-BLT"], name: "Türblatt", defaultQuantity: 1, unit: "Stk" },
        { serviceId: turService.id, articleId: articleIds["SCH-AUM"], name: "Montageschaum", defaultQuantity: 1, unit: "Stk" },
        { serviceId: turService.id, articleId: articleIds["SCH-SET"], name: "Schrauben/Dübel", defaultQuantity: 1, unit: "Set" },
        { serviceId: turService.id, name: "Wasserwaage", defaultQuantity: 1, unit: "Stk", isTool: true, isReservable: false },
        { serviceId: turService.id, name: "Akkuschrauber", defaultQuantity: 1, unit: "Stk", isTool: true, isReservable: false },
      ],
    });
  }

  console.log("Inventar-Demo: Hauptlager, Fahrzeug, 6 Artikel, Leistung „Tür montieren“ mit Stückliste");
}

async function seedPhase3to5(tenantId: string) {
  const employees = await prisma.employee.findMany({ where: { tenantId }, take: 2 });
  const employeeIds = employees.map((e) => e.id);
  const fahrzeugLocation = await prisma.storageLocation.findFirst({
    where: { tenantId, locationType: "FAHRZEUG" },
  });
  if (!fahrzeugLocation) return;

  let vehicle = await prisma.vehicle.findFirst({ where: { tenantId } });
  if (!vehicle) {
    vehicle = await prisma.vehicle.create({
      data: {
        tenantId,
        name: "Transporter 1",
        licensePlate: "B-DM 1234",
        storageLocationId: fahrzeugLocation.id,
      },
    });
  }

  const schaum = await prisma.article.findFirst({ where: { tenantId, sku: "SCH-AUM" } });
  if (schaum) {
    await prisma.stockBalance.upsert({
      where: {
        articleId_storageLocationId: { articleId: schaum.id, storageLocationId: fahrzeugLocation.id },
      },
      update: {},
      create: { articleId: schaum.id, storageLocationId: fahrzeugLocation.id, onHandQuantity: 3 },
    });
  }

  let team = await prisma.team.findFirst({ where: { tenantId, name: "Team Alpha" } });
  if (!team && employeeIds.length >= 2) {
    team = await prisma.team.create({
      data: {
        tenantId,
        name: "Team Alpha",
        vehicleId: vehicle.id,
        members: {
          create: [
            { employeeId: employeeIds[0], isForeman: true },
            { employeeId: employeeIds[1], isForeman: false },
          ],
        },
      },
    });
  }

  const poCount = await prisma.purchaseOrder.count({ where: { tenantId } });
  if (poCount === 0 && schaum) {
    await prisma.purchaseOrder.create({
      data: {
        tenantId,
        poNumber: "PO-2026-1001",
        supplierName: "Baustoff Großhandel",
        status: "ORDERED",
        orderedAt: new Date(),
        expectedAt: new Date(Date.now() + 3 * 86400000),
        lines: {
          create: [{ articleId: schaum.id, quantityOrdered: 10, unitPriceNet: 4.5 }],
        },
      },
    });
  }

  if (employeeIds[0]) {
    const absenceCount = await prisma.employeeAbsence.count({ where: { employeeId: employeeIds[0] } });
    if (absenceCount === 0) {
      const start = new Date();
      start.setDate(start.getDate() + 14);
      const end = new Date(start);
      end.setDate(end.getDate() + 5);
      await prisma.employeeAbsence.create({
        data: { employeeId: employeeIds[0], type: "URLAUB", startDate: start, endDate: end },
      });
    }
  }

  console.log("Phase 3–5 Demo: Fahrzeug, Team Alpha, Bestellung, Urlaub");
}

async function main() {
  console.log("Seeding database...");

  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      slug: "demo",
      name: "Mustermann Sanitär GmbH",
      email: "info@mustermann-sanitaer.de",
      phone: "+49 30 12345678",
      address: "Musterstraße 1",
      city: "Berlin",
      zipCode: "10115",
      primaryColor: "#2563eb",
      bufferMinutes: 15,
      privacyPolicyUrl: "/datenschutz",
    },
  });

  const passwordHash = await bcrypt.hash("demo1234", 12);

  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@demo.de" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "admin@demo.de",
      passwordHash,
      firstName: "Max",
      lastName: "Admin",
      role: "ADMIN",
    },
  });

  const buero = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "buero@demo.de" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "buero@demo.de",
      passwordHash,
      firstName: "Anna",
      lastName: "Büro",
      role: "BUERO",
    },
  });

  const monteurUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "monteur@demo.de" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "monteur@demo.de",
      passwordHash,
      firstName: "Tom",
      lastName: "Monteur",
      role: "MONTEUR",
    },
  });

  const monteur2User = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "monteur2@demo.de" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "monteur2@demo.de",
      passwordHash,
      firstName: "Lisa",
      lastName: "Klein",
      role: "MONTEUR",
    },
  });

  const employee1 = await prisma.employee.upsert({
    where: { userId: monteurUser.id },
    update: { color: "#3b82f6" },
    create: {
      tenantId: tenant.id,
      userId: monteurUser.id,
      color: "#3b82f6",
      qualifications: {
        create: [{ name: "Sanitär" }, { name: "Heizung" }],
      },
    },
  });

  const employee2 = await prisma.employee.upsert({
    where: { userId: monteur2User.id },
    update: { color: "#10b981" },
    create: {
      tenantId: tenant.id,
      userId: monteur2User.id,
      color: "#10b981",
      qualifications: {
        create: [{ name: "Sanitär" }, { name: "Elektro" }],
      },
    },
  });

  for (let day = 1; day <= 5; day++) {
    await prisma.workingHours.upsert({
      where: { tenantId_dayOfWeek: { tenantId: tenant.id, dayOfWeek: day } },
      update: {},
      create: {
        tenantId: tenant.id,
        dayOfWeek: day,
        startTime: "08:00",
        endTime: "17:00",
      },
    });
  }

  for (const emp of [employee1, employee2]) {
    for (let day = 1; day <= 5; day++) {
      await prisma.employeeWorkingHours.upsert({
        where: { employeeId_dayOfWeek: { employeeId: emp.id, dayOfWeek: day } },
        update: {},
        create: {
          employeeId: emp.id,
          dayOfWeek: day,
          startTime: "08:00",
          endTime: "17:00",
        },
      });
    }
  }

  await prisma.serviceArea.upsert({
    where: { id: "demo-area-berlin" },
    update: {},
    create: {
      id: "demo-area-berlin",
      tenantId: tenant.id,
      label: "Berlin & Umgebung",
      zipFrom: "10000",
      zipTo: "14999",
    },
  });

  const existingServices = await prisma.service.count({ where: { tenantId: tenant.id } });
  await seedInventory(tenant.id);
  await seedPhase3to5(tenant.id);
  if (existingServices > 0) {
    console.log("Demo-Daten bereits vorhanden, überspringe Beispiel-Aufträge.");
    console.log("Demo accounts (password: demo1234):");
    console.log("  admin@demo.de (Admin)");
    console.log("  buero@demo.de (Büro)");
    console.log("  monteur@demo.de (Monteur)");
    console.log(`Booking widget: /buchen/demo`);
    return;
  }

  const service1 = await prisma.service.create({
    data: {
      tenantId: tenant.id,
      name: "Rohrreinigung",
      description: "Professionelle Rohrreinigung für verstopfte Abflüsse",
      durationMinutes: 60,
      bufferMinutes: 15,
      priceCents: 8900,
      sortOrder: 1,
      qualifications: { create: [{ name: "Sanitär" }] },
      questions: {
        create: [
          { question: "Wo befindet sich die Verstopfung?", type: "SELECT", options: ["Küche", "Bad", "Keller", "Außenbereich"], isRequired: true, sortOrder: 1 },
          { question: "Seit wann besteht das Problem?", type: "TEXT", isRequired: false, sortOrder: 2 },
        ],
      },
    },
  });

  const service2 = await prisma.service.create({
    data: {
      tenantId: tenant.id,
      name: "Heizungswartung",
      description: "Jährliche Wartung Ihrer Heizungsanlage",
      durationMinutes: 90,
      bufferMinutes: 15,
      priceCents: 14900,
      sortOrder: 2,
      qualifications: { create: [{ name: "Heizung" }] },
      questions: {
        create: [
          { question: "Art der Heizung", type: "SELECT", options: ["Gas", "Öl", "Wärmepumpe", "Pellet"], isRequired: true, sortOrder: 1 },
        ],
      },
    },
  });

  const checklistTemplate = await prisma.checklistTemplate.create({
    data: {
      tenantId: tenant.id,
      serviceId: service1.id,
      name: "Rohrreinigung Standard",
      items: {
        create: [
          { label: "Arbeitsbereich abgesichert", sortOrder: 1, isRequired: true },
          { label: "Verstopfung lokalisiert", sortOrder: 2, isRequired: true },
          { label: "Rohr gereinigt", sortOrder: 3, isRequired: true },
          { label: "Dichtheit geprüft", sortOrder: 4, isRequired: true },
          { label: "Arbeitsplatz gereinigt", sortOrder: 5, isRequired: false },
          { label: "Kunde informiert", sortOrder: 6, isRequired: true },
        ],
      },
    },
  });

  const customer = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      firstName: "Peter",
      lastName: "Schmidt",
      email: "peter.schmidt@example.de",
      phone: "+49 170 1234567",
      gdprConsent: true,
      gdprConsentAt: new Date(),
      properties: {
        create: {
          tenantId: tenant.id,
          label: "Wohnung",
          street: "Hauptstraße 42",
          zipCode: "10115",
          city: "Berlin",
        },
      },
    },
    include: { properties: true },
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(11, 15, 0, 0);

  const order = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      customerId: customer.id,
      propertyId: customer.properties[0].id,
      orderNumber: "AUF-2026-1001",
      status: "EINGEPLANT",
      description: "Verstopfter Küchenabfluss",
      scheduledStart: tomorrow,
      scheduledEnd: tomorrowEnd,
      services: { create: [{ serviceId: service1.id }] },
      appointments: {
        create: {
          tenantId: tenant.id,
          employeeId: employee1.id,
          startTime: tomorrow,
          endTime: tomorrowEnd,
          status: "GEPLANT",
        },
      },
      checklists: {
        create: (await prisma.checklistItem.findMany({ where: { templateId: checklistTemplate.id } })).map((item) => ({
          templateId: checklistTemplate.id,
          label: item.label,
          sortOrder: item.sortOrder,
        })),
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: admin.id,
      entityType: "Order",
      entityId: order.id,
      action: "SEED_CREATED",
      newValues: { orderNumber: order.orderNumber },
    },
  });

  await prisma.companySettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      companyName: tenant.name,
      street: "Musterstraße",
      houseNumber: "1",
      postalCode: "10115",
      city: "Berlin",
      defaultHourlyRate: 68,
      defaultWorkshopHourlyRate: 55,
      defaultMaterialMarkupPercent: 25,
      defaultProcurementHourlyRate: 55,
      defaultRiskPercent: 7,
      defaultProfitPercent: 12,
      defaultKilometerRate: 0.45,
      defaultTravelHourlyRate: 45,
    },
  });

  await prisma.overheadSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      productiveHoursPerMonth: 160,
      overheadCalculationMode: "HOURLY_ALLOCATION",
    },
  });

  const existingZones = await prisma.travelZone.count({ where: { tenantId: tenant.id } });
  if (existingZones === 0) {
    await prisma.travelZone.createMany({
      data: [
        { tenantId: tenant.id, name: "Zone 1", minKm: 0, maxKm: 10, flatFeeNet: 35, useFormula: false, sortOrder: 1 },
        { tenantId: tenant.id, name: "Zone 2", minKm: 10.01, maxKm: 25, flatFeeNet: 59, useFormula: false, sortOrder: 2 },
        { tenantId: tenant.id, name: "Zone 3", minKm: 25.01, maxKm: 50, flatFeeNet: 89, useFormula: false, sortOrder: 3 },
        { tenantId: tenant.id, name: "Zone 4", minKm: 50.01, maxKm: null, flatFeeNet: 0, useFormula: true, sortOrder: 4 },
      ],
    });
  }

  const existingFixed = await prisma.monthlyFixedCost.count({ where: { tenantId: tenant.id } });
  if (existingFixed === 0) {
    await prisma.monthlyFixedCost.create({
      data: {
        tenantId: tenant.id,
        name: "Betriebsfixkosten (Demo)",
        category: "SONSTIGE",
        amountNet: 4000,
        isActive: true,
        notes: "Summe monatlicher Fixkosten für Kalkulationsbeispiel",
      },
    });
  }

  const machineRate = calcMachineHourlyRate({
    purchasePriceNet: 2500,
    residualValueNet: 300,
    expectedLifetimeHours: 800,
    expectedRepairCostsNet: 700,
    expectedMaintenanceCostsNet: 0,
    expectedConsumablePartsNet: 500,
    insuranceCostsNet: 0,
    energyCostsTotalNet: 0,
    breakageRiskPercent: 15,
  });

  const existingMachine = await prisma.machine.findFirst({ where: { tenantId: tenant.id } });
  if (!existingMachine) {
    await prisma.machine.create({
      data: {
        tenantId: tenant.id,
        name: "Demo-Maschine",
        machineType: "Werkzeug",
        purchasePriceNet: 2500,
        residualValueNet: 300,
        expectedLifetimeHours: 800,
        expectedRepairCostsNet: 700,
        expectedConsumablePartsNet: 500,
        breakageRiskPercent: 15,
        calculatedHourlyRateNet: machineRate,
      },
    });
  }

  await seedInventory(tenant.id);
  await seedPhase3to5(tenant.id);
  await normalizeEmployeeColors(tenant.id);

  console.log("Seed completed!");
  console.log("Demo accounts (password: demo1234):");
  console.log("  admin@demo.de (Admin)");
  console.log("  buero@demo.de (Büro)");
  console.log("  monteur@demo.de (Monteur)");
  console.log("  monteur2@demo.de (Monteur)");
  console.log(`Booking widget: /buchen/demo`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
