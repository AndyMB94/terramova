import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors duration-[var(--duration-fast)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        outline: "border border-border bg-transparent text-foreground hover:bg-surface-raised",
        solid: "border border-border bg-surface text-foreground hover:bg-surface-raised",
        primary: "bg-primary text-primary-foreground hover:opacity-90",
        ghost: "bg-transparent text-foreground hover:bg-surface-raised",
        link: "bg-transparent px-0 text-primary hover:underline",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-3.5",
        icon: "size-10 p-0 lg:size-9",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
