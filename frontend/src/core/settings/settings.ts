import { localStore } from '../storage/localStore'

export type ThemeMode = 'light' | 'dark' | 'system'
export type AccentTheme = 'navy' | 'emerald' | 'graphite' | 'gold'
export type BackgroundTheme = 'bluegray' | 'mist' | 'sage' | 'sand' | 'sky' | 'lavender'
export type AppLanguage = 'fa' | 'en'
export type FontTheme = 'vazirmatn' | 'tahoma' | 'arial' | 'system' | 'noto' | 'sahel' | 'shabnam' | 'samim' | 'nazanin' | 'titr' | 'inter' | 'roboto' | 'opensans' | 'lato' | 'montserrat' | 'poppins' | 'serif' | 'mono'

export interface AppSettings {
  themeMode: ThemeMode
  accentTheme: AccentTheme
  backgroundTheme: BackgroundTheme
  fontTheme: FontTheme
  language: AppLanguage
  compactMode: boolean
  confirmBeforeDelete: boolean
  autoBackup: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'light',
  accentTheme: 'navy',
  backgroundTheme: 'bluegray',
  fontTheme: 'vazirmatn',
  language: 'fa',
  compactMode: false,
  confirmBeforeDelete: true,
  autoBackup: false
}

const SETTINGS_KEY = 'settings:app:v1'

export async function loadSettings(): Promise<AppSettings> {
  const stored = await localStore.get<Partial<AppSettings>>(SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await localStore.set(SETTINGS_KEY, settings)
}

export function applySettings(settings: AppSettings) {
  const root = document.documentElement
  const resolvedMode = settings.themeMode === 'system'
    ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : settings.themeMode
  root.dataset.theme = resolvedMode
  root.dataset.accent = settings.accentTheme
  root.dataset.background = settings.backgroundTheme ?? 'bluegray'
  root.dataset.font = settings.fontTheme ?? 'vazirmatn'
  root.lang = settings.language
  root.dir = settings.language === 'fa' ? 'rtl' : 'ltr'
  root.dataset.density = settings.compactMode ? 'compact' : 'comfortable'
}
