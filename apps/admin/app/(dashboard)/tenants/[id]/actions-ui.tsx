"use client";

import { useState } from "react";
import { updateTenantStatus } from "./actions";

export function TenantActions({
  tenantId,
  currentStatus,
}: {
  tenantId: string;
  currentStatus: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleStatusChange(newStatus: string) {
    if (!confirm(`Are you sure you want to set this tenant to "${newStatus}"?`)) {
      return;
    }
    setPending(true);
    const result = await updateTenantStatus(tenantId, newStatus);
    if (result.error) {
      alert(result.error);
    }
    setPending(false);
  }

  return (
    <div className="flex gap-2">
      {currentStatus === "active" && (
        <button
          onClick={() => handleStatusChange("suspended")}
          disabled={pending}
          className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-400/20 disabled:opacity-50"
        >
          Suspend
        </button>
      )}
      {currentStatus === "suspended" && (
        <button
          onClick={() => handleStatusChange("active")}
          disabled={pending}
          className="rounded-lg border border-green-400/20 bg-green-400/10 px-3 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-400/20 disabled:opacity-50"
        >
          Activate
        </button>
      )}
      {currentStatus === "trial" && (
        <button
          onClick={() => handleStatusChange("active")}
          disabled={pending}
          className="rounded-lg border border-green-400/20 bg-green-400/10 px-3 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-400/20 disabled:opacity-50"
        >
          Convert to Active
        </button>
      )}
    </div>
  );
}
