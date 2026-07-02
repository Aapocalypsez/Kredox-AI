import { Navigate, Outlet, useLocation } from 'react-router-dom';

function currentAgent() {
  try {
    return JSON.parse(localStorage.getItem('kredox_agent') || 'null');
  } catch {
    return null;
  }
}

const viewerBlocked = new Set(['/campaigns', '/admin']);

export default function ProtectedRoute() {
  const token = localStorage.getItem('kredox_token');
  const location = useLocation();
  const agent = currentAgent();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (agent?.role === 'viewer' && viewerBlocked.has(location.pathname)) {
    return <Navigate to="/reports" replace />;
  }

  return <Outlet />;
}
