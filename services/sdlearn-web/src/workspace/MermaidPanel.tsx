import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDownToLine, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '../components/ui';
import { useI18n } from '../i18n';

interface MermaidPanelProps {
  source: string;
  onChange: (source: string) => void;
  onGenerateFromCanvas: () => void;
  onApplyToCanvas: () => void;
  warnings: string[];
}

let mermaidReady: Promise<typeof import('mermaid').default> | null = null;

function loadMermaid() {
  mermaidReady ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      themeVariables: {
        darkMode: true, background: '#0b0a14', primaryColor: '#1a1729', primaryTextColor: '#ece9f7', primaryBorderColor: '#7c3aed',
        secondaryColor: '#151226', tertiaryColor: '#12101f', lineColor: '#8f89ab', textColor: '#ece9f7', edgeLabelBackground: '#12101f', fontSize: '14px',
      },
      htmlLabels: false,
      flowchart: { curve: 'basis', padding: 14, htmlLabels: false, nodeSpacing: 40, rankSpacing: 60 },
    });
    return mermaid;
  });
  return mermaidReady;
}

export function MermaidPanel({ source, onChange, onGenerateFromCanvas, onApplyToCanvas, warnings }: MermaidPanelProps) {
  const { t } = useI18n();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const baseId = useId().replace(/[^a-zA-Z0-9]/g, '');
  // Read through a ref so switching language does not re-render the diagram.
  const invalidSyntax = useRef(t.mermaid.invalid);
  invalidSyntax.current = t.mermaid.invalid;

  useEffect(() => {
    if (!source.trim()) { setSvg(null); setError(null); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      void loadMermaid().then(async (mermaid) => {
        try {
          const rendered = await mermaid.render(`mmd${baseId}${Date.now()}`, source);
          if (active) { setSvg(rendered.svg); setError(null); }
        } catch (renderError) {
          if (active) setError(renderError instanceof Error ? renderError.message.split('\n').slice(0, 3).join(' ') : invalidSyntax.current);
        }
      });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [source, baseId]);

  // Mermaid sizes the viewBox from text measured off-screen, which can differ from the final render and
  // clip labels. Refit it to the real content and let small diagrams grow to fill the preview.
  useLayoutEffect(() => {
    const element = holder.current?.querySelector('svg');
    if (!element) return;
    const box = element.getBBox();
    if (!box.width || !box.height) return;
    const pad = 16;
    element.setAttribute('viewBox', `${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`);
    element.removeAttribute('height');
    element.style.width = '100%';
    element.style.maxWidth = `${Math.max((box.width + pad * 2) * 1.6, 360)}px`;
  }, [svg]);

  return (
    <div className="mermaid-panel">
      <div className="mermaid-editor">
        <div className="mermaid-toolbar">
          <span className="mono-dim">diagram.mmd</span>
          <div>
            <Button size="sm" onClick={onGenerateFromCanvas} title={t.mermaid.generateTitle}><RefreshCw size={13} />{t.mermaid.generate}</Button>
            <Button size="sm" onClick={onApplyToCanvas} disabled={!source.trim()} title={t.mermaid.applyTitle}><ArrowDownToLine size={13} />{t.mermaid.apply}</Button>
          </div>
        </div>
        <textarea
          className="code-input"
          value={source}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          aria-label={t.mermaid.codeLabel}
          placeholder={'flowchart LR\n  U([Users]) --> LB[Load Balancer]\n  LB --> API[URL Service ×3]\n  API --> C[[Redis Cache]]\n  API --> DB[(Cassandra)]\n  API -.->|click events| K[/Kafka/]'}
        />
        {warnings.length > 0 && <div className="mermaid-warnings">{warnings.slice(0, 4).map((warning) => <p key={warning}><TriangleAlert size={12} />{warning}</p>)}</div>}
        <p className="mermaid-help">{t.mermaid.help}</p>
      </div>
      <div className="mermaid-preview" aria-label={t.mermaid.preview}>
        {error ? <div className="mermaid-error"><TriangleAlert size={16} /><span>{error}</span></div>
          : svg ? <div ref={holder} className="mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} />
            : <p className="muted">{t.mermaid.empty}</p>}
      </div>
    </div>
  );
}
