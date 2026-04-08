"use client";

import { useMemo, useState } from "react";
import { Download, Loader2, Mail, ShieldAlert, Users } from "lucide-react";

import { useAdminWaitlist } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface WaitlistUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  source: string;
  status: string;
  couponAccess: boolean;
  createdAt: string;
  lastEmailedAt: string | null;
}

export default function AdminWaitlistPage() {
  const { data, error, isLoading, mutate } = useAdminWaitlist();
  const [selected, setSelected] = useState<string[]>([]);
  const [subject, setSubject] = useState("InsightAlpha AI pre-launch update");
  const [htmlContent, setHtmlContent] = useState("<p>Thanks for joining the InsightAlpha AI waitlist.</p>");
  const [textContent, setTextContent] = useState("Thanks for joining the InsightAlpha AI waitlist.");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const users: WaitlistUser[] = data?.users ?? [];
  const stats = data?.stats;

  const allSelected = useMemo(
    () => users.length > 0 && selected.length === users.length,
    [selected.length, users.length],
  );

  const toggleUser = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const toggleAll = () => {
    setSelected(allSelected ? [] : users.map((user) => user.id));
  };

  const exportCsv = async () => {
    const response = await fetch("/api/admin/waitlist", { method: "POST" });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `waitlist-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sendBulkEmail = async () => {
    if (selected.length === 0 || !subject.trim() || !htmlContent.trim()) return;
    setIsSending(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/waitlist/bulk-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected, subject, htmlContent, textContent }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setResult(payload.error || "Failed to send email");
      } else {
        setResult(`Sent waitlist email to ${payload.sent} users`);
        setSelected([]);
        void mutate();
      }
    } catch {
      setResult("Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (error) {
    return <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3"><ShieldAlert className="h-8 w-8 text-destructive" /><p className="text-sm text-muted-foreground">Failed to load waitlist data.</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Waitlist</h1>
          <p className="mt-1 text-xs text-muted-foreground">Manage pre-launch leads, export CSV and send bulk Brevo emails.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-2xl" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/5 bg-card/80 p-4 backdrop-blur-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total waitlist</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{stats?.total ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-card/80 p-4 backdrop-blur-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Coupon access</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{stats?.couponAccessCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-card/80 p-4 backdrop-blur-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Joined 7d</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{stats?.recent7d ?? 0}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-primary">Bulk email waitlist</h2>
        </div>
        <div className="grid gap-3">
          <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Email subject" />
          <textarea
            value={htmlContent}
            onChange={(event) => setHtmlContent(event.target.value)}
            className="min-h-32 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
            placeholder="HTML email content"
          />
          <textarea
            value={textContent}
            onChange={(event) => setTextContent(event.target.value)}
            className="min-h-24 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
            placeholder="Plain text fallback"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{selected.length} waitlist user(s) selected</p>
            <Button className="rounded-2xl" onClick={sendBulkEmail} disabled={isSending || selected.length === 0}>
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Send via Brevo
            </Button>
          </div>
          {result ? <p className="text-xs text-muted-foreground">{result}</p> : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Waitlisted users</p>
          </div>
          <button onClick={toggleAll} className="text-xs font-semibold text-primary">
            {allSelected ? "Clear all" : "Select all"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-muted/20">
                <th className="px-3 py-2.5 text-left text-muted-foreground">Select</th>
                <th className="px-3 py-2.5 text-left text-muted-foreground">Email</th>
                <th className="px-3 py-2.5 text-left text-muted-foreground">Source</th>
                <th className="px-3 py-2.5 text-left text-muted-foreground">Status</th>
                <th className="px-3 py-2.5 text-left text-muted-foreground">Coupon Access</th>
                <th className="px-3 py-2.5 text-left text-muted-foreground">Joined</th>
                <th className="px-3 py-2.5 text-left text-muted-foreground">Last emailed</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border/20 hover:bg-muted/10">
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={selected.includes(user.id)} onChange={() => toggleUser(user.id)} />
                  </td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{user.email}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{user.source}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{user.status}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{user.couponAccess ? "Yes" : "No"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{user.lastEmailedAt ? new Date(user.lastEmailedAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No waitlist users yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
