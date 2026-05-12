#!/usr/bin/env node
/**
 * Seed a fake test customer + 4 hired Expert Agents in Supabase, so the
 * second-computer (client) test can exercise the Liaison loop without
 * requiring a real Stripe Checkout.
 *
 * Inserts:
 *   - 1 fake row in wavex_os.subscriptions (status='trialing', tier='custom'
 *     so all 4 Expert Agents are hireable)
 *   - 4 rows in wavex_os.hired_expert_agents (one per catalog id, status='active')
 *
 * Prints the subscription_id + a synthetic SUBSCRIPTION_JWT placeholder that
 * the client computer's Liaison should use as env vars.
 *
 * USAGE:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   TEST_USER_EMAIL=test@wavex-qa.com \
 *     node scripts/qa/seed-test-customer.mjs
 *
 * TEAR DOWN:
 *   node scripts/qa/seed-test-customer.mjs --teardown <subscription_id>
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.TEST_USER_EMAIL ?? `qa-test-${Date.now()}@wavex-qa.com`;

if (!url || !svc) {
  console.error("Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, svc, { auth: { persistSession: false } });

// Teardown mode
if (process.argv[2] === "--teardown") {
  const subId = process.argv[3];
  if (!subId) {
    console.error("Usage: --teardown <subscription_id>");
    process.exit(1);
  }
  console.log(`Tearing down subscription ${subId}...`);
  // delete hires first (FK)
  await sb.schema("wavex_os").from("hired_expert_agents").delete().eq("subscription_id", subId);
  await sb.schema("wavex_os").from("subscriptions").delete().eq("id", subId);
  console.log("✓ done");
  process.exit(0);
}

// Step 1: create the fake auth user (or find existing)
console.log(`Looking up auth user for email ${email}...`);
const { data: existingUsers, error: lookupErr } = await sb.auth.admin.listUsers();
if (lookupErr) {
  console.error(`auth lookup failed: ${lookupErr.message}`);
  process.exit(1);
}

let user = existingUsers.users.find((u) => u.email === email);
if (!user) {
  console.log("Creating fake auth user...");
  const { data: createData, error: createErr } = await sb.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { wavex_test: true },
  });
  if (createErr) {
    console.error(`auth user creation failed: ${createErr.message}`);
    process.exit(1);
  }
  user = createData.user;
}
console.log(`  user_id: ${user.id}`);

// Step 2: insert subscription (idempotent on stripe_subscription_id)
const fakeSubId = `qa_sub_${Date.now()}`;
console.log(`Inserting subscription...`);
const periodEnd = new Date();
periodEnd.setDate(periodEnd.getDate() + 14);

const { data: sub, error: subErr } = await sb
  .schema("wavex_os")
  .from("subscriptions")
  .upsert({
    user_id: user.id,
    stripe_customer_id: `qa_cus_${Date.now()}`,
    stripe_subscription_id: fakeSubId,
    tier: "custom", // hire-everything tier
    status: "trialing",
    current_period_start: new Date().toISOString(),
    current_period_end: periodEnd.toISOString(),
    trial_end: periodEnd.toISOString(),
    metadata: { qa_test: true, created_by: "seed-test-customer.mjs" },
  }, { onConflict: "stripe_subscription_id" })
  .select()
  .single();

if (subErr) {
  console.error(`subscription insert failed: ${subErr.message}`);
  process.exit(1);
}
console.log(`  subscription_id: ${sub.id}`);

// Step 3: hire all 4 Expert Agents
console.log("Hiring 4 Expert Agents...");
const catalogIds = ["optimizer-v1", "alignment-v1", "error-handler-v1", "concierge-v1"];
for (const cid of catalogIds) {
  const { error: hireErr } = await sb
    .schema("wavex_os")
    .from("hired_expert_agents")
    .upsert({
      subscription_id: sub.id,
      catalog_id: cid,
      status: "active",
      agreement_version: "1.0",
    }, { onConflict: "subscription_id,catalog_id" });
  if (hireErr) {
    console.error(`  ${cid}: ${hireErr.message}`);
  } else {
    console.log(`  ✓ ${cid}`);
  }
}

// Print the env vars the client computer's Liaison needs
console.log("");
console.log("=".repeat(60));
console.log("Client-computer env vars:");
console.log("=".repeat(60));
console.log(`SUBSCRIPTION_ID=${sub.id}`);
console.log(`TEST_USER_EMAIL=${email}`);
console.log(`SUBSCRIPTION_JWT=<get this via supabase.auth.signInWithOtp + verifyOtp on the client side>`);
console.log("");
console.log("To tear down:");
console.log(`  node scripts/qa/seed-test-customer.mjs --teardown ${sub.id}`);
console.log("");
console.log("To watch what the Liaison uploads:");
console.log(`  watch -n 5 "psql ... -c \\"select id, received_at, jsonb_object_keys(field_envelopes) from wavex_os.fleet_digests where subscription_id='${sub.id}' order by received_at desc limit 10\\""`);
