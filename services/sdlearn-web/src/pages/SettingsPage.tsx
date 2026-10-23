import { useEffect, useState } from 'react';
import { Check, CircleCheck, CircleX, Gavel, KeyRound, LoaderCircle, RefreshCw, Save, Scale, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Button, ErrorState, PageLoading } from '../components/ui';
import { useI18n } from '../i18n';
import { useAsync } from '../lib/useAsync';
import type { JudgeAssignment, JudgeRole, ProviderId, ProviderStatus, PublicSettings } from '../types';

const providerHelp: Record<ProviderId, { keyUrl?: string; suggested?: string }> = {
  openai: { keyUrl: 'https://platform.openai.com/api-keys' },
  anthropic: { keyUrl: 'https://console.anthropic.com/settings/keys', suggested: 'claude-opus-5-5' },
  gemini: { keyUrl: 'https://aistudio.google.com/apikey' },
  xai: { keyUrl: 'https://console.x.ai' },
  ollama: {},
  'azure-openai': {},
};

const roles: { id: JudgeRole; icon: typeof Gavel }[] = [
  { id: 'rigor', icon: Gavel },
  { id: 'pragmatic', icon: Scale },
  { id: 'moderator', icon: Sparkles },
];

export function SettingsPage() {
  const { t } = useI18n();
  const loaded = useAsync(() => api.getSettings(), []);
  if (api.mode === 'local') return <div className="container page"><ErrorState message={t.settings.needsApi} /></div>;
  if (loaded.loading) return <PageLoading />;
  if (loaded.error || !loaded.data) return <div className="container page"><ErrorState message={loaded.error ?? t.common.couldNotLoad} onRetry={loaded.reload} /></div>;
  return <SettingsForm initial={loaded.data} />;
}

function SettingsForm({ initial }: { initial: PublicSettings }) {
  const { t } = useI18n();
  const [settings, setSettings] = useState(initial);
  return (
    <div className="container page">
      <header className="page-header">
        <p className="eyebrow">{t.settings.eyebrow}</p>
        <h1>{t.settings.title} <span className="gradient-text">{t.settings.titleAccent}</span></h1>
        <p className="hero-lead">{t.settings.lead}</p>
      </header>

      {!settings.secretsEncrypted && (
        <div className="banner banner-warning"><ShieldAlert size={18} /><p>{t.settings.secretsWarning}</p></div>
      )}

      <h2 className="section-title"><KeyRound size={17} />{t.settings.providers}</h2>
      <div className="provider-grid">
        {settings.providers.map((provider) => <ProviderCard key={provider.id} provider={provider} onSaved={setSettings} />)}
      </div>

      <JudgesSection settings={settings} onSaved={setSettings} />
    </div>
  );
}

