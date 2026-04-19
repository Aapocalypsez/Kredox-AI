import { Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { useAppContext } from '../../context/AppContext.jsx';

export function ProtectedRoute({ children }) {
  const token = localStorage.getItem('kredox_token');
  return token ? children : <Navigate to="/login" replace />;
}

export function DashboardLayout() {
  const { sidebarOpen } = useAppContext();
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-bg-base text-text-primary">
        <Sidebar />
        <Topbar />
        <main className={`min-h-screen pt-16 transition-all ${sidebarOpen ? 'pl-60' : 'pl-[60px]'}`}>
          <Outlet />
        </main>
      </div>
    </ProtectedRoute>
  );
}
