import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { createCookieStorage } from './middleware/cookie-storage';

type Theme = 'light' | 'dark' | 'system';

interface AppState {
  theme: Theme;
  sidebarOpen: boolean;
}

interface AppActions {
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

type AppStore = AppState & AppActions;

const INITIAL_STATE: AppState = {
  theme: 'dark',
  sidebarOpen: false,
};

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set) => ({
        ...INITIAL_STATE,

        setTheme: (theme) => set({ theme }, false, 'app/setTheme'),

        toggleSidebar: () =>
          set((s) => ({ sidebarOpen: !s.sidebarOpen }), false, 'app/toggleSidebar'),

        setSidebarOpen: (open) => set({ sidebarOpen: open }, false, 'app/setSidebarOpen'),
      }),
      {
        name: 'app',
        // Cookie storage: the `theme` preference is readable server-side,
        // enabling SSR to apply the correct class before hydration.
        storage: createCookieStorage({ maxAge: 60 * 60 * 24 * 365 }),
        partialize: (state) => ({ theme: state.theme }),
      },
    ),
    { name: 'AppStore' },
  ),
);
