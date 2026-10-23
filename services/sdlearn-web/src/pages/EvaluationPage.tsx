import { useEffect, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, CircleCheck, CircleX, Gavel, MessagesSquare, Scale, Sparkles, Target, TriangleAlert, X } from 'lucide-react';
import { api } from '../api';
import { ErrorState, PageLoading, ScoreRing, Spinner, VerdictBadge } from '../components/ui';
import { evaluationStatusLabel, isRunning, relativeTime, scoreTone, verdictLabel } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import type { DebateTurn, Evaluation, JudgeAssessment, JudgeId, RubricReport } from '../types';

export const judgeInfo: Record<JudgeId, { name: string; philosophy: string; icon: typeof Gavel }> = {
  rigor: { name: 'O Rigoroso', philosophy: 'Rigor: corretude sob falha, garantias explícitas, contas que fecham.', icon: Gavel },
  pragmatic: { name: 'O Pragmático', philosophy: 'Pragmatismo: simplicidade, custo e trade-offs que cabem na entrevista.', icon: Scale },
};

const phases: { status: Evaluation['status']; label: string }[] = [
  { status: 'judging', label: 'Avaliações independentes' },
  { status: 'debating', label: 'Debate' },
  { status: 'deliberating', label: 'Consenso' },
];

export function EvaluationPage() {
  const { evaluationId = '' } = useParams();
  const evaluation = useAsync(() => api.getEvaluation(evaluationId), [evaluationId]);
  const running = evaluation.data ? isRunning(evaluation.data.status) : false;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      api.getEvaluation(evaluationId).then((value) => evaluation.setData(value), () => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [running, evaluationId, evaluation.setData]);

  if (evaluation.loading) return <PageLoading />;
  if (evaluation.error || !evaluation.data) return <div className="container page"><ErrorState message={evaluation.error ?? 'Avaliação não encontrada.'} onRetry={evaluation.reload} /></div>;
  const item = evaluation.data;

  return (
    <div className="container page">
      <Link to={`/sessions/${item.sessionId}`} className="back-link"><ArrowLeft size={14} />Voltar ao canvas</Link>
      <header className="page-header">
        <p className="eyebrow">// AVALIAÇÃO · {item.problemTitle.toUpperCase()}</p>
        <h1>{item.consensus ? <>Veredito: <span className={`verdict-text tone-${item.consensus.verdict}`}>{verdictLabel[item.consensus.verdict]}</span></> : evaluationStatusLabel[item.status]}</h1>
        <p className="muted mono-small">{relativeTime(item.createdAt)}{item.judgeConfig ? ` · Rigoroso: ${item.judgeConfig.rigor} · Pragmático: ${item.judgeConfig.pragmatic} · Moderador: ${item.judgeConfig.moderator}` : item.provider ? ` · ${item.provider}` : ''}</p>
      </header>

      {running && <PhaseTracker status={item.status} />}
      {item.status === 'failed' && <div className="banner banner-error"><TriangleAlert size={18} /><p>{item.error}</p></div>}
      {item.status === 'heuristic' && <div className="banner banner-info"><Sparkles size={18} /><p>{item.error} A nota abaixo vem do simulador determinístico, não dos juízes.</p></div>}

      {item.consensus && (
        <section className="consensus panel">
          <div className="consensus-score">
            <ScoreRing score={item.consensus.score} size={148} label="CONSENSO" />
            <VerdictBadge verdict={item.consensus.verdict} />
          </div>
          <div className="consensus-body">
            <p className="body-text">{item.consensus.summary}</p>
            <div className="three-col">
              <FeedbackList title="Pontos fortes" icon={<CircleCheck size={14} />} tone="pass" items={item.consensus.keyStrengths} />
              <FeedbackList title="Melhorias" icon={<Target size={14} />} tone="borderline" items={item.consensus.keyImprovements} />
              <FeedbackList title="Próximos passos" icon={<Sparkles size={14} />} tone="accent" items={item.consensus.nextSteps} />
            </div>
          </div>
        </section>
      )}

      {item.assessments.length > 0 && (
        <>
          <h2 className="section-title">Avaliações independentes</h2>
          <div className="judge-grid">
            {item.assessments.map((assessment) => <JudgeCard key={assessment.judge} assessment={assessment} debate={item.debate.find((turn) => turn.judge === assessment.judge)} />)}
          </div>
        </>
      )}

      {item.debate.length > 0 && (
        <>
          <h2 className="section-title"><MessagesSquare size={16} />Debate entre os juízes</h2>
          <div className="debate">
            {item.debate.map((turn) => <DebateBubble key={turn.judge} turn={turn} original={item.assessments.find((assessment) => assessment.judge === turn.judge)?.score} />)}
          </div>
        </>
      )}

      <h2 className="section-title">Pré-check automático</h2>
      <RubricPanel rubric={item.rubric} />
    </div>
  );
}

