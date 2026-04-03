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
          'X-CSRFToken': getCookie('csrftoken') // <--- İŞTE BURAYI EKLEDİK
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
      <label htmlFor={field} className="block text-sm font-medium text-gray-300 mb-2">
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
        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        disabled={loading}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Sistem Ayarları</h1>
            <p className="text-gray-400">Aktivite tanıma algoritması parametreleri</p>
          </div>

          {message.text && (
            <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-900/50 border border-green-500 text-green-200' : 'bg-red-900/50 border border-red-500 text-red-200'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-purple-400 mb-4 pb-2 border-b border-gray-700">Kızgınlık (Excited) Tespiti</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderInput('EXCITED_MAG', 'Eşik Değer (m/s²)', 'number', 0.1)}
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-semibold text-purple-400 mb-4 pb-2 border-b border-gray-700">Yürüyüş Tespiti</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {renderInput('WALK_STD_MIN', 'Min Standart Sapma', 'number', 0.1)}
                {renderInput('WALK_STD_MAX', 'Max Standart Sapma', 'number', 0.1)}
                {renderInput('WALK_PEAKS_MIN', 'Min Tepe Sayısı (8s)', 'number', 1, 0)}
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-semibold text-purple-400 mb-4 pb-2 border-b border-gray-700">Durağan (Still) Tespiti</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {renderInput('STILL_STD_MAX', 'Max Standart Sapma', 'number', 0.1)}
                {renderInput('STILL_MAG_MIN', 'Min Magnitude (m/s²)', 'number', 0.1)}
                {renderInput('STILL_MAG_MAX', 'Max Magnitude (m/s²)', 'number', 0.1)}
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-semibold text-purple-400 mb-4 pb-2 border-b border-gray-700">Yatma (Lying) Tespiti</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {renderInput('LYING_STILL_MIN_MINUTES', 'Gündüz Min Süre (dk)', 'number', 1, 0)}
                {renderInput('LYING_NIGHT_START', 'Gece Başlangıç (saat)', 'number', 1, 0, 23)}
                {renderInput('LYING_NIGHT_END', 'Gece Bitiş (saat)', 'number', 1, 0, 23)}
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-semibold text-purple-400 mb-4 pb-2 border-b border-gray-700">Adım Sayacı (Peak Detection)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderInput('MAG_PEAK_THRESHOLD', 'Tepe Eşiği (m/s²)', 'number', 0.1)}
                {renderInput('MAG_VALLEY_THRESHOLD', 'Vadi Eşiği (m/s²)', 'number', 0.1)}
                {renderInput('COOLDOWN_MS', 'Soğuma Süresi (ms)', 'number', 10, 0)}
                {renderInput('WINDOW_SIZE', 'Pencere Boyutu', 'number', 1, 1, 20)}
                {renderInput('FETCH_INTERVAL_MS', 'Veri Çekme Aralığı (ms)', 'number', 10, 100)}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
              </button>
              <button
                type="button"
                onClick={fetchSettings}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
                disabled={loading}
              >
                Yenile
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;