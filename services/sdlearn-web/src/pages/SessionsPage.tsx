import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, LayoutGrid, Trash2 } from 'lucide-react';
import { api } from '../api';
import { DifficultyBadge, EmptyState, ErrorState, PageLoading, VerdictBadge } from '../components/ui';
import { relativeTime, scoreTone, sessionStatusLabel } from '../lib/format';
import { useAsync } from '../lib/useAsync';

export function SessionsPage() {
  const sessions = useAsync(() => api.listSessions(), []);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function remove(id: string, title: string) {
    if (!window.confirm(`Excluir a sessão de "${title}"? O desenho, os chaos runs e as avaliações serão apagados.`)) return;
    setDeleting(id);
    setActionError(null);
    try {
      await api.deleteSession(id);
      sessions.setData((current) => ({ items: (current?.items ?? []).filter((item) => item.id !== id), nextCursor: null }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível excluir a sessão.');
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
        <p className="eyebrow">// MINHAS SESSÕES</p>
        <h1>Histórico de prática</h1>
        <p className="hero-lead">Cada sessão guarda o canvas, as notas, os experimentos de chaos e as avaliações dos juízes.</p>
      </header>

      {!sessions.loading && !sessions.error && items.length > 0 && (
        <div className="stat-row">
          <div className="stat"><span>Sessões</span><strong>{items.length}</strong></div>
          <div className="stat"><span>Julgadas</span><strong>{judged.length}</strong></div>
          <div className="stat"><span>Nota média</span><strong className={`tone-${scoreTone(average)}`}>{average ?? '—'}</strong></div>
          <div className="stat"><span>Aprovadas</span><strong>{items.filter((item) => item.lastVerdict === 'pass').length}</strong></div>
        </div>
      )}

      {actionError && <ErrorState message={actionError} />}
      {sessions.loading ? <PageLoading /> : sessions.error ? <ErrorState message={sessions.error} onRetry={sessions.reload} /> : items.length === 0 ? (
        <EmptyState icon={<LayoutGrid size={22} />} title="Nenhuma sessão ainda" body="Escolha um problema na biblioteca e comece a desenhar." action={<Link to="/" className="btn btn-primary">Ir para a biblioteca</Link>} />
      ) : (
        <div className="session-table" role="table" aria-label="Sessões">
          <div className="session-row session-head" role="row">
            <span role="columnheader">Problema</span><span role="columnheader">Status</span><span role="columnheader">Canvas</span>
            <span role="columnheader">Nota</span><span role="columnheader">Atualizada</span><span role="columnheader" aria-label="Ações" />
          </div>
          {items.map((session) => (
            <div key={session.id} className="session-row" role="row">
              <Link role="cell" to={`/sessions/${session.id}`} className="session-title"><strong>{session.title}</strong><DifficultyBadge difficulty={session.difficulty} /></Link>
              <span role="cell" className={`status-text status-${session.status}`}>{sessionStatusLabel[session.status]}</span>
              <span role="cell" className="mono-dim"><Boxes size={13} /> {session.componentCount}</span>
              <span role="cell" className="session-score"><strong className={`tone-${scoreTone(session.bestScore)}`}>{session.bestScore ?? '—'}</strong><VerdictBadge verdict={session.lastVerdict} /></span>
              <span role="cell" className="muted">{relativeTime(session.updatedAt)}</span>
              <span role="cell" className="row-actions">
                <Link to={`/sessions/${session.id}`} className="btn btn-ghost btn-sm">Abrir</Link>
                <button className="icon-btn" aria-label={`Excluir sessão de ${session.title}`} title="Excluir" disabled={deleting === session.id} onClick={() => void remove(session.id, session.title)}><Trash2 size={15} /></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
