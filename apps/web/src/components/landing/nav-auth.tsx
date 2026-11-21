"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { landingFor, useSession } from "@/lib/session";

/** Signed-in visitors get a way back into the app instead of sign-up. */
export function NavAuth() {
  const { me, loading } = useSession();
  if (!loading && me)
    return (
      <Button asChild size="sm">
        <Link href={landingFor(me)}>Open your workspace</Link>
      </Button>
    );
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/login">Sign in</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/signup">Create your workspace</Link>
      </Button>
    </div>
  );
}
