import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [agent, setAgent] = useState(() => {
    const stored = localStorage.getItem('kredox_agent');
    try {
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionEntities, setSessionEntities] = useState({});
  const [notifications, setNotifications] = useState([]);

  const persistAgent = useCallback((agentData) => {
    setAgent(agentData);
    if (agentData) {
      localStorage.setItem('kredox_agent', JSON.stringify(agentData));
    } else {
      localStorage.removeItem('kredox_agent');
    }
  }, []);

  const updateEntity = useCallback((field, value) => {
    if (!field) return;
    setSessionEntities((current) => ({
      ...current,
      [field]: value
    }));
  }, []);

  const addNotification = useCallback((message, type = 'info') => {
    const item = {
      id: crypto.randomUUID(),
      message,
      type,
      created_at: new Date().toISOString()
    };
    setNotifications((current) => [item, ...current].slice(0, 30));
    return item;
  }, []);

  const value = useMemo(
    () => ({
      agent,
      currentSession,
      sessionEntities,
      notifications,
      setAgent: persistAgent,
      setCurrentSession,
      updateEntity,
      addNotification
    }),
    [addNotification, agent, currentSession, notifications, persistAgent, sessionEntities, updateEntity]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider');
  }
  return context;
}
