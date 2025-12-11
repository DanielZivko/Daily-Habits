import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

// #region agent log
fetch('http://127.0.0.1:7242/ingest/ed08f49b-d9aa-411f-9610-deb641090c9f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/main.tsx:top',message:'Main starting with ErrorBoundary',data:{},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
// #endregion

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
