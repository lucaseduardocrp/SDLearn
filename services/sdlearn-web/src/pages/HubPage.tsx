import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Check, Download, FileUp, GitPullRequest, LayoutGrid, LoaderCircle, Package, Pencil, RefreshCw, Search, Trash2, TriangleAlert } from 'lucide-react';
import { api } from '../api';
import { ApiError } from '../api/httpClient';
import type { HubListing } from '../api/types';
import { EmptyState, ErrorState, PageLoading, TagChip } from '../components/ui';
import { relativeTime } from '../lib/format';
import { useAsync } from '../lib/useAsync';

export function HubPage() {
  const hub = useAsync(() => api.getHub(), []);
  if (api.mode === 'local') return <div className="container page"><ErrorState message="O hub precisa da API: os pacotes baixados ficam no banco. Rode o app com npm run dev." /></div>;
  if (hub.loading && !hub.data) return <PageLoading />;
  if (hub.error || !hub.data) return <div className="container page"><ErrorState message={hub.error ?? 'Não foi possível carregar o hub.'} onRetry={hub.reload} /></div>;
  return <HubView listing={hub.data} reload={hub.reload} />;
}

function HubView({ listing, reload }: { listing: HubListing; reload: () => void }) {
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
      setNotice({ tone: 'error', text: `${error instanceof Error ? error.message : 'Falhou.'}${issues}` });
    } finally {
      setBusy(null);
    }
  }

  const install = (packId: string, name: string) => act(packId, async () => {
    const pack = await api.installPack(packId);
    return `${name} ${pack.manifest.version} instalado: ${pack.problemCount} desafio(s) e ${pack.articleCount} artigo(s) já estão na biblioteca.`;
  });

  const remove = (packId: string, name: string) => act(`remove-${packId}`, async () => {
    if (!window.confirm(`Remover o pacote "${name}"? Os desafios e artigos dele saem da biblioteca.`)) return 'Nada foi removido.';
    try {
      await api.removePack(packId);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409 || !window.confirm(error.message)) throw error;
      await api.removePack(packId, true);
    }
    return `${name} removido.`;
  });

  const importFile = (file: File) => act('import', async () => {
    let bundle: unknown;
    try {
      bundle = JSON.parse(await file.text());
    } catch {
      throw new Error('O arquivo não é um JSON válido.');
    }
    const pack = await api.importPack(bundle);
    return `${pack.manifest.name} ${pack.manifest.version} importado.`;
  });

  const saveSource = () => act('source', async () => {
    await api.updateSettings({ hubUrl: source });
    setEditingSource(false);
    return 'Endereço do hub atualizado.';
  });

  const text = query.trim().toLowerCase();
  const packs = listing.packs.filter((pack) => !text || `${pack.name} ${pack.description} ${pack.tags.join(' ')} ${pack.author}`.toLowerCase().includes(text));

  return (
    <div className="container page">
      <header className="page-header">
        <p className="eyebrow">// COMMUNITY HUB</p>
        <h1>Novos desafios, <span className="gradient-text">feitos pela comunidade.</span></h1>
        <p className="hero-lead">Pacotes reúnem desafios de system design (com gabarito para os juízes) e artigos. Baixe um pacote e ele aparece na sua biblioteca, pronto para desenhar.</p>
      </header>

      <div className="hub-source panel">
        <Package size={16} />
        {editingSource ? (
          <form className="hub-source-form" onSubmit={(event) => { event.preventDefault(); void saveSource(); }}>
            <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="https://raw.githubusercontent.com/<usuário>/<repo>/main/hub/dist/index.json" aria-label="Endereço do hub" />
            <button className="btn btn-primary btn-sm" disabled={busy === 'source'}>Salvar</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingSource(false); setSource(listing.source); }}>Cancelar</button>
          </form>
        ) : (
          <>
            <span className="hub-source-text"><strong>{listing.name ?? 'Hub'}</strong><code title={listing.source}>{listing.source}</code></span>
            <button className="icon-btn" title="Trocar endereço do hub" aria-label="Trocar endereço do hub" onClick={() => setEditingSource(true)}><Pencil size={14} /></button>
            <button className="icon-btn" title="Recarregar" aria-label="Recarregar" onClick={reload}><RefreshCw size={14} /></button>
          </>
        )}
      </div>

      {listing.error && <div className="banner banner-error"><TriangleAlert size={18} /><p>{listing.error}</p></div>}
      {notice && <div className={`banner ${notice.tone === 'ok' ? 'banner-success' : 'banner-error'}`}>{notice.tone === 'ok' ? <Check size={18} /> : <TriangleAlert size={18} />}<p>{notice.text}</p></div>}

      <div className="library-toolbar">
        <label className="search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pacote…" aria-label="Buscar pacotes" /></label>
        <button className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()} disabled={busy === 'import'}><FileUp size={14} />Importar pacote .json</button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file); }} />
      </div>

      {!listing.error && packs.length === 0 ? (
        <EmptyState icon={<Package size={22} />} title="Nenhum pacote encontrado" body={text ? 'Tente outro termo.' : 'Este hub ainda não publicou pacotes.'} />
      ) : (
        <div className="pack-grid">
          {packs.map((pack) => (
            <article key={pack.id} className="pack-card">
              <div className="pack-card-top">
                <span className="mono-dim">{pack.id}@{pack.version}</span>
                {pack.status === 'installed' && <span className="pack-status installed"><Check size={12} />Instalado</span>}
                {pack.status === 'update' && <span className="pack-status update">Atualização</span>}
              </div>
              <h3>{pack.name}</h3>
              <p>{pack.description}</p>
              <div className="tag-row">{pack.tags.map((tag) => <TagChip key={tag}>{tag}</TagChip>)}</div>
              <div className="pack-meta">
                <span><LayoutGrid size={13} />{pack.problemCount} desafio{pack.problemCount === 1 ? '' : 's'}</span>
                <span><BookOpen size={13} />{pack.articleCount} artigo{pack.articleCount === 1 ? '' : 's'}</span>
                <span>por {pack.author}</span>
                <span>{pack.license}</span>
              </div>
              <div className="pack-actions">
                {pack.status === 'available' && <button className="btn btn-primary btn-sm" disabled={busy !== null} onClick={() => void install(pack.id, pack.name)}>{busy === pack.id ? <LoaderCircle size={14} className="spin" /> : <Download size={14} />}Baixar</button>}
                {pack.status === 'update' && <button className="btn btn-primary btn-sm" disabled={busy !== null} onClick={() => void install(pack.id, pack.name)}>{busy === pack.id ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />}Atualizar {pack.installedVersion} → {pack.version}</button>}
                {pack.status !== 'available' && <Link className="btn btn-ghost btn-sm" to={`/?pack=${pack.id}`}>Ver desafios</Link>}
              </div>
            </article>
          ))}
        </div>
      )}

      <h2 className="section-title"><Package size={17} />Instalados no seu ambiente</h2>
      {listing.installed.length === 0 ? <p className="muted">Nenhum pacote instalado ainda. O conteúdo nativo (16 desafios e 20 artigos) está sempre disponível.</p> : (
        <ul className="installed-list">
          {listing.installed.map((pack) => (
            <li key={pack.manifest.id} className="panel">
              <span><strong>{pack.manifest.name}</strong><small>{pack.manifest.id}@{pack.manifest.version} · {pack.origin === 'hub' ? 'do hub' : 'importado'} · {relativeTime(pack.installedAt)} · {pack.problemCount} desafios · {pack.articleCount} artigos</small></span>
              <button className="btn btn-danger btn-sm" disabled={busy !== null} onClick={() => void remove(pack.manifest.id, pack.manifest.name)}><Trash2 size={14} />Remover</button>
            </li>
          ))}
        </ul>
      )}

      <section className="panel contribute">
        <GitPullRequest size={20} />
        <div>
          <h3>Contribua com um pacote</h3>
          <p className="muted small">Cada pacote é uma pasta em <code>hub/packs/&lt;id&gt;</code> com um <code>pack.yaml</code>, desafios em <code>problems/*.md</code> e artigos em <code>articles/*.md</code> (Markdown com frontmatter YAML). Copie os modelos de <code>hub/templates</code>, rode <code>npm run hub:check</code> para validar e abra um pull request. Cada desafio precisa de um gabarito (<code>keyPoints</code>) para os juízes. Para testar localmente sem publicar, gere o pacote com <code>npm run hub:build</code> e use "Importar pacote".</p>
        </div>
      </section>
    </div>
  );
}
