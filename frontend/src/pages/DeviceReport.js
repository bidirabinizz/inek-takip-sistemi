import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar
} from "recharts";
import { API_BASE } from '../config';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

// Custom Tooltip for Kızgınlık Grafiği
const KizginlikTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-slate-800/95 border border-rose-500/40 rounded-lg py-3 px-4 text-sm text-slate-200 shadow-xl">
      <div className="text-rose-400 font-bold mb-2">{label}</div>
      <div>Skor: <strong className={d?.kizginlik_skoru >= 60 ? "text-rose-400" : "text-amber-400"}>{d?.kizginlik_skoru ?? 0}</strong></div>
      <div>Toplam Adım: <strong className="text-emerald-400">{d?.toplam_adim ?? 0}</strong></div>
      <div>Gece Adım: <strong className="text-sky-400">{d?.gece_adim ?? 0}</strong></div>
      <div>İvme Patlaması: <strong className="text-pink-400">{d?.excited_count ?? 0}</strong></div>
      <div>Yatma Süresi: <strong className="text-indigo-400">{d?.yatma_suresi_dk ?? 0} dk</strong></div>
      {d?.kizginlik_alarm && (
        <div className="mt-2 text-rose-400 font-bold">⚡ KIZGINLIK ALARMI</div>
      )}
    </div>
  );
};

// Custom Tooltip for History Graph
const HistoryTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800/95 border border-indigo-500/40 rounded-lg py-2 px-3 text-sm text-slate-200">
      <div className="text-indigo-400 font-bold mb-1">{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{parseFloat(p.value).toFixed(3)}</strong>
        </div>
      ))}
    </div>
  );
};

// Average Card Component
function AvgCard({ label, value, unit, borderColor }) {
  return (
    <div className="p-4 border rounded-xl flex justify-between items-center" style={{ borderColor: borderColor }}>
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-slate-100 font-bold text-lg">
        {value} <span className="text-xs text-slate-500">{unit}</span>
      </span>
    </div>
  );
};