function PhaseTracker({ status }: { status: Evaluation['status'] }) {
  const current = phases.findIndex((phase) => phase.status === status);
  return (
    <div className="phase-tracker panel">
      {phases.map((phase, index) => (
        <div key={phase.status} className={`phase${index < current ? ' done' : index === current ? ' active' : ''}`}>
          <span className="phase-dot">{index < current ? <Check size={12} /> : index + 1}</span>
          <span>{phase.label}</span>
        </div>
      ))}
      <Spinner label={status === 'queued' ? 'Na fila…' : 'Os juízes estão trabalhando…'} />
    </div>
  );
}

function FeedbackList({ title, icon, tone, items }: { title: string; icon: ReactNode; tone: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className={`feedback-list tone-${tone}`}>
      <h3>{icon}{title}</h3>
      <ul>{items.map((text) => <li key={text}>{text}</li>)}</ul>
    </div>
  );
}

function JudgeCard({ assessment, debate }: { assessment: JudgeAssessment; debate?: DebateTurn }) {
  const info = judgeInfo[assessment.judge];
  const Icon = info.icon;
  return (
    <section className={`judge-card panel judge-${assessment.judge}`}>
      <header>
        <span className="judge-avatar"><Icon size={18} /></span>
        <div><h3>{info.name}</h3><p className="muted">{info.philosophy}</p></div>
        <ScoreRing score={assessment.score} size={64} />
      </header>
      <div className="judge-verdict"><VerdictBadge verdict={assessment.verdict} />{debate && debate.revisedScore !== assessment.score && <span className="mono-dim">após debate: {debate.revisedScore}</span>}</div>
      {assessment.holisticScore !== undefined && (
        <p className="score-breakdown mono-small">
          {assessment.coverageScore !== null && assessment.coverageScore !== undefined
            ? <>gabarito <b>{assessment.coverageScore}</b> × 60% + visão geral <b>{assessment.holisticScore}</b> × 40% = <b>{assessment.score}</b></>
            : <>visão geral <b>{assessment.holisticScore}</b></>}
          {assessment.model && <span> · {assessment.model}{assessment.samples && assessment.samples > 1 ? ` · mediana de ${assessment.samples} amostras` : ''}</span>}
        </p>
      )}
      <p className="body-text">{assessment.summary}</p>
      {assessment.keyPoints && assessment.keyPoints.length > 0 && (
        <details className="keypoint-details">
          <summary>Gabarito: {assessment.keyPoints.filter((point) => point.coverage === 'full').length} de {assessment.keyPoints.length} pontos cobertos</summary>
          <ul className="keypoint-list">
            {assessment.keyPoints.map((point) => (
              <li key={point.id} className={`coverage-${point.coverage}`}>
                <span className="coverage-badge">{point.coverage === 'full' ? 'coberto' : point.coverage === 'partial' ? 'parcial' : 'faltou'}</span>
                <div><strong>{point.point}</strong><small>{point.evidence}</small></div>
                <span className="mono-dim" title="Peso no gabarito">×{point.weight}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {assessment.dimensions.length > 0 && (
        <div className="dimension-bars">
          {assessment.dimensions.map((dimension) => (
            <div key={dimension.name} className="dimension">
              <span>{dimension.name}</span>
              <div className="bar"><i className={`tone-bg-${scoreTone(dimension.score)}`} style={{ width: `${dimension.score}%` }} /></div>
              <strong>{dimension.score}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="two-col compact">
        <FeedbackList title="Acertos" icon={<Check size={13} />} tone="pass" items={assessment.strengths} />
        <FeedbackList title="Problemas" icon={<X size={13} />} tone="fail" items={assessment.weaknesses} />
      </div>
    </section>
  );
}

function DebateBubble({ turn, original }: { turn: DebateTurn; original?: number }) {
  const info = judgeInfo[turn.judge];
  const delta = original === undefined ? 0 : turn.revisedScore - original;
  return (
    <div className={`debate-turn judge-${turn.judge}`}>
      <div className="debate-head">
        <strong>{info.name}</strong>
        <span className="mono-dim">{original ?? '—'} → <b>{turn.revisedScore}</b>{delta !== 0 && <em className={delta > 0 ? 'up' : 'down'}> ({delta > 0 ? '+' : ''}{delta})</em>}</span>
      </div>
      <p>{turn.argument}</p>
      {turn.agreements.length > 0 && <p className="debate-points"><span className="tone-pass">Concorda:</span> {turn.agreements.join(' · ')}</p>}
      {turn.disagreements.length > 0 && <p className="debate-points"><span className="tone-fail">Discorda:</span> {turn.disagreements.join(' · ')}</p>}
    </div>
  );
}

export function RubricPanel({ rubric }: { rubric: RubricReport }) {
  return (
    <section className="panel rubric">
      <div className="rubric-head">
        <ScoreRing score={rubric.score} size={72} />
        <p className="muted">Checagens determinísticas sobre o canvas: componentes esperados, conectividade, capacidade no pico, latência e pontos únicos de falha. Os juízes recebem isto como evidência.</p>
      </div>
      <ul className="rubric-list">
        {rubric.checks.map((check) => (
          <li key={check.id} className={check.passed ? 'passed' : 'failed'}>
            {check.passed ? <CircleCheck size={16} /> : <CircleX size={16} />}
            <div><strong>{check.label}</strong><span>{check.detail}</span></div>
            <span className="mono-dim">{check.weight} pts</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
