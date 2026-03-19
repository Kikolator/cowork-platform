"use client";

import { useState } from "react";
import { removePlatformAdmin } from "./actions";

export function RemoveAdminButton({ userId }: { userId: string }) {
  const [pending, setPending] = useState(false);

  async function handleRemove() {
    if (!confirm("Remove this admin? They will lose access to the admin dashboard.")) {
      return;
    }
    setPending(true);
    const result = await removePlatformAdmin(userId);
    if (result.error) {
      alert(result.error);
    }
    setPending(false);
  }

  return (
    <button
      onClick={handleRemove}
      disabled={pending}
      className="rounded-md px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-400/10 disabled:opacity-50"
    >
      {pending ? "Removing..." : "Remove"}
    </button>
  );
}
