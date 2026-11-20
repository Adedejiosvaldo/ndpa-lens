import { z } from "zod";
import { ASSIGNABLE_ROLES } from "./roles.js";

const text = (max: number) => z.string().trim().min(1).max(max);

/** ORG-01 fields, collected at sign-up. */
export const OrganisationInput = z.object({
  legalName: text(200),
  tradingName: text(200),
  address: text(500),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a phone number such as +234 801 234 5678"),
});

export const OrgPatchBody = z
  .object({
    name: text(200).optional(),
    legalName: text(200).optional(),
    address: text(500).optional(),
    phone: OrganisationInput.shape.phone.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const AssignableRole = z.enum(ASSIGNABLE_ROLES);
export const RoleBody = z.object({ role: AssignableRole });
export const InviteBody = z.object({ email: z.string().trim().toLowerCase().email().max(254), role: AssignableRole });
export const TransferBody = z.object({ userId: z.uuid() });
export const InvitationToken = z.string().min(40).max(200);
