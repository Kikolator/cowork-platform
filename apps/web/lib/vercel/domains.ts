import "server-only";
import { createLogger } from "@cowork/shared";

const logger = createLogger({ component: "vercel/domains" });

function getConfig() {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) {
    throw new Error("Missing VERCEL_API_TOKEN or VERCEL_PROJECT_ID");
  }
  const teamId = process.env.VERCEL_TEAM_ID;
  return { token, projectId, teamId };
}

function teamQuery(teamId: string | undefined): string {
  return teamId ? `?teamId=${teamId}` : "";
}

/**
 * Add a domain to the Vercel project.
 * Returns the domain response including verification challenges if not yet verified.
 */
export async function addDomainToProject(domain: string): Promise<{
  success: true;
  verified: boolean;
  verification?: Array<{ type: string; domain: string; value: string }>;
} | {
  success: false;
  error: string;
}> {
  const { token, projectId, teamId } = getConfig();

  const res = await fetch(
    `https://api.vercel.com/v10/projects/${projectId}/domains${teamQuery(teamId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    },
  );

  if (res.ok) {
    const data = await res.json();
    return {
      success: true,
      verified: data.verified ?? false,
      verification: data.verification,
    };
  }

  // 409 = domain already exists on project or account — treat as success
  if (res.status === 409) {
    return { success: true, verified: false };
  }

  const body = await res.text();
  logger.error("Failed to add domain to Vercel", { domain, status: res.status, body });
  return { success: false, error: `Vercel API error (${res.status})` };
}

/**
 * Check DNS configuration status for a domain.
 */
export async function getDomainConfig(domain: string): Promise<{
  configured: boolean;
  misconfigured: boolean;
  configuredBy: string | null;
}> {
  const { token, teamId } = getConfig();

  const res = await fetch(
    `https://api.vercel.com/v6/domains/${domain}/config${teamQuery(teamId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!res.ok) {
    logger.error("Failed to check domain config", { domain, status: res.status });
    return { configured: false, misconfigured: true, configuredBy: null };
  }

  const data = await res.json();
  return {
    configured: data.configuredBy !== null && !data.misconfigured,
    misconfigured: data.misconfigured,
    configuredBy: data.configuredBy ?? null,
  };
}

/**
 * Remove a domain from the Vercel project.
 */
export async function removeDomainFromProject(domain: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const { token, projectId, teamId } = getConfig();

  const res = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/domains/${domain}${teamQuery(teamId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (res.ok || res.status === 404) {
    return { success: true };
  }

  const body = await res.text();
  logger.error("Failed to remove domain from Vercel", { domain, status: res.status, body });
  return { success: false, error: `Vercel API error (${res.status})` };
}
