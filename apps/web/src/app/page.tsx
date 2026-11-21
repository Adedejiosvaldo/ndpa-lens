"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { landingFor, useSession } from "@/lib/session";

export default function Home() {
  const { me, loading } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!loading) router.replace(me ? landingFor(me) : "/login");
  }, [loading, me, router]);
  return <p className="p-8 text-muted">Loading…</p>;
}
