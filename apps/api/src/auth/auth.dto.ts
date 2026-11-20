import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);
/** AUTH-01: at least 12 characters (max bounds argon2 work per request). */
export const Password = z.string().min(12, "Use at least 12 characters").max(128, "Use at most 128 characters");

export const SignUpBody = z.object({ name: z.string().trim().min(1).max(120), email, password: Password });
export const LoginBody = z.object({ email, password: z.string().min(1).max(128) });
export const EmailBody = z.object({ email });
export const TokenBody = z.object({ token: z.string().min(10).max(4096) });
export const ResetBody = z.object({ token: z.string().min(10).max(4096), newPassword: Password });
