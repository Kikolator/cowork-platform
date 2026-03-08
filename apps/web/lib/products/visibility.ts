import "server-only";

interface VisibilityRules {
  require_membership?: boolean;
  require_no_membership?: boolean;
  require_plan_ids?: string[];
  exclude_unlimited?: boolean;
}

interface MemberContext {
  isMember: boolean;
  planId: string | null;
  isUnlimited: boolean;
}

export function isProductVisible(
  rules: unknown,
  member: MemberContext,
): boolean {
  const r = rules as VisibilityRules | null | undefined;
  if (!r || Object.keys(r).length === 0) return true;

  if (r.require_membership && !member.isMember) return false;
  if (r.require_no_membership && member.isMember) return false;
  if (
    r.require_plan_ids?.length &&
    !r.require_plan_ids.includes(member.planId ?? "")
  )
    return false;
  if (r.exclude_unlimited && member.isUnlimited) return false;

  return true;
}
