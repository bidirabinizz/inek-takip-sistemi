import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';


import { getCookie } from '../utils/cookieUtils';

const DevicesView = () => {
  const { searchQuery } = useAppContext();
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [showAssignDropdown, setShowAssignDropdown] = useState(null);

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
        // Sayfalama yapısını işle (response.data.results)
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
        // Sayfalama yapısını işle (response.data.results)
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

  const handleAssignAnimal = async (deviceMac, earTag) => {
    setAssigning(deviceMac);
    try {
      const response = await fetch(`${API_BASE}/api/devices/assign/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCookie('csrftoken'), // <--- BURAYI EKLEDİK
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
        <div className="text-white text-xl">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-9 py-4 md:py-6">
      <h2 className="text-cyber-purple font-light mb-4 md:mb-5 text-lg md:text-xl">Kayıtlı Cihazlar (Filo Durumu)</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
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
              className="bg-opacity-3 border border-cyber-purple border-opacity-20 rounded-xl p-6 relative cursor-pointer transition-transform hover:scale-105 hover:bg-opacity-5"
            >
              <div className="text-xs text-cyber-gray tracking-widest">CİHAZ ADI</div>
              <div className="text-xl text-white font-bold my-1">{dev.name || dev.mac}</div>
              
              {dev.animal ? (
                <div className="space-y-1">
                  <div className="text-sm text-cyber-green my-1">🐄 {dev.animal.ear_tag}</div>
                  {dev.animal.name && (
                    <div className="text-xs text-gray-400">{dev.animal.name}</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500 my-1">Hayvan atanmamış</div>
              )}
              
              {dev.location && (
                <div className="text-xs text-cyber-green opacity-80 my-1">📍 {dev.location}</div>
              )}
              
              <div className="h-px bg-white bg-opacity-5 my-3" />
              
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs text-cyber-green tracking-wide">TOPLAM ADIM</div>
                  <div className="text-2xl text-cyber-green font-bold">{dev.total_steps}</div>
                </div>
                <div className="text-4xl opacity-20">🏃</div>
              </div>

              {/* Assignment Button */}
              <div className="mt-4 pt-3 border-t border-gray-700">
                <button
                  onClick={(e) => toggleAssignDropdown(e, dev.mac)}
                  className={`w-full px-3 py-2 text-sm font-semibold rounded transition-colors ${
                    dev.animal 
                      ? 'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-500 border border-yellow-600/50' 
                      : 'bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/50'
                  }`}
                >
                  {dev.animal ? 'Hayvanı Değiştir' : 'Hayvan Eşleştir'}
                </button>

                {showAssignDropdown === dev.mac && (
                  <div 
                    className="absolute left-0 right-0 mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-2">
                      <div className="text-xs text-gray-400 px-2 py-1">Hayvan Seçiniz:</div>
                      {getAvailableAnimals(dev).length === 0 ? (
                        <div className="text-sm text-gray-500 px-2 py-2">Uygun hayvan yok</div>
                      ) : (
                        getAvailableAnimals(dev).map(animal => (
                          <button
                            key={animal.id}
                            onClick={() => handleAssignAnimal(dev.mac, animal.ear_tag)}
                            disabled={assigning === dev.mac}
                            className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm text-white transition-colors disabled:opacity-50"
                          >
                            <div className="font-semibold">{animal.ear_tag}</div>
                            {animal.name && <div className="text-xs text-gray-400">{animal.name}</div>}
                          </button>
                        ))
                      )}
                      {dev.animal && (
                        <button
                          onClick={() => handleUnassign(dev.mac)}
                          className="w-full text-left px-3 py-2 hover:bg-red-900/30 rounded text-sm text-red-400 transition-colors mt-1 border-t border-gray-700 pt-2"
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
          <div className="col-span-full text-center py-12 text-cyber-gray">
            Henüz veritabanına kayıtlı cihaz yok...
          </div>
        )}
        
        {searchQuery && devices.filter(dev => 
          dev.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          dev.mac?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (dev.animal?.ear_tag?.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (dev.animal?.name?.toLowerCase().includes(searchQuery.toLowerCase()))
        ).length === 0 && (
          <div className="col-span-full text-center py-12 text-cyber-gray">
            "{searchQuery}" için cihaz bulunamadı
          </div>
        )}
      </div>
    </div>
  );
};

export default DevicesView;
