import { createContext, useContext } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { componentSpecs } from '@shared/catalog/components';
import { formatRate } from '@shared/engine/chaos';
import type { ChaosResult, NodeReport } from '../types';
import type { ComponentFlowNode, NoteFlowNode } from './designModel';
import { kindIcons } from './kindIcons';

export const ChaosOverlayContext = createContext<ChaosResult | null>(null);

const healthLabel: Record<NodeReport['health'], string> = { healthy: 'OK', degraded: 'Degradado', failing: 'Falhando', down: 'Fora do ar', unreachable: 'Inacessível' };

export function ComponentNode({ id, data, selected }: NodeProps<ComponentFlowNode>) {
  const overlay = useContext(ChaosOverlayContext);
  const report = overlay?.nodes.find((item) => item.id === id);
  const spec = componentSpecs[data.kind];
  const Icon = kindIcons[data.kind];
  const utilization = report && report.capacity > 0 ? report.load / report.capacity : 0;
  const isTarget = overlay?.targetId === id;
  return (
    <div className={`cnode category-${spec.category.toLowerCase()}${selected ? ' selected' : ''}${report ? ` health-${report.health}` : ''}${isTarget ? ' chaos-target' : ''}`} title={report?.reasons.join('\n')}>
      <Handle type="target" position={Position.Left} />
      <span className="cnode-icon"><Icon size={16} /></span>
      <span className="cnode-text">
        <span className="cnode-label">{data.label || spec.label}</span>
        <span className="cnode-kind">{spec.label}{data.replicas > 1 ? ` · ×${data.replicas}` : ''}</span>
      </span>
      {report && (
        <span className="cnode-health">
          <b>{healthLabel[report.health]}</b>
          {report.capacity > 0 && <span className="cnode-load" title={`${formatRate(report.load)} / ${formatRate(report.capacity)} req/s`}><i style={{ width: `${Math.min(100, utilization * 100)}%` }} /></span>}
        </span>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function NoteNode({ id, data, selected }: NodeProps<NoteFlowNode>) {
  const { updateNodeData } = useReactFlow();
  return (
    <div className={`note-node${selected ? ' selected' : ''}`}>
      <span className="note-grip">NOTA</span>
      <textarea
        className="nodrag nowheel"
        value={data.label}
        placeholder="Anote uma decisão, um trade-off ou uma premissa…"
        onChange={(event) => updateNodeData(id, { label: event.target.value })}
        rows={4}
        maxLength={2000}
        aria-label="Texto da nota"
      />
    </div>
  );
}

export const nodeTypes = { component: ComponentNode, note: NoteNode };
