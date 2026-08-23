import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePhoneNumber, isValidE164 } from "../src/lib/phone";
import { resolveReminderDelivery } from "../src/lib/reminder-channel";
import { renderReminderSms, renderReminderEmail, buildReminderVars } from "../src/lib/reminder-templates";
import { getMessagingStatus } from "../src/lib/messaging/config";

describe("parsePhoneNumber", () => {
  it("normalizes German mobile numbers to E.164", () => {
    const parsed = parsePhoneNumber("0176 12345678");
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.e164, "+4917612345678");
  });

  it("keeps international numbers", () => {
    const parsed = parsePhoneNumber("+43 664 1234567");
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.e164, "+436641234567");
  });

  it("accepts 00 prefix", () => {
    const parsed = parsePhoneNumber("004917612345678");
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.e164, "+4917612345678");
  });

  it("rejects invalid numbers", () => {
    const parsed = parsePhoneNumber("123");
    assert.equal(parsed.ok, false);
  });

  it("treats empty as missing, not invalid", () => {
    const parsed = parsePhoneNumber("  ");
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.e164, null);
  });

  it("validates E.164", () => {
    assert.equal(isValidE164("+4917612345678"), true);
    assert.equal(isValidE164("017612345678"), false);
  });

  it("accepts a German Twilio trial number", () => {
    const parsed = parsePhoneNumber("+4915888623971");
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.e164, "+4915888623971");
  });

  it("treats 49… without plus as international, not +4949…", () => {
    const parsed = parsePhoneNumber("4915259655035");
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.e164, "+4915259655035");
  });
});

const settingsOn = {
  appointmentReminderEnabled: true,
  remindCustomer: true,
  defaultEmail: true,
  defaultSms: true,
};

describe("resolveReminderDelivery", () => {
  const runtime = { messagingConfigured: true };

  it("sends email when only email exists", () => {
    const result = resolveReminderDelivery(
      { email: "kunde@example.com", phone: null },
      settingsOn,
      runtime
    );
    assert.equal(result.action, "send");
    if (result.action === "send") {
      assert.equal(result.channel, "EMAIL");
      assert.equal(result.recipient, "kunde@example.com");
    }
  });

  it("sends SMS when only phone exists", () => {
    const result = resolveReminderDelivery(
      { email: "max.mustermann@kunde.local", phone: "+4917612345678" },
      settingsOn,
      runtime
    );
    assert.equal(result.action, "send");
    if (result.action === "send") {
      assert.equal(result.channel, "SMS");
      assert.equal(result.recipient, "+4917612345678");
    }
  });

  it("prefers SMS when email and phone exist", () => {
    const result = resolveReminderDelivery(
      { email: "kunde@example.com", phone: "017612345678" },
      settingsOn,
      runtime
    );
    assert.equal(result.action, "send");
    if (result.action === "send") {
      assert.equal(result.channel, "SMS");
    }
  });

  it("skips without contact data", () => {
    const result = resolveReminderDelivery(
      { email: "a.b@kunde.local", phone: "" },
      settingsOn,
      runtime
    );
    assert.equal(result.action, "skip");
    if (result.action === "skip") {
      assert.equal(result.status, "NO_CONTACT");
      assert.match(result.reason, /Keine Kontaktdaten/);
    }
  });

  it("flags invalid phone when it is the only contact", () => {
    const result = resolveReminderDelivery(
      { email: "", phone: "abc" },
      settingsOn,
      runtime
    );
    assert.equal(result.action, "skip");
    if (result.action === "skip") assert.equal(result.status, "INVALID_PHONE");
  });

  it("falls back to email when SMS is not configured", () => {
    const result = resolveReminderDelivery(
      { email: "kunde@example.com", phone: "+4917612345678" },
      settingsOn,
      { messagingConfigured: false }
    );
    assert.equal(result.action, "send");
    if (result.action === "send") assert.equal(result.channel, "EMAIL");
  });

  it("respects disabled customer reminders", () => {
    const result = resolveReminderDelivery(
      {
        email: "kunde@example.com",
        phone: "+4917612345678",
        appointmentRemindersEnabled: false,
      },
      settingsOn,
      runtime
    );
    assert.equal(result.action, "skip");
    if (result.action === "skip") assert.equal(result.status, "DISABLED");
  });
});

describe("reminder templates", () => {
  it("fills SMS and email placeholders", () => {
    const vars = buildReminderVars({
      startTime: new Date("2026-08-22T08:00:00.000Z"),
      customerName: "Erika Muster",
      companyName: "Mustermann GmbH",
      orderNumber: "A-1",
      address: "Hauptstr. 1",
      city: "Berlin",
    });
    const sms = renderReminderSms(null, vars);
    assert.match(sms, /Mustermann GmbH/);
    const email = renderReminderEmail(null, vars);
    assert.match(email, /Erika Muster/);
    assert.match(email, /Mustermann GmbH/);
  });
});

describe("getMessagingStatus", () => {
  it("erkennt gesetzte seven.io-Variablen", () => {
    const bakKey = process.env.SEVEN_API_KEY;
    const bakFrom = process.env.SEVEN_SMS_FROM;
    process.env.SEVEN_API_KEY = "seven-test-key";
    process.env.SEVEN_SMS_FROM = "JoMaster";
    try {
      const status = getMessagingStatus("SMS");
      assert.equal(status.configured, true);
      assert.equal(status.provider, "seven");
      assert.equal(status.fromMasked, "••••er");
    } finally {
      process.env.SEVEN_API_KEY = bakKey;
      process.env.SEVEN_SMS_FROM = bakFrom;
    }
  });
});
