import React, { useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAppContext } from './context/AppContext';
import { useAuth, AuthProvider } from './context/AuthContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Brush
} from "recharts";
import { API_BASE } from './config';
import Navbar from './components/Navbar';
import DevicesView from './pages/Devices';
import DeviceReport from './pages/DeviceReport';
import { AppProvider } from './context/AppContext';
import LoginForm from './components/LoginForm';
import Settings from './pages/Settings';
import Animals from './pages/Animals';
// 🚀 ROO'NUN SİLDİĞİ YETKİLENDİRME ROTALARI GERİ GELDİ!
import Users from './pages/Users';
import ProtectedRoute from './components/ProtectedRoute';

const ACTIVITY_META = {
  LYING: { label: "YATIYOR", icon: "🌙", color: "#818cf8", desc: "Uzun süreli hareketsizlik veya gece saati" },
  STANDING: { label: "AYAKTA DURAĞAN", icon: "🐄", color: "#60a5fa", desc: "Kısa süreli hareketsizlik" },
  WALKING: { label: "YÜRÜYOR", icon: "🚶", color: "#fbbf24", desc: "Ritmik hareket halinde" },
  EXCITED: { label: "KIZGIN / ATLIYOR", icon: "⚡", color: "#f87171", desc: "Yüksek ani ivme patlaması!" },
  UNKNOWN: { label: "BİLİNMİYOR", icon: "❓", color: "#9ca3af", desc: "Veri toplanıyor..." },
};

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

function movingAverage(arr, w) {
  return arr.map((_, i) => {
    const sl = arr.slice(Math.max(0, i - w + 1), i + 1);
    return sl.reduce((a, b) => a + b, 0) / sl.length;
  });
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function isNightHour(settings) {
  const h = new Date().getHours();
  return h >= settings.LYING_NIGHT_START || h < settings.LYING_NIGHT_END;
}

function classifyActivityRaw(mags, recentPeakCount, settings) {
  if (!mags || mags.length < 10) return "UNKNOWN";

  const avgMag = mean(mags);
  const magStd = stdDev(mags);

  const excitedCount = mags.filter(m => m > settings.EXCITED_MAG).length;
  if (excitedCount >= settings.EXCITED_COUNT) return "EXCITED";

  const stdInWalkRange = magStd >= settings.WALK_STD_MIN && magStd <= settings.WALK_STD_MAX;
  const hasRhythm      = recentPeakCount >= settings.WALK_PEAKS_MIN;

  if (stdInWalkRange && hasRhythm) return "WALKING";

  if (magStd < settings.STILL_STD_MAX &&
      avgMag > settings.STILL_MAG_MIN &&
      avgMag < settings.STILL_MAG_MAX) return "STILL";

  return "UNKNOWN";
}

function detectSteps(smoothedMags, timestamps, stateRef, lastStepTimeRef, settings) {
  let newSteps = 0;
  for (let i = 0; i < smoothedMags.length; i++) {
    const mag  = smoothedMags[i];
    const time = timestamps[i];
    switch (stateRef.current) {
      case "VALLEY":
        if (mag > settings.MAG_PEAK_THRESHOLD) stateRef.current = "RISING";
        break;
      case "RISING":
        if (mag < settings.MAG_PEAK_THRESHOLD) stateRef.current = "FALLING";
        break;
      case "FALLING":
        if (mag <= settings.MAG_VALLEY_THRESHOLD) {
          if (time - lastStepTimeRef.current >= settings.COOLDOWN_MS) {
            newSteps++;
            lastStepTimeRef.current = time;
          }
          stateRef.current = "VALLEY";
        } else if (mag > settings.MAG_PEAK_THRESHOLD) stateRef.current = "RISING";
        break;
      default:
        stateRef.current = "VALLEY";
    }
  }
  return newSteps;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(10,10,20,0.92)", border: "1px solid rgba(0,255,180,0.3)", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#e0e0e0" }}>
      <div style={{ color: "#00ffb4", marginBottom: 4, fontWeight: 700 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>{p.name}: <strong>{parseFloat(p.value).toFixed(3)}</strong></div>
      ))}
    </div>
  );
};


