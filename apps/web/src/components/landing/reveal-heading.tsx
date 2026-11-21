import type * as React from "react";
import type { ElementType } from "react";
import { cn } from "@/lib/cn";

/**
 * Heading revealed word by word by the CSS hero intro (globals.css). The accessible name is the
 * unsplit text (aria-label); split words are decorative (aria-hidden) and
 * visible without JavaScript, so nothing depends on the animation running.
 */
export function RevealHeading({
  as: Tag = "h2",
  text,
  className,
  italic,
  id,
}: {
  as?: ElementType;
  text: string;
  className?: string;
  italic?: string;
  id?: string;
}) {
  const words = text.split(" ");
  return (
    <Tag id={id} aria-label={text} data-reveal className={cn("font-display", className)}>
      <span aria-hidden>
        {words.map((w, i) => (
          <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <span data-word style={{ "--i": i } as React.CSSProperties} className={cn("inline-block", italic && w.replace(/[.,]/g, "") === italic && "text-accent")}>
              {w}
              {i < words.length - 1 ? " " : ""}
            </span>
          </span>
        ))}
      </span>
    </Tag>
  );
}
