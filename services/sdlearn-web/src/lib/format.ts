import type { EvaluationStatus } from '../types';
import { getLocale, getMessages } from '../i18n';

const units: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3_600], ['minute', 60]];
const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();

export function relativeTime(iso: string): string {
  const locale = getLocale();
  let relative = relativeFormats.get(locale);
  if (!relative) relativeFormats.set(locale, relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }));
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  return getMessages().time.justNow;
}

export function formatNumber(value: number): string {
  return value.toLocaleString(getLocale());
}

export function padNumber(value: number): string {
  return `#${String(value).padStart(3, '0')}`;
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function isRunning(status: EvaluationStatus): boolean {
  return status === 'queued' || status === 'judging' || status === 'debating' || status === 'deliberating';
}

export function scoreTone(score: number | null | undefined): 'pass' | 'borderline' | 'fail' | 'none' {
  if (score === null || score === undefined) return 'none';
  return score >= 75 ? 'pass' : score >= 55 ? 'borderline' : 'fail';
}
