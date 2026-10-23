import { createContext, useContext } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { componentSpecs } from '@shared/catalog/components';
import { findTechnology } from '@shared/catalog/technologies';
import { formatRate } from '@shared/engine/chaos';
import type { ChaosResult } from '../types';
import { useI18n } from '../i18n';
import type { ComponentFlowNode, NoteFlowNode } from './designModel';
import { kindIcons } from './kindIcons';

export const ChaosOverlayContext = createContext<ChaosResult | null>(null);

/** Instances drawn inside a replica group; larger groups end with a "+N" chip. */
const VISIBLE_REPLICAS = 6;

/** How many instances of this component the current chaos run took down. */
function lostInstances(overlay: ChaosResult | null, id: string, replicas: number): number {
  if (!overlay || overlay.targetId !== id) return 0;
  if (overlay.scenarioId === 'node-failure') return replicas;
  if (overlay.scenarioId === 'replica-loss' || overlay.scenarioId === 'chaos-monkey') return Math.min(replicas, overlay.magnitude ?? 1);
  return 0;
}

export function ComponentNode({ id, data, selected }: NodeProps<ComponentFlowNode>) {
  const { t } = useI18n();
  const overlay = useContext(ChaosOverlayContext);
  const report = overlay?.nodes.find((item) => item.id === id);
  const spec = componentSpecs[data.kind];
  const technology = findTechnology(data.tech);
  const Icon = kindIcons[data.kind];
  const utilization = report && report.capacity > 0 ? report.load / report.capacity : 0;
  const isTarget = overlay?.targetId === id;
  const grouped = data.replicas > 1;
  const lost = lostInstances(overlay, id, data.replicas);
  const className = `cnode${grouped ? ' cnode-group' : ''} category-${spec.category.toLowerCase()}${selected ? ' selected' : ''}${report ? ` health-${report.health}` : ''}${isTarget ? ' chaos-target' : ''}`;
  const head = (
    <>
      <span className="cnode-icon"><Icon size={16} /></span>
      <span className="cnode-text">
        <span className="cnode-label">{data.label || spec.label}</span>
        <span className="cnode-kind">{technology?.label ?? spec.label}</span>
      </span>
    </>
  );
  return (
    <div className={className} title={report?.reasons.join('\n')}>
      <Handle type="target" position={Position.Left} />
      {grouped ? (
        <>
          <div className="cnode-head">{head}<span className="replica-count" title={t.canvas.replicaGroup(data.replicas)}>×{data.replicas}</span></div>
          <div className="replica-stack" aria-label={t.canvas.replicaGroup(data.replicas)}>
            {Array.from({ length: Math.min(data.replicas, VISIBLE_REPLICAS) }, (_, index) => (
              <span key={index} className={`replica${index < lost ? ' down' : ''}`} title={index < lost ? t.canvas.replicaDown : undefined}>
                <Icon size={11} />{index + 1}
              </span>
            ))}
            {data.replicas > VISIBLE_REPLICAS && <span className="replica more">+{data.replicas - VISIBLE_REPLICAS}</span>}
          </div>
        </>
      ) : head}
      {report && (
        <span className="cnode-health">
          <b>{t.canvas.health[report.health]}</b>
          {report.capacity > 0 && <span className="cnode-load" title={`${formatRate(report.load)} / ${formatRate(report.capacity)} req/s`}><i style={{ width: `${Math.min(100, utilization * 100)}%` }} /></span>}
        </span>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function NoteNode({ id, data, selected }: NodeProps<NoteFlowNode>) {
  const { t } = useI18n();
  const { updateNodeData } = useReactFlow();
  return (
    <div className={`note-node${selected ? ' selected' : ''}`}>
      <span className="note-grip">{t.canvas.noteGrip}</span>
      <textarea
        className="nodrag nowheel"
        value={data.label}
        placeholder={t.canvas.notePlaceholder}
        onChange={(event) => updateNodeData(id, { label: event.target.value })}
        rows={4}
        maxLength={2000}
        aria-label={t.canvas.noteLabel}
      />
    </div>
  );
}

export const nodeTypes = { component: ComponentNode, note: NoteNode };
