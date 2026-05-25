import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export const Card = ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
  <section className={cn("surface-card", className)} {...props} />
);

export const CardHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <header className={cn("border-b border-slate-100 px-4 py-3 md:px-5", className)} {...props} />
);

export const CardBody = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-4 py-3 md:px-5", className)} {...props} />
);
