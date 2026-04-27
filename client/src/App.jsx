import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './styles.css';
import Admin from './pages/Admin.jsx';
import Layout from './components/Layout.jsx';
import ApplicationReport from './pages/ApplicationReport.jsx';
import Applications from './pages/Applications.jsx';
import Campaigns from './pages/Campaigns.jsx';
import CustomerVideoPage from './pages/CustomerVideoPage.jsx';
import CustomerOfferPage from './pages/CustomerOfferPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LiveSession from './pages/LiveSession.jsx';
import Login from './pages/Login.jsx';
import ProtectedRoute from './pages/ProtectedRoute.jsx';
import { Reports } from './pages/Reports.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#FFFFFF',
            color: '#0D1B3E',
            border: '1px solid #DDE3EE',
            boxShadow: '0 4px 16px rgba(13,27,62,0.1)',
            fontFamily: "'Inter', sans-serif",
            fontSize: '13px',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify/:token" element={<CustomerVideoPage />} />
        <Route path="/offer/:token" element={<CustomerOfferPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/report/:id" element={<ApplicationReport />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/audit" element={<Navigate to="/admin" replace />} />
          </Route>
          <Route path="/session/:id" element={<LiveSession />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
