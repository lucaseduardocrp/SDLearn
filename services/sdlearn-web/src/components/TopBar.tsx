import { NavLink } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../lib/useAsync';

export function Logo() {
  return (
    <NavLink to="/" className="logo" aria-label="Archon — início">
      <span className="logo-mark">A</span>
      <span className="logo-name">Archon</span>
      <span className="logo-path">/sd-lab</span>
    </NavLink>
  );
}

export function TopBar() {
  const health = useAsync(() => api.getHealth(), []);
  const judges = api.mode === 'local'
    ? { tone: 'offline', label: 'OFFLINE', title: 'Modo offline: tudo roda no navegador; os juízes de IA ficam indisponíveis.' }
    : health.data?.judgeProvider
      ? { tone: 'on', label: 'JUÍZES ON', title: `Juízes de IA: ${health.data.judgeProvider}` }
      : health.error
        ? { tone: 'off', label: 'API OFF', title: health.error }
        : { tone: 'off', label: 'JUÍZES OFF', title: 'Nenhum provedor de IA configurado na API. Você ainda recebe a pré-avaliação automática.' };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Logo />
        <nav className="topnav" aria-label="Principal">
          <NavLink to="/" end>Biblioteca</NavLink>
          <NavLink to="/learn">Aprender</NavLink>
          <NavLink to="/sessions">Minhas sessões</NavLink>
        </nav>
        <div className="topbar-right">
          {!health.loading && <span className={`status-pill status-${judges.tone}`} title={judges.title}><i />{judges.label}</span>}
          <span className="access-pill">FULL ACCESS</span>
        </div>
      </div>
    </header>
  );
}
