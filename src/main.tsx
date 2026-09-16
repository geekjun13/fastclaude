// Stylesheet order matters: the base layer (tokens + the glass material) must be
// emitted before any feature stylesheet, or a feature rule with equal specificity
// loses the tie to `.glass` and silently gets no effect. Import it first.
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { StoreProvider } from './core/store.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
