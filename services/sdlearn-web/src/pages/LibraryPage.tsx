import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, SearchX } from 'lucide-react';
import { api } from '../api';
import { DifficultyBadge, EmptyState, ErrorState, PageLoading, TagChip } from '../components/ui';
import { padNumber, scoreTone } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import type { Difficulty, SessionSummary } from '../types';

const features = ['Todos os problemas', 'Sessões ilimitadas', 'Canvas + chaos ilimitado', '2 juízes de IA (0-100)', 'Veredito pass/borderline/fail', 'Feedback & consenso', 'Editor Mermaid'];
const filters: ('All' | Difficulty)[] = ['All', 'Easy', 'Medium', 'Hard'];

export function LibraryPage() {
  const problems = useAsync(() => api.listProblems(), []);
  const sessions = useAsync(() => api.listSessions(), []);
  const [difficulty, setDifficulty] = useState<'All' | Difficulty>('All');
  const [query, setQuery] = useState('');

  const progress = useMemo(() => {
    const byProblem = new Map<string, { best: number | null; count: number }>();
    for (const session of sessions.data?.items ?? [] as SessionSummary[]) {
      const current = byProblem.get(session.problemId) ?? { best: null, count: 0 };
      byProblem.set(session.problemId, { count: current.count + 1, best: session.bestScore === null ? current.best : Math.max(current.best ?? 0, session.bestScore) });
    }
    return byProblem;
  }, [sessions.data]);

  const visible = (problems.data?.items ?? []).filter((problem) => {
    const text = query.trim().toLowerCase();
    return (difficulty === 'All' || problem.difficulty === difficulty)
      && (!text || `${problem.title} ${problem.summary} ${problem.tags.join(' ')}`.toLowerCase().includes(text));
  });

  return (
    <div className="container page">
      <section className="hero">
        <p className="eyebrow">// SYSTEM DESIGN TRAINING GROUND</p>
        <h1>Desenhe. Quebre. <span className="gradient-text">Seja julgado.</span></h1>
        <p className="hero-lead">Monte arquiteturas no canvas, injete falhas com chaos e receba nota de dois juízes de IA com feedback completo.</p>
        <ul className="feature-chips">
          {features.map((feature) => <li key={feature}>✓ {feature}</li>)}
        </ul>
      </section>

      <div className="library-toolbar">
        <div className="filter-pills" role="group" aria-label="Filtrar por dificuldade">
          {filters.map((item) => (
            <button key={item} className={`pill${difficulty === item ? ' active' : ''}`} aria-pressed={difficulty === item} onClick={() => setDifficulty(item)}>{item}</button>
          ))}
        </div>
        <label className="search-field">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar problema ou conceito…" aria-label="Buscar problemas" />
        </label>
      </div>

      {problems.loading ? <PageLoading /> : problems.error ? <ErrorState message={problems.error} onRetry={problems.reload} /> : visible.length === 0 ? (
        <EmptyState icon={<SearchX size={22} />} title="Nenhum problema encontrado" body="Tente outra dificuldade ou outro termo de busca." action={<button className="btn btn-ghost" onClick={() => { setQuery(''); setDifficulty('All'); }}>Limpar filtros</button>} />
      ) : (
        <div className="problem-grid">
          {visible.map((problem) => {
            const mine = progress.get(problem.id);
            return (
              <Link key={problem.id} to={`/problems/${problem.id}`} className="problem-card">
                <div className="problem-card-top">
                  <span className="mono-dim">{padNumber(problem.number)}</span>
                  <DifficultyBadge difficulty={problem.difficulty} />
                </div>
                <h3>{problem.title}</h3>
                <p>{problem.summary}</p>
                <div className="tag-row">{problem.tags.map((tag) => <TagChip key={tag}>{tag}</TagChip>)}</div>
                {mine && (
                  <div className="problem-card-progress">
                    <span>{mine.count} {mine.count === 1 ? 'sessão' : 'sessões'}</span>
                    {mine.best !== null && <span className={`best tone-${scoreTone(mine.best)}`}>melhor {mine.best}</span>}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
