import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { AuthProvider } from './contexts/AuthContext';
import { UndoProvider } from './contexts/UndoContext';
import { useSync } from './hooks/useSync';

function AppContent() {
  // Initialize Sync Hook inside AuthProvider context
  useSync();
  
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <UndoProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </UndoProvider>
    </AuthProvider>
  );
}

export default App;