// ─────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────
function Dashboard() {
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
      const res = await fetch(`${API_BASE}/api/dashboard-summary/`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error("Dashboard summary çekilemedi:", err);
    }
  }, []);

  const fetchAlarmDevices = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cihazlar-heatmap/?alert=has_alarm`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setAlarmDevices(data);
      }
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
      const res = await fetch(`${API_BASE}/api/aktivite-durum/?mac=${mac}`, {
        credentials: 'include'
      });
      const data = await res.json();
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
      const res = await fetch(`${API_BASE}/api/cihazlar/`, {
        credentials: 'include'
      });
      if (res.ok) setAvailableDevicesData(await res.json());
    } catch (err) { console.error("İsim çekme hatası:", err); }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/gercek-sensor/`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
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

      const newSteps = detectSteps(smoothed, timestamps, peakStateRef, lastStepTimeRef, settings);
      const now = Date.now();
      
      if (newSteps > 0) {
        setSteps(prev => prev + newSteps);
        recentStepTimesRef.current.push(...Array(newSteps).fill(now));
        setDebugInfo(prev => prev ? { ...prev, stillMn: 0 } : { stillMn: 0 });
        fetch(`${API_BASE}/api/cihaz-guncelle/`, {
          method: "POST", headers: { "Content-Type": "application/json", 'X-CSRFToken': getCookie('csrftoken')},
          body: JSON.stringify({ mac: currentMac, steps: newSteps }),
          credentials: 'include'
        }).catch(() => {});
      }

      recentStepTimesRef.current = recentStepTimesRef.current.filter(t => now - t < 8000);
      lastFetchedTimeRef.current = sorted[sorted.length - 1].time;

      recentMagsRef.current = [...recentMagsRef.current, ...rawMags].slice(-settings.WINDOW);
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

      fetch(`${API_BASE}/api/aktivite-guncelle/`, {
        method: "POST", headers: { "Content-Type": "application/json", 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({
          mac: currentMac,
          steps: newSteps,
          raw_activity: rawActivity,
          data_start: sorted[0].time,
          data_end: sorted[sorted.length - 1].time
        }),
        credentials: 'include'
      })
      .then(r => r.json())
        .then(data => {
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
  }, [handleDeviceChange, settings]); // 🚀 EKSİK DEPENDENCY DÜZELTİLDİ

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
      {/* YENİ KPI KARTLARI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, padding: "20px 36px" }}>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #00ffb422", borderRadius: 12, padding: "20px 24px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -10, right: -10, fontSize: 48, opacity: 0.06, userSelect: "none" }}>🐄</div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#00ffb4", opacity: 0.7, marginBottom: 8 }}>TOPLAM HAYVAN</div>
          <div style={{ fontSize: 42, fontWeight: 700, color: "#00ffb4", lineHeight: 1, textShadow: `0 0 20px #00ffb455`, wordBreak: "break-all" }}>{summaryData?.total_active_animals || 0}</div>
          <div style={{ fontSize: 11, color: "#8899aa", marginTop: 4 }}>Aktif hayvanlar</div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #f8717122", borderRadius: 12, padding: "20px 24px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -10, right: -10, fontSize: 48, opacity: 0.06, userSelect: "none" }}>⚡</div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#f87171", opacity: 0.7, marginBottom: 8 }}>ALARMLI İNEKLER</div>
          <div style={{ fontSize: 42, fontWeight: 700, color: "#f87171", lineHeight: 1, textShadow: `0 0 20px #f8717155`, wordBreak: "break-all" }}>{summaryData?.excited_animals || 0}</div>
          <div style={{ fontSize: 11, color: "#8899aa", marginTop: 4 }}>Kızgınlık alarmı</div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #fbbf2422", borderRadius: 12, padding: "20px 24px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -10, right: -10, fontSize: 48, opacity: 0.06, userSelect: "none" }}>🦶</div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#fbbf24", opacity: 0.7, marginBottom: 8 }}>GÜNLÜK TOPLAM ADIM</div>
          <div style={{ fontSize: 42, fontWeight: 700, color: "#fbbf24", lineHeight: 1, textShadow: `0 0 20px #fbbf2455`, wordBreak: "break-all" }}>{summaryData?.total_steps || 0}</div>
          <div style={{ fontSize: 11, color: "#8899aa", marginTop: 4 }}>Tüm cihazlar</div>
        </div>
      </div>

      {/* ACİL DURUM TABLOSU */}
      {alarmDevices.length > 0 && (
        <div style={{ margin: "0 36px 24px", background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 12, padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 24 }}>🚨</span>
            <div>
              <div style={{ fontSize: 14, letterSpacing: 3, color: "#f87171", opacity: 0.7, marginBottom: 2 }}>ACİL DURUM</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f87171" }}>Alarmlı İnekler</div>
            </div>
            <div style={{ marginLeft: "auto", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#f87171", fontWeight: 600 }}>
              {alarmDevices.length} cihaz
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(248,113,113,0.2)" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: "#f87171", fontWeight: 600, letterSpacing: 1 }}>CİHAZ</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: "#f87171", fontWeight: 600, letterSpacing: 1 }}>HAYVAN</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: "#f87171", fontWeight: 600, letterSpacing: 1 }}>KIZGINLIK SKORU</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: "#f87171", fontWeight: 600, letterSpacing: 1 }}>DURUM</th>
                </tr>
              </thead>
              <tbody>
                {alarmDevices.map((device, idx) => (
                  <tr key={device.mac} style={{ borderBottom: idx < alarmDevices.length - 1 ? "1px solid rgba(248,113,113,0.1)" : "" }}>
                    <td style={{ padding: "12px 16px", color: "#fff", fontFamily: "monospace" }}>{device.name}</td>
                    <td style={{ padding: "12px 16px", color: "#c9d6e8" }}>
                      {device.animal ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>{device.animal.ear_tag}</div>
                          <div style={{ fontSize: 11, color: "#8899aa" }}>{device.animal.name || '-'}</div>
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 8, height: 8,
                          borderRadius: "50%",
                          background: "#f87171",
                          boxShadow: "0 0 8px #f87171"
                        }} />
                        <span style={{ color: "#f87171", fontWeight: 700, fontSize: 16 }}>{device.kizginlik_skoru.toFixed(0)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        background: "rgba(248,113,113,0.15)",
                        border: "1px solid rgba(248,113,113,0.4)",
                        color: "#f87171",
                        padding: "4px 12px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: 1
                      }}>ALARM</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GELİŞTİRİCİ MODU */}
      <div style={{ margin: "0 36px 36px" }}>
        <div style={{
          background: "linear-gradient(90deg, rgba(167,139,250,0.1) 0%, rgba(0,255,180,0.05) 100%)",
          border: "1px solid rgba(167,139,250,0.3)",
          borderRadius: 12,
          padding: "16px 24px 8px",
          marginBottom: 16
        }}>
          <div style={{ fontSize: 12, letterSpacing: 4, color: "#a78bfa", opacity: 0.8, marginBottom: 4, textTransform: "uppercase" }}>Geliştirici Modu</div>
          <div style={{ fontSize: 14, color: "#c9d6e8", fontWeight: 600 }}>Detaylı Analiz & Kalibrasyon</div>
        </div>

        {/* 🚀 ROO'NUN SİLDİĞİ CİHAZ SEÇİCİ TEKRAR GELDİ! (Unused Variables Hatasını Çözer) */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", background: "rgba(255,255,255,0.03)", borderRadius: 12, marginBottom: 16, border: "1px solid rgba(0,255,180,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "#8899aa", letterSpacing: 2 }}>SENSÖR SEÇ:</span>
            <select value={selectedDevice} onChange={e => handleDeviceChange(e.target.value)} style={{ background: "rgba(10,22,40,0.9)", border: "1px solid #00ffb4", color: "#00ffb4", padding: "8px 16px", borderRadius: 8, fontSize: 13, outline: "none", cursor: "pointer" }}>
              {availableDevices.length === 0 ? <option value="">Bekleniyor...</option> : availableDevices.map(mac => ( <option key={mac} value={mac}>{availableDevicesData?.find(d => d.mac === mac)?.name || mac}</option> ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
             <div style={{color: '#00ffb4', fontSize: 13}}>Lokal Adım: <b style={{fontSize: 16}}>{steps}</b></div>
             <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.2)", padding: "6px 12px", borderRadius: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, boxShadow: `0 0 8px ${statusColor}`, animation: status === "live" ? "pulse 1.5s infinite" : "none" }} />
              <span style={{ fontSize: 11, letterSpacing: 3, color: statusColor }}>{statusLabel}</span>
            </div>
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#fbbf24", opacity: 0.7, marginBottom: 4 }}>HİBRİD AKTİVİTE KALİBRASYON REHBERİ</div>
            <div style={{ fontSize: 11, color: "#4a6070", marginBottom: 14 }}>Debug panelini izleyerek eşikleri güncelle. Yatma süresi artık sunucuda tutulur — tüm cihazlarda senkronize görünür.</div>
            <div style={{ padding: "12px 16px", marginBottom: 16, background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.2)", borderRadius: 8, fontSize: 12, lineHeight: 2 }}>
              <div style={{ color: "#818cf8", fontWeight: 700, marginBottom: 4 }}>Karar Ağacı:</div>
              <div><span style={{ color: "#f87171" }}>EXCITED_MAG aşıldı</span> → ⚡ Kızgın/Atlıyor</div>
              <div><span style={{ color: "#fbbf24" }}>Std yüksek + Adım var</span> → 🚶 Yürüyor</div>
              <div><span style={{ color: "#818cf8" }}>Std düşük + Gece (22-06)</span> → 🌙 Yatıyor</div>
              <div><span style={{ color: "#818cf8" }}>Std düşük + Gündüz + ≥{settings.LYING_STILL_MIN_MINUTES} dk</span> → 🌙 Yatıyor</div>
              <div><span style={{ color: "#60a5fa" }}>Std düşük + Gündüz + {settings.LYING_STILL_MIN_MINUTES} dk</span> → 🐄 Ayakta Durağan</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 32px", fontSize: 12, color: "#8899aa", lineHeight: 2 }}>
              {[
                ["EXCITED_MAG", settings.EXCITED_MAG, "Kızgın anındaki max Avg Mag"],
                ["WALK_STD_MIN", settings.WALK_STD_MIN, "Yürürken Mag Std minimumu"],
                ["STILL_STD_MAX", settings.STILL_STD_MAX, "Durağan haldeki max Std"],
                ["LYING_STILL_MIN", settings.LYING_STILL_MIN_MINUTES, "Gündüz yatma eşiği (dk)"],
              ].map(([k, v, desc]) => (
                <div key={k}><span style={{ color: "#fbbf24", fontWeight: 600 }}>{k}: </span><span style={{ color: "#c9d6e8" }}>{v} </span><span style={{ color: "#6b7280" }}>— {desc}</span></div>
              ))}
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,77,109,0.15)", borderRadius: 12, padding: "24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#ff4d6d", opacity: 0.7, marginBottom: 8 }}>KONTROL</div>
              <div style={{ fontSize: 12, color: "#8899aa", lineHeight: 1.6 }}>Adım sayacını ve algoritma durumunu sıfırlar.</div>
            </div>
            <button onClick={resetSteps} style={{ marginTop: 20, background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.4)", color: "#ff4d6d", borderRadius: 8, padding: "10px 0", cursor: "pointer", fontSize: 12, width: "100%", letterSpacing: 2, fontFamily: "inherit", transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "rgba(255,77,109,0.2)"} onMouseOut={e => e.currentTarget.style.background = "rgba(255,77,109,0.1)"}>SIFIRLA</button>
          </div>
        </div>

        {/* GÜNCEL AKTİVİTE PANOSU */}
        <div style={{ margin: "24px 0 0", background: `${actMeta.color}11`, border: `1px solid ${actMeta.color}44`, borderRadius: 12, padding: "16px 28px", display: "flex", alignItems: "center", gap: 20, transition: "background 0.5s, border-color 0.5s" }}>
          <span style={{ fontSize: 36 }}>{actMeta.icon}</span>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 3, color: actMeta.color, opacity: 0.7 }}>GÜNCEL AKTİVİTE</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: actMeta.color }}>
              {actMeta.label}
              {activity === "LYING" && lyingMins > 0 && <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 12, color: actMeta.color, opacity: 0.7 }}>(bugün toplam {lyingMins} dk)</span>}
            </div>
            <div style={{ fontSize: 12, color: "#8899aa", marginTop: 2 }}>{actMeta.desc}</div>
          </div>

          {debugInfo && (
            <div style={{ marginLeft: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 28px", fontSize: 11 }}>
              {[
                ["Mag Std",  debugInfo.magStd,  "#fbbf24", `Yürüyüş: ${settings.WALK_STD_MIN}–${settings.WALK_STD_MAX}`],
                ["Avg Mag",  debugInfo.avgMag,  "#00ffb4", `Durağan: ${settings.STILL_MAG_MIN}–${settings.STILL_MAG_MAX}`],
                ["8s Adım",  debugInfo.peaks8s, "#f472b6", `Min: ${settings.WALK_PEAKS_MIN}`],
                ["Durağan",  `${debugInfo.stillMn} dk`, "#818cf8", `≥${settings.LYING_STILL_MIN_MINUTES}dk = YATIYOR`],
                ["Gece mi?", debugInfo.night,   "#60a5fa", `22:00–${settings.LYING_NIGHT_END}:00 = YATIYOR`],
              ].map(([k, v, c, hint]) => (
                <div key={k} title={hint}><span style={{ color: "#4a6070" }}>{k}: </span><span style={{ color: c, fontWeight: 600 }}>{v}</span></div>
              ))}
            </div>
          )}
        </div>

        {/* CANLI VERİ AKIŞI GRAFİĞİ */}
        <div style={{ margin: "24px 0 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,255,180,0.08)", borderRadius: 12, padding: "24px 16px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingLeft: 8 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#00ffb4", opacity: 0.6, marginBottom: 2 }}>CANLI VERİ AKIŞI</div>
              <div style={{ fontSize: 14, color: "#c9d6e8", fontWeight: 600 }}>Ham Magnitude vs Filtrelenmiş Sinyal</div>
            </div>
            <div style={{ display: "flex", gap: 20, fontSize: 11 }}>
              <span style={{ color: "#5a6a7a" }}>— Ham</span>
              <span style={{ color: "#00ffb4" }}>— Filtrelenmiş</span>
              <span style={{ color: "#7dd3fc" }}>— Z</span>
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

function AppContent() {
  const { theme } = useAppContext(); 
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
        <div className="text-white text-xl">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''} min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-mono`}>
      <div className="app-container">
        <Navbar />
        <main className="pt-2">
          {isAuthenticated ? (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/devices" element={<DevicesView />} />
              <Route path="/report/:mac" element={<DeviceReport />} />
              <Route path="/animals" element={<Animals />} />
              
              {/* 🚀 ROO'NUN SİLDİĞİ YETKİLİ ROTALAR BURADA GERİ GELDİ! */}
              <Route
                path="/settings"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <Users />
                  </ProtectedRoute>
                }
              />
            </Routes>
          ) : (
            <LoginForm />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppProvider>
        <AuthProvider>
          <AppContent /> 
        </AuthProvider>
      </AppProvider>
    </Router>
  );
}