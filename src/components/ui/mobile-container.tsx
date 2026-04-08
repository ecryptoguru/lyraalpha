/**
 * Mobile-optimized container component
 * Provides consistent responsive padding and max-width across all pages
 */

import { cn } from "@/lib/utils";

interface MobileContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

const maxWidthClasses = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
};

export function MobileContainer({
  children,
  className,
  maxWidth = "2xl",
}: MobileContainerProps) {
  return (
    <div
      className={cn(
        "w-full mx-auto px-3 sm:px-4 md:px-6 lg:px-8",
        maxWidthClasses[maxWidth],
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Mobile-optimized section with responsive spacing
 */
export function MobileSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("py-4 sm:py-6 md:py-8", className)}>
      {children}
    </section>
  );
}

/**
 * Mobile-optimized grid with responsive columns
 */
export function MobileGrid({
  children,
  className,
  cols = { mobile: 1, tablet: 2, desktop: 3 },
}: {
  children: React.ReactNode;
  className?: string;
  cols?: { mobile?: number; tablet?: number; desktop?: number };
}) {
  const gridCols = `grid-cols-${cols.mobile || 1} sm:grid-cols-${cols.tablet || 2} lg:grid-cols-${cols.desktop || 3}`;
  
  return (
    <div className={cn("grid gap-3 sm:gap-4 md:gap-6", gridCols, className)}>
      {children}
    </div>
  );
}

/**
 * Mobile-optimized card with responsive padding
 */
export function MobileCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl sm:rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl backdrop-blur-xl p-3 sm:p-4 md:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Mobile-optimized heading with responsive text size
 */
export function MobileHeading({
  children,
  level = "h2",
  className,
}: {
  children: React.ReactNode;
  level?: "h1" | "h2" | "h3" | "h4";
  className?: string;
}) {
  const sizes = {
    h1: "text-2xl sm:text-3xl md:text-4xl lg:text-5xl",
    h2: "text-xl sm:text-2xl md:text-3xl",
    h3: "text-lg sm:text-xl md:text-2xl",
    h4: "text-base sm:text-lg md:text-xl",
  };

  const Component = level;

  return (
    <Component className={cn("font-bold tracking-tight", sizes[level], className)}>
      {children}
    </Component>
  );
}

/**
 * Mobile-optimized text with responsive size
 */
export function MobileText({
  children,
  size = "base",
  className,
}: {
  children: React.ReactNode;
  size?: "xs" | "sm" | "base" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "text-[10px] sm:text-xs",
    sm: "text-xs sm:text-sm",
    base: "text-sm sm:text-base",
    lg: "text-base sm:text-lg",
  };

  return <p className={cn(sizes[size], className)}>{children}</p>;
}
