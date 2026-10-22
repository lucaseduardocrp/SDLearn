import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Clock, Lightbulb, Play } from 'lucide-react';
import { articles } from '@shared/catalog/articles';
import { api } from '../api';
import { DifficultyBadge, ErrorState, PageLoading, TagChip, VerdictBadge } from '../components/ui';
import { padNumber, relativeTime, sessionStatusLabel } from '../lib/format';
import { useAsync } from '../lib/useAsync';

export function ProblemPage() {
  const { problemId = '' } = useParams();
  const navigate = useNavigate();
  const problem = useAsync(() => api.getProblem(problemId), [problemId]);
  const sessions = useAsync(() => api.listSessions(problemId), [problemId]);
  const [showHints, setShowHints] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setStartError(null);
    try {
      const session = await api.createSession(problemId);
      navigate(`/sessions/${session.id}`);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Não foi possível iniciar a sessão.');
      setStarting(false);
    }
  }

  if (problem.loading) return <PageLoading />;
  if (problem.error || !problem.data) return <div className="container page"><ErrorState message={problem.error ?? 'Problema não encontrado.'} onRetry={problem.reload} /></div>;
  const item = problem.data;
  const related = articles.filter((article) => item.relatedArticles.includes(article.slug));

  return (
    <div className="container page">
      <Link to="/" className="back-link"><ArrowLeft size={14} />Biblioteca</Link>
      <header className="problem-header">
        <div className="problem-header-meta">
          <span className="mono-dim">{padNumber(item.number)}</span>
          <DifficultyBadge difficulty={item.difficulty} />
          <span className="mono-dim"><Clock size={12} /> ~{item.estimatedMinutes} min</span>
        </div>
        <h1>{item.title}</h1>
        <p className="hero-lead">{item.summary}</p>
        <div className="tag-row">{item.tags.map((tag) => <TagChip key={tag}>{tag}</TagChip>)}</div>
      </header>

      <div className="problem-layout">
        <div className="problem-main">
          <section className="panel">
            <h2 className="panel-title">Enunciado</h2>
            <p className="body-text">{item.statement}</p>
          </section>
          <div className="two-col">
            <section className="panel">
              <h2 className="panel-title">Requisitos funcionais</h2>
              <ul className="check-list">{item.functionalRequirements.map((text) => <li key={text}>{text}</li>)}</ul>
            </section>
            <section className="panel">
              <h2 className="panel-title">Requisitos não-funcionais</h2>
              <ul className="check-list">{item.nonFunctionalRequirements.map((text) => <li key={text}>{text}</li>)}</ul>
            </section>
          </div>
          <section className="panel">
            <h2 className="panel-title">Escala</h2>
            <div className="scale-grid">
              {item.scale.map((entry) => <div key={entry.label} className="scale-item"><span>{entry.label}</span><strong>{entry.value}</strong></div>)}
              <div className="scale-item"><span>Orçamento de latência</span><strong>{item.latencyBudgetMs} ms</strong></div>
            </div>
          </section>
          <section className="panel">
            <button className="hint-toggle" onClick={() => setShowHints((value) => !value)} aria-expanded={showHints}>
              <Lightbulb size={15} />{showHints ? 'Esconder dicas' : 'Mostrar dicas'}<span className="mono-dim">{item.hints.length}</span>
            </button>
            {showHints && <ol className="hint-list">{item.hints.map((hint) => <li key={hint}>{hint}</li>)}</ol>}
          </section>
        </div>

        <aside className="problem-side">
          <section className="panel cta-panel">
            <p className="eyebrow">// PRONTO?</p>
            <h2>Abra o canvas</h2>
            <p className="muted">Desenhe a arquitetura, rode cenários de chaos e submeta aos juízes quando estiver pronto.</p>
            <button className="btn btn-primary btn-block" onClick={() => void start()} disabled={starting}><Play size={15} />{starting ? 'Criando sessão…' : 'Começar novo design'}</button>
            {startError && <p className="form-error">{startError}</p>}
          </section>

          <section className="panel">
            <h2 className="panel-title">Suas sessões</h2>
            {sessions.loading ? <p className="muted">Carregando…</p> : !sessions.data?.items.length ? <p className="muted">Nenhuma sessão ainda para este problema.</p> : (
              <ul className="mini-list">
                {sessions.data.items.map((session) => (
                  <li key={session.id}>
                    <Link to={`/sessions/${session.id}`}>
                      <span><strong>{sessionStatusLabel[session.status]}</strong><small>{relativeTime(session.updatedAt)} · {session.componentCount} componentes</small></span>
                      <span className="mini-list-score">{session.bestScore ?? '—'}<VerdictBadge verdict={session.lastVerdict} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {related.length > 0 && (
            <section className="panel">
              <h2 className="panel-title"><BookOpen size={14} />Leituras relacionadas</h2>
              <ul className="mini-list">
                {related.map((article) => (
                  <li key={article.slug}>
                    <Link to={`/learn/${article.slug}`}>
                      <span><strong>{article.title}</strong><small>{article.category} · {article.readingMinutes} min</small></span>
                      <ArrowRight size={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
