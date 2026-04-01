import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [theme, setTheme] = useState('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [onlineStatus, setOnlineStatus] = useState('connecting');

  // Theme sync localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.className = savedTheme;
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.className = newTheme;
  };

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    const notif = { id, message, type, timestamp: new Date().toLocaleTimeString() };
    setNotifications(prev => [notif, ...prev.slice(0, 4)]);
    setTimeout(() => removeNotification(id), 10000);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <AppContext.Provider value={{
      theme, toggleTheme,
      searchQuery, setSearchQuery,
      notifications, addNotification, removeNotification,
      onlineStatus, setOnlineStatus
    }}>
      {children}
    </AppContext.Provider>
  );
};

