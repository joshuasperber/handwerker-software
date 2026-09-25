import "dotenv/config";

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string };

class ApiClient {
  private readonly cookies = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  private rememberCookies(headers: Headers) {
    const values =
      (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
      (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);
    for (const value of values) {
      const [pair] = value.split(";", 1);
      const separator = pair.indexOf("=");
      if (separator > 0) this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    headers.set("origin", this.baseUrl);
    if (this.cookies.size) {
      headers.set(
        "cookie",
        [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ")
      );
    }
    const response = await fetch(new URL(path, this.baseUrl), { ...init, headers });
    this.rememberCookies(response.headers);
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok || !payload?.success) {
      throw new Error(
        `${init.method ?? "GET"} ${path}: ${response.status} ${payload?.error ?? "Ungültige Antwort"}`
      );
    }
    return payload.data as T;
  }

  json<T>(path: string, method: string, body: unknown) {
    return this.request<T>(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  login(email: string, password: string, tenantSlug?: string) {
    return this.json<{ redirectTo: string }>("/api/auth/login", "POST", {
      email,
      password,
      ...(tenantSlug ? { tenantSlug } : {}),
    });
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} fehlt`);
  return value;
}

async function main() {
  if (process.env.E2E_CONFIRM_WRITES !== "1") {
    throw new Error(
      "Abbruch: E2E_CONFIRM_WRITES=1 ist erforderlich. Der Lauf erzeugt Testdaten im Zielsystem."
    );
  }

  const baseUrl = new URL(required("E2E_BASE_URL")).origin;
  const adminEmail = required("E2E_ADMIN_EMAIL");
  const adminPassword = required("E2E_ADMIN_PASSWORD");
  const monteurEmail = required("E2E_MONTEUR_EMAIL").toLowerCase();
  const monteurPassword = required("E2E_MONTEUR_PASSWORD");
  const tenantSlug = process.env.E2E_TENANT_SLUG?.trim() || undefined;
  const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const marker = `[E2E-${runId}]`;

  const admin = new ApiClient(baseUrl);
  await admin.login(adminEmail, adminPassword, tenantSlug);

  const health = await admin.request<{
    ok: boolean;
    checks: Record<string, { status: string; message?: string }>;
    config: Record<string, boolean>;
  }>("/api/health", { method: "POST" });
  if (health.checks.database?.status !== "ok") {
    throw new Error("Staging-Datenbank ist nicht gesund");
  }

  const messaging = await admin.request<{
    email: { configured: boolean; missing: string[] };
    messaging: { configured: boolean; missing: string[] };
  }>("/api/notification-settings/runtime");

  const services = await admin.request<
    Array<{ id: string; name: string; priceCents: number | null; isActive: boolean }>
  >("/api/services");
  const service = services.find((item) => item.isActive && (item.priceCents ?? 0) > 0);
  if (!service) throw new Error("Für den E2E-Lauf wird eine aktive Leistung mit Preis benötigt");

  const employees = await admin.request<
    Array<{ id: string; user: { email: string; role: string; isActive: boolean } }>
  >("/api/employees");
  const employee = employees.find(
    (item) => item.user.email.toLowerCase() === monteurEmail && item.user.isActive
  );
  if (!employee) throw new Error(`Aktiver Monteur ${monteurEmail} nicht gefunden`);

  const customer = await admin.json<{
    id: string;
    properties: Array<{ id: string }>;
  }>("/api/customers", "POST", {
    firstName: "E2E",
    lastName: runId,
    email: process.env.E2E_CUSTOMER_EMAIL || `e2e-${runId}@example.invalid`,
    contactAllowed: false,
    appointmentRemindersEnabled: false,
    notes: `${marker} automatischer Staging-Test`,
    property: {
      label: "E2E-Testobjekt",
      street: "Teststraße 1",
      zipCode: "10115",
      city: "Berlin",
    },
  });
  const propertyId = customer.properties[0]?.id;
  if (!propertyId) throw new Error("Testkunde wurde ohne Objekt angelegt");

  const order = await admin.json<{ id: string; orderNumber: string }>(
    "/api/orders",
    "POST",
    {
      customerId: customer.id,
      propertyId,
      serviceIds: [service.id],
      description: `${marker} Kernworkflow`,
      internalNotes: "Automatisch erzeugter Staging-Datensatz; darf nach dem Lauf gelöscht werden.",
    }
  );

  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 45);
  start.setUTCHours(9, Number(runId.slice(-2)) % 60, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const appointment = await admin.json<{ id: string }>("/api/appointments", "POST", {
    orderId: order.id,
    employeeId: employee.id,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    notes: marker,
  });

  let storageUpload: "ok" | "skipped" = "skipped";
  if (health.config.s3Configured && process.env.E2E_VERIFY_STORAGE !== "0") {
    const onePixelPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    );
    const form = new FormData();
    form.append("file", new File([onePixelPng], `${runId}.png`, { type: "image/png" }));
    form.append("category", "DOKUMENT");
    form.append("description", marker);
    await admin.request(`/api/orders/${order.id}/files`, { method: "POST", body: form });
    storageUpload = "ok";
  }

  const monteur = new ApiClient(baseUrl);
  await monteur.login(monteurEmail, monteurPassword, tenantSlug);
  await monteur.request(`/api/monteur/orders/${order.id}`);
  await monteur.json(`/api/monteur/appointments/${appointment.id}`, "PATCH", {
    status: "UNTERWEGS",
  });
  await monteur.json(`/api/monteur/appointments/${appointment.id}`, "PATCH", {
    status: "IN_ARBEIT",
  });

  const timeStart = new Date(Date.now() - 35 * 60 * 1000);
  const timeEntry = await monteur.json<{ id: string }>(
    `/api/monteur/orders/${order.id}/time`,
    "POST",
    {
      startTime: timeStart.toISOString(),
      activity: "Ausführung",
      notes: marker,
    }
  );
  await monteur.json(`/api/monteur/time/${timeEntry.id}`, "PATCH", {
    endTime: new Date().toISOString(),
  });
  await monteur.json(`/api/monteur/appointments/${appointment.id}`, "PATCH", {
    status: "ABGESCHLOSSEN",
  });

  const calculationResult = await admin.request<{
    calculation: { id: string };
    created: boolean;
  }>(`/api/orders/${order.id}/calculation`, { method: "POST" });
  const invoiceResult = await admin.json<{
    document: { id: string; documentNumber: string; grossAmount: number };
  }>(`/api/calculations/${calculationResult.calculation.id}/convert-to-invoice`, "POST", {
    mode: "create",
  });
  if (!(invoiceResult.document.grossAmount > 0)) {
    throw new Error("Die erzeugte Rechnung hat keinen positiven Bruttobetrag");
  }
  const payment = await admin.json<{ paidAmount: number; status: string }>(
    `/api/documents/${invoiceResult.document.id}/payments`,
    "POST",
    {
      amount: invoiceResult.document.grossAmount,
      method: "UEBERWEISUNG",
      note: marker,
    }
  );
  if (payment.status !== "BEZAHLT") {
    throw new Error(`Rechnung ist nach Vollzahlung nicht BEZAHLT (${payment.status})`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        marker,
        customerId: customer.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        appointmentId: appointment.id,
        calculationId: calculationResult.calculation.id,
        invoiceId: invoiceResult.document.id,
        invoiceNumber: invoiceResult.document.documentNumber,
        paymentStatus: payment.status,
        integrations: {
          database: health.checks.database?.status,
          storageHealth: health.checks.storage?.status,
          storageUpload,
          smtpConfigured: messaging.email.configured,
          smsConfigured: messaging.messaging.configured,
          cron: health.checks.cron?.status,
        },
        note: "Testdaten bleiben absichtlich mit E2E-Marker im isolierten Staging erhalten.",
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
