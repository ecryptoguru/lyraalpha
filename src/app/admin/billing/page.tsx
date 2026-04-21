"use client";

import React from "react";
import { useAdminBilling } from "@/hooks/use-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, Search, Clock, Loader2 } from "lucide-react";

export default function BillingAdminPage() {
  const { data, error, isLoading } = useAdminBilling();

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3"><ShieldAlert className="h-8 w-8 text-destructive" /><p className="text-sm text-muted-foreground">Failed to load billing data.</p></div>;
  if (!data) return null;

  const recentLogs = data.recentLogs || [];
  const activeSubs = data.activeSubscriptions || 0;
  const pastDueSubs = data.pastDueSubscriptions || 0;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-warning" />
            Billing Operations
          </h1>
          <p className="text-muted-foreground mt-2">
            Read-only audit trail and subscription status monitor. Stripe is the financial authority.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-success/10 border-success/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-success dark:text-success text-sm font-bold uppercase tracking-widest">Active Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-success dark:text-success">{activeSubs}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-warning/10 border-warning/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-primary dark:text-warning text-sm font-bold uppercase tracking-widest">Past Due / Failing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary dark:text-warning">{pastDueSubs}</div>
          </CardContent>
        </Card>

        <Card className="bg-warning/10 border-warning/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-primary dark:text-warning text-sm font-bold uppercase tracking-widest">System Authority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium text-primary dark:text-warning mt-2">
              All financial mutations must occur in the Stripe Dashboard.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/5 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Billing Audit Trail</CardTitle>
              <CardDescription>Immutable log of all billing state transitions</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search email or ID..." 
                  className="pl-9 pr-4 py-2 text-sm bg-muted/50 border border-white/5 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/20 w-64"
                  disabled
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                <tr>
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Event Type</th>
                  <th className="px-4 py-3 font-medium">State Change</th>
                  <th className="px-4 py-3 font-medium">Stripe Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {recentLogs.map((log: {
                  id: string;
                  timestamp: string;
                  userId: string;
                  eventType: string;
                  previousState: string | null;
                  newState: string;
                  amount: number | null;
                  currency: string | null;
                  stripeObjectId: string | null;
                  user: { email: string; plan: string } | null;
                }) => (
                  <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {new Date(log.timestamp).toLocaleString(undefined, { 
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' 
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{log.user?.email || log.userId}</div>
                      <div className="text-xs text-muted-foreground">Plan: {log.user?.plan}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-primary/10 text-primary uppercase">
                        {log.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.previousState && (
                        <span className="text-muted-foreground line-through mr-2">{log.previousState}</span>
                      )}
                      <span className="font-medium text-foreground">→ {log.newState}</span>
                      {log.amount !== null && (
                        <div className="text-xs text-success mt-0.5 font-medium">
                          {(log.amount / 100).toFixed(2)} {log.currency?.toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-mono text-muted-foreground">
                        {log.stripeObjectId ? `${log.stripeObjectId.slice(0, 14)}...` : "—"}
                      </div>
                    </td>
                  </tr>
                ))}
                {recentLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No billing events recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
