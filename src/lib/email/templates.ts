interface WelcomeEmailInput {
  firstName?: string | null;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export function buildWelcomeEmail({ firstName }: WelcomeEmailInput) {
  const safeName = firstName?.trim() || "there";

  return {
    subject: "Welcome to LyraAlpha AI — your ELITE Beta access is ready",
    text: `Hi ${safeName},

Welcome to LyraAlpha AI Beta.

Your account is set up with:
- ELITE plan access (full feature set)
- 300 beta credits to explore the platform

Start here:
1) Complete onboarding wizard
2) Ask Lyra your first market question
3) Explore Discovery Feed

Open dashboard: ${APP_URL}/dashboard

- Team LyraAlpha AI`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2 style="margin-bottom: 8px;">Welcome to LyraAlpha AI Beta, ${safeName}.</h2>
        <p style="margin-top: 0;">Institutional-grade intelligence with retail clarity.</p>
        <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 14px 16px; border-radius: 10px; margin: 16px 0;">
          <p style="margin: 0; font-size: 13px; font-weight: 700; color: #92400e;">Your Beta access includes:</p>
          <p style="margin: 6px 0 0; font-size: 13px; color: #78350f;">&#10003; ELITE plan — full feature access</p>
          <p style="margin: 4px 0 0; font-size: 13px; color: #78350f;">&#10003; 300 beta credits to explore the platform</p>
        </div>
        <ol>
          <li>Complete your onboarding wizard</li>
          <li>Ask Lyra your first market question</li>
          <li>Explore your personalized Discovery Feed</li>
        </ol>
        <a
          href="${APP_URL}/dashboard"
          style="display: inline-block; margin-top: 12px; background: #f59e0b; color: #111827; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 700;"
        >
          Open Dashboard
        </a>
        <p style="margin-top: 16px; color: #6b7280; font-size: 12px;">You can manage email preferences inside your dashboard settings.</p>
      </div>
    `,
  };
}

interface ReengagementNudge1Input {
  firstName?: string | null;
}

export function buildReengagementNudge1Email({ firstName }: ReengagementNudge1Input) {
  const safeName = firstName?.trim() || "there";

  return {
    subject: "Your portfolio is moving — Lyra has insights",
    text: `Hi ${safeName},

Markets don't sleep and neither does Lyra.

Here's what's been happening:
• Sector rotation in tech and energy
• New discovery opportunities in your watchlist
• Market regime shift detected

Your credits are waiting. Come see what's changed.

Open dashboard: ${APP_URL}/dashboard

- Team LyraAlpha AI`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2 style="margin-bottom: 8px;">Your portfolio is moving, ${safeName}.</h2>
        <p style="margin-top: 0;">Markets don't sleep and neither does Lyra.</p>
        <h3 style="margin-top: 16px;">Here's what's been happening:</h3>
        <ul>
          <li>Sector rotation in tech and energy</li>
          <li>New discovery opportunities in your watchlist</li>
          <li>Market regime shift detected</li>
        </ul>
        <p>Your credits are waiting. Come see what's changed.</p>
        <a
          href="${APP_URL}/dashboard"
          style="display: inline-block; margin-top: 12px; background: #f59e0b; color: #111827; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 700;"
        >
          Open Dashboard
        </a>
      </div>
    `,
  };
}

interface ReengagementNudge2Input {
  firstName?: string | null;
  creditsRemaining: number;
}

export function buildReengagementNudge2Email({ firstName, creditsRemaining }: ReengagementNudge2Input) {
  const safeName = firstName?.trim() || "there";

  return {
    subject: `You have ${creditsRemaining} credits waiting — markets don't sleep`,
    text: `Hi ${safeName},

You still have ${creditsRemaining} credits to use.

Don't let good insights go to waste. Here's what you might have missed:
• New AI analysis on your watchlist assets
• Updated discovery feed with fresh opportunities
• Market intelligence reports

Your credits expire at the end of the month.

Open dashboard: ${APP_URL}/dashboard

- Team LyraAlpha AI`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2 style="margin-bottom: 8px;">You have ${creditsRemaining} credits waiting, ${safeName}.</h2>
        <p style="margin-top: 0;">Markets don't sleep and neither should your investing.</p>
        <h3 style="margin-top: 16px;">Don't let good insights go to waste:</h3>
        <ul>
          <li>New AI analysis on your watchlist assets</li>
          <li>Updated discovery feed with fresh opportunities</li>
          <li>Market intelligence reports</li>
        </ul>
        <p><strong>Your credits expire at the end of the month.</strong></p>
        <a
          href="${APP_URL}/dashboard"
          style="display: inline-block; margin-top: 12px; background: #f59e0b; color: #111827; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 700;"
        >
          Open Dashboard
        </a>
      </div>
    `,
  };
}

interface WinbackInput {
  firstName?: string | null;
  bonusCredits: number;
}

export function buildWinbackEmail({ firstName, bonusCredits }: WinbackInput) {
  const safeName = firstName?.trim() || "there";

  return {
    subject: `We miss you — here's ${bonusCredits} bonus credits to come back`,
    text: `Hi ${safeName},

We noticed you've been away. Here's our way of saying we want you back:

${bonusCredits} bonus credits (valid for 7 days)

That's enough for ~${Math.floor(bonusCredits / 3)} moderate analyses or ~${Math.floor(bonusCredits)} simple queries.

Come back and see what's new:
• Faster response times
• Better discovery feed
• New market intelligence features

Claim your bonus: ${APP_URL}/dashboard

- Team LyraAlpha AI`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2 style="margin-bottom: 8px;">We miss you, ${safeName}.</h2>
        <p style="margin-top: 0;">We noticed you've been away. Here's our way of saying we want you back:</p>
        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0; text-align: center;">
          <span style="font-size: 24px;">🎁</span>
          <p style="margin: 8px 0 0;"><strong>${bonusCredits} bonus credits</strong></p>
          <p style="margin: 4px 0 0; font-size: 12px; color: #92400e;">(valid for 7 days)</p>
        </div>
        <p>That's enough for ~${Math.floor(bonusCredits / 3)} moderate analyses or ~${Math.floor(bonusCredits)} simple queries.</p>
        <h3 style="margin-top: 16px;">Come back and see what's new:</h3>
        <ul>
          <li>Faster response times</li>
          <li>Better discovery feed</li>
          <li>New market intelligence features</li>
        </ul>
        <a
          href="${APP_URL}/dashboard"
          style="display: inline-block; margin-top: 12px; background: #f59e0b; color: #111827; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 700;"
        >
          Claim Your Bonus
        </a>
      </div>
    `,
  };
}

interface LowCreditsInput {
  firstName?: string | null;
  referralLink: string;
}

export function buildLowCreditsEmail({ firstName, referralLink }: LowCreditsInput) {
  const safeName = firstName?.trim() || "there";

  return {
    subject: "Running low on credits? Here's a free way to get more",
    text: `Hi ${safeName},

You're running low on credits. But there's a free way to get more:

Refer a friend = 75 free credits
They get 50 credits to start and you both win.

Your referral link: ${referralLink}

Share it with anyone interested in smarter investing.

- Team LyraAlpha AI`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2 style="margin-bottom: 8px;">Running low on credits, ${safeName}?</h2>
        <p style="margin-top: 0;">Here's a free way to get more:</p>
        <div style="background: #ecfdf5; padding: 16px; border-radius: 8px; margin: 16px 0; text-align: center;">
          <p style="margin: 0; font-size: 18px;">📨 <strong>Refer a friend = 75 free credits</strong></p>
          <p style="margin: 8px 0 0; font-size: 12px; color: #065f46;">They get 50 credits to start and you both win.</p>
        </div>
        <p><strong>Your referral link:</strong></p>
        <p style="word-break: break-all; color: #059669;">${referralLink}</p>
        <p>Share it with anyone interested in smarter investing.</p>
        <a
          href="${referralLink}"
          style="display: inline-block; margin-top: 12px; background: #10b981; color: white; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 700;"
        >
          Share Referral Link
        </a>
      </div>
    `,
  };
}

interface OnboardingReminderInput {
  firstName?: string | null;
  step: number;
}

export function buildOnboardingReminderEmail({ firstName, step }: OnboardingReminderInput) {
  const safeName = firstName?.trim() || "there";
  const remaining = 5 - step;

  return {
    subject: `You're ${remaining} steps away from your first Lyra insight`,
    text: `Hi ${safeName},

You're almost there. Just ${remaining} more steps to your first breakthrough:

1. Complete onboarding
2. Ask Lyra a question about any asset
3. Get institutional-grade analysis

It only takes 2 minutes. Your first insight is waiting.

Start now: ${APP_URL}/dashboard

- Team LyraAlpha AI`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2 style="margin-bottom: 8px;">You're ${remaining} steps away, ${safeName}.</h2>
        <p style="margin-top: 0;">Complete your onboarding and get your first Lyra insight.</p>
        <ol>
          <li>Complete onboarding</li>
          <li>Ask Lyra a question about any asset</li>
          <li>Get institutional-grade analysis</li>
        </ol>
        <p>It only takes 2 minutes. Your first insight is waiting.</p>
        <a
          href="${APP_URL}/dashboard"
          style="display: inline-block; margin-top: 12px; background: #f59e0b; color: #111827; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 700;"
        >
          Start Now
        </a>
      </div>
    `,
  };
}
