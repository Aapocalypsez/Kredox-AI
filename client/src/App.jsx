import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './styles.css';
import Layout from './components/Layout.jsx';
import ApplicationReport from './pages/ApplicationReport.jsx';
import Campaigns from './pages/Campaigns.jsx';
import CustomerVideoPage from './pages/CustomerVideoPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LiveSession from './pages/LiveSession.jsx';
import Login from './pages/Login.jsx';
import ProtectedRoute from './pages/ProtectedRoute.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0D1420',
            color: '#E8EAF0',
            border: '1px solid #1A2535',
            fontFamily: "'Geist', sans-serif",
            fontSize: '13px',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify/:token" element={<CustomerVideoPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/report/:id" element={<ApplicationReport />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/applications" element={<Navigate to="/report/KYC-2024-0847" replace />} />
            <Route path="/reports" element={<Navigate to="/report/KYC-2024-0847" replace />} />
            <Route path="/audit" element={<Navigate to="/report/KYC-2024-0847" replace />} />
          </Route>
          <Route path="/session/:id" element={<LiveSession />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
