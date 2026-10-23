import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position, useInternalNode, type EdgeProps, type InternalNode } from '@xyflow/react';
import { findProtocol } from '@shared/catalog/technologies';
import type { FlowEdge, FlowNode } from './designModel';

/** Shared arrow head; `context-stroke` makes it follow the edge colour (hover, selection, async, chaos). */
export function EdgeMarkers() {
  return (
    <svg className="edge-markers" aria-hidden="true">
      <defs>
        <marker id="archon-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
        </marker>
      </defs>
    </svg>
  );
}

function center(node: InternalNode<FlowNode>) {
  const { x, y } = node.internals.positionAbsolute;
  return { x: x + (node.measured.width ?? 0) / 2, y: y + (node.measured.height ?? 0) / 2 };
}

/**
 * Midpoint of the side of `node` that faces `toward`, pushed `gap` px outwards so arrow heads stop at the border.
 * Comparing the direction against the node's aspect ratio picks the side the straight line would cross.
 */
function anchor(node: InternalNode<FlowNode>, toward: { x: number; y: number }, gap: number) {
  const c = center(node);
  const halfWidth = (node.measured.width ?? 0) / 2;
  const halfHeight = (node.measured.height ?? 0) / 2;
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (Math.abs(dx) * halfHeight >= Math.abs(dy) * halfWidth) {
    const side = dx >= 0 ? 1 : -1;
    return { x: c.x + side * (halfWidth + gap), y: c.y, position: side > 0 ? Position.Right : Position.Left };
  }
  const side = dy >= 0 ? 1 : -1;
  return { x: c.x, y: c.y + side * (halfHeight + gap), position: side > 0 ? Position.Bottom : Position.Top };
}

export function FloatingEdge({ id, source, target, label, data, selected }: EdgeProps<FlowEdge>) {
  const sourceNode = useInternalNode<FlowNode>(source);
  const targetNode = useInternalNode<FlowNode>(target);
  if (!sourceNode || !targetNode) return null;
  const from = anchor(sourceNode, center(targetNode), 0);
  const to = anchor(targetNode, center(sourceNode), 6);
  const [path, labelX, labelY] = getBezierPath({
    sourceX: from.x, sourceY: from.y, sourcePosition: from.position,
    targetX: to.x, targetY: to.y, targetPosition: to.position, curvature: 0.35,
  });
  const text = (typeof label === 'string' && label.trim()) || findProtocol(data?.protocol)?.label;
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd="url(#archon-arrow)" interactionWidth={22} />
      {text && (
        <EdgeLabelRenderer>
          <div className={`edge-label${selected ? ' selected' : ''}${data?.async ? ' async' : ''}`} style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>{text}</div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const edgeTypes = { floating: FloatingEdge };
