import { BrowserRouter, Navigate, Route, Routes, Link } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout.jsx';
import { ApplicationReport } from './pages/ApplicationReport.jsx';
import { Campaigns } from './pages/Campaigns.jsx';
import { CustomerVideoPage } from './pages/CustomerVideoPage.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { LiveSession } from './pages/LiveSession.jsx';
import { Login } from './pages/Login.jsx';

function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg-base p-6 text-text-primary">
      <div className="glass-card max-w-md rounded-2xl p-8 text-center">
        <div className="font-display text-3xl font-extrabold">Session not found</div>
        <p className="mt-3 text-text-muted">The requested Kredox AI workspace route is unavailable.</p>
        <Link className="mt-6 inline-flex rounded-lg bg-accent px-4 py-2 font-bold text-white" to="/dashboard">Return to Dashboard</Link>
      </div>
    </main>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify/:token" element={<CustomerVideoPage />} />

        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/session/:sessionId" element={<LiveSession />} />
          <Route path="/report/:sessionId" element={<ApplicationReport />} />
          <Route path="/campaigns" element={<Campaigns />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
