import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LiveSession from './pages/LiveSession.jsx';
import ApplicationReport from './pages/ApplicationReport.jsx';
import Campaigns from './pages/Campaigns.jsx';
import CustomerVideoPage from './pages/CustomerVideoPage.jsx';
import ProtectedRoute from './pages/ProtectedRoute.jsx';
import '../src/styles.css';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0F1117',
            color: '#ECEDF2',
            border: '1px solid #1F2130',
            fontFamily: "'DM Sans', sans-serif",
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify/:token" element={<CustomerVideoPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/session/:sessionId" element={<LiveSession />} />
          <Route path="/report/:sessionId" element={<ApplicationReport />} />
          <Route path="/campaigns" element={<Campaigns />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
