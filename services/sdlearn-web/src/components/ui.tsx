import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle, RotateCcw, TriangleAlert } from 'lucide-react';
import type { Difficulty, Verdict } from '../types';
import { useI18n } from '../i18n';
import { scoreTone } from '../lib/format';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'chaos' | 'toggle';

export interface ButtonStyle {
  variant?: ButtonVariant;
  /** Every size shares one height/padding scale, so buttons in the same row always line up. */
  size?: 'sm' | 'md';
  active?: boolean;
  block?: boolean;
}

/** Class list for the shared button; use it directly on links that should look like buttons. */
export function buttonClass({ variant = 'ghost', size = 'md', active = false, block = false }: ButtonStyle = {}, extra?: string): string {
  return ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', active && 'active', block && 'btn-block', extra].filter(Boolean).join(' ');
}

export function Button({ variant, size, active, block, className, type = 'button', ...props }: ButtonStyle & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={buttonClass({ variant, size, active, block }, className)} {...props} />;
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const { t } = useI18n();
  return <span className={`difficulty difficulty-${difficulty.toLowerCase()}`}>{t.difficulty[difficulty]}</span>;
}

export function TagChip({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}

export function VerdictBadge({ verdict }: { verdict: Verdict | null | undefined }) {
  const { t } = useI18n();
  if (!verdict) return null;
  return <span className={`verdict verdict-${verdict}`}>{t.verdict[verdict]}</span>;
}

export function ScoreRing({ score, size = 120, label }: { score: number | null; size?: number; label?: string }) {
  const stroke = Math.max(6, size / 14);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score === null ? 0 : Math.min(100, Math.max(0, score)) / 100;
  return (
    <div className={`score-ring tone-${scoreTone(score)}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} className="score-ring-track" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} className="score-ring-value" strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="score-ring-label">
        <strong style={{ fontSize: size / 3.4 }}>{score ?? '—'}</strong>
        {label && <span>{label}</span>}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return <div className="spinner" role="status"><LoaderCircle className="spin" size={18} />{label && <span>{label}</span>}</div>;
}

export function PageLoading() {
  const { t } = useI18n();
  return <div className="page-loading"><Spinner label={t.common.loading} /></div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="state-box state-error" role="alert">
      <TriangleAlert size={20} />
      <div><strong>{t.common.somethingWrong}</strong><p>{message}</p></div>
      {onRetry && <Button onClick={onRetry}><RotateCcw size={14} />{t.common.retry}</Button>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="state-box state-empty">
      <span className="state-icon">{icon}</span>
      <strong>{title}</strong>
      <p>{body}</p>
      {action}
    </div>
  );
}
