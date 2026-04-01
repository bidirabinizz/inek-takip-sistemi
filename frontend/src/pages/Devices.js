import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';

const DevicesView = () => {
  const { searchQuery } = useAppContext();
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleSelectDevice = (mac) => {
    navigate(`/report/${mac}`);
  };

  useEffect(() => {
    fetch(`${API_BASE}/api/cihazlar/`)
      .then(res => res.json())
      .then(data => {
        setDevices(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Cihazlar çekilemedi", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="px-9 py-6">
      <h2 className="text-cyber-purple font-light mb-5">Kayıtlı Cihazlar (Filo Durumu)</h2>
      
      {loading ? (
        <div className="text-cyber-gray">Veriler Yükleniyor...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {devices
            .filter(dev => 
              dev.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              dev.mac?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              dev.cow_id?.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map(dev => (
              <div 
                key={dev.mac} 
                onClick={() => handleSelectDevice(dev.mac)}
                className=" bg-opacity-3 border border-cyber-purple border-opacity-20 rounded-xl p-6 relative cursor-pointer transition-transform hover:scale-105 hover:bg-opacity-5"
              >
                <div className="text-xs text-cyber-gray tracking-widest">CİHAZ ADI</div>
                <div className="text-xl text-white font-bold my-1">{dev.name || dev.mac}</div>
                {dev.cow_id && (
                  <div className="text-sm text-cyber-purple my-1">🐄 {dev.cow_id}</div>
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
              </div>
            ))}
          {devices.length === 0 && (
            <div className="text-cyber-gray">Henüz veritabanına kayıtlı cihaz yok...</div>
          )}
          {searchQuery && devices.filter(dev => 
            dev.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            dev.mac?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            dev.cow_id?.toLowerCase().includes(searchQuery.toLowerCase())
          ).length === 0 && (
            <div className="col-span-full text-center py-12 text-cyber-gray">
              "{searchQuery}" için cihaz bulunamadı
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DevicesView;