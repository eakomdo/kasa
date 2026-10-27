/**
 * Preferences that belong to this phone, not the account: theme, data saver,
 * card direction and which units are stored for offline use.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePref = 'system' | 'light' | 'dark';

interface DevicePrefs {
  theme: ThemePref;
  dataSaver: boolean;
  cardDirection: 'english-first' | 'local-first';
  offlineUnitIds: string[];
  setTheme: (t: ThemePref) => void;
  setDataSaver: (v: boolean) => void;
  setCardDirection: (d: DevicePrefs['cardDirection']) => void;
  toggleOfflineUnit: (unitId: string) => void;
}

export const useDevicePrefs = create<DevicePrefs>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      dataSaver: false,
      cardDirection: 'english-first',
      offlineUnitIds: [],
      setTheme: (theme) => set({ theme }),
      setDataSaver: (dataSaver) => set({ dataSaver }),
      setCardDirection: (cardDirection) => set({ cardDirection }),
      toggleOfflineUnit: (id) => {
        const ids = get().offlineUnitIds;
        set({ offlineUnitIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });
      },
    }),
    {
      name: 'kasa-device',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // v2: Kasa became dark-first, so earlier "system" choices move to dark
      migrate: (state, version) => {
        const s = state as DevicePrefs;
        return version < 2 ? { ...s, theme: 'dark' } : s;
      },
    },
  ),
);

/** Free accounts can keep this many units offline; Kasa Plus removes the limit. */
export const FREE_OFFLINE_UNITS = 3;
