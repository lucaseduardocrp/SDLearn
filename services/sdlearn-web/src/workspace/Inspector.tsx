import { ArrowLeftRight, CircleCheck, CircleX, Minus, MousePointerClick, Plus, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { componentCategories, componentList, componentSpecs } from '@shared/catalog/components';
import { componentOptions, effectiveSpec, protocols, resolveConfig, technologiesFor, type ComponentOption } from '@shared/catalog/technologies';
import { formatRate } from '@shared/engine/chaos';
import type { Locale } from '@shared/i18n/locale';
import type { ComponentKind, ComponentOptionValue, RubricReport } from '../types';
import type { EdgePatch } from './CanvasEditor';
import { technologyPatch } from './canvasMenus';
import { engineMessages } from '@shared/i18n/engine';
import { Button, ScoreRing } from '../components/ui';
import { useI18n } from '../i18n';
import type { ComponentNodeData, DesignWarning, FlowEdge, FlowNode } from './designModel';
import { kindIcons } from './kindIcons';

interface InspectorProps {
  node?: FlowNode;
  edge?: FlowEdge;
  nodes: FlowNode[];
  rubric: RubricReport;
  warnings: DesignWarning[];
  onNodeChange: (id: string, data: Partial<ComponentNodeData>) => void;
  onEdgeChange: (id: string, patch: EdgePatch) => void;
  onDelete: (target: { nodeId?: string; edgeId?: string }) => void;
}

export function Inspector({ node, edge, nodes, rubric, warnings, onNodeChange, onEdgeChange, onDelete }: InspectorProps) {
  const { t, locale } = useI18n();
  const catalogText = engineMessages(locale);
  if (node?.type === 'component') {
    const spec = componentSpecs[node.data.kind];
    const Icon = kindIcons[node.data.kind];
    const effective = effectiveSpec(node.data);
    const technology = effective.technology;
    const techs = technologiesFor(node.data.kind);
    const options = componentOptions[node.data.kind];
    const config = resolveConfig(node.data.kind, technology?.id, node.data.config);
    const capacity = effective.capacityPerReplica * node.data.replicas;
    const setOption = (id: string, value: ComponentOptionValue) => onNodeChange(node.id, { config: { ...node.data.config, [id]: value } });
    return (
      <div className="inspector">
        <div className="inspector-head"><span className={`cnode-icon category-${spec.category.toLowerCase()}`}><Icon size={16} /></span><div><strong>{node.data.label || spec.label}</strong><small>{catalogText.componentDescriptions[spec.kind]}</small></div></div>
        <label className="field"><span>{t.inspector.name}</span><input value={node.data.label} maxLength={60} onChange={(event) => onNodeChange(node.id, { label: event.target.value })} /></label>
        <label className="field"><span>{t.inspector.type}</span>
          <select value={node.data.kind} onChange={(event) => onNodeChange(node.id, { kind: event.target.value as ComponentKind })}>
            {componentCategories.map((category) => (
              <optgroup key={category} label={catalogText.componentCategories[category]}>
                {componentList.filter((item) => item.category === category).map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {techs.length > 0 && (
          <label className="field"><span>{t.inspector.technology}</span>
            <select value={technology?.id ?? ''} onChange={(event) => onNodeChange(node.id, technologyPatch(node.data, event.target.value || undefined))}>
              <option value="">{t.inspector.generic}</option>
              {techs.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            {technology && <small className="tech-note">{technology.managed && <b>{t.inspector.managed}</b>}{technology.description[locale]}</small>}
          </label>
        )}
        {!spec.entry && (
          <div className="field"><span>{technology?.unit ? t.inspector.replicasUnit(technology.unit[locale]) : t.inspector.replicas}</span>
            <div className="stepper">
              <button aria-label={t.inspector.fewerReplicas} onClick={() => onNodeChange(node.id, { replicas: Math.max(1, node.data.replicas - 1) })} disabled={node.data.replicas <= 1}><Minus size={14} /></button>
              <input type="number" min={1} max={100} value={node.data.replicas} onChange={(event) => onNodeChange(node.id, { replicas: Math.min(100, Math.max(1, Math.round(Number(event.target.value)) || 1)) })} aria-label={t.inspector.replicasLabel} />
              <button aria-label={t.inspector.moreReplicas} onClick={() => onNodeChange(node.id, { replicas: Math.min(100, node.data.replicas + 1) })} disabled={node.data.replicas >= 100}><Plus size={14} /></button>
            </div>
            <small className="muted">{t.inspector.capacity(formatRate(capacity), effective.latencyMs, effective.soft, effective.buffers)}</small>
          </div>
        )}
        {options.length > 0 && (
          <fieldset className="option-group">
            <legend>
              {t.inspector.configuration}
              {node.data.config && Object.keys(node.data.config).length > 0 && (
                <button type="button" className="link-button" onClick={() => onNodeChange(node.id, { config: undefined })}><RotateCcw size={11} />{t.inspector.resetDefaults}</button>
              )}
            </legend>
            {options.map((option) => <OptionField key={option.id} option={option} value={config[option.id]} locale={locale} onChange={(value) => setOption(option.id, value)} />)}
          </fieldset>
        )}
        <label className="field"><span>{t.inspector.componentNotes}</span><textarea rows={4} maxLength={2000} value={node.data.notes ?? ''} placeholder={t.inspector.componentNotesPlaceholder} onChange={(event) => onNodeChange(node.id, { notes: event.target.value })} /></label>
        <Button variant="danger" block onClick={() => onDelete({ nodeId: node.id })}><Trash2 size={14} />{t.inspector.removeComponent}</Button>
      </div>
    );
  }

  if (node?.type === 'note') {
    return (
      <div className="inspector">
        <div className="inspector-head"><div><strong>{t.inspector.note}</strong><small>{t.inspector.noteHelp}</small></div></div>
        <Button variant="danger" block onClick={() => onDelete({ nodeId: node.id })}><Trash2 size={14} />{t.inspector.removeNote}</Button>
      </div>
    );
  }

  if (edge) {
    const source = nodes.find((item) => item.id === edge.source)?.data.label;
    const target = nodes.find((item) => item.id === edge.target)?.data.label;
    return (
      <div className="inspector">
        <div className="inspector-head"><div><strong>{source} → {target}</strong><small>{t.inspector.edgeHelp(source, target)}</small></div></div>
        <Button block onClick={() => onEdgeChange(edge.id, { reverse: true })}><ArrowLeftRight size={14} />{t.inspector.reverse}</Button>
        <label className="field"><span>{t.inspector.protocol}</span>
          <select value={edge.data?.protocol ?? ''} onChange={(event) => { const picked = protocols.find((item) => item.id === event.target.value); onEdgeChange(edge.id, picked ? { protocol: picked.id, async: Boolean(picked.async) } : { protocol: null }); }}>
            <option value="">{t.inspector.noProtocol}</option>
            {protocols.map((item) => <option key={item.id} value={item.id}>{item.label}{item.async ? ' · async' : ''}</option>)}
          </select>
        </label>
        <label className="field"><span>{t.inspector.label}</span><input maxLength={80} value={typeof edge.label === 'string' ? edge.label : ''} placeholder={t.inspector.labelPlaceholder} onChange={(event) => onEdgeChange(edge.id, { label: event.target.value })} /></label>
        <label className="toggle">
          <input type="checkbox" checked={Boolean(edge.data?.async)} onChange={(event) => onEdgeChange(edge.id, { async: event.target.checked })} />
          <span><strong>{t.inspector.async}</strong><small>{t.inspector.asyncHelp}</small></span>
        </label>
        <Button variant="danger" block onClick={() => onDelete({ edgeId: edge.id })}><Trash2 size={14} />{t.inspector.removeEdge}</Button>
      </div>
    );
  }

  const componentCount = nodes.filter((item) => item.type === 'component').length;
  return (
    <div className="inspector">
      <div className="inspector-empty"><MousePointerClick size={18} /><span>{t.inspector.empty}</span></div>
      {warnings.length > 0 && (
        <div className="design-warnings">
          <span className="panel-label">{t.inspector.warnings}</span>
          {warnings.map((warning) => <p key={warning.id}><TriangleAlert size={14} />{warning.text}</p>)}
        </div>
      )}
      <div className="live-check">
        <div className="live-check-head">
          <ScoreRing score={rubric.score} size={58} />
          <div><strong>{t.inspector.liveCheck}</strong><small>{t.inspector.liveCheckBody(componentCount)}</small></div>
        </div>
        <ul className="rubric-list compact">
          {rubric.checks.map((check) => (
            <li key={check.id} className={check.passed ? 'passed' : 'failed'} title={check.detail}>
              {check.passed ? <CircleCheck size={14} /> : <CircleX size={14} />}
              <div><strong>{check.label}</strong><span>{check.detail}</span></div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function OptionField({ option, value, locale, onChange }: { option: ComponentOption; value: ComponentOptionValue; locale: Locale; onChange: (value: ComponentOptionValue) => void }) {
  if (option.type === 'toggle') {
    return (
      <label className="toggle compact">
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
        <span><strong>{option.label[locale]}</strong>{option.help && <small>{option.help[locale]}</small>}</span>
      </label>
    );
  }
  if (option.type === 'select') {
    return (
      <label className="field"><span>{option.label[locale]}</span>
        <select value={String(value)} onChange={(event) => onChange(event.target.value)}>
          {option.choices?.map((choice) => <option key={choice.value} value={choice.value}>{choice.label[locale]}</option>)}
        </select>
        {option.help && <small className="muted">{option.help[locale]}</small>}
      </label>
    );
  }
  return (
    <label className="field"><span>{option.label[locale]}</span>
      <div className="unit-input">
        <input type="number" min={option.min} max={option.max} step={option.step} value={Number(value)} onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isFinite(parsed)) onChange(Math.min(option.max ?? parsed, Math.max(option.min ?? parsed, parsed)));
        }} />
        {option.unit && <span>{option.unit}</span>}
      </div>
      {option.help && <small className="muted">{option.help[locale]}</small>}
    </label>
  );
}
