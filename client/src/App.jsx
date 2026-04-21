import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Statistics from './pages/Statistics';
import Cosmetics from './pages/Cosmetics';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Chargement...</p></div>;
  return user ? children : <Navigate to="/auth" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/stats" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
      <Route path="/lobby" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
      <Route path="/lobby/:pin" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
      <Route path="/game/:pin" element={<ProtectedRoute><Game /></ProtectedRoute>} />
      <Route path="/cosmetics" element={<ProtectedRoute><Cosmetics /></ProtectedRoute>} />
    </Routes>
  );
}
