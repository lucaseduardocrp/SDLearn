import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  Avatar,
  Badge,
  Body1,
  Button,
  Card,
  CardHeader,
  Caption1,
  createDarkTheme,
  createLightTheme,
  Divider,
  FluentProvider,
  Input,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Skeleton,
  SkeletonItem,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Title1,
  Title2,
  Toolbar,
} from '@fluentui/react-components';
import {
  AddRegular,
  ArrowRightRegular,
  BookOpenRegular,
  ChartMultipleRegular,
  CheckmarkCircleRegular,
  DocumentRegular,
  GridRegular,
  HomeRegular,
  SearchRegular,
  SettingsRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
} from '@fluentui/react-icons';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';
import { getPreviewDataState, setPreviewDataState, subscribePreviewState, type PreviewDataState } from './api/previewState';
import type { ArchitectureModel, ChaosRun, ChaosScenario, Evaluation, PracticeSession, Problem, Requirement } from './types';

const brandRamp = {
  10: '#0D061A', 20: '#1C0C33', 30: '#2D104D', 40: '#3E1668',
  50: '#501E83', 60: '#62279F', 70: '#7432BA', 80: '#8540D0',
  90: '#9654E1', 100: '#A86DF0', 110: '#BA89F7', 120: '#CCA6FB',
  130: '#DCC2FD', 140: '#E9D8FE', 150: '#F3EBFF', 160: '#FBF8FF',
};
const lightTheme = createLightTheme(brandRamp);
const darkTheme = createDarkTheme(brandRamp);

type WorkbenchData = {
  problems: Problem[];
  sessions: PracticeSession[];
  requirements: Requirement[];
  architecture: ArchitectureModel | null;
  scenarios: ChaosScenario[];
  chaosRuns: ChaosRun[];
  evaluations: Evaluation[];
};

const emptyData: WorkbenchData = { problems: [], sessions: [], requirements: [], architecture: null, scenarios: [], chaosRuns: [], evaluations: [] };
const navigation = [
  { label: 'Overview', to: '/', icon: <HomeRegular /> },
  { label: 'Problem library', to: '/problems', icon: <BookOpenRegular /> },
  { label: 'Practice session', to: '/sessions/session-url', icon: <DocumentRegular /> },
  { label: 'Architecture studio', to: '/sessions/session-url/architecture', icon: <GridRegular /> },
  { label: 'Chaos lab', to: '/chaos', icon: <SettingsRegular /> },
  { label: 'Evaluations', to: '/evaluations', icon: <ChartMultipleRegular /> },
];
const stateOptions: PreviewDataState[] = ['data', 'loading', 'empty', 'error'];

