import { mkdirSync } from "node:fs";
import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Local Supabase defaults (deterministic for every `supabase start`)
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SECRET_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const TEST_USER_EMAIL = "e2e@test.local";
const TEST_PASSWORD = "e2e-test-pw-123!";
const SPACE_ID = "22222222-2222-2222-2222-222222222222";
const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const SPACE_BASE_URL = "http://test-space.localhost:3000";
const AUTH_FILE = "e2e/.auth/user.json";

/** Cookie name used by @supabase/ssr (derived from Supabase URL hostname). */
const COOKIE_NAME = "sb-127-auth-token";
const CHUNK_SIZE = 3180;

export default async function globalSetup(_config: FullConfig) {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Create or find the test user (with password for direct sign-in)
  let userId: string;
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existing = existingUsers?.users.find(
    (u) => u.email === TEST_USER_EMAIL,
  );

  if (existing) {
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, { password: TEST_PASSWORD });
  } else {
    const { data: newUser, error } = await admin.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error || !newUser)
      throw new Error(`Failed to create test user: ${error?.message}`);
    userId = newUser.user.id;
  }

  // 2. Upsert space_users record (owner role for admin access)
  const { error: upsertError } = await admin
    .from("space_users")
    .upsert(
      { user_id: userId, space_id: SPACE_ID, role: "owner" },
      { onConflict: "user_id,space_id" },
    );
  if (upsertError)
    throw new Error(`Failed to upsert space_users: ${upsertError.message}`);

  // 3. Set JWT claims BEFORE signing in (so the session JWT has correct claims)
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      space_id: SPACE_ID,
      tenant_id: TENANT_ID,
      space_role: "owner",
    },
  });

  // 4. Sign in with password to get session tokens
  const anonClient = createClient(SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signInData, error: signInError } =
    await anonClient.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_PASSWORD,
    });
  if (signInError || !signInData.session)
    throw new Error(`Sign in failed: ${signInError?.message}`);

  // 5. Inject session as @supabase/ssr cookies into Playwright browser
  const sessionStr = JSON.stringify(signInData.session);
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: SPACE_BASE_URL });

  const cookiesToSet: Array<{ name: string; value: string; url: string }> = [];

  if (sessionStr.length <= CHUNK_SIZE) {
    cookiesToSet.push({
      name: COOKIE_NAME,
      value: sessionStr,
      url: SPACE_BASE_URL,
    });
  } else {
    for (let i = 0; i < sessionStr.length; i += CHUNK_SIZE) {
      cookiesToSet.push({
        name: `${COOKIE_NAME}.${Math.floor(i / CHUNK_SIZE)}`,
        value: sessionStr.slice(i, i + CHUNK_SIZE),
        url: SPACE_BASE_URL,
      });
    }
  }

  await context.addCookies(cookiesToSet);

  // 6. Navigate to dashboard to verify the session works
  const page = await context.newPage();
  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  // 7. Save authenticated state
  mkdirSync("e2e/.auth", { recursive: true });
  await context.storageState({ path: AUTH_FILE });
  await browser.close();
}
