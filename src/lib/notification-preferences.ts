export const defaultNotificationPreferences = {
  emailNotifications: true,
  pushNotifications: false,
  newsAlerts: true,
  morningIntelligence: true,
  portfolioAlerts: true,
  opportunityAlerts: true,
  narrativeAlerts: true,
  shockWarnings: true,
  weeklyReports: true,
};

export type NotificationPreferencePayload = typeof defaultNotificationPreferences;

export const notificationPreferenceSelect = {
  emailNotifications: true,
  pushNotifications: true,
  newsAlerts: true,
  morningIntelligence: true,
  portfolioAlerts: true,
  opportunityAlerts: true,
  narrativeAlerts: true,
  shockWarnings: true,
  weeklyReports: true,
};

export function normalizeNotificationPreferences(
  value?: Partial<NotificationPreferencePayload> | null,
): NotificationPreferencePayload {
  return {
    ...defaultNotificationPreferences,
    ...value,
  };
}