const DeviceReport = () => {
  const { mac } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useAppContext();
  const goBack = () => navigate('/devices');
  const today = new Date().toISOString().slice(0, 16);

  // State
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [averages, setAverages] = useState(null);
  const [kizginlikData, setKizginlikData] = useState([]);
  const [kizginlikLoading, setKizginlikLoading] = useState(false);
  const [deviceData, setDeviceData] = useState(null);

  // Fetch History
  const fetchHistory = useCallback(() => {
    setHistoryLoading(true);
    const url = `${API_BASE}/api/device-history-range/?mac=${mac}&start_date=${startDate}&end_date=${endDate}`;

    fetch(url, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setHistoryData(data.data || []);
        if (data.ortalama_adim !== undefined) {
          setAverages({
            toplam_adim: data.ortalama_adim,
            yatma_suresi: data.ortalama_yatma_suresi,
            kizginlik_skoru: data.ortalama_kizginlik_skoru,
            toplam_gun: data.toplam_gun,
          });
        } else {
          setAverages(null);
        }
        setHistoryLoading(false);
      })
      .catch(err => {
        console.error("Geçmiş veriler çekilemedi:", err);
        setHistoryLoading(false);
      });
  }, [mac, startDate, endDate]);

  // Fetch Kızgınlık Report
  const fetchKizginlik = useCallback(() => {
    if (!mac) return;
    setKizginlikLoading(true);
    fetch(`${API_BASE}/api/kizginlik-raporu/?mac=${mac}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setKizginlikData(data);
        setKizginlikLoading(false);
      })
      .catch(err => {
        console.error("Kızgınlık raporu çekilemedi:", err);
        setKizginlikLoading(false);
      });
  }, [mac]);

  useEffect(() => {
    if (mac) {
      fetch(`${API_BASE}/api/cihazlar/`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          const device = data.find(d => d.mac_address === mac || d.mac === mac);
          setDeviceData(device);
        })
        .catch(err => console.error("Cihaz bilgisi alınamadı", err));
      
      fetchHistory();
      fetchKizginlik();
    }
  }, [mac, fetchHistory, fetchKizginlik]);

  // Calculations
  const alarmGunler = kizginlikData.filter(d => d.kizginlik_alarm).length;
  const maxSkor = kizginlikData.length ? Math.max(...kizginlikData.map(d => d.kizginlik_skoru)) : 0;
  const yatmaVerileri = kizginlikData.filter(d => d.yatma_suresi_dk > 0);
  const ortYatma = yatmaVerileri.length 
    ? (yatmaVerileri.reduce((sum, d) => sum + d.yatma_suresi_dk, 0) / yatmaVerileri.length).toFixed(0)
    : 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="text-xs tracking-widest text-indigo-400 opacity-70 mb-1">CİHAZ RAPORU</div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            📡 {deviceData?.name || mac}
            {deviceData?.animal && (
              <span className="text-base font-normal text-slate-400">
                🐄 {deviceData.animal.ear_tag}
                {deviceData.animal.name && ` (${deviceData.animal.name})`}
              </span>
            )}
          </h2>
        </div>
        <button
          onClick={goBack}
          className="px-6 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/50 rounded-lg font-semibold transition-all duration-200"
        >
          🔙 Geri Dön
        </button>
      </div>

      {/* Section 1: Kızgınlık Report */}
      <div className="bg-slate-800/50 border border-rose-500/30 rounded-xl p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="text-xs tracking-widest text-rose-400 opacity-70 mb-1">SON 14 GÜNLÜK ANALİZ</div>
            <div className="text-lg font-bold text-rose-400">Kızgınlık (Östrus) Takip Grafiği</div>
            <div className="text-xs text-slate-400 mt-1">Skor ≥ 60 → Alarm | İnek döngüsü ~21 günde bir</div>
          </div>
          <div className="flex gap-3">
            {[
              { label: "ALARM GÜNÜ", value: alarmGunler, color: "bg-rose-500/20 border-rose-500/40 text-rose-400" },
              { label: "MAX SKOR", value: maxSkor.toFixed(0), color: "bg-amber-500/20 border-amber-500/40 text-amber-400" },
              { label: "ORT. YATMA", value: `${ortYatma} dk`, color: "bg-indigo-500/20 border-indigo-500/40 text-indigo-400" },
            ].map(k => (
              <div key={k.label} className={`p-3 border rounded-xl text-center min-w-[80px] ${k.color}`}>
                <div className="text-[10px] tracking-wider opacity-70">{k.label}</div>
                <div className="text-xl font-bold mt-1">{k.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Kızgınlık Graph */}
        {kizginlikLoading ? (
          <div className="text-center py-16 text-rose-400">Rapor yükleniyor...</div>
        ) : kizginlikData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={kizginlikData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="tarih" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} />
              <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} width={32} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<KizginlikTooltip />} />
              <ReferenceLine yAxisId="left" y={60} stroke="#f87171" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: "ALARM EŞİĞİ (60)", position: "insideTopRight", fontSize: 12, fill: "#f87171" }} />
              <ReferenceLine yAxisId="left" y={40} stroke="#fbbf24" strokeDasharray="3 6" strokeOpacity={0.4} label={{ value: "ŞÜPHE (40)", position: "insideTopRight", fontSize: 12, fill: "#fbbf24" }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="kizginlik_skoru"
                stroke="#f87171"
                strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (payload.kizginlik_alarm) {
                    return (
                      <g key={`dot-${cx}-${cy}`}>
                        <circle cx={cx} cy={cy} r={7} fill="#f87171" opacity={0.3} />
                        <circle cx={cx} cy={cy} r={4} fill="#f87171" />
                      </g>
                    );
                  }
                  return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="#f87171" opacity={0.5} />;
                }}
                isAnimationActive={false}
                name="Kızgınlık Skoru"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="gece_adim"
                stroke="#7dd3fc"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                name="Gece Adımı"
                strokeDasharray="3 3"
                strokeOpacity={0.6}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="yatma_suresi_dk"
                stroke="#818cf8"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                name="Yatma Süresi"
                strokeOpacity={0.8}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-16 text-slate-400">Henüz kızgınlık verisi yok. Veri biriktikçe grafik oluşacak.</div>
        )}

        <div className="flex flex-wrap gap-6 mt-4 text-xs text-slate-400">
          <span><span className="text-rose-400">—</span> Skor (Sol Eksen)</span>
          <span><span className="text-sky-400">—</span> Gece Adımı (Sağ)</span>
          <span><span className="text-indigo-400">—</span> Yatma Dk (Sağ)</span>
          <span className="ml-auto">Skor = Adım Artışı (%50) + Gece Aktivitesi (%30) + İvme Patlaması (%20)</span>
        </div>
      </div>

      {/* Section 2: Historical Acceleration Graph */}
      <div className="bg-slate-800/30 border border-indigo-500/20 rounded-xl p-4 md:p-6">
        <div className="text-xs tracking-widest text-indigo-400 opacity-70 mb-4">TARİHSEL İVME ANALİZİ</div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-3 items-end mb-6">
          {[
            { label: "BAŞLANGIÇ", value: startDate, setter: setStartDate },
            { label: "BİTİŞ", value: endDate, setter: setEndDate },
          ].map(f => (
            <div key={f.label} className="flex-1 min-w-[140px]">
              <div className="text-xs text-slate-400 tracking-wider mb-2">{f.label}</div>
              <input
                type="date"
                value={f.value}
                onChange={e => f.setter(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))}
          <button
            onClick={fetchHistory}
            className="px-6 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/50 rounded-lg font-semibold transition-all duration-200"
          >
            🔍 GETİR
          </button>
          {averages && (
            <div className="text-sm text-slate-400">{averages.toplam_gun} gün</div>
          )}
        </div>

        {/* Graphs */}
        {historyLoading ? (
          <div className="text-center py-16 text-indigo-400">Veriler getiriliyor...</div>
        ) : historyData.length > 0 ? (
          <div className="space-y-8">
            {/* Daily Steps Bar Chart */}
            <div>
              <div className="text-sm text-emerald-400 font-semibold mb-3">📊 Günlük Toplam Adım</div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={historyData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="tarih" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(0,255,180,0.3)", borderRadius: 8, color: "#e0e0e0" }}
                    labelStyle={{ color: "#00ffb4", fontWeight: 700 }}
                  />
                  <Bar dataKey="toplam_adim" fill="#10b981" name="Toplam Adım" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Lying Time & Excitement Line Chart */}
            <div>
              <div className="text-sm text-indigo-400 font-semibold mb-3">📈 Yatma Süresi ve Kızgınlık Skoru</div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={historyData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="tarih" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(129,140,248,0.3)", borderRadius: 8, color: "#e0e0e0" }}
                    labelStyle={{ color: "#818cf8", fontWeight: 700 }}
                  />
                  <ReferenceLine yAxisId="right" y={60} stroke="#f87171" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: "ALARM", fontSize: 10, fill: "#f87171" }} />
                  <Line yAxisId="left" type="monotone" dataKey="yatma_suresi_dk" stroke="#818cf8" strokeWidth={2} dot={false} isAnimationActive={false} name="Yatma (dk)" />
                  <Line yAxisId="right" type="monotone" dataKey="kizginlik_skoru" stroke="#f87171" strokeWidth={2} dot={false} isAnimationActive={false} name="Kızgınlık Skoru" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-slate-400">Bu tarih aralığında günlük aktivite verisi bulunamadı.</div>
        )}
      </div>

      {/* Section 3: Averages */}
      <div className="bg-slate-800/20 border border-indigo-500/20 rounded-xl p-4 md:p-6">
        <div className="text-xs tracking-widest text-indigo-400 opacity-70 mb-4">SEÇİLİ ARALIK ORTALAMALARI</div>
        {averages ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AvgCard label="Ort. Günlük Adım" value={averages.toplam_adim?.toFixed(0) || 0} unit="adım" borderColor="rgba(16,185,129,0.4)" />
            <AvgCard label="Ort. Yatma Süresi" value={averages.yatma_suresi?.toFixed(0) || 0} unit="dk" borderColor="rgba(129,140,248,0.4)" />
            <AvgCard label="Ort. Kızgınlık Skoru" value={averages.kizginlik_skoru?.toFixed(1) || 0} unit="puan" borderColor="rgba(248,113,113,0.4)" />
            <div className="text-sm text-slate-400 mt-4 lg:mt-0">{averages.toplam_gun} gün üzerinden hesaplandı</div>
          </div>
        ) : (
          <div className="text-slate-400 text-sm">Ortalama hesaplamak için yukarıdan tarih aralığı seçip GETİR'e bas.</div>
        )}
      </div>
    </div>
  );
};

export default DeviceReport;
