export const locales = ['pt-BR', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'pt-BR';

/** Display name of each locale in its own language, for language pickers. */
export const localeNames: Record<Locale, string> = { 'pt-BR': 'Português (Brasil)', en: 'English' };

/** A string available in every supported locale. */
export type Localized = Record<Locale, string>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/**
 * Picks the first supported locale from an Accept-Language header or a list of BCP 47 tags
 * (navigator.languages). Any Portuguese variant maps to pt-BR and any English variant to en.
 */
export function resolveLocale(input: string | readonly string[] | null | undefined, fallback: Locale = defaultLocale): Locale {
  const tags = typeof input === 'string' ? input.split(',').map((part) => part.split(';')[0]) : input ?? [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    if (tag.startsWith('pt')) return 'pt-BR';
    if (tag.startsWith('en')) return 'en';
  }
  return fallback;
}

export function localized(ptBR: string, en: string): Localized {
  return { 'pt-BR': ptBR, en };
}