function routeIsActive(pathname: string, route: string): boolean {
  return route === '/' ? pathname === '/' : pathname.startsWith(route);
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const previewState = useSyncExternalStore(subscribePreviewState, getPreviewDataState);
  const [data, setData] = useState<WorkbenchData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState('');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => window.localStorage.getItem('app-theme') === 'dark' ? 'dark' : 'light');
  const isArchitecture = location.pathname.endsWith('/architecture');
  const isPractice = location.pathname.startsWith('/sessions/') && !isArchitecture;
  const currentSessionId = location.pathname.split('/')[2] || 'session-url';
  const session = data.sessions.find((item) => item.id === currentSessionId) ?? data.sessions[0];
  const pageTitle = isArchitecture ? 'Architecture studio' : isPractice ? 'Practice session' : navigation.find((item) => routeIsActive(location.pathname, item.to))?.label ?? 'Overview';

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      api.listProblems(), api.listSessions(), api.getSession('session-url'), api.getArchitecture('session-url'),
      api.listChaosScenarios(), api.listRecentChaosRuns(), api.listEvaluations(),
    ]).then(([problemResult, sessionResult, sessionDetail, architectureResult, scenarioResult, runResult, evaluationResult]) => {
      if (!alive) return;
      setData({
        problems: problemResult.items,
        sessions: sessionResult.items,
        requirements: sessionDetail.requirements,
        architecture: architectureResult.architecture,
        scenarios: scenarioResult.items,
        chaosRuns: runResult.items,
        evaluations: evaluationResult.items,
      });
      setLoading(false);
    }).catch((loadError: unknown) => {
      if (!alive) return;
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the workbench.');
      setLoading(false);
    });
    return () => { alive = false; };
  }, [previewState, refreshKey]);

  useEffect(() => { window.localStorage.setItem('app-theme', themeMode); }, [themeMode]);

  async function startPractice(problemId: string): Promise<void> {
    try {
      const result = await api.createSession({ problemId });
      if (result.session) navigate(`/sessions/${result.session.id}`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not start this practice session.');
    }
  }

  async function saveNotes(): Promise<void> {
    if (!session) return;
    try {
      await api.updateSession(session.id, { notes: 'Compare regional routing with global hashing.', decisions: ['Use stable short-code hashing'] });
      setRefreshKey((value) => value + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not save session notes.');
    }
  }

  async function startChaosRun(scenarioId: string): Promise<void> {
    if (!session) return;
    try {
      await api.startChaosRun(session.id, { scenarioId, parameters: { durationSeconds: 90 } });
      setRefreshKey((value) => value + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not start the simulation.');
    }
  }

  async function requestReview(): Promise<void> {
    if (!session) return;
    try {
      await api.requestEvaluation(session.id, { submission: 'Architecture notes and tradeoffs are ready for review.' });
      navigate('/evaluations');
      setRefreshKey((value) => value + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not request an evaluation.');
    }
  }

  async function saveDiagram(): Promise<void> {
    if (!data.architecture) return;
    try {
      await api.saveArchitecture(currentSessionId, { diagram: data.architecture.components, mermaid: data.architecture.mermaid });
      setError(null);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not save the architecture.');
    }
  }

  const filteredProblems = data.problems.filter((problem) => `${problem.name} ${problem.domain}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <FluentProvider theme={themeMode === 'dark' ? darkTheme : lightTheme} className={`app-provider ${themeMode}`}>
      <div className="workbench">
        <aside className="sidebar">
          <NavLink to="/" className="brand-lockup" aria-label="SDLearn overview">
            <span className="brand-mark">S</span><span><strong>SDLearn</strong><small>DESIGN PRACTICE</small></span>
          </NavLink>
          <Caption1 className="nav-label">WORKSPACE</Caption1>
          <nav className="side-nav" aria-label="Main navigation">
            {navigation.map((item) => <NavLink key={item.to} to={item.to} className={`nav-link${routeIsActive(location.pathname, item.to) ? ' active' : ''}`}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
            </NavLink>)}
          </nav>
          <div className="sidebar-bottom">
            <div className="availability"><span className="signal-dot" /><div><strong>All features unlocked</strong><small>No practice limits</small></div></div>
            <Divider />
            <div className="profile-row"><Avatar name="Alex Morgan" size={32} color="brand" /><span><strong>Alex Morgan</strong><small>Independent learner</small></span></div>
          </div>
        </aside>

        <main className="main-column">
          <header className="topbar">
            <div className="breadcrumb"><span>Workbench</span><span className="crumb-slash">/</span><strong>{pageTitle}</strong></div>
            <Toolbar className="top-actions">
              <Button appearance="subtle" icon={themeMode === 'dark' ? <WeatherSunnyRegular /> : <WeatherMoonRegular />} aria-label="Toggle color theme" title="Toggle color theme" onClick={() => setThemeMode((value) => value === 'dark' ? 'light' : 'dark')} />
              <Button appearance="subtle" icon={<SettingsRegular />} aria-label="Settings" title="Settings" />
            </Toolbar>
          </header>

          <div className="page-content">
            {error && <MessageBar intent="error" className="error-banner"><MessageBarBody><MessageBarTitle>Something went wrong</MessageBarTitle>{error}</MessageBarBody><Button appearance="subtle" onClick={() => setRefreshKey((value) => value + 1)}>Retry</Button></MessageBar>}
            {loading ? <LoadingSurface /> : location.pathname === '/problems' ? <>
              <PageHeading eyebrow="PRACTICE LIBRARY" title="Choose a system to design" subtitle="A growing catalog of real-world architecture challenges. Every problem is ready when you are." />
              <div className="toolbar-row"><Input contentBefore={<SearchRegular />} placeholder="Search problems or domains" value={query} onChange={(_, value) => setQuery(value.value)} /><Badge appearance="outline">{filteredProblems.length} problems</Badge></div>
              {filteredProblems.length === 0 ? <EmptyState title="No problems match that search" body="Try a broader system name or domain." action="Clear search" onAction={() => setQuery('')} /> : <Table className="problem-table" aria-label="Problem library"><TableHeader><TableRow><TableHeaderCell>PROBLEM</TableHeaderCell><TableHeaderCell>DOMAIN</TableHeaderCell><TableHeaderCell>LEVEL</TableHeaderCell><TableHeaderCell>TIME</TableHeaderCell><TableHeaderCell /></TableRow></TableHeader><TableBody>{filteredProblems.map((problem) => <TableRow key={problem.id}><TableCell><div className="problem-name"><span className="table-icon"><DocumentRegular /></span><span><strong>{problem.name}</strong><small>{problem.summary}</small></span></div></TableCell><TableCell>{problem.domain}</TableCell><TableCell><Badge appearance="tint" color={problem.difficulty === 'Advanced' ? 'danger' : 'informative'}>{problem.difficulty}</Badge></TableCell><TableCell>{problem.estimatedMinutes} min</TableCell><TableCell><Button appearance="subtle" icon={<ArrowRightRegular />} aria-label={`Start ${problem.name}`} title={`Start ${problem.name}`} onClick={() => void startPractice(problem.id)} /></TableCell></TableRow>)}</TableBody></Table>}
            </> : location.pathname === '/chaos' ? <>
              <PageHeading eyebrow="RESILIENCE EXERCISES" title="Chaos lab" subtitle="Pressure-test your design against controlled failures and inspect what degrades first." />
              <SectionHeading title="Scenario library" detail="Repeatable, configurable simulations" />
              <div className="scenario-grid">{data.scenarios.map((scenario) => <Card key={scenario.id} className="scenario-card"><div className="scenario-top"><span className="scenario-icon"><SettingsRegular /></span><Badge appearance="outline">{scenario.category}</Badge></div><Title2>{scenario.name}</Title2><Body1>{scenario.fault}</Body1><Divider /><div className="scenario-meta"><span>Duration</span><strong>{scenario.duration}</strong></div><Button appearance="primary" icon={<ArrowRightRegular />} onClick={() => void startChaosRun(scenario.id)}>Run simulation</Button></Card>)}</div>
              <SectionHeading title="Recent runs" detail="Outcomes from your practice sessions" />
              {data.chaosRuns.length ? <div className="run-list">{data.chaosRuns.map((run) => <Card key={run.id} className="run-row"><span className="run-status"><CheckmarkCircleRegular /></span><div><strong>{run.scenario}</strong><small>{run.outcome}</small></div><Badge appearance="tint" color="success">{run.status}</Badge></Card>)}</div> : <EmptyState title="No simulations yet" body="Choose a scenario above to run your first failure exercise." action="Browse scenarios" onAction={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />}
            </> : location.pathname === '/evaluations' ? <>
              <PageHeading eyebrow="DESIGN REVIEWS" title="Judge evaluations" subtitle="Compare independent scalability and reliability feedback, with consensus kept transparent." />
              {data.evaluations.length ? <div className="evaluation-list">{data.evaluations.map((evaluation) => <Card key={evaluation.id} className="evaluation-card"><div className="evaluation-head"><div><Caption1>{evaluation.system}</Caption1><Title2>{evaluation.focus}</Title2></div><div className="score-block"><strong>{evaluation.score}</strong><span>CONSENSUS</span></div></div><p className="feedback">{evaluation.feedback}</p><Divider /><div className="judge-grid">{evaluation.judges.map((judge) => <div key={judge.judge} className="judge-result"><div className="judge-top"><strong>{judge.judge}</strong><Badge appearance="tint" color={judge.verdict === 'Pass' ? 'success' : 'warning'}>{judge.verdict}</Badge></div><div className="judge-score">{judge.score}<small> / 100</small></div><p>{judge.feedback}</p></div>)}</div></Card>)}</div> : <EmptyState title="Your review queue is clear" body="Complete an architecture submission to request two independent design reviews." action="Open practice session" onAction={() => navigate('/sessions/session-url')} />}
            </> : isArchitecture ? <>
              <PageHeading eyebrow="DESIGN WORKSPACE" title="Architecture studio" subtitle="Keep the component inventory and Mermaid source in sync as your design takes shape." />
              <div className="architecture-layout"><Card className="inventory-panel"><CardHeader header={<Title2>Component inventory</Title2>} description="Services and their responsibilities" /><div className="component-list">{data.architecture?.components.map((component) => <div className="component-row" key={component.id}><span className="component-node"><GridRegular /></span><div><strong>{component.name}</strong><small>{component.responsibility} · {component.technology}</small></div><Badge appearance="tint" color={component.status === 'Ready' ? 'success' : 'informative'}>{component.status}</Badge></div>)}</div><Button appearance="primary" icon={<SaveRegularIcon />} onClick={() => void saveDiagram()}>Save architecture</Button></Card><Card className="diagram-panel"><div className="diagram-header"><div><Caption1>MERMAID SOURCE</Caption1><Title2>System topology</Title2></div><Badge appearance="tint" color="success">Synced</Badge></div><pre className="mermaid-code">{data.architecture?.mermaid ?? 'Add components to begin mapping the system.'}</pre><div className="diagram-preview"><div className="flow-node">Client</div><span className="flow-line" /><div className="flow-node primary-node">Redirect API</div><span className="flow-line" /><div className="flow-node">Link Store</div></div></Card></div>
              <SectionHeading title="Session requirements" detail="Design against the explicit constraints" />
              <div className="requirements-list">{data.requirements.map((requirement) => <Card key={requirement.id} className="requirement-row"><span className={`requirement-state ${requirement.state === 'In progress' ? 'working' : ''}`} /><div><strong>{requirement.requirement}</strong><small>{requirement.constraint}</small></div><Badge appearance="outline">{requirement.category}</Badge></Card>)}</div>
            </> : isPractice ? <>
              <PageHeading eyebrow="PRACTICE SESSION · 45 MIN" title={session?.system ?? 'Practice session'} subtitle="Work from the constraints, record tradeoffs, then submit your design for an independent review." />
              <div className="session-topline"><Badge appearance="tint" color="brand">IN PROGRESS</Badge><span>Last saved just now</span><Button appearance="primary" icon={<SaveRegularIcon />} onClick={() => void saveNotes()}>Save session notes</Button></div>
              <div className="session-grid"><Card className="prompt-panel"><CardHeader header={<Title2>Requirements</Title2>} description="Non-functional targets and constraints" />{data.requirements.map((requirement) => <div className="prompt-row" key={requirement.id}><span className={`requirement-state ${requirement.state === 'In progress' ? 'working' : ''}`} /><div><strong>{requirement.requirement}</strong><small>{requirement.constraint}</small></div><Badge appearance="outline">{requirement.state}</Badge></div>)}</Card><Card className="notes-panel"><CardHeader header={<Title2>Tradeoff notes</Title2>} description="Decisions worth making explicit" /><div className="note-entry"><span className="note-number">01</span><div><strong>Partitioning strategy</strong><p>Use stable short-code hashing; route reads close to the user while keeping the mapping globally resolvable.</p></div></div><div className="note-entry"><span className="note-number">02</span><div><strong>Hot-key protection</strong><p>Cache popular redirects with bounded TTLs and protect the origin with request coalescing.</p></div></div><Button appearance="subtle" icon={<AddRegular />}>Add decision</Button></Card></div>
              <div className="session-bottom"><Card className="submission-panel"><div><Caption1>READY FOR REVIEW?</Caption1><Title2>Get an independent architecture review</Title2><Body1>Both judges evaluate your design separately. Provider availability and demo results are always labelled.</Body1></div><Button appearance="primary" icon={<ArrowRightRegular />} onClick={() => void requestReview()}>Request two-judge review</Button></Card><Card className="score-summary"><Caption1>LAST EVALUATION</Caption1><strong>{session?.score ?? '—'}</strong><span>{session?.verdict ?? 'Not submitted'}</span></Card></div>
            </> : <>
              <section className="dashboard-hero">
                <div className="hero-art" aria-hidden="true"><span /><span /><span /></div>
                <div className="hero-copy"><Caption1>YOUR SYSTEM DESIGN PRACTICE</Caption1><Title1>Think in systems.<br />Design with confidence.</Title1><Body1>Build the habit of making clear architecture decisions under real constraints.</Body1><div className="hero-actions"><Button appearance="primary" icon={<ArrowRightRegular />} onClick={() => navigate('/problems')}>Explore problem library</Button><Button appearance="secondary" onClick={() => navigate('/sessions/session-url')}>Resume latest session</Button></div></div>
                <div className="hero-stat"><span>WEEKLY PRACTICE</span><strong>04<span> / 05</span></strong><small><CheckmarkCircleRegular /> On track this week</small></div>
              </section>
              <div className="metric-grid"><Metric label="Sessions completed" value={`${data.sessions.filter((item) => item.status === 'Completed').length + 11}`} detail="Across 4 system domains" icon={<DocumentRegular />} /><Metric label="Average score" value="86" detail="+6 points this month" icon={<ChartMultipleRegular />} /><Metric label="Practice streak" value="8 days" detail="Your longest is 12 days" icon={<CheckmarkCircleRegular />} /></div>
              <div className="section-head"><SectionHeading title="Continue practicing" detail="Pick up where your last design left off" /><Button appearance="subtle" icon={<ArrowRightRegular />} onClick={() => navigate('/problems')}>View all problems</Button></div>
              {data.sessions.length ? <div className="session-list">{data.sessions.slice(0, 3).map((item) => <Card key={item.id} className="session-card"><div className="session-card-icon"><DocumentRegular /></div><div className="session-card-main"><Caption1>{item.focus}</Caption1><strong>{item.system}</strong><small>{item.status === 'Completed' ? 'Completed' : 'Updated recently'}</small></div><div className="session-card-score"><strong>{item.score ?? '—'}</strong><small>{item.verdict ?? 'In progress'}</small></div><Button appearance="subtle" icon={<ArrowRightRegular />} aria-label={`Open ${item.system}`} title={`Open ${item.system}`} onClick={() => navigate(`/sessions/${item.id}`)} /></Card>)}</div> : <EmptyState title="Start your first design" body="Choose a problem from the library and begin working through the constraints." action="Browse problems" onAction={() => navigate('/problems')} />}
              <div className="bottom-grid"><Card className="momentum-panel"><div className="panel-heading"><div><Caption1>PRACTICE MOMENTUM</Caption1><Title2>A steady rhythm beats a sprint</Title2></div><Badge appearance="tint" color="success">8 day streak</Badge></div><div className="momentum-bars" aria-label="Weekly practice activity">{[3, 5, 2, 6, 4, 7, 3].map((height, index) => <div className="momentum-day" key={index}><span style={{ height: `${height * 10}px` }} /><small>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</small></div>)}</div></Card><Card className="billing-panel"><span className="billing-icon"><BookOpenRegular /></span><Caption1>OPEN LEARNING</Caption1><Title2>Everything stays unlocked</Title2><Body1>No daily limits, paid tiers, or gated evaluations. Optional AI providers are configured independently.</Body1><Button appearance="subtle" icon={<ArrowRightRegular />} onClick={() => navigate('/evaluations')}>How evaluations work</Button></Card></div>
            </>}
            <footer className="page-footer"><span>SDLearn · System design, practiced deliberately</span><span>Transparent evaluations · Unlimited practice</span></footer>
          </div>
        </main>
        {import.meta.env.DEV && <div className="preview-switcher" aria-label="Preview data state"><span>PREVIEW</span>{stateOptions.map((state) => <button key={state} className={previewState === state ? 'selected' : ''} onClick={() => setPreviewDataState(state)}>{state}</button>)}</div>}
      </div>
    </FluentProvider>
  );
}

function SaveRegularIcon() {
  return <DocumentRegular />;
}

function PageHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="page-heading"><Caption1>{eyebrow}</Caption1><Title1>{title}</Title1><Body1>{subtitle}</Body1></div>;
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return <div className="section-heading"><div><Title2>{title}</Title2><Caption1>{detail}</Caption1></div></div>;
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactElement }) {
  return <Card className="metric-card"><div className="metric-icon">{icon}</div><Caption1>{label}</Caption1><strong>{value}</strong><small>{detail}</small></Card>;
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  return <Card className="empty-state"><span className="empty-icon"><SearchRegular /></span><Title2>{title}</Title2><Body1>{body}</Body1><Button appearance="primary" onClick={onAction}>{action}</Button></Card>;
}

function LoadingSurface() {
  return <div className="loading-surface"><Skeleton><SkeletonItem size={48} /><SkeletonItem size={32} /><SkeletonItem size={16} /></Skeleton><div className="loading-cards"><Card><Skeleton><SkeletonItem style={{ height: 100 }} /></Skeleton></Card><Card><Skeleton><SkeletonItem style={{ height: 100 }} /></Skeleton></Card><Card><Skeleton><SkeletonItem style={{ height: 100 }} /></Skeleton></Card></div></div>;
}

export default App;