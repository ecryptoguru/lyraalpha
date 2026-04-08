export type LegalDocumentType = "privacy" | "terms";

export interface LegalSection {
  title: string;
  body: string[];
}

export interface LegalDocument {
  title: string;
  subtitle: string;
  updatedAt: string;
  sections: LegalSection[];
}

export const PRIVACY_DOCUMENT: LegalDocument = {
  title: "Privacy Policy",
  subtitle: "LyraAlpha AI and LYRA",
  updatedAt: "February 14, 2026",
  sections: [
    {
      title: "1. Scope",
      body: [
        "This Privacy Policy applies to the LyraAlpha AI website, dashboard, and LYRA features used on free and paid plans.",
        "By using the platform, you acknowledge the data practices described below.",
      ],
    },
    {
      title: "2. Data We Collect",
      body: [
        "We collect account details such as name, email address, authentication identifiers, and profile preferences.",
        "We also collect product usage events, plan information, and security telemetry needed to operate, protect, and improve the service.",
        "Portfolio and watchlist data are processed only to deliver analytics requested by you.",
      ],
    },
    {
      title: "3. Data We Do Not Intentionally Collect",
      body: [
        "We do not intentionally collect biometric identifiers, government identity numbers, or sensitive personal data unless specifically required and legally permitted.",
        "We do not request brokerage passwords or banking credentials inside the product.",
      ],
    },
    {
      title: "4. How We Use Data",
      body: [
        "We use personal data to authenticate users, provide analytics, enforce plan controls, prevent abuse, and communicate important service updates.",
        "We do not sell personal data.",
        "We do not use your personal portfolio data to train foundation AI models without explicit consent.",
      ],
    },
    {
      title: "5. AI and Model Operations",
      body: [
        "LYRA may use deterministic analytics outputs and licensed market context to generate explanations.",
        "Prompt and response logs may be retained for reliability, abuse monitoring, and quality audits.",
        "AI outputs can contain inaccuracies and should be independently verified.",
      ],
    },
    {
      title: "6. Sharing with Service Providers",
      body: [
        "We share data only with trusted processors that help deliver authentication, billing, hosting, monitoring, and core platform infrastructure.",
        "All processors are contractually required to process data only for approved purposes.",
      ],
    },
    {
      title: "7. Security and Retention",
      body: [
        "We apply encryption in transit, access controls, and operational safeguards appropriate to the nature of the data.",
        "Data is retained only as long as needed to provide the service, comply with legal obligations, and resolve legitimate disputes.",
      ],
    },
    {
      title: "8. Your Rights",
      body: [
        "Subject to applicable law, you may request access, correction, deletion, or restriction of your personal data.",
        "You may withdraw consent for optional processing at any time.",
        "Requests can be submitted at support@fusionwaveai.com.",
      ],
    },
    {
      title: "9. Cookies and Similar Technologies",
      body: [
        "We use cookies and similar technologies for session continuity, product performance, and security diagnostics.",
        "Where required by law, consent controls are provided.",
      ],
    },
    {
      title: "10. Children",
      body: [
        "The platform is not intended for users under 18 years of age.",
        "If you believe a minor has provided personal data, contact us for removal.",
      ],
    },
    {
      title: "11. Policy Updates",
      body: [
        "We may revise this policy periodically.",
        "Material updates will be communicated through the platform or associated communication channels.",
      ],
    },
    {
      title: "12. Contact",
      body: [
        "For privacy and grievance requests, email support@fusionwaveai.com.",
        "This policy is governed by applicable laws of India, including the Digital Personal Data Protection Act, 2023.",
      ],
    },
  ],
};

export const TERMS_DOCUMENT: LegalDocument = {
  title: "Terms of Service",
  subtitle: "LyraAlpha AI and LYRA",
  updatedAt: "February 14, 2026",
  sections: [
    {
      title: "1. Acceptance of Terms",
      body: [
        "By accessing or using LyraAlpha AI, you agree to these Terms of Service.",
        "If you do not agree, you must stop using the platform.",
      ],
    },
    {
      title: "2. Service Description",
      body: [
        "LyraAlpha AI provides market analytics, explainability tooling, and AI-assisted interpretation across supported asset classes.",
        "The platform is informational and educational in nature.",
      ],
    },
    {
      title: "3. No Investment Advice",
      body: [
        "Nothing in the platform constitutes investment advice, research advice, fiduciary advice, solicitation, or recommendation to buy or sell securities.",
        "Users remain solely responsible for their financial and investment decisions.",
      ],
    },
    {
      title: "4. AI Output Disclaimer",
      body: [
        "LYRA responses are generated with probabilistic systems and may be incomplete, delayed, or inaccurate.",
        "You should independently validate all critical information before acting on it.",
      ],
    },
    {
      title: "5. Analytics and Scores",
      body: [
        "Displayed metrics and scores are analytical representations based on available data and methodology rules.",
        "They are descriptive indicators and not guaranteed predictors of future market outcomes.",
      ],
    },
    {
      title: "6. User Responsibilities",
      body: [
        "You agree to use the platform lawfully and not attempt abuse, reverse engineering of protected systems, or unauthorized access.",
        "You are responsible for maintaining your account security and safeguarding credentials.",
      ],
    },
    {
      title: "7. Plans and Billing",
      body: [
        "Paid plans provide access to higher limits and additional analytical depth.",
        "Subscription fees pay for platform access and service delivery, not financial outcomes.",
      ],
    },
    {
      title: "8. Third-Party Data",
      body: [
        "The platform may rely on external data providers.",
        "We are not responsible for outages, inaccuracies, or delays originating from third-party sources.",
      ],
    },
    {
      title: "9. Limitation of Liability",
      body: [
        "To the maximum extent permitted by law, LyraAlpha AI is not liable for indirect, incidental, consequential, trading, or investment losses arising from use of the platform.",
        "Use of the platform is at your own risk.",
      ],
    },
    {
      title: "10. Termination",
      body: [
        "We may suspend or terminate access for violations of these terms, abuse, or legal compliance requirements.",
        "You may discontinue use at any time.",
      ],
    },
    {
      title: "11. Changes to Terms",
      body: [
        "We may update these terms from time to time.",
        "Continued use after an update constitutes acceptance of the revised terms.",
      ],
    },
    {
      title: "12. Governing Law and Contact",
      body: [
        "These terms are governed by the laws of India.",
        "For legal and support queries, contact support@fusionwaveai.com.",
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS: Record<LegalDocumentType, LegalDocument> = {
  privacy: PRIVACY_DOCUMENT,
  terms: TERMS_DOCUMENT,
};
