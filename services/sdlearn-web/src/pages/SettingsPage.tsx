import { useEffect, useState } from 'react';
import { Check, CircleCheck, CircleX, Gavel, KeyRound, LoaderCircle, RefreshCw, Save, Scale, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../api';
import { ErrorState, PageLoading } from '../components/ui';
import { useAsync } from '../lib/useAsync';
import type { JudgeAssignment, JudgeRole, ProviderId, ProviderStatus, PublicSettings } from '../types';

const providerHelp: Record<ProviderId, { keyUrl?: string; note: string; suggested?: string }> = {
  openai: { keyUrl: 'https://platform.openai.com/api-keys', note: 'Use a URL avançada para qualquer endpoint compatível com OpenAI (LM Studio, vLLM, OpenRouter).' },
  anthropic: { keyUrl: 'https://console.anthropic.com/settings/keys', note: 'Usa o SDK oficial com saída estruturada.', suggested: 'claude-opus-5-5' },
  gemini: { keyUrl: 'https://aistudio.google.com/apikey', note: 'Chave do Google AI Studio.' },
  xai: { keyUrl: 'https://console.x.ai', note: 'Modelos Grok via API da xAI.' },
  ollama: { note: 'Roda modelos locais, sem chave. Instale em ollama.com e baixe um modelo (ex.: ollama pull llama3.1).' },
  'azure-openai': { note: 'Informe o endpoint do recurso e o nome do deployment. Fora de Development, usa managed identity.' },
};

const roles: { id: JudgeRole; name: string; description: string; icon: typeof Gavel }[] = [
  { id: 'rigor', name: 'O Rigoroso', description: 'Corretude sob falha, garantias explícitas, contas que fecham.', icon: Gavel },
  { id: 'pragmatic', name: 'O Pragmático', description: 'Simplicidade, custo e escopo que cabe na entrevista.', icon: Scale },
  { id: 'moderator', name: 'Moderador', description: 'Escreve o feedback de consenso. A nota final é calculada pelo servidor.', icon: Sparkles },
];

export function SettingsPage() {
  const loaded = useAsync(() => api.getSettings(), []);
  if (api.mode === 'local') return <div className="container page"><ErrorState message="As configurações de juízes ficam na API. Rode o app com npm run dev para configurar provedores." /></div>;
  if (loaded.loading) return <PageLoading />;
  if (loaded.error || !loaded.data) return <div className="container page"><ErrorState message={loaded.error ?? 'Não foi possível carregar.'} onRetry={loaded.reload} /></div>;
  return <SettingsForm initial={loaded.data} />;
}

function SettingsForm({ initial }: { initial: PublicSettings }) {
  const [settings, setSettings] = useState(initial);
  return (
    <div className="container page">
      <header className="page-header">
        <p className="eyebrow">// CONFIGURAÇÕES</p>
        <h1>Juízes e <span className="gradient-text">provedores de IA</span></h1>
        <p className="hero-lead">Conecte seus provedores e escolha qual modelo faz cada papel no painel. Usar modelos diferentes para cada juiz deixa as avaliações mais independentes.</p>
      </header>

      {!settings.secretsEncrypted && (
        <div className="banner banner-warning"><ShieldAlert size={18} /><p>As chaves salvas aqui ficam <b>sem criptografia</b> no banco local. Defina <code>SECRETS_KEY</code> no <code>.env</code> (qualquer frase longa) e salve as chaves de novo para guardá-las criptografadas.</p></div>
      )}

      <h2 className="section-title"><KeyRound size={17} />Provedores</h2>
      <div className="provider-grid">
        {settings.providers.map((provider) => <ProviderCard key={provider.id} provider={provider} onSaved={setSettings} />)}
      </div>

      <JudgesSection settings={settings} onSaved={setSettings} />
    </div>
  );
}

function ProviderCard({ provider, onSaved }: { provider: ProviderStatus; onSaved: (settings: PublicSettings) => void }) {
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
      setMessage({ tone: 'ok', text: 'Salvo.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Não foi possível salvar.' });
    } finally {
      setBusy(false);
    }
  }

  const statusText = provider.configured ? (provider.source === 'env' ? 'Conectado via .env' : 'Conectado') : 'Não configurado';
  return (
    <section className={`panel provider-card${provider.configured ? ' configured' : ''}`}>
      <header>
        <h3>{provider.label}</h3>
        <span className={`provider-status${provider.configured ? ' on' : ''}`}>{provider.configured ? <CircleCheck size={13} /> : <CircleX size={13} />}{statusText}</span>
      </header>
      <p className="muted small">{help.note}{help.keyUrl && <> Chave em <a href={help.keyUrl} target="_blank" rel="noreferrer">{help.keyUrl.replace('https://', '')}</a>.</>}</p>
      <form className="provider-form" onSubmit={(event) => { event.preventDefault(); void save({ ...(apiKey.trim() ? { apiKey } : {}), ...(advanced ? { baseUrl: baseUrl.trim() || null } : {}), ...(provider.id === 'azure-openai' ? { deployment: deployment.trim() || null } : {}) }); }}>
        {provider.needsKey && (
          <label className="field"><span>Chave de API</span>
            <input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={provider.keyHint ? `Salva: ${provider.keyHint} — digite para trocar` : 'Cole sua chave'} />
          </label>
        )}
        {provider.id === 'azure-openai' && (
          <>
            <label className="field"><span>Chave de API (opcional fora de Development)</span><input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={provider.keyHint ?? 'Cole sua chave'} /></label>
            <label className="field"><span>Deployment</span><input value={deployment} onChange={(event) => setDeployment(event.target.value)} placeholder="nome-do-deployment" /></label>
          </>
        )}
        {advanced ? (
          <label className="field"><span>{provider.id === 'azure-openai' ? 'Endpoint' : provider.id === 'ollama' ? 'URL do Ollama' : 'URL base (opcional)'}</span>
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder={provider.id === 'ollama' ? 'http://localhost:11434' : provider.id === 'azure-openai' ? 'https://seu-recurso.openai.azure.com' : provider.baseUrl ?? 'padrão do provedor'} />
          </label>
        ) : (
          <button type="button" className="link-button" onClick={() => setAdvanced(true)}>Usar endpoint customizado</button>
        )}
        <div className="provider-actions">
          <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />}{provider.id === 'ollama' && !provider.configured ? 'Ativar' : 'Salvar'}</button>
          {provider.source === 'settings' && provider.keyHint && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void save({ apiKey: null })}><Trash2 size={14} />Remover chave</button>}
          {message && <span className={`inline-status ${message.tone}`}>{message.text}</span>}
        </div>
      </form>
    </section>
  );
}

