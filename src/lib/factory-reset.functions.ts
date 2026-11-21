import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { supabaseAdmin as SupabaseAdminClient } from "@/integrations/supabase/client.server";

type AdminClient = typeof SupabaseAdminClient;

const PHOTO_BUCKETS = ["jewellery-photos", "job-photos", "staff-avatars"] as const;

async function listStorageFiles(
  admin: AdminClient,
  bucket: string,
  folder = "",
): Promise<string[]> {
  const files: string[] = [];

  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage.from(bucket).list(folder, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      if (/not found/i.test(error.message)) return files;
      throw new Error(`Could not inspect ${bucket}: ${error.message}`);
    }

    const entries = data ?? [];

    for (const entry of entries) {
      const path = folder ? `${folder}/${entry.name}` : entry.name;

      if (entry.id) {
        files.push(path);
      } else {
        files.push(...(await listStorageFiles(admin, bucket, path)));
      }
    }

    if (entries.length < 100) break;
  }

  return files;
}

async function clearStorageBucket(admin: AdminClient, bucket: string) {
  const files = await listStorageFiles(admin, bucket);

  for (let index = 0; index < files.length; index += 100) {
    const batch = files.slice(index, index + 100);
    const { error } = await admin.storage.from(bucket).remove(batch);

    if (error) {
      throw new Error(`Could not clear ${bucket}: ${error.message}`);
    }
  }
}

async function listAllAuthUserIds(admin: AdminClient): Promise<string[]> {
  const userIds: string[] = [];

  for (let page = 1; ; page += 1) {
    const result = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (result.error) {
      throw new Error(`Could not list login accounts: ${result.error.message}`);
    }

    const users = result.data.users ?? [];
    userIds.push(...users.map((user: { id: string }) => user.id));

    if (users.length < 100) break;
  }

  return userIds;
}

export const factoryResetEverything = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ownerCheck = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    if (ownerCheck.error || !ownerCheck.data) {
      throw new Error("Only the shop owner can perform a complete factory reset");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const admin: AdminClient = supabaseAdmin;

    // Capture login IDs before clearing the application tables.
    const authUserIds = await listAllAuthUserIds(admin);

    // Factory reset means uploaded shop files must also be removed.
    for (const bucket of PHOTO_BUCKETS) {
      await clearStorageBucket(admin, bucket);
    }

    // Clear all KaratDesk public data while preserving migration history.
    const reset = await admin.rpc("factory_reset_everything");

    if (reset.error) {
      throw new Error(`Database reset failed: ${reset.error.message}`);
    }

    // Remove the previous owner and staff login accounts so their usernames
    // can be reused during the new first-run setup.
    const failedUsers: string[] = [];

    for (const userId of authUserIds) {
      const deleted = await admin.auth.admin.deleteUser(userId);

      if (deleted.error) {
        failedUsers.push(userId);
      }
    }

    if (failedUsers.length) {
      throw new Error(
        `Shop data was cleared, but ${failedUsers.length} old login account(s) could not be removed. Check Supabase Auth before running setup.`,
      );
    }

    return { ok: true as const };
  });
