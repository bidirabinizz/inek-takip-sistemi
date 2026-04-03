import React, { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Brush } from "recharts";
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { detectSteps, classifyActivityRaw, isNightHour } from '../utils/activityUtils';
import { movingAverage, stdDev, mean } from '../utils/mathUtils';
import {
  fetchSummaryData,
  fetchAlarmDevicesData,
  fetchActivityStatus,
  fetchDeviceNamesData,
  fetchLiveSensorData,
  updateDeviceSteps,
  updateActivityData
} from '../services/dashboardService';
import KPICard from '../components/KPICard';
import AlarmTable from '../components/AlarmTable';

const ACTIVITY_META = {
  LYING: { label: "YATIYOR", icon: "🌙", color: "#818cf8", desc: "Uzun süreli hareketsizlik veya gece saati" },
  STANDING: { label: "AYAKTA DURAĞAN", icon: "🐄", color: "#60a5fa", desc: "Kısa süreli hareketsizlik" },
  WALKING: { label: "YÜRÜYOR", icon: "🚶", color: "#fbbf24", desc: "Ritmik hareket halinde" },
  EXCITED: { label: "KIZGIN / ATLIYOR", icon: "⚡", color: "#f87171", desc: "Yüksek ani ivme patlaması!" },
  UNKNOWN: { label: "BİLİNMİYOR", icon: "❓", color: "#9ca3af", desc: "Veri toplanıyor..." },
};

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
  const [steps,            setSteps]            = useState(0);
  const [status,           setStatus]           = useState("connecting");
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDevice,   setSelectedDevice]   = useState("");
  const [activity,         setActivity]         = useState("UNKNOWN");
  const [debugInfo,        setDebugInfo]        = useState(null);
  const [lyingMins,        setLyingMins]        = useState(0);
  const [summaryData,      setSummaryData]      = useState(null);
  const [alarmDevices,     setAlarmDevices]     = useState([]);

  const selectedDeviceRef  = useRef("");
  const peakStateRef       = useRef("VALLEY");
  const lastStepTimeRef    = useRef(0);
  const lastFetchedTimeRef = useRef(null);
  const recentStepTimesRef = useRef([]);
  const recentMagsRef      = useRef([]);

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

  const fetchAktiviteDurum = useCallback(async (mac) => {
    if (!mac) return;
    try {
      const data = await fetchActivityStatus(mac);
      if (data.final_activity) setActivity(data.final_activity);
      if (data.lying_total_mins !== undefined) setLyingMins(data.lying_total_mins);
      if (data.still_mins !== undefined) {
        setDebugInfo(prev => prev ? { ...prev, stillMn: data.still_mins } : { stillMn: data.still_mins });
      }
    } catch (err) {
      console.error("Durum çekilemedi", err);
    }
  }, []);

  const handleDeviceChange = useCallback((mac) => {
    selectedDeviceRef.current = mac; setSelectedDevice(mac);
    setChartData([]); setSteps(0); setActivity("UNKNOWN"); setDebugInfo(null); setLyingMins(0);
    peakStateRef.current = "VALLEY"; lastStepTimeRef.current = 0; lastFetchedTimeRef.current = null;
    recentStepTimesRef.current = []; recentMagsRef.current = [];
    fetchAktiviteDurum(mac); 
  }, [fetchAktiviteDurum]);

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

      const sorted     = [...newRecords].sort((a, b) => new Date(a.time) - new Date(b.time));
      const rawMags    = sorted.map(d => Math.sqrt(d.x**2 + d.y**2 + d.z**2));
      const smoothed   = movingAverage(rawMags, settings.WINDOW_SIZE);
      const timestamps = sorted.map(d => new Date(d.time).getTime());

      if (lastFetchedTimeRef.current === null) {
        recentMagsRef.current = [...recentMagsRef.current, ...rawMags].slice(-settings.ACTIVITY_BUFFER_SIZE);
        lastFetchedTimeRef.current = sorted[sorted.length - 1].time;
        setChartData(prev => {
          const pts = sorted.map((d, i) => {
            const dateObj = new Date(d.time);
            return {
              timeLabel: dateObj.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              rawMag: parseFloat(rawMags[i].toFixed(3)),
              smoothMag: parseFloat(smoothed[i].toFixed(3)),
              z: parseFloat(d.z.toFixed(3)),
              x: parseFloat(d.x.toFixed(3)),
              y: parseFloat(d.y.toFixed(3)),
            };
          });
          return [...prev, ...pts].slice(-300);
        });
        return; 
      }

      const newSteps = detectSteps(smoothed, timestamps, peakStateRef, lastStepTimeRef, settings);
      const now = Date.now();
      
      if (newSteps > 0) {
        setSteps(prev => prev + newSteps);
        recentStepTimesRef.current.push(...Array(newSteps).fill(now));
        setDebugInfo(prev => prev ? { ...prev, stillMn: 0 } : { stillMn: 0 });
        updateDeviceSteps(currentMac, newSteps).catch(() => {});
      }

      recentStepTimesRef.current = recentStepTimesRef.current.filter(t => now - t < 8000);
      lastFetchedTimeRef.current = sorted[sorted.length - 1].time;

      recentMagsRef.current = [...recentMagsRef.current, ...rawMags].slice(-settings.ACTIVITY_BUFFER_SIZE);
      const recentPeakCount = recentStepTimesRef.current.length;
      const rawActivity = classifyActivityRaw(recentMagsRef.current, recentPeakCount, settings);

      if (recentMagsRef.current.length >= 5) {
        setDebugInfo(prev => ({
          ...prev,
          magStd: stdDev(recentMagsRef.current).toFixed(3),
          avgMag: mean(recentMagsRef.current).toFixed(3),
          peaks8s: recentPeakCount,
          night: isNightHour(settings) ? "EVET" : "HAYIR"
        }));
      }

      updateActivityData({
        mac: currentMac,
        steps: newSteps,
        raw_activity: rawActivity,
        data_start: sorted[0].time,
        data_end: sorted[sorted.length - 1].time
      }).then(data => {
        if (data.final_activity) setActivity(data.final_activity);
        if (typeof data.lying_total_mins === "number") setLyingMins(data.lying_total_mins);
        if (typeof data.still_mins === "number") setDebugInfo(p => ({ ...p, stillMn: data.still_mins }));
      }).catch(() => {});

      setChartData(prev => {
        const pts = sorted.map((d, i) => {
          const dateObj = new Date(d.time);
          return {
            timeLabel: dateObj.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            rawMag: parseFloat(rawMags[i].toFixed(3)),
            smoothMag: parseFloat(smoothed[i].toFixed(3)),
            z: parseFloat(d.z.toFixed(3)),
            x: parseFloat(d.x.toFixed(3)),
            y: parseFloat(d.y.toFixed(3)),
          };
        });
        return [...prev, ...pts].slice(-300);
      });

    } catch (err) { setStatus("error"); }
  }, [handleDeviceChange, settings]);

  useEffect(() => {
    fetchDeviceNames();
    fetchData();
    const id = setInterval(fetchData, settings.FETCH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchData, fetchDeviceNames, settings]);

  const resetSteps = () => {
    setSteps(0); peakStateRef.current = "VALLEY"; lastStepTimeRef.current = 0;
    recentStepTimesRef.current = []; recentMagsRef.current = [];
  };

  const statusColor = status === "live" ? "#00ffb4" : status === "error" ? "#ff4d6d" : "#f0c040";
  const statusLabel = status === "live" ? "CANLI" : status === "error" ? "HATA" : "BAĞLANIYOR";
  const actMeta = ACTIVITY_META[activity] ?? ACTIVITY_META.UNKNOWN;

  return (
    <>
      <div className="grid grid-cols-3 gap-4 py-5 px-9">
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

      <div className="mx-9 mb-9">
        <div className="bg-gradient-to-r from-purple-500/10 to-emerald-400/5 border border-purple-400/30 rounded-xl px-6 py-4 mb-4">
          <div className="text-xs tracking-widest text-purple-400 opacity-80 mb-1 uppercase">Geliştirici Modu</div>
          <div className="text-sm text-slate-200 font-semibold">Detaylı Analiz & Kalibrasyon</div>
        </div>

        <header className="flex items-center justify-between px-6 py-4 bg-white/5 border border-emerald-400/10 rounded-xl mb-4">
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
          <div className="flex items-center gap-4">
             <div className="text-[#00ffb4] text-sm">Lokal Adım: <b className="text-base">{steps}</b></div>
             <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-full">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}`, animation: status === "live" ? "pulse 1.5s infinite" : "none" }} 
              />
              <span className="text-[11px] tracking-widest" style={{ color: statusColor }}>{statusLabel}</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-[1fr_300px] gap-4">
          <div className="bg-white/5 border border-amber-400/15 rounded-xl px-6 py-5">
            <div className="text-[10px] tracking-widest text-amber-400 opacity-70 mb-1">HİBRİD AKTİVİTE KALİBRASYON REHBERİ</div>
            <div className="text-[11px] text-slate-400 mb-3.5">Debug panelini izleyerek eşikleri güncelle. Yatma süresi artık sunucuda tutulur — tüm cihazlarda senkronize görünür.</div>
            <div className="p-3 mb-4 bg-indigo-400/5 border border-indigo-400/20 rounded-lg text-xs leading-loose">
              <div className="text-indigo-400 font-bold mb-1">Karar Ağacı:</div>
              <div><span className="text-red-400">EXCITED_MAG aşıldı</span> → ⚡ Kızgın/Atlıyor</div>
              <div><span className="text-amber-400">Std yüksek + Adım var</span> → 🚶 Yürüyor</div>
              <div><span className="text-indigo-400">Std düşük + Gece (22-06)</span> → 🌙 Yatıyor</div>
              <div><span className="text-indigo-400">Std düşük + Gündüz + ≥{settings.LYING_STILL_MIN_MINUTES} dk</span> → 🌙 Yatıyor</div>
              <div><span className="text-blue-400">Std düşük + Gündüz + {settings.LYING_STILL_MIN_MINUTES} dk</span> → 🐄 Ayakta Durağan</div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-slate-400 leading-loose">
              {[
                ["EXCITED_MAG", settings.EXCITED_MAG, "Kızgın anındaki max Avg Mag"],
                ["WALK_STD_MIN", settings.WALK_STD_MIN, "Yürürken Mag Std minimumu"],
                ["STILL_STD_MAX", settings.STILL_STD_MAX, "Durağan haldeki max Std"],
                ["LYING_STILL_MIN", settings.LYING_STILL_MIN_MINUTES, "Gündüz yatma eşiği (dk)"],
              ].map(([k, v, desc]) => (
                <div key={k}><span className="text-amber-400 font-semibold">{k}: </span><span className="text-slate-200">{v} </span><span className="text-slate-500">— {desc}</span></div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 border border-rose-400/15 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="text-[10px] tracking-widest text-rose-400 opacity-70 mb-2">KONTROL</div>
              <div className="text-xs text-slate-400 leading-relaxed">Adım sayacını ve algoritma durumunu sıfırlar.</div>
            </div>
            <button 
              onClick={resetSteps} 
              className="mt-5 bg-rose-400/10 hover:bg-rose-400/20 border border-rose-400/40 text-rose-400 rounded-lg py-2.5 text-xs w-full tracking-widest transition-colors"
            >
              SIFIRLA
            </button>
          </div>
        </div>

        <div 
          className="mt-6 border rounded-xl px-7 py-4 flex items-center gap-5 transition-colors duration-500"
          style={{ background: `${actMeta.color}11`, borderColor: `${actMeta.color}44` }}
        >
          <span className="text-4xl">{actMeta.icon}</span>
          <div>
            <div className="text-[10px] tracking-widest opacity-70" style={{ color: actMeta.color }}>GÜNCEL AKTİVİTE</div>
            <div className="text-[22px] font-bold" style={{ color: actMeta.color }}>
              {actMeta.label}
              {activity === "LYING" && lyingMins > 0 && <span className="text-sm font-normal ml-3 opacity-70">(bugün toplam {lyingMins} dk)</span>}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{actMeta.desc}</div>
          </div>

          {debugInfo && (
            <div className="ml-auto grid grid-cols-2 gap-x-7 gap-y-1 mt-1 text-[11px]">
              {[
                ["Mag Std",  debugInfo.magStd,  "#fbbf24", `Yürüyüş: ${settings.WALK_STD_MIN}–${settings.WALK_STD_MAX}`],
                ["Avg Mag",  debugInfo.avgMag,  "#00ffb4", `Durağan: ${settings.STILL_MAG_MIN}–${settings.STILL_MAG_MAX}`],
                ["8s Adım",  debugInfo.peaks8s, "#f472b6", `Min: ${settings.WALK_PEAKS_MIN}`],
                ["Durağan",  `${debugInfo.stillMn} dk`, "#818cf8", `≥${settings.LYING_STILL_MIN_MINUTES}dk = YATIYOR`],
                ["Gece mi?", debugInfo.night,   "#60a5fa", `22:00–${settings.LYING_NIGHT_END}:00 = YATIYOR`],
              ].map(([k, v, c, hint]) => (
                <div key={k} title={hint}><span className="text-slate-400">{k}: </span><span style={{ color: c, fontWeight: 600 }}>{v}</span></div>
              ))}
            </div>
          )}
        </div>

        <div className="my-6 bg-white/5 border border-emerald-400/10 rounded-xl pt-6 px-4 pb-4">
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
              <Line type="monotone" dataKey="smoothMag" stroke="#00ffb4" strokeWidth={2.5} dot={false} isAnimationActive={false} name="Filtrelenmiş" />
              <Line type="monotone" dataKey="z" stroke="#7dd3fc" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Z" />
              <Brush dataKey="timeLabel" height={25} stroke="#4a6070" fill="rgba(0,255,180,0.05)" travellerWidth={10} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
