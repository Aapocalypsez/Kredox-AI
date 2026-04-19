import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ApplicationReport } from './pages/ApplicationReport.jsx';
import { Campaigns } from './pages/Campaigns.jsx';
import { CustomerVideoPage } from './pages/CustomerVideoPage.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { LiveSession } from './pages/LiveSession.jsx';
import { Login } from './pages/Login.jsx';
import { ProtectedRoute } from './pages/ProtectedRoute.jsx';
import { Reports } from './pages/Reports.jsx';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/verify/:token" element={<CustomerVideoPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/session/:sessionId" element={<LiveSession />} />
          <Route path="/dashboard/report/:sessionId" element={<ApplicationReport />} />
          <Route path="/dashboard/campaigns" element={<Campaigns />} />
          <Route path="/dashboard/reports" element={<Reports />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
