/** GES school levels. JHS 1–3 are Basic 7–9 under the standards-based curriculum. */
export type BandId = 'lp' | 'up' | 'jhs' | 'shs';
export type LevelId = 'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6' | 'b7' | 'b8' | 'b9' | 'shs1' | 'shs2' | 'shs3';

export interface Band {
  id: BandId;
  name: string;
  /** Label for exam-style practice at this band */
  examLabel: string;
  /** Name of the highest daily-goal option */
  topGoalLabel: string;
}

export interface Level {
  id: LevelId;
  name: string;
  short: string;
  /** Official GES basic-level code when it differs from the everyday name */
  gesCode?: string;
  band: BandId;
}

export const BANDS: readonly Band[] = [
  { id: 'lp', name: 'Lower Primary', examLabel: 'Quiz', topGoalLabel: 'Challenge' },
  { id: 'up', name: 'Upper Primary', examLabel: 'Quiz', topGoalLabel: 'Challenge' },
  { id: 'jhs', name: 'Junior High', examLabel: 'BECE style', topGoalLabel: 'BECE mode' },
  { id: 'shs', name: 'Senior High', examLabel: 'WASSCE style', topGoalLabel: 'WASSCE mode' },
];

export const LEVELS: readonly Level[] = [
  { id: 'b1', name: 'Basic 1', short: 'B1', band: 'lp' },
  { id: 'b2', name: 'Basic 2', short: 'B2', band: 'lp' },
  { id: 'b3', name: 'Basic 3', short: 'B3', band: 'lp' },
  { id: 'b4', name: 'Basic 4', short: 'B4', band: 'up' },
  { id: 'b5', name: 'Basic 5', short: 'B5', band: 'up' },
  { id: 'b6', name: 'Basic 6', short: 'B6', band: 'up' },
  { id: 'b7', name: 'JHS 1', short: 'JHS 1', gesCode: 'Basic 7', band: 'jhs' },
  { id: 'b8', name: 'JHS 2', short: 'JHS 2', gesCode: 'Basic 8', band: 'jhs' },
  { id: 'b9', name: 'JHS 3', short: 'JHS 3', gesCode: 'Basic 9', band: 'jhs' },
  { id: 'shs1', name: 'SHS 1', short: 'SHS 1', band: 'shs' },
  { id: 'shs2', name: 'SHS 2', short: 'SHS 2', band: 'shs' },
  { id: 'shs3', name: 'SHS 3', short: 'SHS 3', band: 'shs' },
];

const DEFAULT_LEVEL = LEVELS[6]!;

export const getLevel = (id: LevelId | string | null | undefined): Level =>
  LEVELS.find((l) => l.id === id) ?? DEFAULT_LEVEL;

export const getBand = (id: BandId): Band => BANDS.find((b) => b.id === id) ?? BANDS[2]!;

export const levelLabel = (level: Level): string =>
  level.gesCode ? `${level.name} (${level.gesCode})` : level.name;

/** Primary pupils are usually under 13 and need a guardian on the account. */
export const needsGuardian = (level: Level): boolean => level.band === 'lp' || level.band === 'up';
