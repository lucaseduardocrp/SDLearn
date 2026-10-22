import { ArrowLeftRight, CircleCheck, CircleX, Minus, MousePointerClick, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { componentCategories, componentList, componentSpecs } from '@shared/catalog/components';
import { formatRate } from '@shared/engine/chaos';
import type { ComponentKind, RubricReport } from '../types';
import { ScoreRing } from '../components/ui';
import type { ComponentNodeData, DesignWarning, FlowEdge, FlowNode } from './designModel';
import { kindIcons } from './kindIcons';

interface InspectorProps {
  node?: FlowNode;
  edge?: FlowEdge;
  nodes: FlowNode[];
  rubric: RubricReport;
  warnings: DesignWarning[];
  onNodeChange: (id: string, data: Partial<ComponentNodeData>) => void;
  onEdgeChange: (id: string, patch: { label?: string; async?: boolean; reverse?: boolean }) => void;
  onDelete: (target: { nodeId?: string; edgeId?: string }) => void;
}

export function Inspector({ node, edge, nodes, rubric, warnings, onNodeChange, onEdgeChange, onDelete }: InspectorProps) {
  if (node?.type === 'component') {
    const spec = componentSpecs[node.data.kind];
    const Icon = kindIcons[node.data.kind];
    const capacity = spec.capacityPerReplica * node.data.replicas;
    return (
      <div className="inspector">
        <div className="inspector-head"><span className={`cnode-icon category-${spec.category.toLowerCase()}`}><Icon size={16} /></span><div><strong>{node.data.label || spec.label}</strong><small>{spec.description}</small></div></div>
        <label className="field"><span>Nome</span><input value={node.data.label} maxLength={60} onChange={(event) => onNodeChange(node.id, { label: event.target.value })} /></label>
        <label className="field"><span>Tipo</span>
          <select value={node.data.kind} onChange={(event) => onNodeChange(node.id, { kind: event.target.value as ComponentKind })}>
            {componentCategories.map((category) => (
              <optgroup key={category} label={category}>
                {componentList.filter((item) => item.category === category).map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {!spec.entry && (
          <div className="field"><span>Réplicas / instâncias</span>
            <div className="stepper">
              <button aria-label="Menos réplicas" onClick={() => onNodeChange(node.id, { replicas: Math.max(1, node.data.replicas - 1) })} disabled={node.data.replicas <= 1}><Minus size={14} /></button>
              <input type="number" min={1} max={100} value={node.data.replicas} onChange={(event) => onNodeChange(node.id, { replicas: Math.min(100, Math.max(1, Math.round(Number(event.target.value)) || 1)) })} aria-label="Réplicas" />
              <button aria-label="Mais réplicas" onClick={() => onNodeChange(node.id, { replicas: Math.min(100, node.data.replicas + 1) })} disabled={node.data.replicas >= 100}><Plus size={14} /></button>
            </div>
            <small className="muted">Capacidade modelada: {formatRate(capacity)} req/s · +{spec.latencyMs} ms por hop{spec.soft ? ' · dependência soft' : ''}{spec.buffers ? ' · absorve picos' : ''}</small>
          </div>
        )}
        <label className="field"><span>Notas do componente</span><textarea rows={4} maxLength={2000} value={node.data.notes ?? ''} placeholder="Tecnologia, particionamento, TTL, consistência…" onChange={(event) => onNodeChange(node.id, { notes: event.target.value })} /></label>
        <button className="btn btn-danger btn-block" onClick={() => onDelete({ nodeId: node.id })}><Trash2 size={14} />Remover componente</button>
      </div>
    );
  }

  if (node?.type === 'note') {
    return (
      <div className="inspector">
        <div className="inspector-head"><div><strong>Nota</strong><small>Edite o texto diretamente no canvas. Notas entram na avaliação dos juízes.</small></div></div>
        <button className="btn btn-danger btn-block" onClick={() => onDelete({ nodeId: node.id })}><Trash2 size={14} />Remover nota</button>
      </div>
    );
  }

  if (edge) {
    const source = nodes.find((item) => item.id === edge.source)?.data.label;
    const target = nodes.find((item) => item.id === edge.target)?.data.label;
    return (
      <div className="inspector">
        <div className="inspector-head"><div><strong>{source} → {target}</strong><small><b>{source}</b> chama <b>{target}</b>. A seta aponta para quem recebe a chamada.</small></div></div>
        <button className="btn btn-ghost btn-block" onClick={() => onEdgeChange(edge.id, { reverse: true })}><ArrowLeftRight size={14} />Inverter direção</button>
        <label className="field"><span>Rótulo</span><input maxLength={80} value={typeof edge.label === 'string' ? edge.label : ''} placeholder="ex.: HTTP, gRPC, publish, CDC" onChange={(event) => onEdgeChange(edge.id, { label: event.target.value })} /></label>
        <label className="toggle">
          <input type="checkbox" checked={Boolean(edge.data?.async)} onChange={(event) => onEdgeChange(edge.id, { async: event.target.checked })} />
          <span><strong>Assíncrona</strong><small>Não bloqueia o chamador: fora do caminho de latência e falhas do destino só degradam a origem.</small></span>
        </label>
        <button className="btn btn-danger btn-block" onClick={() => onDelete({ edgeId: edge.id })}><Trash2 size={14} />Remover conexão</button>
      </div>
    );
  }

  const componentCount = nodes.filter((item) => item.type === 'component').length;
  return (
    <div className="inspector">
      <div className="inspector-empty"><MousePointerClick size={18} /><span>Selecione um componente ou conexão para editar. <kbd>Del</kbd> remove a seleção.</span></div>
      {warnings.length > 0 && (
        <div className="design-warnings">
          <span className="panel-label">Atenção ao desenho</span>
          {warnings.map((warning) => <p key={warning.id}><TriangleAlert size={14} />{warning.text}</p>)}
        </div>
      )}
      <div className="live-check">
        <div className="live-check-head">
          <ScoreRing score={rubric.score} size={58} />
          <div><strong>Pré-check ao vivo</strong><small>{componentCount} componentes · atualiza enquanto você desenha</small></div>
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
