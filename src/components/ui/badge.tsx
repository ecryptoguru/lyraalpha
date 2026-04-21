import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-danger/20 dark:aria-invalid:ring-danger/40 aria-invalid:border-danger transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary/10 text-secondary border border-secondary/25 [a&]:hover:bg-secondary/20",
        destructive:
          "bg-danger-subtle text-danger border border-danger/20 [a&]:hover:bg-danger-subtle/80",
        outline:
          "border-border text-foreground [a&]:hover:bg-muted/50",
        ghost: "[a&]:hover:bg-muted/50",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
        success: "bg-success-subtle text-success border border-success/20",
        warning: "bg-warning-subtle text-warning border border-warning/20",
        danger: "bg-danger-subtle text-danger border border-danger/20",
        info: "bg-info-subtle text-info border border-info/20",
        cta: "bg-accent-cta text-accent-cta-foreground [a&]:hover:bg-accent-cta/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
