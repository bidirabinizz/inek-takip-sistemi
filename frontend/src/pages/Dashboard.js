import React, { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Brush } from "recharts";
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  fetchSummaryData,
  fetchAlarmDevicesData,
  fetchDeviceNamesData,
  fetchLiveSensorData,
  fetchActivityStatus
} from '../services/dashboardService';
import KPICard from '../components/KPICard';
import AlarmTable from '../components/AlarmTable';
import { API_BASE } from '../config';
import { getActivityLabel, getActivityColor } from '../constants/activityTranslations';

// Helper: Calculate standard deviation
const calculateStdDev = (values) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800/90 border border-slate-600 rounded-lg py-2 px-3 text-xs text-slate-200">
      <div className="text-indigo-400 mb-1 font-bold">{label}</div>
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
  const [stillnessTimer,   setStillnessTimer]   = useState(0);
  const [isStill,          setIsStill]          = useState(false);
  const [activityStatus,   setActivityStatus]   = useState({ final_activity: 'Durağan / Ayakta' });
  const [tick,             setTick]             = useState(0);

  const selectedDeviceRef  = useRef("");
  const lastFetchedTimeRef = useRef(null);
  const wsRef = useRef(null);
  const stillnessTimerRef = useRef(null);
  const stillnessStartTimeRef = useRef(null);
  const dataBuffer = useRef([]);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isStill && stillnessStartTimeRef.current) {
        const elapsed = Math.floor((Date.now() - stillnessStartTimeRef.current) / 1000);
        setStillnessTimer(elapsed);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isStill]);

  // Buffer flush interval - flushes dataBuffer to chartData every 1000ms
  useEffect(() => {
    const flushInterval = setInterval(() => {
      if (dataBuffer.current.length > 0) {
        setChartData(prev => {
          const updated = [...prev, ...dataBuffer.current];
          dataBuffer.current = []; // Clear buffer after flushing
          return updated.slice(-300);
        });
      }
    }, 1000);
    return () => clearInterval(flushInterval);
  }, []);

  useEffect(() => {
    resetStillnessTimer();
  }, [selectedDevice]);

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

  const resetStillnessTimer = useCallback(() => {
    setStillnessTimer(0);
    setIsStill(false);
    stillnessStartTimeRef.current = null;
  }, []);

  const checkStillness = useCallback((mag, std) => {
    const { STILL_STD_MAX, STILL_MAG_MIN, STILL_MAG_MAX, WALK_STD_MIN, LYING_STILL_MIN_MINUTES } = settings;
    
    const isStillRange = std <= STILL_STD_MAX && mag >= STILL_MAG_MIN && mag <= STILL_MAG_MAX;
    const isMoving = std > WALK_STD_MIN;

    if (isMoving) {
      resetStillnessTimer();
      return;
    }

    if (isStillRange) {
      if (!isStill) {
        setIsStill(true);
        stillnessStartTimeRef.current = Date.now();
        setStillnessTimer(0);
      }
    } else {
      resetStillnessTimer();
    }
  }, [settings, isStill, resetStillnessTimer]);

  useEffect(() => {
    if (selectedDevice) {
      fetchActivityStatus(selectedDevice)
        .then(status => setActivityStatus(status))
        .catch(err => {
          console.error("Activity status fetch error:", err);
          setActivityStatus({ final_activity: 'Durağan / Ayakta' });
        });
    }
  }, [selectedDevice]);

  const fetchDeviceNames = useCallback(async () => {
    try {
      const data = await fetchDeviceNamesData();
      setAvailableDevicesData(data.results || data || []);
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

      if (sorted.length > 0) {
        const latest = sorted[sorted.length - 1];
        const mag = Math.sqrt(latest.x**2 + latest.y**2 + latest.z**2);
        const std = calculateStdDev([latest.x, latest.y, latest.z]);
        checkStillness(mag, std);
      }

    } catch (err) { setStatus("error"); }
  }, [handleDeviceChange, checkStillness]);

  useEffect(() => {
    let ws;
    const connectWebSocket = () => {
      let wsUrl = '';
      
      if (API_BASE && API_BASE.startsWith('http')) {
          wsUrl = API_BASE.replace(/^http/, 'ws') + '/ws/sensor-data/';
      } else {
          const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsHost = '192.168.170.6';
          wsUrl = `${wsProtocol}//${wsHost}:8000/ws/sensor-data/`;
      }
      
      console.log("[WebSocket] Kesin hedef adres:", wsUrl);
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WebSocket] Bağlantı kabul edildi.");
        reconnectAttempts.current = 0;
        setStatus("live");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'sensor_update') {
            const data = message.data;
            
            if (data.mac) {
              setAvailableDevices(prev => {
                const merged = [...new Set([...prev, data.mac])];
                if (!selectedDeviceRef.current && merged.length > 0) {
                  handleDeviceChange(merged[0]);
                }
                return merged;
              });
              
              const currentMac = selectedDeviceRef.current;
              if (currentMac && data.mac === currentMac) {
                const now = new Date();
                const timeLabel = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                
                const newPoint = {
                  timeLabel,
                  rawMag: parseFloat(Math.sqrt(data.x**2 + data.y**2 + data.z**2).toFixed(3)),
                  z: parseFloat(data.z.toFixed(3)),
                  x: parseFloat(data.x.toFixed(3)),
                  y: parseFloat(data.y.toFixed(3)),
                };
                dataBuffer.current.push(newPoint);
                setTick(prevTick => prevTick + 1);

                const mag = Math.sqrt(data.x**2 + data.y**2 + data.z**2);
                const std = calculateStdDev([data.x, data.y, data.z]);
                checkStillness(mag, std);
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
        
        reconnectAttempts.current += 1;
        const baseDelay = 3000;
        const maxDelay = 60000;
        const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts.current), maxDelay);
        
        console.log(`[WebSocket] Yeniden bağlanılıyor... Deneme: ${reconnectAttempts.current}, Bekleme: ${delay}ms`);
        
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            connectWebSocket();
          }
        }, delay);
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [handleDeviceChange, checkStillness]);

  useEffect(() => {
    fetchDeviceNames();
    fetchData();
  }, [fetchDeviceNames, fetchData, selectedDevice]);

  const sleepThresholdSeconds = settings.LYING_STILL_MIN_MINUTES * 60;
  const isSleeping = isStill && stillnessTimer >= sleepThresholdSeconds;
  
  const displayStatus = isSleeping ? "sleeping" : status;
  const displayStatusColor = isSleeping ? "#818cf8" : status === "live" ? "#10b981" : status === "error" ? "#f87171" : "#fbbf24";
  const displayStatusLabel = isSleeping ? "UYKUDA" : status === "live" ? "CANLI" : status === "error" ? "HATA" : "BAĞLANIYOR";

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard 
          label="TOPLAM HAYVAN" 
          value={summaryData?.total_active_animals || 0} 
          description="Aktif hayvanlar" 
          icon="🐄" 
          colorHex="#10b981" 
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

      {/* Alarm Table */}
      <AlarmTable alarmDevices={alarmDevices} />

      {/* Live Monitoring Section */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 md:p-6 shadow-md">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 tracking-widest">SENSÖR SEÇ:</span>
            <select
              value={selectedDevice}
              onChange={e => handleDeviceChange(e.target.value)}
              className="bg-slate-900 border border-slate-600 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {availableDevices.length === 0 ? <option value="">Bekleniyor...</option> : availableDevices.map(mac => (
                <option key={mac} value={mac}>{availableDevicesData?.find(d => d.mac === mac)?.name || mac}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-full">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: displayStatusColor }}
            />
            <span className="text-xs tracking-widest" style={{ color: displayStatusColor }}>{displayStatusLabel}</span>
          </div>
          {selectedDevice && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                backgroundColor: `${getActivityColor(activityStatus.final_activity)}20`,
                border: `1px solid ${getActivityColor(activityStatus.final_activity)}40`
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: getActivityColor(activityStatus.final_activity) }}
              />
              <span className="text-xs tracking-widest" style={{ color: getActivityColor(activityStatus.final_activity) }}>
                {getActivityLabel(activityStatus.final_activity)}
              </span>
            </div>
          )}
        </div>

        {/* Sleep Timer Display */}
        {isStill && (
          <div className={`mb-4 px-4 py-3 rounded-lg border ${isSleeping ? 'bg-indigo-900/20 border-indigo-500/40' : 'bg-blue-900/20 border-blue-500/30'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">{isSleeping ? '😴' : '🛏️'}</span>
                <div>
                  <div className="text-sm font-semibold text-slate-200">
                    {isSleeping ? 'UYKUDA / YATIYOR' : 'Hareketsizlik Tespit Edildi'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {isSleeping
                      ? `Hayvan ${Math.floor(stillnessTimer / 60)} dakikadır ${stillnessTimer % 60} saniyedir hareketsiz`
                      : `${stillnessTimer} saniyedir hareketsiz - ${settings.LYING_STILL_MIN_MINUTES} dk eşik değeri`}
                  </div>
                </div>
              </div>
              <div className={`text-xl font-mono font-bold ${isSleeping ? 'text-indigo-400' : 'text-blue-400'}`}>
                {Math.floor(stillnessTimer / 60)}:{(stillnessTimer % 60).toString().padStart(2, '0')}
              </div>
            </div>
            <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${isSleeping ? 'bg-indigo-400' : 'bg-blue-400'}`}
                style={{ width: `${Math.min((stillnessTimer / sleepThresholdSeconds) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Live Chart */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 md:p-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-3">
            <div className="text-xs tracking-widest text-indigo-400 opacity-80">CANLI VERİ AKIŞI</div>
            <div className="flex gap-3 text-xs">
              <span className="text-slate-400">— Ham</span>
              <span className="text-emerald-400">— Filtrelenmiş</span>
              <span className="text-sky-300">— Z</span>
            </div>
          </div>

          {(!selectedDevice || chartData.length === 0) ? (
            <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">
              Grafik verisi bekleniyor veya cihaz seçilmedi...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart key={`chart-${tick}`} data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} syncId="anyId">
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="timeLabel" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} interval="preserveStartEnd" />
                <YAxis domain={[0, 20]} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} width={32} />
                <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                <ReferenceLine y={settings.MAG_PEAK_THRESHOLD} stroke="#fbbf24" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "PEAK", position: "insideTopRight", fontSize: 9, fill: "#fbbf24" }} />
                <ReferenceLine y={settings.MAG_VALLEY_THRESHOLD} stroke="#f472b6" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: "VALLEY", position: "insideBottomRight", fontSize: 9, fill: "#f472b6" }} />
                <ReferenceLine y={settings.EXCITED_MAG} stroke="#f87171" strokeDasharray="6 3" strokeOpacity={0.3} label={{ value: "KIZGINLIK", position: "insideTopLeft", fontSize: 9, fill: "#f87171" }} />
                <Line type="monotone" dataKey="rawMag" stroke="rgba(148,163,184,0.45)" strokeWidth={1} dot={false} isAnimationActive={false} name="Ham Mag" />
                <Line type="monotone" dataKey="z" stroke="#7dd3fc" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Z" />
                <Brush dataKey="timeLabel" height={25} stroke="#64748b" fill="rgba(99,102,241,0.05)" travellerWidth={10} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
