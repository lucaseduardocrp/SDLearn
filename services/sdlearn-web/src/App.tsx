import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { TopBar } from './components/TopBar';
import { buttonClass, EmptyState } from './components/ui';
import { useI18n } from './i18n';
import { EvaluationPage } from './pages/EvaluationPage';
import { HubPage } from './pages/HubPage';
import { SettingsPage } from './pages/SettingsPage';
import { ArticlePage, LearnPage } from './pages/LearnPages';
import { LibraryPage } from './pages/LibraryPage';
import { ProblemPage } from './pages/ProblemPage';
import { SessionsPage } from './pages/SessionsPage';
import { WorkspacePage } from './workspace/WorkspacePage';

function App() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const inWorkspace = /^\/sessions\/[^/]+$/.test(pathname);
  return (
    <div className={`app${inWorkspace ? ' app-workspace' : ''}`}>
      <TopBar />
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/problems/:problemId" element={<ProblemPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/sessions/:sessionId" element={<WorkspacePage />} />
        <Route path="/evaluations/:evaluationId" element={<EvaluationPage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/learn/:slug" element={<ArticlePage />} />
        <Route path="/hub" element={<HubPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<div className="container page"><EmptyState icon={<Compass size={22} />} title={t.app.notFoundTitle} body={t.app.notFoundBody} action={<Link to="/" className={buttonClass({ variant: 'primary' })}>{t.common.goToLibrary}</Link>} /></div>} />
      </Routes>
      {!inWorkspace && (
        <footer className="footer container">
          <span>Archon <span className="mono-dim">/sd-lab</span> · {t.app.footerTagline}</span>
          <span className="mono-dim">{t.app.footerFeatures}</span>
        </footer>
      )}
    </div>
  );
}

export default App;
