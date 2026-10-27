/**
 * Feature flags. Defaults live here; a deployment can override them with
 * VITE_FLAGS='{"mobileMoney":true}'. Swap for a remote flag service when
 * rollouts need targeting (by region, school or percentage).
 */
const DEFAULTS = {
  /** Real Mobile Money checkout for Kasa Plus */
  mobileMoney: false,
  /** Speaking practice using Khaya speech recognition */
  speakingPractice: false,
  /** Short graded stories with tap-to-translate */
  gradedReaders: false,
};

export type FlagName = keyof typeof DEFAULTS;

function parseOverrides(): Partial<Record<FlagName, boolean>> {
  try {
    const raw = import.meta.env.VITE_FLAGS as string | undefined;
    return raw ? (JSON.parse(raw) as Partial<Record<FlagName, boolean>>) : {};
  } catch {
    return {};
  }
}

export const flags: Readonly<Record<FlagName, boolean>> = { ...DEFAULTS, ...parseOverrides() };

export const isEnabled = (name: FlagName): boolean => flags[name];
