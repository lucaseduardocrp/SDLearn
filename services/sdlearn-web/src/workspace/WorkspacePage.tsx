import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addEdge, applyEdgeChanges, applyNodeChanges, ReactFlowProvider, useReactFlow,
  type Connection, type EdgeChange, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Bomb, Check, CloudOff, FileCode2, Gavel, LayoutGrid, Lightbulb, LoaderCircle, PanelLeft, SlidersHorizontal, Timer } from 'lucide-react';
import { simulateChaos } from '@shared/engine/chaos';
import { designToMermaid, layeredLayout, mermaidToDesign } from '@shared/engine/graph';
import { analyzeDesign } from '@shared/engine/rubric';
import { api } from '../api';
import { Button, DifficultyBadge, ErrorState, PageLoading } from '../components/ui';
import { useI18n } from '../i18n';
import { formatDuration, formatNumber, padNumber } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import type { ChaosRequest, ChaosResult, ChaosRun, ComponentKind, Design, Evaluation, PracticeSession, ProblemDetail } from '../types';
import { CanvasEditor } from './CanvasEditor';
import { ChaosPanel } from './ChaosPanel';
import { decorateEdge, designWarnings, fromFlow, newComponentNode, newNoteNode, toFlow, type ComponentNodeData, type FlowEdge, type FlowNode } from './designModel';
import { Inspector } from './Inspector';
import { JudgesPanel } from './JudgesPanel';
import { MermaidPanel } from './MermaidPanel';

interface WorkspaceData { session: PracticeSession; problem: ProblemDetail; runs: ChaosRun[]; evaluations: Evaluation[]; aiAvailable: boolean }

export function WorkspacePage() {
  const { t } = useI18n();
  const { sessionId = '' } = useParams();
  const loaded = useAsync<WorkspaceData>(async () => {
    const session = await api.getSession(sessionId);
    const [problem, runs, evaluations, health] = await Promise.all([
      api.getProblem(session.problemId), api.listChaosRuns(sessionId), api.listEvaluations(sessionId), api.getHealth().catch(() => null),
    ]);
    return { session, problem, runs, evaluations: evaluations.items, aiAvailable: Boolean(health?.judgeProvider) };
  }, [sessionId]);

  if (loaded.loading) return <PageLoading />;
  if (loaded.error || !loaded.data) return <div className="container page"><ErrorState message={loaded.error ?? t.workspace.sessionNotFound} onRetry={loaded.reload} /></div>;
  return <ReactFlowProvider><Workspace key={sessionId} initial={loaded.data} /></ReactFlowProvider>;
}

type SelectionState = { nodeId?: string; edgeId?: string };

