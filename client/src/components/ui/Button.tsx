import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: "border border-transparent bg-[var(--gs-primary)] text-white hover:bg-[var(--gs-primary-hover)]",
  outline:
    "border border-slate-300 bg-white text-slate-700 hover:border-[var(--gs-primary)] hover:text-[var(--gs-primary)]",
  ghost: "border border-transparent bg-transparent text-slate-700 hover:bg-slate-100",
  danger: "border border-transparent bg-[var(--gs-danger)] text-white hover:opacity-90",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export const Button = ({ className, variant = "primary", size = "md", type = "button", ...props }: Props) => (
  <button
    type={type}
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
      variantClass[variant],
      sizeClass[size],
      className
    )}
    {...props}
  />
);
