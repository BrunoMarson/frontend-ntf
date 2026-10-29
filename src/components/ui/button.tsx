import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent)] text-[#1c1008] hover:bg-[#f1a159]",
        outline: "border border-[var(--line)] bg-transparent text-[var(--text)] hover:border-[var(--accent)]",
        ghost: "bg-transparent text-[var(--text)] hover:text-[var(--accent)]",
      },
      size: {
        default: "min-h-9 px-3 py-2 text-sm",
        sm: "min-h-8 px-2.5 py-1.5 text-xs",
        icon: "size-9 p-2",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ asChild = false, className, size, variant, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ className, size, variant }))}
      data-variant={variant ?? "default"}
      {...props}
    />
  );
}
