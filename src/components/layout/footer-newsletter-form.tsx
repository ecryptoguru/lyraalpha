"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FooterNewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function subscribeToBlog(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
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
        className="h-11 rounded-[1.2rem] border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder:text-white/28"
        aria-label="Subscribe to blog"
        required
      />
      <Button
        type="submit"
        disabled={submitting || !email.trim()}
        className="h-11 w-full rounded-full bg-amber-400 font-bold text-slate-950 hover:bg-amber-300"
      >
        Subscribe
      </Button>
    </form>
  );
}
