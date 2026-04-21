import Link from "next/link";

type AuthButtonVariant = "default" | "primary";

interface AuthButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: AuthButtonVariant;
  icon?: React.ReactNode;
}

export function AuthButton({ href, children, variant = "default", icon }: AuthButtonProps) {
  const baseStyles = "flex items-center rounded-full px-5 py-2 min-h-[38px] text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5";
  
  const variants: Record<AuthButtonVariant, string> = {
    default: "border border-border/50 bg-white/90 text-foreground hover:bg-white dark:border-white/8 dark:bg-white/3 dark:text-white/80 dark:hover:bg-white/8",
    primary: "border border-primary/25 bg-primary/10 text-primary hover:bg-primary/15",
  };

  return (
    <Link href={href} className={`${baseStyles} ${variants[variant]}`}>
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </Link>
  );
}
