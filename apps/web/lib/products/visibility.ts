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
  unlimitedResourceTypeIds: string[];
}

export function isProductVisible(
  rules: unknown,
  member: MemberContext,
  productResourceTypeId?: string | null,
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

  if (r.exclude_unlimited) {
    if (productResourceTypeId) {
      // Product is tied to a resource type — only hide if member has
      // unlimited credits for that specific resource type
      if (member.unlimitedResourceTypeIds.includes(productResourceTypeId))
        return false;
    } else {
      // Product has no resource type — hide if member has unlimited
      // credits for any resource type (original blanket behavior)
      if (member.unlimitedResourceTypeIds.length > 0) return false;
    }
  }

  return true;
}
