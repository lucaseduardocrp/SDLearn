import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Package, Search, SearchX, X } from 'lucide-react';
import { api } from '../api';
import { Button, buttonClass, DifficultyBadge, EmptyState, ErrorState, PageLoading, TagChip } from '../components/ui';
import { useI18n } from '../i18n';
import { padNumber, scoreTone } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import type { Difficulty, SessionSummary } from '../types';

const filters: ('All' | Difficulty)[] = ['All', 'Easy', 'Medium', 'Hard'];

export function LibraryPage() {
  const { t } = useI18n();
  const problems = useAsync(() => api.listProblems(), []);
  const sessions = useAsync(() => api.listSessions(), []);
  const [difficulty, setDifficulty] = useState<'All' | Difficulty>('All');
  const [query, setQuery] = useState('');
  const [params, setParams] = useSearchParams();
  const packFilter = params.get('pack');

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
      && (!packFilter || problem.source?.packId === packFilter)
      && (!text || `${problem.title} ${problem.summary} ${problem.tags.join(' ')}`.toLowerCase().includes(text));
  });

  return (
    <div className="container page">
      <section className="hero">
        <p className="eyebrow">{t.library.eyebrow}</p>
        <h1>{t.library.title} <span className="gradient-text">{t.library.titleAccent}</span></h1>
        <p className="hero-lead">{t.library.lead}</p>
        <ul className="feature-chips">
          {t.library.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
        </ul>
      </section>

      <div className="toolbar">
        <div className="toolbar-group" role="group" aria-label={t.library.filterByDifficulty}>
          {filters.map((item) => (
            <Button key={item} variant="toggle" size="sm" active={difficulty === item} aria-pressed={difficulty === item} onClick={() => setDifficulty(item)}>
              {item === 'All' ? t.library.all : t.difficulty[item]}
            </Button>
          ))}
        </div>
        <div className="toolbar-group toolbar-end">
          {packFilter && <Button variant="toggle" size="sm" active onClick={() => setParams({})} title={t.library.showAllChallenges}><Package size={14} />{packFilter}<X size={13} /></Button>}
          {api.mode === 'http' && <Link to="/hub" className={buttonClass({ size: 'sm' })}><Package size={14} />{t.library.moreOnHub}</Link>}
          <label className="search-field">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.library.searchPlaceholder} aria-label={t.library.searchLabel} />
          </label>
        </div>
      </div>

      {problems.loading ? <PageLoading /> : problems.error ? <ErrorState message={problems.error} onRetry={problems.reload} /> : visible.length === 0 ? (
        <EmptyState icon={<SearchX size={22} />} title={t.library.emptyTitle} body={t.library.emptyBody} action={<Button onClick={() => { setQuery(''); setDifficulty('All'); setParams({}); }}>{t.library.clearFilters}</Button>} />
      ) : (
        <div className="problem-grid">
          {visible.map((problem) => {
            const mine = progress.get(problem.id);
            return (
              <Link key={problem.id} to={`/problems/${problem.id}`} className="problem-card">
                <div className="problem-card-top">
                  <span className="mono-dim">{padNumber(problem.number)}{problem.source && <span className="source-chip" title={t.library.packTitle(problem.source.packName, problem.source.version)}><Package size={11} />{problem.source.packName}</span>}</span>
                  <DifficultyBadge difficulty={problem.difficulty} />
                </div>
                <h3>{problem.title}</h3>
                <p>{problem.summary}</p>
                <div className="tag-row">{problem.tags.map((tag) => <TagChip key={tag}>{tag}</TagChip>)}</div>
                {mine && (
                  <div className="problem-card-progress">
                    <span>{t.library.sessionCount(mine.count)}</span>
                    {mine.best !== null && <span className={`best tone-${scoreTone(mine.best)}`}>{t.library.best(mine.best)}</span>}
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
