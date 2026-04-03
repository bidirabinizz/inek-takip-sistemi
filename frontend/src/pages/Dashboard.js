import React, { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Brush } from "recharts";
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  fetchSummaryData,
  fetchAlarmDevicesData,
  fetchDeviceNamesData,
  fetchLiveSensorData
} from '../services/dashboardService';
import KPICard from '../components/KPICard';
import AlarmTable from '../components/AlarmTable';
import { API_BASE } from '../config';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-950/90 border border-emerald-400/30 rounded-lg py-2 px-3 text-xs text-slate-200">
      <div className="text-emerald-400 mb-1 font-bold">{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{parseFloat(p.value).toFixed(3)}</strong>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { settings, fetchSettings } = useAppContext();
  const { isAuthenticated } = useAuth();
  
  const [availableDevicesData, setAvailableDevicesData] = useState([]);
  const [chartData,        setChartData]        = useState([]);
  const [status,           setStatus]           = useState("connecting");
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDevice,   setSelectedDevice]   = useState("");
  const [summaryData,      setSummaryData]      = useState(null);
  const [alarmDevices,     setAlarmDevices]     = useState([]);

  const selectedDeviceRef  = useRef("");
  const lastFetchedTimeRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await fetchSummaryData();
      setSummaryData(data);
    } catch (err) {
      console.error("Dashboard summary çekilemedi:", err);
    }
  }, []);

  const fetchAlarmDevices = useCallback(async () => {
    try {
      const data = await fetchAlarmDevicesData();
      setAlarmDevices(data);
    } catch (err) {
      console.error("Alarm cihazları çekilemedi:", err);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSummary();
      fetchAlarmDevices();
    }
  }, [isAuthenticated, fetchSummary, fetchAlarmDevices]);

  const handleDeviceChange = useCallback((mac) => {
    selectedDeviceRef.current = mac;
    setSelectedDevice(mac);
    setChartData([]);
    lastFetchedTimeRef.current = null;
  }, []);

  const fetchDeviceNames = useCallback(async () => {
    try {
      const data = await fetchDeviceNamesData();
      setAvailableDevicesData(data);
    } catch (err) { console.error("İsim çekme hatası:", err); }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const json = await fetchLiveSensorData();
      setStatus("live");
      if (!json?.length) return;

      const macs = [...new Set(json.map(d => d.mac).filter(Boolean))];
      setAvailableDevices(prev => {
        const merged = [...new Set([...prev, ...macs])];
        if (!selectedDeviceRef.current && merged.length > 0) handleDeviceChange(merged[0]);
        return merged;
      });

      const currentMac = selectedDeviceRef.current;
      if (!currentMac) return;

      const targetData = json.filter(d => d.mac === currentMac);
      if (!targetData.length) return;

      const newRecords = lastFetchedTimeRef.current
        ? targetData.filter(d => new Date(d.time) > new Date(lastFetchedTimeRef.current))
        : targetData;
      if (!newRecords.length) return;

      const sorted = [...newRecords].sort((a, b) => new Date(a.time) - new Date(b.time));
      
      // Sadece veri topla - backend tüm hesaplamaları yapıyor
      if (lastFetchedTimeRef.current === null) {
        lastFetchedTimeRef.current = sorted[sorted.length - 1].time;
        setChartData(prev => {
          const pts = sorted.map((d) => {
            const dateObj = new Date(d.time);
            return {
              timeLabel: dateObj.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              rawMag: parseFloat(Math.sqrt(d.x**2 + d.y**2 + d.z**2).toFixed(3)),
              z: parseFloat(d.z.toFixed(3)),
              x: parseFloat(d.x.toFixed(3)),
              y: parseFloat(d.y.toFixed(3)),
            };
          });
          return [...prev, ...pts].slice(-300);
        });
        return;
      }

      lastFetchedTimeRef.current = sorted[sorted.length - 1].time;

      setChartData(prev => {
        const pts = sorted.map((d) => {
          const dateObj = new Date(d.time);
          return {
            timeLabel: dateObj.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            rawMag: parseFloat(Math.sqrt(d.x**2 + d.y**2 + d.z**2).toFixed(3)),
            z: parseFloat(d.z.toFixed(3)),
            x: parseFloat(d.x.toFixed(3)),
            y: parseFloat(d.y.toFixed(3)),
          };
        });
        return [...prev, ...pts].slice(-300);
      });

    } catch (err) { setStatus("error"); }
  }, [handleDeviceChange]);

  // WebSocket bağlantısı kur
  useEffect(() => {
    let ws;
    const connectWebSocket = () => {
      // WebSocket URL oluştur
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.hostname || 'localhost';
      const wsPort = '8000'; // Django varsayılan port
      const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws/sensor-data/`;
      
      console.log("[WebSocket] Bağlanıyor:", wsUrl);
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WebSocket] Bağlantı kabul edildi.");
        setStatus("live");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'sensor_update') {
            const data = message.data;
            console.log("[WebSocket] Yeni veri alındı:", data);
            
            // Cihaz listesini güncelle
            if (data.mac) {
              setAvailableDevices(prev => {
                const merged = [...new Set([...prev, data.mac])];
                if (!selectedDeviceRef.current && merged.length > 0) {
                  handleDeviceChange(merged[0]);
                }
                return merged;
              });
              
              // Grafik verilerini güncelle
              const currentMac = selectedDeviceRef.current;
              if (currentMac && data.mac === currentMac) {
                const now = new Date();
                const timeLabel = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                
                setChartData(prev => {
                  const newPoint = {
                    timeLabel,
                    rawMag: parseFloat(Math.sqrt(data.x**2 + data.y**2 + data.z**2).toFixed(3)),
                    z: parseFloat(data.z.toFixed(3)),
                    x: parseFloat(data.x.toFixed(3)),
                    y: parseFloat(data.y.toFixed(3)),
                  };
                  return [...prev, newPoint].slice(-300);
                });
              }
            }
          }
        } catch (err) {
          console.error("[WebSocket] Mesaj işleme hatası:", err);
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Hata:", error);
        setStatus("error");
      };

      ws.onclose = (event) => {
        console.log(`[WebSocket] Bağlantı kapandı. Kod: ${event.code}`);
        setStatus("connecting");
        
        // 3 saniye sonra yeniden bağlan
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            connectWebSocket();
          }
        }, 3000);
      };
    };

    connectWebSocket();

    // Cleanup
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [handleDeviceChange]);

  // İlk veri çekme (cihaz isimleri için)
  useEffect(() => {
    fetchDeviceNames();
  }, [fetchDeviceNames]);


  const statusColor = status === "live" ? "#00ffb4" : status === "error" ? "#ff4d6d" : "#f0c040";
  const statusLabel = status === "live" ? "CANLI" : status === "error" ? "HATA" : "BAĞLANIYOR";

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-5 px-4 md:px-9">
        <KPICard 
          label="TOPLAM HAYVAN" 
          value={summaryData?.total_active_animals || 0} 
          description="Aktif hayvanlar" 
          icon="🐄" 
          colorHex="#00ffb4" 
        />
        <KPICard 
          label="ALARMLI İNEKLER" 
          value={summaryData?.excited_animals || 0} 
          description="Kızgınlık alarmı" 
          icon="⚡" 
          colorHex="#f87171" 
        />
        <KPICard 
          label="GÜNLÜK TOPLAM ADIM" 
          value={summaryData?.total_steps || 0} 
          description="Tüm cihazlar" 
          icon="🦶" 
          colorHex="#fbbf24" 
        />
      </div>

      <AlarmTable alarmDevices={alarmDevices} />

      <div className="mx-4 md:mx-9 mb-4 md:mb-9">
        <div className="bg-gradient-to-r from-purple-500/10 to-emerald-400/5 border border-purple-400/30 rounded-xl px-6 py-4 mb-4">
          <div className="text-xs tracking-widest text-purple-400 opacity-80 mb-1 uppercase">Geliştirici Modu</div>
          <div className="text-sm text-slate-200 font-semibold">Detaylı Analiz & Kalibrasyon</div>
        </div>

        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 px-4 md:px-6 py-4 bg-white/5 border border-emerald-400/10 rounded-xl mb-4">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 tracking-widest">SENSÖR SEÇ:</span>
            <select
              value={selectedDevice}
              onChange={e => handleDeviceChange(e.target.value)}
              className="bg-slate-900 border border-emerald-400 text-emerald-400 px-4 py-2 rounded-lg text-sm outline-none cursor-pointer"
            >
              {availableDevices.length === 0 ? <option value="">Bekleniyor...</option> : availableDevices.map(mac => ( <option key={mac} value={mac}>{availableDevicesData?.find(d => d.mac === mac)?.name || mac}</option> ))}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-full">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}`, animation: status === "live" ? "pulse 1.5s infinite" : "none" }}
            />
            <span className="text-[11px] tracking-widest" style={{ color: statusColor }}>{statusLabel}</span>
          </div>
        </header>


        <div className="my-4 md:my-6 bg-white/5 border border-emerald-400/10 rounded-xl pt-4 md:pt-6 px-4 pb-4">
          <div className="flex justify-between items-center mb-4 pl-2">
            <div>
              <div className="text-[10px] tracking-widest text-emerald-400 opacity-60 mb-0.5">CANLI VERİ AKIŞI</div>
              <div className="text-sm text-slate-200 font-semibold">Ham Magnitude vs Filtrelenmiş Sinyal</div>
            </div>
            <div className="flex gap-5 text-[11px]">
              <span className="text-slate-400">— Ham</span>
              <span className="text-emerald-400">— Filtrelenmiş</span>
              <span className="text-sky-300">— Z</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="timeLabel" tick={{ fontSize: 10, fill: "#4a6070" }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} interval="preserveStartEnd" />
              <YAxis domain={[0, 20]} tick={{ fontSize: 10, fill: "#4a6070" }} tickLine={false} axisLine={false} width={32} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={settings.MAG_PEAK_THRESHOLD} stroke="#fbbf24" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "PEAK", position: "insideTopRight", fontSize: 9, fill: "#fbbf24" }} />
              <ReferenceLine y={settings.MAG_VALLEY_THRESHOLD} stroke="#f472b6" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: "VALLEY", position: "insideBottomRight", fontSize: 9, fill: "#f472b6" }} />
              <ReferenceLine y={settings.EXCITED_MAG} stroke="#f87171" strokeDasharray="6 3" strokeOpacity={0.3} label={{ value: "KIZGINLIK", position: "insideTopLeft", fontSize: 9, fill: "#f87171" }} />
              <Line type="monotone" dataKey="rawMag" stroke="rgba(100,120,140,0.45)" strokeWidth={1} dot={false} isAnimationActive={false} name="Ham Mag" />
              <Line type="monotone" dataKey="z" stroke="#7dd3fc" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Z" />
              <Brush dataKey="timeLabel" height={25} stroke="#4a6070" fill="rgba(0,255,180,0.05)" travellerWidth={10} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
