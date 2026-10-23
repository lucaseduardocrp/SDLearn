import { Link } from 'react-router-dom';
import { ArrowRight, Gavel, Scale, Send } from 'lucide-react';
import type { Evaluation } from '../types';
import { evaluationStatusLabel, isRunning, relativeTime, scoreTone } from '../lib/format';
import { VerdictBadge } from '../components/ui';

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
  const checklist = [
    { done: componentCount >= 4, text: `${componentCount} componentes no canvas` },
    { done: notesLength >= 200, text: notesLength ? `${notesLength} caracteres de notas e trade-offs` : 'Nenhuma nota de trade-off ainda' },
    { done: chaosRunCount > 0, text: chaosRunCount ? `${chaosRunCount} experimentos de chaos` : 'Nenhum experimento de chaos' },
  ];
  return (
    <div className="judges-panel">
      <div className="judge-intro">
        <div><Gavel size={16} /><span><strong>O Rigoroso</strong><small>corretude, falhas, garantias</small></span></div>
        <div><Scale size={16} /><span><strong>O Pragmático</strong><small>simplicidade, custo, escopo</small></span></div>
      </div>
      <p className="muted small">Os dois juízes avaliam de forma independente (0–100), debatem as diferenças e chegam a um veredito de consenso: <b>pass</b> ≥ 75, <b>borderline</b> 55–74, <b>fail</b> &lt; 55.</p>
      <ul className="submit-checklist">
        {checklist.map((item) => <li key={item.text} className={item.done ? 'done' : ''}>{item.text}</li>)}
      </ul>
      {!aiAvailable && <p className="hint-box">Sem provedor de IA configurado: você recebe a pré-avaliação automática. Conecte OpenAI, Anthropic, Gemini, Grok ou Ollama em <Link to="/settings">Configurações</Link> para ativar os juízes.</p>}
      <button className="btn btn-primary btn-block" onClick={onSubmit} disabled={submitting}><Send size={15} />{submitting ? 'Enviando…' : 'Submeter aos juízes'}</button>
      {error && <p className="form-error">{error}</p>}

      {evaluations.length > 0 && (
        <div className="run-history">
          <span className="panel-label">Avaliações ({evaluations.length})</span>
          <ul>
            {evaluations.map((evaluation) => {
              const score = evaluation.consensus?.score ?? null;
              return (
                <li key={evaluation.id}>
                  <Link to={`/evaluations/${evaluation.id}`}>
                    <span className={`eval-score tone-${scoreTone(score)}`}>{score ?? (evaluation.status === 'heuristic' ? evaluation.rubric.score : '—')}</span>
                    <span><strong>{evaluationStatusLabel[evaluation.status]}{isRunning(evaluation.status) ? '…' : ''}</strong><small>{relativeTime(evaluation.createdAt)}</small></span>
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