function ProviderCard({ provider, onSaved }: { provider: ProviderStatus; onSaved: (settings: PublicSettings) => void }) {
  const { t } = useI18n();
  const help = providerHelp[provider.id];
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(provider.source === 'settings' || provider.id === 'ollama' || provider.id === 'azure-openai' ? provider.baseUrl ?? '' : '');
  const [deployment, setDeployment] = useState(provider.deployment ?? '');
  const [advanced, setAdvanced] = useState(provider.id === 'ollama' || provider.id === 'azure-openai');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function save(patch: { apiKey?: string | null; baseUrl?: string | null; deployment?: string | null }) {
    setBusy(true);
    setMessage(null);
    try {
      onSaved(await api.updateSettings({ providers: { [provider.id]: patch } }));
      setApiKey('');
      setMessage({ tone: 'ok', text: t.common.saved });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : t.common.couldNotSave });
    } finally {
      setBusy(false);
    }
  }

  const statusText = provider.configured ? (provider.source === 'env' ? t.settings.statusEnv : t.settings.statusConnected) : t.settings.statusNotConfigured;
  const urlLabel = provider.id === 'azure-openai' ? t.settings.endpoint : provider.id === 'ollama' ? t.settings.ollamaUrl : t.settings.baseUrl;
  const urlPlaceholder = provider.id === 'ollama' ? 'http://localhost:11434' : provider.id === 'azure-openai' ? t.settings.azurePlaceholder : provider.baseUrl ?? t.settings.providerDefault;
  return (
    <section className={`panel provider-card${provider.configured ? ' configured' : ''}`}>
      <header>
        <h3>{provider.label}</h3>
        <span className={`provider-status${provider.configured ? ' on' : ''}`}>{provider.configured ? <CircleCheck size={13} /> : <CircleX size={13} />}{statusText}</span>
      </header>
      <p className="muted small">{t.settings.providerNotes[provider.id]}{help.keyUrl && t.settings.keyAt(<a href={help.keyUrl} target="_blank" rel="noreferrer">{help.keyUrl.replace('https://', '')}</a>)}</p>
      {/* Fields sit at the bottom of the card, right above the actions, so inputs line up across a row. */}
      <form className="provider-form" onSubmit={(event) => { event.preventDefault(); void save({ ...(apiKey.trim() ? { apiKey } : {}), ...(advanced ? { baseUrl: baseUrl.trim() || null } : {}), ...(provider.id === 'azure-openai' ? { deployment: deployment.trim() || null } : {}) }); }}>
        {provider.needsKey && (
          <label className="field"><span>{t.settings.apiKey}</span>
            <input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={provider.keyHint ? t.settings.keySaved(provider.keyHint) : t.settings.pasteKey} />
          </label>
        )}
        {provider.id === 'azure-openai' && (
          <>
            <label className="field"><span>{t.settings.apiKeyOptional}</span><input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={provider.keyHint ?? t.settings.pasteKey} /></label>
            <label className="field"><span>{t.settings.deployment}</span><input value={deployment} onChange={(event) => setDeployment(event.target.value)} placeholder={t.settings.deploymentPlaceholder} /></label>
          </>
        )}
        {advanced && (
          <label className="field"><span>{urlLabel}</span>
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder={urlPlaceholder} />
          </label>
        )}
        <div className="provider-actions">
          <Button type="submit" variant="primary" size="sm" disabled={busy}>{busy ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />}{provider.id === 'ollama' && !provider.configured ? t.settings.activate : t.common.save}</Button>
          {provider.source === 'settings' && provider.keyHint && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void save({ apiKey: null })}><Trash2 size={14} />{t.settings.removeKey}</Button>}
          {message && <span className={`inline-status ${message.tone}`}>{message.text}</span>}
          {!advanced && <button type="button" className="link-button provider-custom" onClick={() => setAdvanced(true)}>{t.settings.customEndpoint}</button>}
        </div>
      </form>
    </section>
  );
}

