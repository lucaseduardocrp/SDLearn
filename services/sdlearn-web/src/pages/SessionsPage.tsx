import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, LayoutGrid, Trash2 } from 'lucide-react';
import { api } from '../api';
import { buttonClass, DifficultyBadge, EmptyState, ErrorState, PageLoading, VerdictBadge } from '../components/ui';
import { useI18n } from '../i18n';
import { relativeTime, scoreTone } from '../lib/format';
import { useAsync } from '../lib/useAsync';

export function SessionsPage() {
  const { t } = useI18n();
  const sessions = useAsync(() => api.listSessions(), []);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function remove(id: string, title: string) {
    if (!window.confirm(t.sessions.confirmDelete(title))) return;
    setDeleting(id);
    setActionError(null);
    try {
      await api.deleteSession(id);
      sessions.setData((current) => ({ items: (current?.items ?? []).filter((item) => item.id !== id), nextCursor: null }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t.sessions.deleteFailed);
    } finally {
      setDeleting(null);
    }
  }

  const items = sessions.data?.items ?? [];
  const judged = items.filter((item) => item.bestScore !== null);
  const average = judged.length ? Math.round(judged.reduce((sum, item) => sum + (item.bestScore ?? 0), 0) / judged.length) : null;

  return (
    <div className="container page">
      <header className="page-header">
        <p className="eyebrow">{t.sessions.eyebrow}</p>
        <h1>{t.sessions.title}</h1>
        <p className="hero-lead">{t.sessions.lead}</p>
      </header>

      {!sessions.loading && !sessions.error && items.length > 0 && (
        <div className="stat-row">
          <div className="stat"><span>{t.sessions.stats.sessions}</span><strong>{items.length}</strong></div>
          <div className="stat"><span>{t.sessions.stats.judged}</span><strong>{judged.length}</strong></div>
          <div className="stat"><span>{t.sessions.stats.average}</span><strong className={`tone-${scoreTone(average)}`}>{average ?? '—'}</strong></div>
          <div className="stat"><span>{t.sessions.stats.passed}</span><strong>{items.filter((item) => item.lastVerdict === 'pass').length}</strong></div>
        </div>
      )}

      {actionError && <ErrorState message={actionError} />}
      {sessions.loading ? <PageLoading /> : sessions.error ? <ErrorState message={sessions.error} onRetry={sessions.reload} /> : items.length === 0 ? (
        <EmptyState icon={<LayoutGrid size={22} />} title={t.sessions.emptyTitle} body={t.sessions.emptyBody} action={<Link to="/" className={buttonClass({ variant: 'primary' })}>{t.common.goToLibrary}</Link>} />
      ) : (
        <div className="session-table" role="table" aria-label={t.sessions.table}>
          <div className="session-row session-head" role="row">
            <span role="columnheader">{t.sessions.columns.problem}</span><span role="columnheader">{t.sessions.columns.status}</span><span role="columnheader">{t.sessions.columns.canvas}</span>
            <span role="columnheader">{t.sessions.columns.score}</span><span role="columnheader">{t.sessions.columns.updated}</span><span role="columnheader" aria-label={t.sessions.columns.actions} />
          </div>
          {items.map((session) => (
            <div key={session.id} className="session-row" role="row">
              <Link role="cell" to={`/sessions/${session.id}`} className="session-title"><strong>{session.title}</strong><DifficultyBadge difficulty={session.difficulty} /></Link>
              <span role="cell" className={`status-text status-${session.status}`}>{t.sessionStatus[session.status]}</span>
              <span role="cell" className="mono-dim"><Boxes size={13} /> {session.componentCount}</span>
              <span role="cell" className="session-score"><strong className={`tone-${scoreTone(session.bestScore)}`}>{session.bestScore ?? '—'}</strong><VerdictBadge verdict={session.lastVerdict} /></span>
              <span role="cell" className="muted">{relativeTime(session.updatedAt)}</span>
              <span role="cell" className="row-actions">
                <Link to={`/sessions/${session.id}`} className={buttonClass({ size: 'sm' })}>{t.common.open}</Link>
                <button className="icon-btn" aria-label={t.sessions.deleteLabel(session.title)} title={t.common.delete} disabled={deleting === session.id} onClick={() => void remove(session.id, session.title)}><Trash2 size={15} /></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
