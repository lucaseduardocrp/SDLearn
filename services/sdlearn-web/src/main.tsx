import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import App from './App';
import { I18nProvider } from './i18n';
import './styles.css';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <ScrollToTop />
        <App />
      </BrowserRouter>
    </I18nProvider>
  </React.StrictMode>,
);
