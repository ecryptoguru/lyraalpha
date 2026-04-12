"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { PushNotificationToggle } from "@/components/dashboard/push-notification-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Bell,
  Shield,
  Palette,
  Database,
  Key,
  Globe,
  Smartphone,
  CreditCard,
  Settings,
  Sparkles,
  Loader2,
  Star,
  Flame,
  ArrowUpRight,
  Zap,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useUser } from "@/lib/clerk-shim";
import { toast } from "sonner";
import Image from "next/image";
import {
  normalizeNotificationPreferences,
  type NotificationPreferencePayload,
} from "@/lib/notification-preferences";
import { LegalDocumentsModal } from "@/components/legal/legal-documents-modal";
import { type LegalDocumentType } from "@/lib/legal-documents";
import { ReferralPanel } from "@/components/dashboard/referral-panel";
import { useDashboardPoints } from "@/hooks/use-dashboard-points";
import { SectionErrorBoundary } from "@/components/error-boundary";

type PreferredRegion = "US" | "IN" | "BOTH";
type ExperienceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
type Interest = "CRYPTO";

const INTEREST_OPTIONS: Interest[] = ["CRYPTO"];

function formatInterestLabel(interest: Interest) {
  return interest.replace("_", " ");
}

export default function SettingsPage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { points: xpPoints, isLoading: xpLoading } = useDashboardPoints();

  // Profile fields (Clerk-backed)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>("STARTER");
  const [subscription, setSubscription] = useState<{
    plan: string;
    provider: string;
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const profilePreFilled = useRef(false);

  // Notification preferences (DB-backed)
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [newsAlerts, setNewsAlerts] = useState(true);
  const [morningIntelligence, setMorningIntelligence] = useState(true);
  const [portfolioAlerts, setPortfolioAlerts] = useState(true);
  const [opportunityAlerts, setOpportunityAlerts] = useState(true);
  const [narrativeAlerts, setNarrativeAlerts] = useState(true);
  const [shockWarnings, setShockWarnings] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(true);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  // Onboarding preferences
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [resettingOnboarding, setResettingOnboarding] = useState(false);
  const [blogSaving, setBlogSaving] = useState(false);
  const [preferredRegion, setPreferredRegion] = useState<PreferredRegion>("US");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("BEGINNER");
  const [interests, setInterests] = useState<Interest[]>(["CRYPTO"]);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(false);
  const [blogSubscribed, setBlogSubscribed] = useState(true);
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [activeLegalType, setActiveLegalType] = useState<LegalDocumentType>("privacy");

  useEffect(() => {
    // Hydration safety pattern - standard Next.js practice
    setMounted(true);
  }, []);

  // Option B: Fast pre-fill from Clerk client-side user object
  useEffect(() => {
    if (clerkLoaded && clerkUser && !profilePreFilled.current) {
      profilePreFilled.current = true;
      setFirstName(clerkUser.firstName || "");
      setLastName(clerkUser.lastName || "");
      setEmail(clerkUser.primaryEmailAddress?.emailAddress || "");
      setPhone(clerkUser.primaryPhoneNumber?.phoneNumber || "");
      setImageUrl(clerkUser.imageUrl || null);
    }
  }, [clerkLoaded, clerkUser]);

  function openLegalModal(type: LegalDocumentType) {
    setActiveLegalType(type);
    setIsLegalModalOpen(true);
  }

  
  const handleStripePortal = async () => {
    try {
      setPortalLoading(true);
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create portal session");
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      toast.error("Unable to open billing portal", {
        description: "Please try again or contact support if the issue persists.",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const comingSoon = useCallback((feature: string) => {
    toast.info(`${feature} — Coming Soon`, {
      description: "This feature is under development and will be available in a future update.",
    });
  }, []);

  // Load profile from Clerk server API (authoritative source)
  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const response = await fetch("/api/user/profile", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch profile");
      const data = await response.json();
      const p = data.profile as {
        firstName?: string; lastName?: string; email?: string; phone?: string;
        imageUrl?: string | null; createdAt?: string | null; lastSignInAt?: string | null;
      };
      setFirstName(p.firstName || "");
      setLastName(p.lastName || "");
      setEmail(p.email || "");
      setPhone(p.phone || "");
      setImageUrl(p.imageUrl || null);
      setMemberSince(p.createdAt || null);
      setLastSignIn(p.lastSignInAt || null);
      if (data.plan) setPlan(data.plan);
      if (data.subscription !== undefined) setSubscription(data.subscription);
    } catch {
      // Clerk client pre-fill is already in place as fallback
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Load notification preferences from DB
  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const response = await fetch("/api/user/preferences/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch notifications");
      const data = await response.json();
      const n = normalizeNotificationPreferences(data.notifications as Partial<NotificationPreferencePayload> | null | undefined);
      setEmailNotifications(n.emailNotifications ?? true);
      setPushNotifications(n.pushNotifications ?? false);
      setNewsAlerts(n.newsAlerts ?? true);
      setMorningIntelligence(n.morningIntelligence ?? true);
      setPortfolioAlerts(n.portfolioAlerts ?? true);
      setOpportunityAlerts(n.opportunityAlerts ?? true);
      setNarrativeAlerts(n.narrativeAlerts ?? true);
      setShockWarnings(n.shockWarnings ?? true);
      setWeeklyReports(n.weeklyReports ?? true);
    } catch {
      toast.error("Failed to load notification preferences");
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    setPreferencesLoading(true);
    try {
      const response = await fetch("/api/user/preferences", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch preferences");

      const data = await response.json();
      const prefs = data.preferences as {
        preferredRegion?: PreferredRegion;
        experienceLevel?: ExperienceLevel;
        interests?: Interest[];
        onboardingCompleted?: boolean;
        tourCompleted?: boolean;
        blogSubscribed?: boolean;
      };

      setPreferredRegion(prefs.preferredRegion || "US");
      setExperienceLevel(prefs.experienceLevel || "BEGINNER");
      setInterests(Array.isArray(prefs.interests) && prefs.interests.length > 0 ? prefs.interests as Interest[] : ["CRYPTO"]);
      setOnboardingCompleted(Boolean(prefs.onboardingCompleted));
      setTourCompleted(Boolean(prefs.tourCompleted));
      setBlogSubscribed(typeof prefs.blogSubscribed === "boolean" ? prefs.blogSubscribed : true);
    } catch {
      toast.error("Failed to load onboarding preferences");
    } finally {
      setPreferencesLoading(false);
    }
  }, []);

  async function resetOnboarding() {
    setResettingOnboarding(true);
    try {
      const response = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredRegion,
          experienceLevel,
          interests,
          onboardingCompleted: false,
          tourCompleted: false,
        }),
      });

      if (!response.ok) throw new Error("Failed to reset onboarding");

      setOnboardingCompleted(false);
      setTourCompleted(false);
      toast.success("Onboarding reset. Reopening onboarding wizard...");
      window.location.assign("/dashboard");
    } catch {
      toast.error("Unable to reset onboarding");
    } finally {
      setResettingOnboarding(false);
    }
  }

  useEffect(() => {
    if (!mounted) return;
    void loadPreferences();
    void loadProfile();
    void loadNotifications();
  }, [mounted, loadPreferences, loadProfile, loadNotifications]);

  function toggleInterest(interest: Interest) {
    setInterests((prev) => {
      if (prev.includes(interest)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== interest);
      }
      return [...prev, interest];
    });
  }

  async function saveOnboardingPreferences() {
    setPreferencesSaving(true);
    try {
      const response = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredRegion,
          experienceLevel,
          interests,
          onboardingCompleted,
          tourCompleted,
        }),
      });

      if (!response.ok) throw new Error("Failed to save preferences");
      toast.success("Onboarding preferences saved");
    } catch {
      toast.error("Unable to save onboarding preferences");
    } finally {
      setPreferencesSaving(false);
    }
  }

  async function updateBlogSubscription(nextValue: boolean) {
    const previous = blogSubscribed;
    setBlogSubscribed(nextValue);
    setBlogSaving(true);

    try {
      const response = await fetch("/api/user/preferences/blog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogSubscribed: nextValue }),
      });
      if (!response.ok) throw new Error("Failed to update blog preference");
      toast.success(nextValue ? "Blog emails enabled" : "Blog emails disabled");
    } catch {
      setBlogSubscribed(previous);
      toast.error("Unable to update blog subscription");
    } finally {
      setBlogSaving(false);
    }
  }

  if (!mounted) {
    return (
      <SectionErrorBoundary>
        <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full animate-pulse">
          <div className="h-24 rounded-3xl bg-muted/20 border border-border/20" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-3xl bg-muted/20 border border-border/20" />
          ))}
        </div>
      </SectionErrorBoundary>
    );
  }

  return (
    <SectionErrorBoundary>
      <div className="relative flex flex-col gap-4 sm:gap-5 w-full pb-6 p-3 sm:p-4 md:p-6 min-w-0 overflow-x-hidden">
      <section className="animate-slide-up-fade">
        <div className="rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            <Settings className="h-3 w-3" />
            User preferences
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl md:leading-[0.95]">
            System
            <span className="premium-gradient-text block">Settings</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            Configure your profile, market preferences, notifications, billing controls and account defaults from one consistent workspace.
          </p>
        </div>
      </section>

      {/* Profile Settings */}
      <Card className="rounded-4xl border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl animate-slide-up-fade animation-delay-100">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-2xl bg-muted/50">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Profile</CardTitle>
              <CardDescription className="text-xs">
                Name, email, and account details
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Avatar + Plan Badge + Member Since */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/20 border border-border/30">
            <div className="relative shrink-0">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={`${firstName} ${lastName}`}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-2xl border-2 border-primary/20 object-cover shadow-md"
                  unoptimized
                />
              ) : (
                <div className="h-14 w-14 rounded-2xl border-2 border-white/5 bg-muted/30 flex items-center justify-center">
                  <User className="h-6 w-6 text-muted-foreground/40" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-xl text-[7px] font-bold uppercase tracking-widest border bg-background shadow-sm"
                style={{
                  color: plan === "ELITE" || plan === "ENTERPRISE" ? "rgb(245, 158, 11)" : plan === "PRO" ? "rgb(59, 130, 246)" : "rgb(156, 163, 175)",
                  borderColor: plan === "ELITE" || plan === "ENTERPRISE" ? "rgba(245, 158, 11, 0.3)" : plan === "PRO" ? "rgba(59, 130, 246, 0.3)" : "rgba(156, 163, 175, 0.3)",
                }}
              >
                {plan}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold tracking-tight truncate">
                {firstName && lastName ? `${firstName} ${lastName}` : email || "Loading..."}
              </p>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
              {memberSince && (
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  Member since {new Date(memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                  {lastSignIn && ` · Last sign-in ${new Date(lastSignIn).toLocaleDateString()}`}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                placeholder="John"
                className="h-12 md:h-10"
                aria-label="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={profileLoading || profileSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                className="h-12 md:h-10"
                aria-label="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={profileLoading || profileSaving}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john.doe@example.com"
              className="h-12 md:h-10"
              aria-label="Email"
              value={email}
              disabled={true}
            />
            <p className="text-xs text-muted-foreground">Email is managed by your authentication provider and cannot be changed here.</p>
          </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 012-3456"
                className="h-12 md:h-10"
                aria-label="Phone Number"
                value={phone}
                disabled
              />
              <p className="text-xs text-muted-foreground">Phone number is managed by your authentication provider.</p>
            </div>
          <div className="flex justify-end pt-1">
          <Button
            className="h-10"
            disabled={profileSaving || profileLoading}
            onClick={async () => {
              setProfileSaving(true);
              try {
                const response = await fetch("/api/user/profile", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ firstName, lastName }),
                });
                if (!response.ok) {
                  const err = await response.json().catch(() => ({}));
                  throw new Error(err.error || "Failed to save profile");
                }
                const data = await response.json();
                const p = data.profile as { firstName?: string; lastName?: string; email?: string; phone?: string };
                setFirstName(p.firstName || "");
                setLastName(p.lastName || "");
                setEmail(p.email || "");
                setPhone(p.phone || "");
                toast.success("Profile saved successfully");
              } catch (error) {
                const message = error instanceof Error ? error.message : "Unable to save profile";
                toast.error(message);
              } finally {
                setProfileSaving(false);
              }
            }}
          >
            {profileSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Preferences */}
      <Card className="rounded-4xl border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl animate-slide-up-fade animation-delay-200">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-2xl bg-muted/50">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Onboarding & Personalization</CardTitle>
              <CardDescription className="text-xs">
                Region, risk profile, and content preferences
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {preferencesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your preferences...
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="preferred-region">Preferred Market</Label>
                  <Select value={preferredRegion} onValueChange={(v) => setPreferredRegion(v as PreferredRegion)}>
                    <SelectTrigger id="preferred-region">
                      <SelectValue placeholder="Select market" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="IN">India</SelectItem>
                      <SelectItem value="BOTH">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience-level">Experience Level</Label>
                  <Select value={experienceLevel} onValueChange={(v) => setExperienceLevel(v as ExperienceLevel)}>
                    <SelectTrigger id="experience-level">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BEGINNER">Beginner</SelectItem>
                      <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                      <SelectItem value="ADVANCED">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Interests</Label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((interest) => {
                    const selected = interests.includes(interest);
                    return (
                      <Button
                        key={interest}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleInterest(interest)}
                      >
                        {formatInterestLabel(interest)}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Select at least one interest to keep recommendations relevant.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-2xl border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="onboarding-completed">Onboarding Completed</Label>
                    <p className="text-xs text-muted-foreground">Controls whether onboarding wizard appears again</p>
                  </div>
                  <Switch
                    id="onboarding-completed"
                    checked={onboardingCompleted}
                    onCheckedChange={setOnboardingCompleted}
                  />
                </div>
                <div className="flex items-center justify-between rounded-2xl border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="tour-completed">Quick Tour Completed</Label>
                    <p className="text-xs text-muted-foreground">Track whether intro walkthrough is complete</p>
                  </div>
                  <Switch
                    id="tour-completed"
                    checked={tourCompleted}
                    onCheckedChange={setTourCompleted}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetOnboarding}
                  disabled={resettingOnboarding || preferencesSaving}
                >
                  {resettingOnboarding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Reset Onboarding
                </Button>
                <Button onClick={saveOnboardingPreferences} disabled={preferencesSaving || resettingOnboarding} className="min-w-44">
                  {preferencesSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Preferences
                </Button>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between rounded-2xl border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="blog-subscription">Blog & Intelligence Emails</Label>
                  <p className="text-sm text-muted-foreground">Receive weekly market insights and product updates</p>
                </div>
                <Switch
                  id="blog-subscription"
                  checked={blogSubscribed}
                  disabled={blogSaving}
                  onCheckedChange={updateBlogSubscription}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="rounded-4xl border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl animate-slide-up-fade animation-delay-200">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-2xl bg-muted/50">
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Notifications</CardTitle>
              <CardDescription className="text-xs">
                Push alerts and email updates
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {notificationsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading notification preferences...
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow email delivery for the notification types enabled below
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  disabled={notificationsSaving}
                  onCheckedChange={setEmailNotifications}
                />
              </div>

              <Separator />

              <PushNotificationToggle
                checked={pushNotifications}
                disabled={notificationsSaving}
                onStatusChange={setPushNotifications}
              />

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="news-alerts">News & Updates</Label>
                  <p className="text-sm text-muted-foreground">
                    Master toggle for market-news-driven intelligence alerts
                  </p>
                </div>
                <Switch
                  id="news-alerts"
                  checked={newsAlerts}
                  disabled={notificationsSaving}
                  onCheckedChange={setNewsAlerts}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Alert Types</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose which intelligence flows can reach you through the enabled channels above.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center justify-between rounded-2xl border p-3">
                    <div className="space-y-0.5 pr-4">
                      <Label htmlFor="morning-intelligence">Morning Intelligence</Label>
                      <p className="text-sm text-muted-foreground">Daily market-open briefing and context summary</p>
                    </div>
                    <Switch
                      id="morning-intelligence"
                      checked={morningIntelligence}
                      disabled={notificationsSaving}
                      onCheckedChange={setMorningIntelligence}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border p-3">
                    <div className="space-y-0.5 pr-4">
                      <Label htmlFor="portfolio-alerts">Portfolio Alerts</Label>
                      <p className="text-sm text-muted-foreground">Fragility, concentration and portfolio action alerts</p>
                    </div>
                    <Switch
                      id="portfolio-alerts"
                      checked={portfolioAlerts}
                      disabled={notificationsSaving}
                      onCheckedChange={setPortfolioAlerts}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border p-3">
                    <div className="space-y-0.5 pr-4">
                      <Label htmlFor="opportunity-alerts">Opportunity Alerts</Label>
                      <p className="text-sm text-muted-foreground">New Multibagger Radar and discovery opportunities</p>
                    </div>
                    <Switch
                      id="opportunity-alerts"
                      checked={opportunityAlerts}
                      disabled={notificationsSaving}
                      onCheckedChange={setOpportunityAlerts}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border p-3">
                    <div className="space-y-0.5 pr-4">
                      <Label htmlFor="narrative-alerts">Narrative Alerts</Label>
                      <p className="text-sm text-muted-foreground">Changes in the market story and regime narrative</p>
                    </div>
                    <Switch
                      id="narrative-alerts"
                      checked={narrativeAlerts}
                      disabled={notificationsSaving}
                      onCheckedChange={setNarrativeAlerts}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border p-3">
                    <div className="space-y-0.5 pr-4">
                      <Label htmlFor="shock-warnings">Shock Warnings</Label>
                      <p className="text-sm text-muted-foreground">Scenario-based stress and downside warnings</p>
                    </div>
                    <Switch
                      id="shock-warnings"
                      checked={shockWarnings}
                      disabled={notificationsSaving}
                      onCheckedChange={setShockWarnings}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border p-3">
                    <div className="space-y-0.5 pr-4">
                      <Label htmlFor="weekly-reports">Weekly Reports</Label>
                      <p className="text-sm text-muted-foreground">The slower weekly intelligence summary with biggest risk and best opportunity</p>
                    </div>
                    <Switch
                      id="weekly-reports"
                      checked={weeklyReports}
                      disabled={notificationsSaving}
                      onCheckedChange={setWeeklyReports}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button
                  disabled={notificationsSaving}
                  onClick={async () => {
                    setNotificationsSaving(true);
                    try {
                      const notificationPreferences: NotificationPreferencePayload = {
                        emailNotifications,
                        pushNotifications,
                        newsAlerts,
                        morningIntelligence,
                        portfolioAlerts,
                        opportunityAlerts,
                        narrativeAlerts,
                        shockWarnings,
                        weeklyReports,
                      };

                      const response = await fetch("/api/user/preferences/notifications", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(notificationPreferences),
                      });
                      if (!response.ok) {
                        const err = await response.json().catch(() => ({}));
                        throw new Error(err.error || "Failed to save");
                      }
                      toast.success("Notification preferences saved");
                    } catch (error) {
                      const message = error instanceof Error ? error.message : "Unable to save notification preferences";
                      toast.error(message);
                    } finally {
                      setNotificationsSaving(false);
                    }
                  }}
                >
                  {notificationsSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Notifications
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="rounded-4xl border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl animate-slide-up-fade animation-delay-300">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-2xl bg-muted/50">
              <Palette className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Appearance</CardTitle>
              <CardDescription className="text-xs">
                Light/dark mode and display options
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-0.5">
              <Label>Theme</Label>
              <p className="text-sm text-muted-foreground">
                Follow your device by default or choose a fixed appearance for this app.
              </p>
            </div>
            <ThemeToggle showLabels fullWidth showStatus />
            {mounted ? (
              <p className="text-xs text-muted-foreground">
                Preference: {theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}.
                {" "}
                Current appearance: {resolvedTheme === "dark" ? "Dark" : "Light"}.
              </p>
            ) : null}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="language-select">Language</Label>
            <Select defaultValue="en-US">
              <SelectTrigger id="language-select">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en-US">English (US)</SelectItem>
                <SelectItem value="en-UK">English (UK)</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency-select">Currency</Label>
            <Select defaultValue="USD">
              <SelectTrigger id="currency-select">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
                <SelectItem value="JPY">JPY (¥)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="rounded-4xl border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl animate-slide-up-fade animation-delay-300">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-2xl bg-muted/50">
              <Shield className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Security</CardTitle>
              <CardDescription className="text-xs">
                Password, 2FA, and active sessions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Password</Label>
            <Button variant="outline" className="w-full justify-start" onClick={() => comingSoon("Password Change")}>
              <Key className="h-4 w-4 mr-2" />
              Change Password
              <span className="ml-auto text-[10px] bg-muted px-2 py-0.5 rounded-full">Coming Soon</span>
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Two-Factor Authentication</Label>
            <div className="flex items-center justify-between p-3 border rounded-2xl">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">2FA Status</p>
                  <p className="text-xs text-muted-foreground">Not enabled</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => comingSoon("Two-Factor Authentication")}>
                Enable
                <span className="ml-1.5 text-[9px] bg-muted px-1.5 py-0.5 rounded-full">Soon</span>
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Active Sessions</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 border rounded-2xl">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Current Session</p>
                    <p className="text-xs text-muted-foreground">
                      {lastSignIn
                        ? `Last sign-in: ${new Date(lastSignIn).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                        : "Active now"}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-green-500 font-medium">
                  Active
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      
      {/* Subscription & Billing */}
      <Card className="rounded-4xl border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl animate-slide-up-fade animation-delay-500">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-2xl bg-muted/50">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Billing & Invoices</CardTitle>
              <CardDescription className="text-xs">
                Plan, invoices, and payment method
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Plan Info */}
          <div className="space-y-4 p-4 border rounded-2xl bg-muted/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-lg">{plan} Plan</p>
                {plan === "ELITE" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    You&apos;re on Elite. You get full Lyra routing, advanced modules, Compare, Stress Test, and 1.5× XP.
                  </p>
                )}
                {plan === "PRO" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    You&apos;re on Pro. You get a larger monthly credit balance and stronger Lyra analysis than Starter.
                  </p>
                )}
                {plan === "STARTER" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    You are currently on the free Starter plan.
                  </p>
                )}
              </div>
              {plan === "STARTER" ? (
                <Button onClick={() => { window.location.href = "/dashboard/upgrade"; }}>Upgrade Plan</Button>
              ) : (
                <Button variant="outline" disabled={portalLoading} onClick={handleStripePortal}>
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Manage Billing
                </Button>
              )}
            </div>

            {subscription && (
              <>
                <Separator className="bg-border/50" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Billing cycle</p>
                    <p className="text-muted-foreground mt-0.5">
                      {subscription.cancelAtPeriodEnd ? "Cancels" : "Renews"} on {new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    {subscription.cancelAtPeriodEnd && (
                      <p className="text-xs text-amber-500 font-medium mt-1">Scheduled to cancel at period end</p>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Payment method</p>
                    <p className="text-muted-foreground mt-0.5">Managed securely by {subscription.provider === "STRIPE" ? "Stripe" : "Razorpay"}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">(LyraAlpha AI does not store your card details)</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Plan Management Info */}
          {plan !== "STARTER" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Plan Management</p>
                <p className="text-sm text-muted-foreground">
                  You can change your plan at any time. Plan changes take effect at the start of the next billing cycle.
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Cancel subscription</p>
                <p className="text-sm text-muted-foreground">
                  You can cancel anytime. Your access will continue until the end of the current billing period. Canceling does not affect your existing data or history.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { window.location.href = "/dashboard/upgrade"; }}>
              {plan === "STARTER" ? "View Plans" : "Upgrade / Downgrade"}
            </Button>
            {plan !== "STARTER" && (
              <Button variant="outline" className="flex-1" disabled={portalLoading} onClick={handleStripePortal}>
                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Invoice History
              </Button>
            )}
          </div>
        </CardContent>
      </Card>


      {/* Credits & XP */}
      <Card className="rounded-4xl border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl animate-slide-up-fade animation-delay-400">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-2xl bg-amber-500/10">
                <Star className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base">Credits &amp; XP</CardTitle>
                <CardDescription className="text-xs">
                  Balance, level progress, and streak
                </CardDescription>
              </div>
            </div>
            <Link
              href="/dashboard/rewards"
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              View All
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {xpLoading ? (
            <div className="space-y-3">
              <div className="h-16 rounded-2xl bg-muted/20 animate-pulse" />
              <div className="h-16 rounded-2xl bg-muted/20 animate-pulse" />
            </div>
          ) : (
            <>
              {/* Credits row */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/20 border border-border/30">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Available Credits</div>
                  <div className="text-lg font-bold text-foreground leading-tight">
                    {(xpPoints?.credits ?? 0).toLocaleString()} credits
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(xpPoints?.totalCreditsEarned ?? 0).toLocaleString()} earned all-time
                  </div>
                </div>
              </div>

              {/* XP + Level row */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/20 border border-border/30">
                <div className="relative shrink-0">
                  <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <span className="text-base font-bold text-amber-400">{xpPoints?.level ?? 1}</span>
                  </div>
                  {(xpPoints?.streak ?? 0) >= 7 && (
                    <div className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-orange-500 flex items-center justify-center shadow">
                      <Flame className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {xpPoints?.tierEmoji ?? "🌱"} Level {xpPoints?.level ?? 1} · {xpPoints?.tierName ?? "Beginner"}
                  </div>
                  <div className="text-lg font-bold text-foreground leading-tight">
                    {(xpPoints?.xp ?? 0).toLocaleString()} XP
                  </div>
                  {(xpPoints?.streak ?? 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs text-orange-400">
                      <Flame className="h-3 w-3" />
                      {xpPoints?.streak}-day streak
                    </div>
                  )}
                </div>
              </div>

              {/* XP level progress bar */}
              {!xpPoints?.isMaxLevel && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <span>Level Progress</span>
                    <span className="text-amber-400">{xpPoints?.progressPercent ?? 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-amber-500/80 to-amber-400 transition-all duration-700 ease-out"
                      style={{ width: `${xpPoints?.progressPercent ?? 0}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground/70">
                    {((xpPoints?.xpNeededForNext ?? 0) - (xpPoints?.xpInCurrentLevel ?? 0)).toLocaleString()} XP until Level {(xpPoints?.level ?? 1) + 1}
                  </div>
                </div>
              )}
              {xpPoints?.isMaxLevel && (
                <p className="text-xs text-amber-400 font-bold">👑 Maximum level reached</p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="text-[10px] text-muted-foreground/60">
                  Earn XP by asking Lyra, completing modules, daily logins, and streaks. Redeem XP for credits on the Rewards page.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Referral Program */}
      <Card className="rounded-4xl border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl animate-slide-up-fade animation-delay-400">
        <CardContent className="p-4">
          <ReferralPanel />
        </CardContent>
      </Card>

      {/* Data & Privacy */}
      <Card className="rounded-4xl border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl animate-slide-up-fade animation-delay-500">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-2xl bg-muted/50">
              <Database className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Data & Privacy</CardTitle>
              <CardDescription className="text-xs">
                Export or delete your data
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => comingSoon("Data Export")}>
              <Database className="h-4 w-4 mr-2" />
              Download Your Data
              <span className="ml-auto text-[10px] bg-muted px-2 py-0.5 rounded-full">Coming Soon</span>
            </Button>
            <p className="text-xs text-muted-foreground">
              Export all your data in a portable format
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={() => comingSoon("Account Deletion")}
            >
              <Shield className="h-4 w-4 mr-2" />
              Delete Account
              <span className="ml-auto text-[10px] bg-muted px-2 py-0.5 rounded-full">Coming Soon</span>
            </Button>
            <p className="text-xs text-muted-foreground">
              Permanently delete your account and all associated data
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 py-6 border-t border-border/20">
        <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Beta</p>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => openLegalModal("privacy")}
            className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest hover:text-foreground transition-colors"
          >
            Privacy
          </button>
          <button
            type="button"
            onClick={() => openLegalModal("terms")}
            className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest hover:text-foreground transition-colors"
          >
            Terms
          </button>
          <a href="mailto:support@fusionwaveai.com" className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest hover:text-foreground transition-colors">
            Support
          </a>
        </div>
      </div>

      <LegalDocumentsModal
        open={isLegalModalOpen}
        onOpenChange={setIsLegalModalOpen}
        activeType={activeLegalType}
        onTypeChange={setActiveLegalType}
      />
      </div>
    </SectionErrorBoundary>
  );
}
