import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import { getActivityLabel, getActivityColor } from '../constants/activityTranslations';
import { fetchActivityStatus } from '../services/dashboardService';
import { getCookie } from '../utils/cookieUtils';

const DevicesView = () => {
  const { searchQuery } = useAppContext();
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [showAssignDropdown, setShowAssignDropdown] = useState(null);
  const [activityStatuses, setActivityStatuses] = useState({});

  const handleSelectDevice = (mac) => {
    navigate(`/report/${mac}`);
  };

  const fetchDevices = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/cihazlar/`, {
        'X-CSRFToken': getCookie('csrftoken'),
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setDevices(data.results || data);
      }
    } catch (err) {
      console.error("Cihazlar çekilemedi", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnimals = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/animals/`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAnimals(data.results || data);
      }
    } catch (err) {
      console.error("Hayvanlar çekilemedi", err);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchAnimals();
  }, []);

  // Fetch activity statuses for all devices
  useEffect(() => {
    if (devices.length > 0) {
      const fetchAllActivities = async () => {
        const statuses = {};
        await Promise.all(
          devices.map(async (dev) => {
            try {
              const status = await fetchActivityStatus(dev.mac_address || dev.mac);
              statuses[dev.mac_address || dev.mac] = status;
            } catch (err) {
              console.error(`Activity status fetch error for ${dev.mac}:`, err);
              statuses[dev.mac_address || dev.mac] = { final_activity: 'Durağan / Ayakta' };
            }
          })
        );
        setActivityStatuses(statuses);
      };
      fetchAllActivities();
    }
  }, [devices]);

  const handleAssignAnimal = async (deviceMac, earTag) => {
    setAssigning(deviceMac);
    try {
      const response = await fetch(`${API_BASE}/api/devices/assign/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCookie('csrftoken'),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          mac_address: deviceMac,
          ear_tag: earTag
        }),
      });
      if (response.ok) {
        fetchDevices();
        setShowAssignDropdown(null);
      }
    } catch (err) {
      console.error("Atama başarısız", err);
    } finally {
      setAssigning(null);
    }
  };

  const handleUnassign = async (deviceMac) => {
    if (!window.confirm('Bu cihazdan hayvan atamasını kaldırmak istediğinize emin misiniz?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/devices/unassign/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCookie('csrftoken'),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ mac_address: deviceMac }),
      });
      if (response.ok) {
        fetchDevices();
      }
    } catch (err) {
      console.error("Atama kaldırma başarısız", err);
    }
  };

  const toggleAssignDropdown = (e, mac) => {
    e.stopPropagation();
    setShowAssignDropdown(showAssignDropdown === mac ? null : mac);
  };

  const getAvailableAnimals = (device) => {
    if (!device.animal) {
      return animals.filter(a => a.is_active);
    }
    return animals.filter(a => a.is_active && a.id !== device.animal.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-slate-100 text-xl">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-100 mb-2">Cihaz Yönetimi</h1>
        <p className="text-slate-400 text-sm">Sensör cihazları ve hayvan atamaları</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {devices
          .filter(dev => 
            dev.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            dev.mac?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (dev.animal?.ear_tag?.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (dev.animal?.name?.toLowerCase().includes(searchQuery.toLowerCase()))
          )
          .map(dev => (
            <div 
              key={dev.mac} 
              onClick={() => handleSelectDevice(dev.mac)}
              className="bg-slate-800 border border-slate-700 rounded-xl p-5 cursor-pointer transition-all hover:bg-slate-700/50 hover:border-indigo-500/50 group"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="text-xs text-slate-400 tracking-widest">CİHAZ</div>
                <div className="text-2xl opacity-20 group-hover:opacity-40 transition-opacity">📡</div>
              </div>
              
              <div className="text-lg text-slate-100 font-bold mb-2 break-all">{dev.name || dev.mac}</div>
              
              <div className="text-xs text-slate-400 font-mono mb-3">{dev.mac}</div>
              
              {dev.animal ? (
                <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 mb-3">
                  <div className="text-xs text-emerald-400 mb-1">ATANMIŞ HAYVAN</div>
                  <div className="text-slate-100 font-semibold">🐄 {dev.animal.ear_tag}</div>
                  {dev.animal.name && (
                    <div className="text-xs text-slate-400">{dev.animal.name}</div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 mb-3">
                  <div className="text-xs text-amber-400 mb-1">ATANMAMIŞ</div>
                  <div className="text-slate-300 text-sm">Hayvan eşleştirilmedi</div>
                </div>
              )}

              {/* Activity Status */}
              {(() => {
                const mac = dev.mac_address || dev.mac;
                const activity = activityStatuses[mac]?.final_activity || 'Durağan / Ayakta';
                const label = getActivityLabel(activity);
                const color = getActivityColor(activity);
                return (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xs text-slate-400">DURUM:</span>
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded"
                      style={{
                        color,
                        backgroundColor: `${color}20`,
                        border: `1px solid ${color}40`
                      }}
                    >
                      {label}
                    </span>
                  </div>
                );
              })()}

              <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                <div>
                  <div className="text-xs text-slate-400">TOPLAM ADIM</div>
                  <div className="text-xl text-indigo-400 font-bold">{dev.total_steps?.toLocaleString() || 0}</div>
                </div>
                <div className="text-2xl opacity-30">🏃</div>
              </div>

              {/* Assignment Button */}
              <div className="mt-4">
                <button
                  onClick={(e) => toggleAssignDropdown(e, dev.mac)}
                  className={`w-full px-3 py-2 text-sm font-semibold rounded transition-colors ${
                    dev.animal 
                      ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-600/50' 
                      : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/50'
                  }`}
                >
                  {dev.animal ? 'Hayvanı Değiştir' : 'Hayvan Eşleştir'}
                </button>

                {showAssignDropdown === dev.mac && (
                  <div 
                    className="absolute left-4 right-4 md:left-auto md:right-4 md:w-80 mt-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-3">
                      <div className="text-xs text-slate-400 mb-2">Hayvan Seçiniz:</div>
                      {getAvailableAnimals(dev).length === 0 ? (
                        <div className="text-sm text-slate-500 py-2">Uygun hayvan yok</div>
                      ) : (
                        getAvailableAnimals(dev).map(animal => (
                          <button
                            key={animal.id}
                            onClick={() => handleAssignAnimal(dev.mac, animal.ear_tag)}
                            disabled={assigning === dev.mac}
                            className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded text-sm text-slate-100 transition-colors disabled:opacity-50 mb-1 last:mb-0"
                          >
                            <div className="font-semibold">{animal.ear_tag}</div>
                            {animal.name && <div className="text-xs text-slate-400">{animal.name}</div>}
                          </button>
                        ))
                      )}
                      {dev.animal && (
                        <button
                          onClick={() => handleUnassign(dev.mac)}
                          className="w-full text-left px-3 py-2 hover:bg-rose-900/30 rounded text-sm text-rose-400 transition-colors mt-2 border-t border-slate-700 pt-2"
                        >
                          ↔️ Atamayı Kaldır
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        
        {devices.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            Henüz veritabanına kayıtlı cihaz yok...
          </div>
        )}
        
        {searchQuery && devices.filter(dev => 
          dev.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          dev.mac?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (dev.animal?.ear_tag?.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (dev.animal?.name?.toLowerCase().includes(searchQuery.toLowerCase()))
        ).length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            "{searchQuery}" için cihaz bulunamadı
          </div>
        )}
      </div>
    </div>
  );
};

export default DevicesView;
