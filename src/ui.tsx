import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "default" | "subtle";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent border-transparent hover:bg-accent-hover",
  default: "bg-surface border-line text-fg hover:bg-surface-2",
  subtle: "bg-transparent border-transparent text-fg hover:bg-black/5 dark:hover:bg-white/8",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: LucideIcon;
}

export function Button({ variant = "default", icon: Icon, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 font-medium whitespace-nowrap transition-colors disabled:opacity-50",
        variants[variant],
        className,
      )}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
}

export function IconButton({ icon: Icon, label, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...rest}
      className={cx("grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-black/5 hover:text-fg dark:hover:bg-white/8", className)}
    >
      <Icon size={16} />
    </button>
  );
}
