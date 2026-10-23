import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isLocale, resolveLocale, type Locale } from '@shared/i18n/locale';
import { en } from './en';
import { ptBR, type Messages } from './pt-BR';

export type { Messages } from './pt-BR';

const STORAGE_KEY = 'archon.locale';
const catalogs: Record<Locale, Messages> = { 'pt-BR': ptBR, en };

function initialLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Storage can be unavailable (private mode); fall back to the browser language.
  }
  return resolveLocale(navigator.languages?.length ? navigator.languages : [navigator.language], 'en');
}

// Mirrors the provider state for code outside React (API clients, date formatting).
let activeLocale: Locale = initialLocale();

export function getLocale(): Locale {
  return activeLocale;
}

export function getMessages(): Messages {
  return catalogs[activeLocale];
}

interface I18nContextValue { locale: Locale; setLocale: (locale: Locale) => void; t: Messages }

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(activeLocale);

  const setLocale = useCallback((next: Locale) => {
    activeLocale = next;
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this visit.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = catalogs[locale].meta.documentTitle;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t: catalogs[locale] }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
