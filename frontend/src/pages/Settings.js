import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config';

import { getCookie } from '../utils/cookieUtils';

const Settings = () => {
  const { isAuthenticated } = useAuth();
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
    FETCH_INTERVAL_MS: 700,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
    }
  }, [isAuthenticated]);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/settings/`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        setMessage({ type: 'error', text: 'Ayarlar yüklenemedi' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bağlantı hatası' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${API_BASE}/api/settings/update/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Ayarlar başarıyla güncellendi' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Güncelleme başarısız' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bağlantı hatası' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const renderInput = (field, label, type = 'number', step = 1, min, max) => (
    <div key={field} className="mb-4">
      <label htmlFor={field} className="block text-sm font-medium text-slate-300 mb-2">
        {label}
      </label>
      <input
        type={type}
        id={field}
        value={settings[field]}
        onChange={(e) => handleChange(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        step={step}
        min={min}
        max={max}
        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        disabled={loading}
      />
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="bg-slate-800 rounded-xl shadow-md p-4 md:p-6 border border-slate-700">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-slate-100 mb-2">Sistem Ayarları</h1>
          <p className="text-slate-400 text-sm">Aktivite tanıma algoritması parametreleri</p>
        </div>

        {message.text && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-emerald-900/30 border border-emerald-500/50 text-emerald-200' : 'bg-rose-900/30 border border-rose-500/50 text-rose-200'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-indigo-400 mb-4 pb-2 border-b border-slate-700">Kızgınlık (Excited) Tespiti</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderInput('EXCITED_MAG', 'Eşik Değer (m/s²)', 'number', 0.1)}
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-indigo-400 mb-4 pb-2 border-b border-slate-700">Yürüyüş Tespiti</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {renderInput('WALK_STD_MIN', 'Min Standart Sapma', 'number', 0.1)}
              {renderInput('WALK_STD_MAX', 'Max Standart Sapma', 'number', 0.1)}
              {renderInput('WALK_PEAKS_MIN', 'Min Tepe Sayısı (8s)', 'number', 1, 0)}
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-indigo-400 mb-4 pb-2 border-b border-slate-700">Durağan (Still) Tespiti</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {renderInput('STILL_STD_MAX', 'Max Standart Sapma', 'number', 0.1)}
              {renderInput('STILL_MAG_MIN', 'Min Magnitude (m/s²)', 'number', 0.1)}
              {renderInput('STILL_MAG_MAX', 'Max Magnitude (m/s²)', 'number', 0.1)}
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-indigo-400 mb-4 pb-2 border-b border-slate-700">Yatma (Lying) Tespiti</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {renderInput('LYING_STILL_MIN_MINUTES', 'Gündüz Min Süre (dk)', 'number', 1, 0)}
              {renderInput('LYING_NIGHT_START', 'Gece Başlangıç (saat)', 'number', 1, 0, 23)}
              {renderInput('LYING_NIGHT_END', 'Gece Bitiş (saat)', 'number', 1, 0, 23)}
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-indigo-400 mb-4 pb-2 border-b border-slate-700">Adım Sayacı (Peak Detection)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {renderInput('MAG_PEAK_THRESHOLD', 'Tepe Eşiği (m/s²)', 'number', 0.1)}
              {renderInput('MAG_VALLEY_THRESHOLD', 'Vadi Eşiği (m/s²)', 'number', 0.1)}
              {renderInput('COOLDOWN_MS', 'Soğuma Süresi (ms)', 'number', 10, 0)}
              {renderInput('WINDOW_SIZE', 'Pencere Boyutu', 'number', 1, 1, 20)}
              {renderInput('FETCH_INTERVAL_MS', 'Veri Çekme Aralığı (ms)', 'number', 10, 100)}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-700">
            <button
              type="submit"
              className="flex-1 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
            </button>
            <button
              type="button"
              onClick={fetchSettings}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
              disabled={loading}
            >
              Yenile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
