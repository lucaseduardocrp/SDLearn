import { Link, NavLink } from 'react-router-dom';
import { useEffect } from 'react';
import { Settings } from 'lucide-react';
import { localeNames, locales } from '@shared/i18n/locale';
import { api } from '../api';
import { SETTINGS_CHANGED_EVENT } from '../api/httpClient';
import { useI18n } from '../i18n';
import { useAsync } from '../lib/useAsync';

const localeShort = { 'pt-BR': 'PT', en: 'EN' } as const;

export function Logo() {
  const { t } = useI18n();
  return (
    <NavLink to="/" className="logo" aria-label={t.topbar.home}>
      <span className="logo-mark">A</span>
      <span className="logo-name">Archon</span>
      <span className="logo-path">/sd-lab</span>
    </NavLink>
  );
}

function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="lang-switch" role="radiogroup" aria-label={t.meta.language}>
      {locales.map((item) => (
        <button key={item} type="button" role="radio" aria-checked={locale === item} className={locale === item ? 'active' : ''} title={localeNames[item]} lang={item} onClick={() => setLocale(item)}>
          {localeShort[item]}
        </button>
      ))}
    </div>
  );
}

export function TopBar() {
  const { t } = useI18n();
  const health = useAsync(() => api.getHealth(), []);
  const { reload } = health;
  useEffect(() => {
    window.addEventListener(SETTINGS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, reload);
  }, [reload]);
  const judges = api.mode === 'local'
    ? { tone: 'offline', label: t.topbar.offline.label, title: t.topbar.offline.title }
    : health.data?.judgeProvider
      ? { tone: 'on', label: t.topbar.judgesOn.label, title: t.topbar.judgesOn.title(health.data.judgeProvider) }
      : health.error
        ? { tone: 'off', label: t.topbar.apiOff, title: health.error }
        : { tone: 'off', label: t.topbar.judgesOff.label, title: t.topbar.judgesOff.title };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Logo />
        <nav className="topnav" aria-label={t.topbar.navigation}>
          <NavLink to="/" end>{t.topbar.library}</NavLink>
          <NavLink to="/learn">{t.topbar.learn}</NavLink>
          <NavLink to="/hub">{t.topbar.hub}</NavLink>
          <NavLink to="/sessions">{t.topbar.sessions}</NavLink>
        </nav>
        <div className="topbar-right">
          {!health.loading && <Link to="/settings" className={`status-pill status-${judges.tone}`} title={judges.title}><i />{judges.label}</Link>}
          <span className="access-pill">{t.topbar.fullAccess}</span>
          <LanguageSwitch />
          <NavLink to="/settings" className="icon-btn" aria-label={t.topbar.settings} title={t.topbar.settings}><Settings size={16} /></NavLink>
        </div>
      </div>
    </header>
  );
}
