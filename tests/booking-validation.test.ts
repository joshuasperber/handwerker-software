import assert from "node:assert/strict";
import test from "node:test";
import { bookingSchema } from "../src/lib/booking";

const validBooking = {
  serviceIds: ["service-1"],
  firstName: "Erika",
  lastName: "Mustermann",
  email: "ERIKA@example.com",
  street: "Musterstraße 1",
  zipCode: "10115",
  city: "Berlin",
  gdprConsent: true as const,
};

test("booking validation accepts a service request without appointment", () => {
  const result = bookingSchema.safeParse(validBooking);
  assert.equal(result.success, true);
});

test("booking validation rejects duplicate services", () => {
  const result = bookingSchema.safeParse({
    ...validBooking,
    serviceIds: ["service-1", "service-1"],
  });
  assert.equal(result.success, false);
});

test("booking validation requires a complete slot and employee", () => {
  const startOnly = bookingSchema.safeParse({
    ...validBooking,
    slotStart: "2030-01-10T09:00:00.000Z",
  });
  const slotWithoutEmployee = bookingSchema.safeParse({
    ...validBooking,
    slotStart: "2030-01-10T09:00:00.000Z",
    slotEnd: "2030-01-10T10:00:00.000Z",
  });
  assert.equal(startOnly.success, false);
  assert.equal(slotWithoutEmployee.success, false);
});

test("booking validation limits unbounded public text fields", () => {
  const result = bookingSchema.safeParse({
    ...validBooking,
    description: "x".repeat(5001),
  });
  assert.equal(result.success, false);
});
