import type { EvaluationStatus, SessionStatus, Verdict } from '../types';

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
const units: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3_600], ['minute', 60]];

export function relativeTime(iso: string): string {
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  return 'agora mesmo';
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

export const verdictLabel: Record<Verdict, string> = { pass: 'Pass', borderline: 'Borderline', fail: 'Fail' };

export const sessionStatusLabel: Record<SessionStatus, string> = { 'in-progress': 'Em progresso', submitted: 'Pré-avaliado', judged: 'Julgado' };

export const evaluationStatusLabel: Record<EvaluationStatus, string> = {
  queued: 'Na fila', judging: 'Juízes avaliando', debating: 'Em debate', deliberating: 'Chegando ao consenso',
  completed: 'Concluída', heuristic: 'Pré-avaliação', failed: 'Falhou',
};

export function isRunning(status: EvaluationStatus): boolean {
  return status === 'queued' || status === 'judging' || status === 'debating' || status === 'deliberating';
}

export function scoreTone(score: number | null | undefined): 'pass' | 'borderline' | 'fail' | 'none' {
  if (score === null || score === undefined) return 'none';
  return score >= 75 ? 'pass' : score >= 55 ? 'borderline' : 'fail';
}
