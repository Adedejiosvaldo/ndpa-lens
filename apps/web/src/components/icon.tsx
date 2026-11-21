import { cn } from "@/lib/cn";
import { ICONS, type IconName } from "./icons.generated";

/** Solar icon as inline SVG. Decorative by default; pass `label` when it carries meaning on its own. */
export function Icon({ name, className, label }: { name: IconName; className?: string; label?: string }) {
  const icon = ICONS[name];
  return (
    <svg
      viewBox={icon.viewBox}
      className={cn("size-4 shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
}
