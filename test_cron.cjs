const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  "https://bsmlzvenkeumebfbpsab.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbWx6dmVua2V1bWViZmJwc2FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODkyNTAsImV4cCI6MjA4ODA2NTI1MH0.sv4TsAtJy4cPqZsj4BN_U-NdfB2XwwuVdDmAqUAU6BU"
);
const CID = "25776d85-3068-49cf-858c-49404f903cdc";

async function test() {
  await supabase.auth.signInWithPassword({email:"ngethenan768@gmail.com",password:"TestExpressWash2026!"});

  // 1. Check if birthday cron job exists
  console.log("=== 1. CRON JOBS ===");
  const { data: crons, error: cronErr } = await supabase.rpc("get_cron_jobs").catch(() => ({ data: null, error: { message: "no rpc" } }));
  if (cronErr) {
    // Try direct query
    const { data: jobs } = await supabase.from("cron.job").select("*").catch(() => ({ data: null }));
    console.log("Cron jobs (direct):", jobs ? jobs.length : "cannot access cron schema from client");
  } else {
    console.log("Cron jobs:", crons);
  }

  // 2. Simulate what the birthday discount cron does
  console.log("\n=== 2. BIRTHDAY DISCOUNT SIMULATION ===");
  // Set birthday to 7 days from now (the cron creates discount codes 7 days before)
  const sevenDaysOut = new Date();
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  const bdayStr = sevenDaysOut.toISOString().split("T")[0];
  await supabase.from("profiles").update({ birthday: bdayStr }).eq("id", CID);
  console.log("Set birthday to:", bdayStr, "(7 days from now)");

  // Check if a birthday promo already exists
  const { data: existingPromo } = await supabase.from("promotions")
    .select("id, name, code, discount_value, valid_from, valid_until")
    .ilike("name", "%Birthday%Test Customer%");
  console.log("Existing birthday promos:", existingPromo?.length || 0);

  // 3. Simulate what the Platinum birthday bonus cron does
  console.log("\n=== 3. PLATINUM BIRTHDAY BONUS SIMULATION ===");
  // Set birthday to today and tier to platinum
  const today = new Date().toISOString().split("T")[0];
  await supabase.from("profiles").update({ birthday: today }).eq("id", CID);
  await supabase.from("loyalty_accounts").update({ tier: "platinum" }).eq("customer_id", CID);

  // Manually run what the cron would do
  const { data: acc } = await supabase.from("loyalty_accounts").select("points").eq("customer_id", CID).single();
  const newBalance = acc.points + 200;

  // Check if already received this year
  const yearStart = new Date().getFullYear() + "-01-01";
  const { data: existingBonus } = await supabase.from("loyalty_transactions")
    .select("id")
    .eq("customer_id", CID)
    .eq("type", "bonus")
    .ilike("description", "%Birthday bonus%")
    .gte("created_at", yearStart);
  
  if (existingBonus?.length) {
    console.log("Already received birthday bonus this year - skipping");
  } else {
    // Award bonus (using admin session since RLS blocks customer inserts on loyalty_transactions)
    // In production, the cron runs as postgres so no RLS issue
    console.log("Would award 200 birthday bonus points (balance:", acc.points, "->", newBalance, ")");
    console.log("(Cron runs as postgres role, bypasses RLS)");
  }

  // 4. Check where the discount code is sent
  console.log("\n=== 4. DISCOUNT CODE DELIVERY ===");
  // The birthday cron creates a promotion and queues SMS + email notifications
  console.log("The birthday discount cron (from migration 020) does:");
  console.log("  1. Creates a 20% discount promotion code (BDAY-XXXXXX)");
  console.log("  2. Queues SMS notification to customer's phone");
  console.log("  3. Queues Email notification to customer's email");
  console.log("  Both go through notification_history -> send-notification edge function");

  // Check if notification templates exist for birthday
  const { data: templates } = await supabase.from("notification_templates")
    .select("name, channel")
    .or("name.ilike.%birthday%,name.ilike.%Birthday%");
  console.log("\nBirthday notification templates:", templates?.length || 0);
  templates?.forEach(t => console.log("  -", t.name, "[" + t.channel + "]"));

  // Restore original state
  await supabase.from("loyalty_accounts").update({ tier: "bronze" }).eq("customer_id", CID);
  await supabase.from("profiles").update({ birthday: "1995-06-15" }).eq("id", CID);
  console.log("\nRestored original state");
}
test().catch(e => console.error("ERROR:", e.message));
