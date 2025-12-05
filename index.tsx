import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LandingPage from './LandingPage';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const path = window.location.pathname || '/';
const useApp = path === '/app' || path.startsWith('/app/');

root.render(
  <React.StrictMode>
    {useApp ? <App /> : <LandingPage />}
  </React.StrictMode>
);
