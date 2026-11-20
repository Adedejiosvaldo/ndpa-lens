import { z } from "zod";
import { OrganisationInput } from "../orgs/orgs.dto.js";

const email = z.string().trim().toLowerCase().email().max(254);
/** AUTH-01: at least 12 characters (max bounds argon2 work per request). */
export const Password = z.string().min(12, "Use at least 12 characters").max(128, "Use at most 128 characters");

/**
 * AUTH-01 + ORG-01. A DPCO founder signs up with their organisation and becomes
 * its Owner. An invited colleague signs up without one and joins by invitation.
 */
export const SignUpBody = z.object({
  name: z.string().trim().min(1).max(120),
  email,
  password: Password,
  organisation: OrganisationInput.optional(),
});
export const LoginBody = z.object({ email, password: z.string().min(1).max(128) });
export const EmailBody = z.object({ email });
export const TokenBody = z.object({ token: z.string().min(10).max(4096) });
export const ResetBody = z.object({ token: z.string().min(10).max(4096), newPassword: Password });
