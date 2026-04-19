import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [demoMode, setDemoMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [agent, setAgentState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('kredox_agent')) || { name: 'Ravi Desai', role: 'Senior Agent' };
    } catch {
      return { name: 'Ravi Desai', role: 'Senior Agent' };
    }
  });

  const setAgent = useCallback((nextAgent) => {
    setAgentState(nextAgent);
    localStorage.setItem('kredox_agent', JSON.stringify(nextAgent));
  }, []);

  const addNotification = useCallback((message, type = 'success') => {
    toast[type]?.(message) || toast(message);
  }, []);

  const value = useMemo(
    () => ({
      agent,
      setAgent,
      demoMode,
      setDemoMode,
      sidebarOpen,
      setSidebarOpen,
      addNotification
    }),
    [addNotification, agent, demoMode, setAgent, sidebarOpen]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used inside AppProvider');
  return context;
}