function Workspace({ initial }: { initial: WorkspaceData }) {
  const { session, problem } = initial;
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { fitView } = useReactFlow();
  const initialFlow = useMemo(() => toFlow(session.design), [session.design]);
  const [nodes, setNodes] = useState<FlowNode[]>(initialFlow.nodes);
  const [edges, setEdges] = useState<FlowEdge[]>(initialFlow.edges);
  const [notes, setNotes] = useState(session.design.notes);
  const [mermaid, setMermaid] = useState(session.design.mermaid);
  const [mermaidWarnings, setMermaidWarnings] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [savedRevision, setSavedRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionState>({});
  const [overlay, setOverlay] = useState<ChaosResult | null>(null);
  const [runs, setRuns] = useState(initial.runs);
  const [chaosRunning, setChaosRunning] = useState(false);
  const [chaosError, setChaosError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [centerTab, setCenterTab] = useState<'canvas' | 'mermaid'>('canvas');
  const [rightTab, setRightTab] = useState<'inspect' | 'chaos' | 'judges'>('inspect');
  const [leftTab, setLeftTab] = useState<'brief' | 'notes'>('brief');
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth > 1100);

  const latest = useRef({ nodes, edges, notes, mermaid, revision });
  latest.current = { nodes, edges, notes, mermaid, revision };
  const saveChain = useRef<Promise<void>>(Promise.resolve());

  const currentDesign = useCallback((): Design => {
    const snapshot = latest.current;
    return { ...fromFlow(snapshot.nodes, snapshot.edges), notes: snapshot.notes, mermaid: snapshot.mermaid };
  }, []);

  const touch = useCallback(() => {
    setRevision((value) => value + 1);
    setOverlay(null);
  }, []);

  // Saves are chained so an older snapshot can never overwrite a newer one on the server.
  const save = useCallback(() => {
    saveChain.current = saveChain.current.then(async () => {
      const target = latest.current.revision;
      setSaving(true);
      try {
        await api.saveDesign(session.id, currentDesign());
        setSavedRevision((value) => Math.max(value, target));
        setSaveError(null);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : t.workspace.saveFailed);
      } finally {
        setSaving(false);
      }
    });
    return saveChain.current;
  }, [currentDesign, session.id, t]);

  const dirty = revision !== savedRevision;
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => void save(), 1000);
    return () => window.clearTimeout(timer);
  }, [dirty, revision, save]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const flush = useCallback(async () => {
    if (latest.current.revision !== savedRevision) await save();
    else await saveChain.current;
  }, [save, savedRevision]);

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
    if (changes.some((change) => change.type !== 'select' && change.type !== 'dimensions')) touch();
  }, [touch]);

  const onEdgesChange = useCallback((changes: EdgeChange<FlowEdge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
    if (changes.some((change) => change.type !== 'select')) touch();
  }, [touch]);

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source === connection.target) return;
    setEdges((current) => addEdge(decorateEdge({ ...connection, id: `e-${crypto.randomUUID().slice(0, 8)}`, data: {} }), current));
    touch();
  }, [touch]);

  const onAdd = useCallback((kind: ComponentKind | 'note', position: { x: number; y: number }) => {
    setNodes((current) => [...current.map((node) => node.selected ? { ...node, selected: false } : node), kind === 'note' ? newNoteNode(position) : newComponentNode(kind, position, current)]);
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    if (kind !== 'note') setRightTab((tab) => tab === 'judges' ? 'inspect' : tab);
    touch();
  }, [touch]);

  const onNodeChange = useCallback((id: string, patch: Partial<ComponentNodeData>) => {
    setNodes((current) => current.map((node) => node.id === id && node.type === 'component' ? { ...node, data: { ...node.data, ...patch } } : node));
    touch();
  }, [touch]);

  const onEdgeChange = useCallback((id: string, patch: { label?: string; async?: boolean; reverse?: boolean }) => {
    setEdges((current) => current.map((edge) => {
      if (edge.id !== id) return edge;
      const next = decorateEdge({ ...edge, label: patch.label ?? edge.label, data: { ...edge.data, async: patch.async ?? edge.data?.async } });
      return patch.reverse ? { ...next, source: edge.target, target: edge.source, sourceHandle: undefined, targetHandle: undefined } : next;
    }));
    touch();
  }, [touch]);

  const onLayout = useCallback(() => {
    setNodes((current) => {
      const components = current.filter((node) => node.type === 'component');
      const positions = layeredLayout(components.map((node) => node.id), latest.current.edges);
      const notes = current.filter((node) => node.type === 'note');
      const bottom = Math.max(0, ...[...positions.values()].map((position) => position.y)) + 160;
      return current.map((node) => node.type === 'component'
        ? { ...node, position: positions.get(node.id) ?? node.position }
        : { ...node, position: { x: notes.indexOf(node) * 240, y: bottom } });
    });
    touch();
    window.setTimeout(() => void fitView({ padding: 0.25, minZoom: 0.65, maxZoom: 1.15, duration: 300 }), 50);
  }, [fitView, touch]);

  const onDelete = useCallback(({ nodeId, edgeId }: SelectionState) => {
    if (nodeId) {
      setNodes((current) => current.filter((node) => node.id !== nodeId));
      setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    }
    if (edgeId) setEdges((current) => current.filter((edge) => edge.id !== edgeId));
    setSelection({});
    touch();
  }, [touch]);

  const selectedNode = nodes.find((node) => node.id === selection.nodeId);
  const selectedEdge = edges.find((edge) => edge.id === selection.edgeId);
  const labelOf = (id: string) => nodes.find((node) => node.id === id)?.data.label ?? id;
  const selectionLabel = selectedNode ? selectedNode.data.label || t.workspace.note : selectedEdge ? `${labelOf(selectedEdge.source)} → ${labelOf(selectedEdge.target)}` : undefined;

  const warnings = useMemo(() => designWarnings(nodes, edges, t.workspace.warnings), [nodes, edges, t]);
  const designForAnalysis = useMemo(() => ({ ...fromFlow(nodes, edges), notes, mermaid }), [nodes, edges, notes, mermaid]);
  const deferredDesign = useDeferredValue(designForAnalysis);
  const rubric = useMemo(() => analyzeDesign(deferredDesign, problem, locale).rubric, [deferredDesign, problem, locale]);

  async function runChaos(request: ChaosRequest) {
    setChaosError(null);
    try {
      setOverlay(simulateChaos(currentDesign(), problem, request, { locale }));
    } catch (error) {
      setChaosError(error instanceof Error ? error.message : t.workspace.simulateFailed);
      return;
    }
    setChaosRunning(true);
    try {
      await flush();
      const run = await api.runChaos(session.id, request);
      setRuns((current) => [run, ...current]);
    } catch (error) {
      setChaosError(t.workspace.notRecorded(error instanceof Error ? error.message : t.common.unknownError));
    } finally {
      setChaosRunning(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await flush();
      if (saveError) throw new Error(t.workspace.notSaved);
      const evaluation = await api.requestEvaluation(session.id);
      navigate(`/evaluations/${evaluation.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t.workspace.submitFailed);
      setSubmitting(false);
    }
  }

  function openMermaid() {
    if (!mermaid.trim()) { setMermaid(designToMermaid(currentDesign(), locale)); touch(); }
    setCenterTab('mermaid');
  }

  function applyMermaid() {
    const componentCount = nodes.filter((node) => node.type === 'component').length;
    if (componentCount > 1 && !window.confirm(t.workspace.confirmApplyMermaid)) return;
    const imported = mermaidToDesign(mermaid, locale);
    const flow = toFlow(imported);
    setNodes((current) => [...current.filter((node) => node.type === 'note'), ...flow.nodes]);
    setEdges(flow.edges);
    setMermaidWarnings(imported.warnings);
    setSelection({});
    touch();
    setCenterTab('canvas');
    window.setTimeout(() => void fitView({ padding: 0.25, minZoom: 0.65, maxZoom: 1.15, duration: 300 }), 60);
  }

  const componentCount = nodes.filter((node) => node.type === 'component').length;
  const noteLength = notes.trim().length + nodes.filter((node) => node.type === 'note').reduce((sum, node) => sum + node.data.label.length, 0);

  return (
    <div className="workspace">
      <div className="workspace-bar">
        <div className="workspace-title">
          <Link to={`/problems/${problem.id}`} className="icon-btn" aria-label={t.workspace.backToProblem} title={t.workspace.backToProblem}><ArrowLeft size={16} /></Link>
          <button className={`icon-btn${leftOpen ? ' active' : ''}`} onClick={() => setLeftOpen((value) => !value)} aria-label={t.workspace.showBrief} title={t.workspace.briefAndNotes}><PanelLeft size={16} /></button>
          <span className="mono-dim">{padNumber(problem.number)}</span>
          <strong>{problem.title}</strong>
          <DifficultyBadge difficulty={problem.difficulty} />
        </div>
        <div className="segmented" role="tablist" aria-label={t.workspace.editor}>
          <button role="tab" aria-selected={centerTab === 'canvas'} className={centerTab === 'canvas' ? 'active' : ''} onClick={() => setCenterTab('canvas')}><LayoutGrid size={14} />Canvas</button>
          <button role="tab" aria-selected={centerTab === 'mermaid'} className={centerTab === 'mermaid' ? 'active' : ''} onClick={openMermaid}><FileCode2 size={14} />Mermaid</button>
        </div>
        <div className="workspace-actions">
          <SessionTimer createdAt={session.createdAt} estimatedMinutes={problem.estimatedMinutes} />
          <SaveIndicator dirty={dirty} saving={saving} error={saveError} onRetry={() => void save()} />
          <Button variant="chaos" size="sm" onClick={() => setRightTab('chaos')}><Bomb size={14} />{t.workspace.chaos}</Button>
          <Button variant="primary" size="sm" onClick={() => setRightTab('judges')}><Gavel size={14} />{t.workspace.submit}</Button>
        </div>
      </div>

      <div className={`workspace-body${leftOpen ? '' : ' left-closed'}`}>
        {leftOpen && (
          <aside className="side-panel left-panel">
            <div className="side-tabs" role="tablist">
              <button role="tab" aria-selected={leftTab === 'brief'} className={leftTab === 'brief' ? 'active' : ''} onClick={() => setLeftTab('brief')}>{t.workspace.tabProblem}</button>
              <button role="tab" aria-selected={leftTab === 'notes'} className={leftTab === 'notes' ? 'active' : ''} onClick={() => setLeftTab('notes')}>{t.workspace.tabNotes}{noteLength ? <span className="tab-count">{noteLength}</span> : null}</button>
            </div>
            <div className="side-scroll">
              {leftTab === 'brief' ? <Brief problem={problem} /> : (
                <div className="notes-editor">
                  <p className="muted small">{t.workspace.notesHelp}</p>
                  <textarea
                    value={notes} maxLength={20000} onChange={(event) => { setNotes(event.target.value); touch(); }}
                    placeholder={t.workspace.notesPlaceholder}
                    aria-label={t.workspace.notesLabel}
                  />
                </div>
              )}
            </div>
          </aside>
        )}

        <main className="workspace-center">
          {centerTab === 'canvas' ? (
            <CanvasEditor nodes={nodes} edges={edges} overlay={overlay} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onAdd={onAdd} onSelectionChange={setSelection} onLayout={onLayout} />
          ) : (
            <MermaidPanel
              source={mermaid}
              onChange={(value) => { setMermaid(value); touch(); }}
              onGenerateFromCanvas={() => { setMermaid(designToMermaid(currentDesign(), locale)); setMermaidWarnings([]); touch(); }}
              onApplyToCanvas={applyMermaid}
              warnings={mermaidWarnings}
            />
          )}
        </main>

        <aside className="side-panel right-panel">
          <div className="side-tabs" role="tablist">
            <button role="tab" aria-selected={rightTab === 'inspect'} className={rightTab === 'inspect' ? 'active' : ''} onClick={() => setRightTab('inspect')}><SlidersHorizontal size={13} />{t.workspace.tabInspector}</button>
            <button role="tab" aria-selected={rightTab === 'chaos'} className={rightTab === 'chaos' ? 'active' : ''} onClick={() => setRightTab('chaos')}><Bomb size={13} />{t.workspace.chaos}</button>
            <button role="tab" aria-selected={rightTab === 'judges'} className={rightTab === 'judges' ? 'active' : ''} onClick={() => setRightTab('judges')}><Gavel size={13} />{t.workspace.tabJudges}</button>
          </div>
          <div className="side-scroll">
            {rightTab === 'inspect' && <Inspector node={selectedNode} edge={selectedEdge} nodes={nodes} rubric={rubric} warnings={warnings} onNodeChange={onNodeChange} onEdgeChange={onEdgeChange} onDelete={onDelete} />}
            {rightTab === 'chaos' && (
              <ChaosPanel
                selection={{ ...selection, label: selectionLabel }} result={overlay} runs={runs} running={chaosRunning} error={chaosError}
                onRun={(request) => { setCenterTab('canvas'); void runChaos(request); }} onClear={() => setOverlay(null)}
                onShowRun={(run) => { setCenterTab('canvas'); setOverlay(run.result); }}
              />
            )}
            {rightTab === 'judges' && (
              <JudgesPanel
                evaluations={initial.evaluations} componentCount={componentCount} notesLength={noteLength} chaosRunCount={runs.length}
                submitting={submitting} error={submitError} aiAvailable={initial.aiAvailable} onSubmit={() => void submit()}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Brief({ problem }: { problem: ProblemDetail }) {
  const { t } = useI18n();
  const [showHints, setShowHints] = useState(false);
  return (
    <div className="brief">
      <p className="body-text small">{problem.statement}</p>
      <h4>{t.workspace.functional}</h4>
      <ul className="check-list compact">{problem.functionalRequirements.map((text) => <li key={text}>{text}</li>)}</ul>
      <h4>{t.workspace.nonFunctional}</h4>
      <ul className="check-list compact">{problem.nonFunctionalRequirements.map((text) => <li key={text}>{text}</li>)}</ul>
      <h4>{t.workspace.scale}</h4>
      <div className="scale-grid compact">
        {problem.scale.map((entry) => <div key={entry.label} className="scale-item"><span>{entry.label}</span><strong>{entry.value}</strong></div>)}
      </div>
      <p className="muted small">{t.workspace.chaosProfile(formatNumber(problem.peakRps), problem.latencyBudgetMs)}</p>
      <button className="hint-toggle" onClick={() => setShowHints((value) => !value)} aria-expanded={showHints}><Lightbulb size={14} />{showHints ? t.common.hideHints : t.common.showHints}</button>
      {showHints && <ol className="hint-list">{problem.hints.map((hint) => <li key={hint}>{hint}</li>)}</ol>}
    </div>
  );
}

function SessionTimer({ createdAt, estimatedMinutes }: { createdAt: string; estimatedMinutes: number }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const elapsed = Math.max(0, (now - Date.parse(createdAt)) / 1000);
  const over = elapsed > estimatedMinutes * 60;
  return (
    <span className={`timer${over ? ' over' : ''}`} title={t.workspace.timerTitle(estimatedMinutes)}>
      <Timer size={13} />{elapsed > 86_400 ? t.time.overADay : formatDuration(elapsed)}<small>/ {estimatedMinutes}:00</small>
    </span>
  );
}

function SaveIndicator({ dirty, saving, error, onRetry }: { dirty: boolean; saving: boolean; error: string | null; onRetry: () => void }) {
  const { t } = useI18n();
  if (error) return <button className="save-state error" onClick={onRetry} title={error}><CloudOff size={13} />{t.workspace.notSavedRetry}</button>;
  if (saving || dirty) return <span className="save-state"><LoaderCircle size={13} className="spin" />{t.workspace.saving}</span>;
  return <span className="save-state saved"><Check size={13} />{t.workspace.savedState}</span>;
}
