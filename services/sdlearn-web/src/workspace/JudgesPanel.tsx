import { Link } from 'react-router-dom';
import { ArrowRight, Gavel, Scale, Send } from 'lucide-react';
import type { Evaluation } from '../types';
import { useI18n } from '../i18n';
import { isRunning, relativeTime, scoreTone } from '../lib/format';
import { Button, VerdictBadge } from '../components/ui';

interface JudgesPanelProps {
  evaluations: Evaluation[];
  componentCount: number;
  notesLength: number;
  chaosRunCount: number;
  submitting: boolean;
  error: string | null;
  aiAvailable: boolean;
  onSubmit: () => void;
}

export function JudgesPanel({ evaluations, componentCount, notesLength, chaosRunCount, submitting, error, aiAvailable, onSubmit }: JudgesPanelProps) {
  const { t } = useI18n();
  const checklist = [
    { done: componentCount >= 4, text: t.judgesPanel.components(componentCount) },
    { done: notesLength >= 200, text: notesLength ? t.judgesPanel.notes(notesLength) : t.judgesPanel.noNotes },
    { done: chaosRunCount > 0, text: chaosRunCount ? t.judgesPanel.experiments(chaosRunCount) : t.judgesPanel.noExperiments },
  ];
  return (
    <div className="judges-panel">
      <div className="judge-intro">
        <div><Gavel size={16} /><span><strong>{t.judges.rigor.name}</strong><small>{t.judges.rigor.focus}</small></span></div>
        <div><Scale size={16} /><span><strong>{t.judges.pragmatic.name}</strong><small>{t.judges.pragmatic.focus}</small></span></div>
      </div>
      <p className="muted small">{t.judgesPanel.intro(t.verdict.pass, t.verdict.borderline, t.verdict.fail)}</p>
      <ul className="submit-checklist">
        {checklist.map((item) => <li key={item.text} className={item.done ? 'done' : ''}>{item.text}</li>)}
      </ul>
      {!aiAvailable && <p className="hint-box">{t.judgesPanel.noAi(<Link to="/settings">{t.judgesPanel.settings}</Link>)}</p>}
      <Button variant="primary" block onClick={onSubmit} disabled={submitting}><Send size={15} />{submitting ? t.judgesPanel.submitting : t.judgesPanel.submit}</Button>
      {error && <p className="form-error">{error}</p>}

      {evaluations.length > 0 && (
        <div className="run-history">
          <span className="panel-label">{t.judgesPanel.evaluations(evaluations.length)}</span>
          <ul>
            {evaluations.map((evaluation) => {
              const score = evaluation.consensus?.score ?? null;
              return (
                <li key={evaluation.id}>
                  <Link to={`/evaluations/${evaluation.id}`}>
                    <span className={`eval-score tone-${scoreTone(score)}`}>{score ?? (evaluation.status === 'heuristic' ? evaluation.rubric.score : '—')}</span>
                    <span><strong>{t.evaluationStatus[evaluation.status]}{isRunning(evaluation.status) ? '…' : ''}</strong><small>{relativeTime(evaluation.createdAt)}</small></span>
                    {evaluation.consensus ? <VerdictBadge verdict={evaluation.consensus.verdict} /> : <ArrowRight size={14} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
