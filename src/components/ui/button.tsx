import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-(--radius) text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-70 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-danger/20 dark:aria-invalid:ring-danger/40 aria-invalid:border-danger active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        cta: "bg-accent-cta text-accent-cta-foreground shadow-(--shadow-glow-cta) hover:bg-accent-cta/90",
        destructive:
          "bg-danger text-danger-foreground hover:bg-danger/90 focus-visible:ring-danger/20 dark:focus-visible:ring-danger/40",
        outline:
          "border border-border bg-transparent text-foreground shadow-(--shadow-xs) hover:bg-muted/50",
        secondary:
          "bg-secondary/10 text-secondary border border-secondary/30 hover:bg-secondary/20",
        ghost:
          "bg-transparent text-foreground hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success text-success-foreground hover:bg-success/90",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-(--radius-sm) px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-(--radius-sm) px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-11 rounded-(--radius-lg) px-6 text-base",
        icon: "h-10 w-10",
        "icon-xs": "size-6 rounded-(--radius-sm) [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