function JudgesSection({ settings, onSaved }: { settings: PublicSettings; onSaved: (settings: PublicSettings) => void }) {
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
      setModelErrors((current) => ({ ...current, [provider]: error instanceof Error ? error.message : 'Falha ao listar modelos.' }));
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
      setTests((current) => ({ ...current, [role]: { running: false, ok: result.ok, text: result.ok ? `Respondeu em ${(result.latencyMs / 1000).toFixed(1)} s` : result.error ?? 'Resposta inesperada.' } }));
    } catch (error) {
      setTests((current) => ({ ...current, [role]: { running: false, ok: false, text: error instanceof Error ? error.message : 'Falhou.' } }));
    }
  }

  async function save() {
    setSaving(true);
    try {
      onSaved(await api.updateSettings({ judges, samples }));
      setSaved('Painel salvo. As próximas submissões usam esta configuração.');
    } catch (error) {
      setSaved(error instanceof Error ? error.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  const complete = roles.every((role) => judges[role.id].provider && judges[role.id].model);
  return (
    <>
      <h2 className="section-title"><Gavel size={17} />Painel de juízes</h2>
      {configured.length === 0 ? (
        <p className="hint-box">Conecte pelo menos um provedor acima para escolher os modelos dos juízes.</p>
      ) : (
        <div className="panel judge-config">
          {roles.map((role) => {
            const Icon = role.icon;
            const assignment = judges[role.id];
            const state = tests[role.id];
            return (
              <div key={role.id} className="judge-row">
                <div className="judge-row-title"><span className={`judge-avatar role-${role.id}`}><Icon size={16} /></span><span><strong>{role.name}</strong><small>{role.description}</small></span></div>
                <label className="field"><span>Provedor</span>
                  <select value={assignment.provider ?? ''} onChange={(event) => assign(role.id, { provider: (event.target.value || null) as ProviderId | null })}>
                    <option value="">Escolha…</option>
                    {configured.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
                  </select>
                </label>
                <label className="field"><span>Modelo {assignment.provider && <button type="button" className="link-button" onClick={() => void loadModels(assignment.provider!, true)} title="Recarregar lista de modelos"><RefreshCw size={11} /></button>}</span>
                  <input list={`models-${role.id}`} value={assignment.model ?? ''} onChange={(event) => assign(role.id, { model: event.target.value })} placeholder={assignment.provider ? 'Digite ou escolha um modelo' : '—'} disabled={!assignment.provider} />
                  <datalist id={`models-${role.id}`}>{(assignment.provider ? models[assignment.provider] ?? [] : []).map((model) => <option key={model} value={model} />)}</datalist>
                  {assignment.provider && modelErrors[assignment.provider] && <small className="form-error">{modelErrors[assignment.provider]}</small>}
                </label>
                <div className="judge-row-test">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={!assignment.provider || !assignment.model || state?.running} onClick={() => void test(role.id)}>{state?.running ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}Testar</button>
                  {state?.text && <span className={`inline-status ${state.ok ? 'ok' : 'error'}`} title={state.text}>{state.text}</span>}
                </div>
              </div>
            );
          })}

          <div className="samples-row">
            <div><strong>Consistência</strong><small>Rodar cada juiz várias vezes e usar a mediana reduz a variação entre avaliações do mesmo desenho.</small></div>
            <div className="segmented" role="radiogroup" aria-label="Amostras por juiz">
              <button type="button" role="radio" aria-checked={samples === 1} className={samples === 1 ? 'active' : ''} onClick={() => { setSamples(1); setSaved(null); }}>1× · 5 chamadas</button>
              <button type="button" role="radio" aria-checked={samples === 3} className={samples === 3 ? 'active' : ''} onClick={() => { setSamples(3); setSaved(null); }}>3× · 9 chamadas</button>
            </div>
          </div>

          <div className="provider-actions">
            <button className="btn btn-primary" disabled={saving || !complete} onClick={() => void save()}>{saving ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />}Salvar painel</button>
            {!complete && <span className="muted small">Escolha provedor e modelo para os três papéis.</span>}
            {saved && <span className="inline-status ok">{saved}</span>}
          </div>
        </div>
      )}
    </>
  );
}
