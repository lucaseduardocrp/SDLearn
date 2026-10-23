import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Check, Download, FileUp, GitPullRequest, LayoutGrid, LoaderCircle, Package, Pencil, RefreshCw, Search, Trash2, TriangleAlert } from 'lucide-react';
import { api } from '../api';
import { ApiError } from '../api/httpClient';
import type { HubListing } from '../api/types';
import { Button, buttonClass, EmptyState, ErrorState, PageLoading, TagChip } from '../components/ui';
import { useI18n } from '../i18n';
import { relativeTime } from '../lib/format';
import { useAsync } from '../lib/useAsync';

export function HubPage() {
  const { t } = useI18n();
  const hub = useAsync(() => api.getHub(), []);
  if (api.mode === 'local') return <div className="container page"><ErrorState message={t.hub.needsApi} /></div>;
  if (hub.loading && !hub.data) return <PageLoading />;
  if (hub.error || !hub.data) return <div className="container page"><ErrorState message={hub.error ?? t.hub.loadFailed} onRetry={hub.reload} /></div>;
  return <HubView listing={hub.data} reload={hub.reload} />;
}

function HubView({ listing, reload }: { listing: HubListing; reload: () => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [editingSource, setEditingSource] = useState(false);
  const [source, setSource] = useState(listing.source);
  const fileInput = useRef<HTMLInputElement>(null);

  async function act(key: string, action: () => Promise<string>) {
    setBusy(key);
    setNotice(null);
    try {
      setNotice({ tone: 'ok', text: await action() });
      reload();
    } catch (error) {
      const issues = error instanceof ApiError && Array.isArray(error.details?.issues) ? ` ${(error.details!.issues as string[]).slice(0, 4).join(' · ')}` : '';
      setNotice({ tone: 'error', text: `${error instanceof Error ? error.message : t.common.failed}${issues}` });
    } finally {
      setBusy(null);
    }
  }

  const install = (packId: string, name: string) => act(packId, async () => {
    const pack = await api.installPack(packId);
    return t.hub.installed(name, pack.manifest.version, pack.problemCount, pack.articleCount);
  });

  const remove = (packId: string, name: string) => act(`remove-${packId}`, async () => {
    if (!window.confirm(t.hub.confirmRemove(name))) return t.hub.nothingRemoved;
    try {
      await api.removePack(packId);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409 || !window.confirm(error.message)) throw error;
      await api.removePack(packId, true);
    }
    return t.hub.removed(name);
  });

  const importFile = (file: File) => act('import', async () => {
    let bundle: unknown;
    try {
      bundle = JSON.parse(await file.text());
    } catch {
      throw new Error(t.hub.invalidJson);
    }
    const pack = await api.importPack(bundle);
    return t.hub.imported(pack.manifest.name, pack.manifest.version);
  });

  const saveSource = () => act('source', async () => {
    await api.updateSettings({ hubUrl: source });
    setEditingSource(false);
    return t.hub.sourceUpdated;
  });

  const text = query.trim().toLowerCase();
  const packs = listing.packs.filter((pack) => !text || `${pack.name} ${pack.description} ${pack.tags.join(' ')} ${pack.author}`.toLowerCase().includes(text));

  return (
    <div className="container page">
      <header className="page-header">
        <p className="eyebrow">{t.hub.eyebrow}</p>
        <h1>{t.hub.title} <span className="gradient-text">{t.hub.titleAccent}</span></h1>
        <p className="hero-lead">{t.hub.lead}</p>
      </header>

      <div className="hub-source panel">
        <Package size={16} />
        {editingSource ? (
          <form className="hub-source-form" onSubmit={(event) => { event.preventDefault(); void saveSource(); }}>
            <input value={source} onChange={(event) => setSource(event.target.value)} placeholder={t.hub.sourcePlaceholder} aria-label={t.hub.sourceLabel} />
            <Button type="submit" variant="primary" size="sm" disabled={busy === 'source'}>{t.common.save}</Button>
            <Button size="sm" onClick={() => { setEditingSource(false); setSource(listing.source); }}>{t.common.cancel}</Button>
          </form>
        ) : (
          <>
            <span className="hub-source-text"><strong>{listing.name ?? 'Hub'}</strong><code title={listing.source}>{listing.source}</code></span>
            <button className="icon-btn" title={t.hub.changeSource} aria-label={t.hub.changeSource} onClick={() => setEditingSource(true)}><Pencil size={14} /></button>
            <button className="icon-btn" title={t.common.reload} aria-label={t.common.reload} onClick={reload}><RefreshCw size={14} /></button>
          </>
        )}
      </div>

      {listing.error && <div className="banner banner-error"><TriangleAlert size={18} /><p>{listing.error}</p></div>}
      {notice && <div className={`banner ${notice.tone === 'ok' ? 'banner-success' : 'banner-error'}`}>{notice.tone === 'ok' ? <Check size={18} /> : <TriangleAlert size={18} />}<p>{notice.text}</p></div>}

      <div className="toolbar">
        <label className="search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.hub.searchPlaceholder} aria-label={t.hub.searchLabel} /></label>
        <Button size="sm" onClick={() => fileInput.current?.click()} disabled={busy === 'import'}><FileUp size={14} />{t.hub.importPack}</Button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file); }} />
      </div>

      {!listing.error && packs.length === 0 ? (
        <EmptyState icon={<Package size={22} />} title={t.hub.emptyTitle} body={text ? t.hub.emptySearch : t.hub.emptyHub} />
      ) : (
        <div className="pack-grid">
          {packs.map((pack) => (
            <article key={pack.id} className="pack-card">
              <div className="pack-card-top">
                <span className="mono-dim">{pack.id}@{pack.version}</span>
                {pack.status === 'installed' && <span className="pack-status installed"><Check size={12} />{t.hub.statusInstalled}</span>}
                {pack.status === 'update' && <span className="pack-status update">{t.hub.statusUpdate}</span>}
              </div>
              <h3>{pack.name}</h3>
              <p>{pack.description}</p>
              <div className="tag-row">{pack.tags.map((tag) => <TagChip key={tag}>{tag}</TagChip>)}</div>
              <div className="pack-meta">
                <span><LayoutGrid size={13} />{t.hub.problemCount(pack.problemCount)}</span>
                <span><BookOpen size={13} />{t.hub.articleCount(pack.articleCount)}</span>
                <span>{t.hub.by(pack.author)}</span>
                <span>{pack.license}</span>
              </div>
              <div className="pack-actions">
                {pack.status === 'available' && <Button variant="primary" size="sm" disabled={busy !== null} onClick={() => void install(pack.id, pack.name)}>{busy === pack.id ? <LoaderCircle size={14} className="spin" /> : <Download size={14} />}{t.hub.download}</Button>}
                {pack.status === 'update' && <Button variant="primary" size="sm" disabled={busy !== null} onClick={() => void install(pack.id, pack.name)}>{busy === pack.id ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />}{t.hub.update(pack.installedVersion, pack.version)}</Button>}
                {pack.status !== 'available' && <Link className={buttonClass({ size: 'sm' })} to={`/?pack=${pack.id}`}>{t.hub.viewChallenges}</Link>}
              </div>
            </article>
          ))}
        </div>
      )}

      <h2 className="section-title"><Package size={17} />{t.hub.installedTitle}</h2>
      {listing.installed.length === 0 ? <p className="muted">{t.hub.noneInstalled}</p> : (
        <ul className="installed-list">
          {listing.installed.map((pack) => (
            <li key={pack.manifest.id} className="panel">
              <span><strong>{pack.manifest.name}</strong><small>{pack.manifest.id}@{pack.manifest.version} · {pack.origin === 'hub' ? t.hub.fromHub : t.hub.importedOrigin} · {relativeTime(pack.installedAt)} · {t.hub.problemCount(pack.problemCount)} · {t.hub.articleCount(pack.articleCount)}</small></span>
              <Button variant="danger" size="sm" disabled={busy !== null} onClick={() => void remove(pack.manifest.id, pack.manifest.name)}><Trash2 size={14} />{t.common.remove}</Button>
            </li>
          ))}
        </ul>
      )}

      <section className="panel contribute">
        <GitPullRequest size={20} />
        <div>
          <h3>{t.hub.contributeTitle}</h3>
          <p className="muted small">{t.hub.contributeBody}</p>
        </div>
      </section>
    </div>
  );
}
