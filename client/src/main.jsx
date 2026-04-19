import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { App } from './App.jsx';
import { AppProvider } from './context/AppContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'toast-dark',
          duration: 3200
        }}
      />
    </AppProvider>
  </React.StrictMode>
);
