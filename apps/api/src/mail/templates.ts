/** Plain-text emails, British English. Kept short: they carry one action each. */

export function verifyEmail(name: string, link: string) {
  return {
    subject: "Confirm your email for NDPA Lens",
    text: `Hello ${name},\n\nConfirm your email address to finish setting up NDPA Lens:\n\n${link}\n\nThe link works once and expires in 24 hours. If you didn't sign up, ignore this email.\n`,
  };
}

export function existingAccount(name: string, loginLink: string, resetLink: string) {
  return {
    subject: "You already have an NDPA Lens account",
    text: `Hello ${name},\n\nSomeone tried to sign up with this email address, but you already have an account.\n\nSign in: ${loginLink}\nForgotten your password? ${resetLink}\n\nIf this wasn't you, you don't need to do anything.\n`,
  };
}

export function resetPassword(name: string, link: string) {
  return {
    subject: "Reset your NDPA Lens password",
    text: `Hello ${name},\n\nUse this link to choose a new password:\n\n${link}\n\nIt works once and expires in 30 minutes. Resetting signs you out everywhere. If you didn't ask for this, ignore this email — your password stays the same.\n`,
  };
}

export function accountLocked(name: string, resetLink: string) {
  return {
    subject: "Sign-in paused on your NDPA Lens account",
    text: `Hello ${name},\n\nThere were 5 failed sign-in attempts on your account, so we've paused sign-in for 15 minutes.\n\nIf this was you, wait 15 minutes and try again, or reset your password: ${resetLink}\nIf it wasn't you, reset your password now.\n`,
  };
}
