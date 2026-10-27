/**
 * Product analytics with a typed event catalogue. Events never carry personal
 * data (no names, emails or free text), because most learners are children.
 * In production, setAnalyticsSink() forwards to PostHog, Amplitude, etc.
 */
export interface AnalyticsEvents {
  signup_completed: { level: string };
  onboarding_completed: { lang: string; level: string; goal: number; hasSchool: boolean };
  practice_started: { mode: string; scoped: boolean };
  practice_completed: { mode: string; cards: number; accuracy: number };
  lookup_performed: { lang: string; source: 'curriculum' | 'khaya' | 'none' };
  translation_suggested: { lang: string };
  unit_saved_offline: { unitId: string };
  app_installed: Record<string, never>;
  community_joined: { policy: string };
  community_created: { kind: string };
  thread_posted: Record<string, never>;
}

type Sink = <K extends keyof AnalyticsEvents>(name: K, props: AnalyticsEvents[K]) => void;

let sink: Sink = (name, props) => {
  // eslint-disable-next-line no-console -- dev-only visibility into events
  if (import.meta.env.DEV) console.debug('[analytics]', name, props);
};

export function setAnalyticsSink(next: Sink) {
  sink = next;
}

export function track<K extends keyof AnalyticsEvents>(name: K, props: AnalyticsEvents[K]) {
  try {
    sink(name, props);
  } catch {
    /* analytics must never break learning */
  }
}
