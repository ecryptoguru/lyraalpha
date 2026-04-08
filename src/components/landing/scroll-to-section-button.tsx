"use client";

import { type ComponentProps } from "react";

import { Button } from "@/components/ui/button";

interface ScrollToSectionButtonProps extends Omit<ComponentProps<typeof Button>, "onClick"> {
  targetId: string;
}

export function ScrollToSectionButton({
  targetId,
  children,
  ...props
}: ScrollToSectionButtonProps) {
  return (
    <Button
      {...props}
      onClick={() => {
        document.getElementById(targetId)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }}
    >
      {children}
    </Button>
  );
}
