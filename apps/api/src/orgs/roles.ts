import type { Role } from "@ndpa/schema";

/** PRD §2 matrix is hierarchical: viewer < analyst < admin < owner. */
export const ROLE_RANK: Record<Role, number> = { viewer: 0, analyst: 1, admin: 2, owner: 3 };

export const atLeast = (role: Role, min: Role) => ROLE_RANK[role] >= ROLE_RANK[min];

/** Roles that can be granted by invitation or role change; owner only via transfer. */
export const ASSIGNABLE_ROLES = ["admin", "analyst", "viewer"] as const;
