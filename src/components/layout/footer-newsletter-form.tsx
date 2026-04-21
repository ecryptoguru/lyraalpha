"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function FooterNewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure client-side only rendering for form state
  useEffect(() => {
    setMounted(true);
  }, []);

  const isValidEmail = useMemo(() => {
    return EMAIL_REGEX.test(email.trim());
  }, [email]);

  const isDisabled = !mounted || submitting || !isValidEmail;

  async function subscribeToBlog(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      if (!response.ok) {
        throw new Error("Subscription failed");
      }

      toast.success("Subscribed to market insights");
      setEmail("");
    } catch {
      toast.error("Unable to subscribe. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-5 space-y-3" onSubmit={subscribeToBlog}>
      <Input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@domain.com"
        className="h-11 rounded-[1.2rem] border-border/50 bg-white text-foreground placeholder:text-muted-foreground dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder:text-white/28"
        aria-label="Subscribe to blog"
        disabled={submitting}
      />
      <Button
        type="submit"
        disabled={isDisabled}
        className="h-11 w-full rounded-full bg-warning font-bold text-foreground hover:bg-warning1623 disabled:opacity-50"
      >
        {submitting ? "Subscribing..." : "Subscribe"}
      </Button>
    </form>
  );
}
