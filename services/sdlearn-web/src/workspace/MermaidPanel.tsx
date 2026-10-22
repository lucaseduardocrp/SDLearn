import { useEffect, useId, useState } from 'react';
import { ArrowDownToLine, RefreshCw, TriangleAlert } from 'lucide-react';

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
      flowchart: { curve: 'basis', padding: 12 },
    });
    return mermaid;
  });
  return mermaidReady;
}

export function MermaidPanel({ source, onChange, onGenerateFromCanvas, onApplyToCanvas, warnings }: MermaidPanelProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const baseId = useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    if (!source.trim()) { setSvg(null); setError(null); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      void loadMermaid().then(async (mermaid) => {
        try {
          const rendered = await mermaid.render(`mmd${baseId}${Date.now()}`, source);
          if (active) { setSvg(rendered.svg); setError(null); }
        } catch (renderError) {
          if (active) setError(renderError instanceof Error ? renderError.message.split('\n').slice(0, 3).join(' ') : 'Sintaxe Mermaid inválida.');
        }
      });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [source, baseId]);

  return (
    <div className="mermaid-panel">
      <div className="mermaid-editor">
        <div className="mermaid-toolbar">
          <span className="mono-dim">diagram.mmd</span>
          <div>
            <button className="btn btn-ghost btn-sm" onClick={onGenerateFromCanvas} title="Substitui o texto pelo diagrama gerado a partir do canvas"><RefreshCw size={13} />Gerar do canvas</button>
            <button className="btn btn-ghost btn-sm" onClick={onApplyToCanvas} disabled={!source.trim()} title="Substitui o canvas pelos nós e conexões deste diagrama"><ArrowDownToLine size={13} />Aplicar no canvas</button>
          </div>
        </div>
        <textarea
          className="code-input"
          value={source}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          aria-label="Código Mermaid"
          placeholder={'flowchart LR\n  U([Users]) --> LB[Load Balancer]\n  LB --> API[URL Service ×3]\n  API --> C[[Redis Cache]]\n  API --> DB[(Cassandra)]\n  API -.->|click events| K[/Kafka/]'}
        />
        {warnings.length > 0 && <div className="mermaid-warnings">{warnings.slice(0, 4).map((warning) => <p key={warning}><TriangleAlert size={12} />{warning}</p>)}</div>}
        <p className="mermaid-help">Formas viram tipos: <code>([x])</code> client · <code>[(x)]</code> banco · <code>[[x]]</code> cache · <code>[/x/]</code> fila · <code>{'{{x}}'}</code> CDN. Nomes como “Redis”, “Kafka” ou “S3” também são reconhecidos. <code>×3</code> no rótulo = 3 réplicas; <code>-.-&gt;</code> = assíncrono.</p>
      </div>
      <div className="mermaid-preview" aria-label="Pré-visualização do diagrama">
        {error ? <div className="mermaid-error"><TriangleAlert size={16} /><span>{error}</span></div>
          : svg ? <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} />
            : <p className="muted">Escreva um diagrama ou gere a partir do canvas.</p>}
      </div>
    </div>
  );
}
