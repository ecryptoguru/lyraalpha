import Link from "next/link";

export function FooterLegalLinks() {
  return (
    <div className="flex flex-wrap items-center gap-5">
      <Link
        href="/privacy"
        className="transition-colors hover:text-primary dark:hover:text-primary/60 py-2 min-h-[40px]"
      >
        Privacy Policy
      </Link>
      <Link
        href="/terms"
        className="transition-colors hover:text-primary dark:hover:text-primary/60 py-2 min-h-[40px]"
      >
        Terms of Service
      </Link>
    </div>
  );
}