function JudgesSection({ settings, onSaved }: { settings: PublicSettings; onSaved: (settings: PublicSettings) => void }) {
  const { t, locale } = useI18n();
  const [judges, setJudges] = useState<Record<JudgeRole, JudgeAssignment>>(settings.judges);
  const [samples, setSamples] = useState(settings.samples);
  const [models, setModels] = useState<Partial<Record<ProviderId, string[]>>>({});
  const [modelErrors, setModelErrors] = useState<Partial<Record<ProviderId, string>>>({});
  const [tests, setTests] = useState<Partial<Record<JudgeRole, { running: boolean; text?: string; ok?: boolean }>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const configured = settings.providers.filter((provider) => provider.configured);

  async function loadModels(provider: ProviderId, force = false) {
    if (!force && models[provider]) return;
    setModelErrors((current) => ({ ...current, [provider]: undefined }));
    try {
      const items = await api.listProviderModels(provider);
      setModels((current) => ({ ...current, [provider]: items }));
    } catch (error) {
      setModelErrors((current) => ({ ...current, [provider]: error instanceof Error ? error.message : t.settings.listModelsFailed }));
    }
  }

  useEffect(() => {
    for (const assignment of Object.values(judges)) if (assignment.provider && configured.some((item) => item.id === assignment.provider)) void loadModels(assignment.provider);
    // Load model lists once for the providers already assigned.
  }, []);

  function assign(role: JudgeRole, patch: Partial<JudgeAssignment>) {
    setSaved(null);
    setJudges((current) => {
      const next = { ...current[role], ...patch };
      if (patch.provider !== undefined && patch.provider !== current[role].provider) next.model = patch.provider ? providerHelp[patch.provider].suggested ?? null : null;
      return { ...current, [role]: next };
    });
    if (patch.provider) void loadModels(patch.provider);
  }

  async function test(role: JudgeRole) {
    const { provider, model } = judges[role];
    if (!provider || !model) return;
    setTests((current) => ({ ...current, [role]: { running: true } }));
    try {
      const result = await api.testProvider(provider, model);
      setTests((current) => ({ ...current, [role]: { running: false, ok: result.ok, text: result.ok ? t.settings.answeredIn((result.latencyMs / 1000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })) : result.error ?? t.settings.unexpectedAnswer } }));
    } catch (error) {
      setTests((current) => ({ ...current, [role]: { running: false, ok: false, text: error instanceof Error ? error.message : t.common.failed } }));
    }
  }

  async function save() {
    setSaving(true);
    try {
      onSaved(await api.updateSettings({ judges, samples }));
      setSaved(t.settings.panelSaved);
    } catch (error) {
      setSaved(error instanceof Error ? error.message : t.common.couldNotSave);
    } finally {
      setSaving(false);
    }
  }

  const complete = roles.every((role) => judges[role.id].provider && judges[role.id].model);
  return (
    <>
      <h2 className="section-title"><Gavel size={17} />{t.settings.judgePanel}</h2>
      {configured.length === 0 ? (
        <p className="hint-box">{t.settings.connectFirst}</p>
      ) : (
        <div className="panel judge-config">
          {roles.map((role) => {
            const Icon = role.icon;
            const assignment = judges[role.id];
            const state = tests[role.id];
            return (
              <div key={role.id} className="judge-row">
                <div className="judge-row-title"><span className={`judge-avatar role-${role.id}`}><Icon size={16} /></span><span><strong>{t.judges[role.id].name}</strong><small>{t.judges[role.id].role}</small></span></div>
                <label className="field"><span>{t.settings.provider}</span>
                  <select value={assignment.provider ?? ''} onChange={(event) => assign(role.id, { provider: (event.target.value || null) as ProviderId | null })}>
                    <option value="">{t.settings.choose}</option>
                    {configured.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
                  </select>
                </label>
                <label className="field"><span>{t.settings.model} {assignment.provider && <button type="button" className="link-button" onClick={() => void loadModels(assignment.provider!, true)} title={t.settings.reloadModels}><RefreshCw size={11} /></button>}</span>
                  <input list={`models-${role.id}`} value={assignment.model ?? ''} onChange={(event) => assign(role.id, { model: event.target.value })} placeholder={assignment.provider ? t.settings.modelPlaceholder : '—'} disabled={!assignment.provider} />
                  <datalist id={`models-${role.id}`}>{(assignment.provider ? models[assignment.provider] ?? [] : []).map((model) => <option key={model} value={model} />)}</datalist>
                  {assignment.provider && modelErrors[assignment.provider] && <small className="form-error">{modelErrors[assignment.provider]}</small>}
                </label>
                <div className="judge-row-test">
                  <Button size="sm" disabled={!assignment.provider || !assignment.model || state?.running} onClick={() => void test(role.id)}>{state?.running ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}{t.settings.test}</Button>
                  {state?.text && <span className={`inline-status ${state.ok ? 'ok' : 'error'}`} title={state.text}>{state.text}</span>}
                </div>
              </div>
            );
          })}

          <div className="samples-row">
            <div><strong>{t.settings.consistency}</strong><small>{t.settings.consistencyBody}</small></div>
            <div className="segmented" role="radiogroup" aria-label={t.settings.samplesLabel}>
              <button type="button" role="radio" aria-checked={samples === 1} className={samples === 1 ? 'active' : ''} onClick={() => { setSamples(1); setSaved(null); }}>{t.settings.samples(1, 5)}</button>
              <button type="button" role="radio" aria-checked={samples === 3} className={samples === 3 ? 'active' : ''} onClick={() => { setSamples(3); setSaved(null); }}>{t.settings.samples(3, 9)}</button>
            </div>
          </div>

          <div className="provider-actions">
            <Button variant="primary" disabled={saving || !complete} onClick={() => void save()}>{saving ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />}{t.settings.savePanel}</Button>
            {!complete && <span className="muted small">{t.settings.incomplete}</span>}
            {saved && <span className="inline-status ok">{saved}</span>}
          </div>
        </div>
      )}
    </>
  );
}
