"use client";

import { useEffect, useState } from "react";
import { daysToCar } from "@/lib/car";

/** Server renders the build-time count; the browser corrects it on load. */
export function DaysToCar({ initial }: { initial: number }) {
  const [days, setDays] = useState(initial);
  useEffect(() => setDays(daysToCar(Date.now())), []);
  return <span className="tabular">{days}</span>;
}
