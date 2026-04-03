import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config';
import { getCookie } from '../utils/cookieUtils';

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
  const [settings, setSettings] = useState({
    EXCITED_MAG: 25.0,
    WALK_STD_MIN: 2.0,
    WALK_STD_MAX: 15.0,
    WALK_PEAKS_MIN: 1,
    STILL_STD_MAX: 2.0,
    STILL_MAG_MIN: 7.5,
    STILL_MAG_MAX: 12.5,
    LYING_STILL_MIN_MINUTES: 2,
    LYING_NIGHT_START: 22,
    LYING_NIGHT_END: 6,
    MAG_PEAK_THRESHOLD: 11.5,
    MAG_VALLEY_THRESHOLD: 9.5,
    COOLDOWN_MS: 650,
    WINDOW_SIZE: 5,
    ACTIVITY_BUFFER_SIZE: 40,
    FETCH_INTERVAL_MS: 700,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);



  // Theme sync localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.className = savedTheme;
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.className = newTheme;
  }, [theme]);

  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now();
    const notif = { id, message, type, timestamp: new Date().toLocaleTimeString() };
    setNotifications(prev => [notif, ...prev.slice(0, 4)]);
    setTimeout(() => removeNotification(id), 10000);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/settings/`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else if (response.status === 401 || response.status === 403) {
        // Unauthorized - clear state and potentially redirect
        console.error('Ayarlar yüklenemedi: Oturum süreniz doldu, lütfen tekrar giriş yapın.');
        // Could also trigger logout via AuthContext if needed
      }
    } catch (error) {
      console.error('Settings fetch error:', error);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings) => {
    setSettingsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/settings/update/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        credentials: 'include',
        body: JSON.stringify(newSettings),
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || newSettings);
        return { success: true };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Güncelleme başarısız' };
      }
    } catch (error) {
      return { success: false, error: 'Bağlantı hatası' };
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  return (
    <AppContext.Provider value={{
      theme, toggleTheme,
      searchQuery, setSearchQuery,
      notifications, addNotification, removeNotification,
      onlineStatus, setOnlineStatus,
      settings, fetchSettings, updateSettings, settingsLoading
    }}>
      {children}
    </AppContext.Provider>
  );
};
