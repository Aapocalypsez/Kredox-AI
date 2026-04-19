import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute() {
  const token = localStorage.getItem('kredox_token') || localStorage.getItem('kredox_access_token');
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}
