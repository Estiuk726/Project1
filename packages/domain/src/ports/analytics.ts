/** Core-loop events from PRD 18.1. Carry IDs only, never personal data. */
export type AnalyticsEvent =
  { name: 'signup_completed'; userId: string } | { name: 'email_verified'; userId: string };

export interface Analytics {
  track(event: AnalyticsEvent): Promise<void>;
}
