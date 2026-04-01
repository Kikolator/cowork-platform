import { describe, expect, it } from "vitest";
import { isProductVisible } from "./visibility";

const DESK_RT = "rt_desk";
const MEETING_RT = "rt_meeting";

const member = { isMember: true, planId: "plan_a", unlimitedResourceTypeIds: [] as string[] };
const nonMember = { isMember: false, planId: null, unlimitedResourceTypeIds: [] as string[] };
const unlimitedAllMember = {
  isMember: true,
  planId: "plan_u",
  unlimitedResourceTypeIds: [DESK_RT, MEETING_RT],
};
const unlimitedDeskMember = {
  isMember: true,
  planId: "plan_d",
  unlimitedResourceTypeIds: [DESK_RT],
};
const unlimitedMeetingMember = {
  isMember: true,
  planId: "plan_m",
  unlimitedResourceTypeIds: [MEETING_RT],
};

describe("isProductVisible", () => {
  // ── No rules (permissive default) ──────────────────────────────────

  it("returns true for null rules", () => {
    expect(isProductVisible(null, member)).toBe(true);
  });

  it("returns true for undefined rules", () => {
    expect(isProductVisible(undefined, member)).toBe(true);
  });

  it("returns true for empty rules object", () => {
    expect(isProductVisible({}, member)).toBe(true);
  });

  it("returns true for null rules even for non-member", () => {
    expect(isProductVisible(null, nonMember)).toBe(true);
  });

  // ── require_membership ─────────────────────────────────────────────

  it("hides product when require_membership and user is not a member", () => {
    expect(isProductVisible({ require_membership: true }, nonMember)).toBe(false);
  });

  it("shows product when require_membership and user is a member", () => {
    expect(isProductVisible({ require_membership: true }, member)).toBe(true);
  });

  it("shows product when require_membership is false (rule is inactive)", () => {
    expect(isProductVisible({ require_membership: false }, nonMember)).toBe(true);
  });

  // ── require_no_membership ──────────────────────────────────────────

  it("hides product when require_no_membership and user is a member", () => {
    expect(isProductVisible({ require_no_membership: true }, member)).toBe(false);
  });

  it("shows product when require_no_membership and user is not a member", () => {
    expect(isProductVisible({ require_no_membership: true }, nonMember)).toBe(true);
  });

  it("shows product when require_no_membership is false (rule is inactive)", () => {
    expect(isProductVisible({ require_no_membership: false }, member)).toBe(true);
  });

  // ── require_plan_ids ───────────────────────────────────────────────

  it("shows product when user plan matches required plan", () => {
    expect(isProductVisible({ require_plan_ids: ["plan_a", "plan_b"] }, member)).toBe(true);
  });

  it("hides product when user plan does not match required plans", () => {
    expect(
      isProductVisible(
        { require_plan_ids: ["plan_x", "plan_y"] },
        member,
      ),
    ).toBe(false);
  });

  it("hides product when planId is null and require_plan_ids is set", () => {
    expect(isProductVisible({ require_plan_ids: ["plan_a"] }, nonMember)).toBe(false);
  });

  it("shows product when require_plan_ids is an empty array (no restriction)", () => {
    expect(isProductVisible({ require_plan_ids: [] }, member)).toBe(true);
    expect(isProductVisible({ require_plan_ids: [] }, nonMember)).toBe(true);
  });

  it("matches only exact plan IDs (no partial matches)", () => {
    expect(isProductVisible({ require_plan_ids: ["plan_ab"] }, member)).toBe(false);
    expect(isProductVisible({ require_plan_ids: ["plan"] }, member)).toBe(false);
  });

  // ── exclude_unlimited (no product resource type — blanket behavior) ─

  it("hides product when exclude_unlimited and member has any unlimited", () => {
    expect(isProductVisible({ exclude_unlimited: true }, unlimitedAllMember)).toBe(false);
  });

  it("shows product when exclude_unlimited and member has no unlimited", () => {
    expect(isProductVisible({ exclude_unlimited: true }, member)).toBe(true);
  });

  it("shows product when exclude_unlimited is false for unlimited member", () => {
    expect(isProductVisible({ exclude_unlimited: false }, unlimitedAllMember)).toBe(true);
  });

  it("shows product for non-member when exclude_unlimited is true", () => {
    expect(isProductVisible({ exclude_unlimited: true }, nonMember)).toBe(true);
  });

  // ── exclude_unlimited (with product resource type — per-type behavior) ─

  it("hides meeting room bundle for member with unlimited meeting rooms", () => {
    expect(
      isProductVisible({ exclude_unlimited: true }, unlimitedMeetingMember, MEETING_RT),
    ).toBe(false);
  });

  it("shows meeting room bundle for member with unlimited desks only", () => {
    expect(
      isProductVisible({ exclude_unlimited: true }, unlimitedDeskMember, MEETING_RT),
    ).toBe(true);
  });

  it("hides desk bundle for member with unlimited desks", () => {
    expect(
      isProductVisible({ exclude_unlimited: true }, unlimitedDeskMember, DESK_RT),
    ).toBe(false);
  });

  it("shows desk bundle for member with unlimited meeting rooms only", () => {
    expect(
      isProductVisible({ exclude_unlimited: true }, unlimitedMeetingMember, DESK_RT),
    ).toBe(true);
  });

  it("hides both bundles for member with all unlimited", () => {
    expect(
      isProductVisible({ exclude_unlimited: true }, unlimitedAllMember, DESK_RT),
    ).toBe(false);
    expect(
      isProductVisible({ exclude_unlimited: true }, unlimitedAllMember, MEETING_RT),
    ).toBe(false);
  });

  it("shows resource-typed product when exclude_unlimited is false", () => {
    expect(
      isProductVisible({ exclude_unlimited: false }, unlimitedDeskMember, DESK_RT),
    ).toBe(true);
  });

  it("shows resource-typed product for limited member", () => {
    expect(
      isProductVisible({ exclude_unlimited: true }, member, DESK_RT),
    ).toBe(true);
  });

  // ── Combined rules ─────────────────────────────────────────────────

  it("applies all rules — membership + plan match → visible", () => {
    expect(
      isProductVisible(
        { require_membership: true, require_plan_ids: ["plan_a"] },
        member,
      ),
    ).toBe(true);
  });

  it("applies all rules — membership ok but plan mismatch → hidden", () => {
    expect(
      isProductVisible(
        { require_membership: true, require_plan_ids: ["plan_x"] },
        member,
      ),
    ).toBe(false);
  });

  it("applies require_no_membership + exclude_unlimited — non-member passes both", () => {
    expect(
      isProductVisible(
        { require_no_membership: true, exclude_unlimited: true },
        nonMember,
      ),
    ).toBe(true);
  });

  it("applies require_membership + exclude_unlimited — unlimited member is hidden (no resource type)", () => {
    expect(
      isProductVisible(
        { require_membership: true, exclude_unlimited: true },
        unlimitedAllMember,
      ),
    ).toBe(false);
  });

  it("applies require_membership + exclude_unlimited — limited member passes", () => {
    expect(
      isProductVisible(
        { require_membership: true, exclude_unlimited: true },
        member,
      ),
    ).toBe(true);
  });

  it("applies membership + exclude_unlimited with resource type — desk-unlimited member sees meeting bundle", () => {
    expect(
      isProductVisible(
        { require_membership: true, exclude_unlimited: true },
        unlimitedDeskMember,
        MEETING_RT,
      ),
    ).toBe(true);
  });

  it("handles conflicting rules (require_membership + require_no_membership both true)", () => {
    // A member fails require_no_membership; a non-member fails require_membership
    expect(
      isProductVisible(
        { require_membership: true, require_no_membership: true },
        member,
      ),
    ).toBe(false);
    expect(
      isProductVisible(
        { require_membership: true, require_no_membership: true },
        nonMember,
      ),
    ).toBe(false);
  });

  // ── Unknown extra properties in rules (robustness) ─────────────────

  it("ignores unknown properties in the rules object", () => {
    expect(
      isProductVisible({ some_future_rule: true } as Record<string, unknown>, member),
    ).toBe(true);
  });
});
