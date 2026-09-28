import assert from "node:assert/strict";
import test from "node:test";
import {
  initialPasswordFlagAfterSupabaseFallback,
  selectPasswordResetUser,
} from "../src/lib/auth/password-reset";

test("password reset prefers the exact Supabase user mapping", () => {
  const exact = { id: "local-exact", supabaseUserId: "supabase-1" };
  const unmapped = { id: "local-unmapped", supabaseUserId: null };
  assert.equal(selectPasswordResetUser([unmapped, exact], "supabase-1"), exact);
});

test("password reset accepts one unmapped account but rejects ambiguity", () => {
  const first = { id: "local-1", supabaseUserId: null };
  const second = { id: "local-2", supabaseUserId: null };
  assert.equal(selectPasswordResetUser([first], "supabase-1"), first);
  assert.equal(selectPasswordResetUser([first, second], "supabase-1"), null);
});

test("Supabase fallback clears the initial-password flag only for a stale local hash", () => {
  assert.equal(initialPasswordFlagAfterSupabaseFallback(true, "old-hash"), false);
  assert.equal(initialPasswordFlagAfterSupabaseFallback(true, null), true);
  assert.equal(initialPasswordFlagAfterSupabaseFallback(false, "old-hash"), false);
});
