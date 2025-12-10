import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LandingPage from './LandingPage.tsx';
import BetaGate from './components/BetaGate';
import BetaTerms from './components/BetaTerms';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const path = window.location.pathname || '/';
const useApp = path === '/app' || path.startsWith('/app/');
const useTerms = path === '/beta-terms' || path === '/privacy' || path === '/terms';

const RootApp: React.FC = () => {
  const validCodes = useMemo(() => ['BETA2025', 'NEXUSBETA'], []);
  const [betaAccess, setBetaAccess] = useState(false);

  useEffect(() => {
    if (!useApp) return;
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite') || '';
    const hasStored = localStorage.getItem('beta_access') === '1';
    const hasValidInvite = validCodes.includes(invite.trim());
    if (hasValidInvite) {
      localStorage.setItem('beta_access', '1');
      setBetaAccess(true);
      return;
    }
    if (hasStored) {
      setBetaAccess(true);
    }
  }, [useApp, validCodes]);

  if (useTerms) {
    return <BetaTerms />;
  }

  if (useApp && !betaAccess) {
    return <BetaGate onUnlock={() => setBetaAccess(true)} validCodes={validCodes} />;
  }

  return useApp ? <App /> : <LandingPage />;
};

root.render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
