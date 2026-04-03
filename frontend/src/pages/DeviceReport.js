import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar
} from "recharts";
import { API_BASE } from '../config';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

// ─────────────────────────────────────────────
//  ÖZEL TOOLTIP — Kızgınlık Grafiği
// ─────────────────────────────────────────────
const KizginlikTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{
      background: "rgba(10,10,20,0.95)",
      border: "1px solid rgba(248,113,113,0.3)",
      borderRadius: 8, padding: "10px 14px",
      fontSize: 12, color: "#e0e0e0",
    }}>
      <div style={{ color: "#f87171", fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div>Skor: <strong style={{ color: d?.kizginlik_skoru >= 60 ? "#f87171" : "#fbbf24" }}>
        {d?.kizginlik_skoru ?? 0}
      </strong></div>
      <div>Toplam Adım: <strong style={{ color: "#00ffb4" }}>{d?.toplam_adim ?? 0}</strong></div>
      <div>Gece Adım: <strong style={{ color: "#7dd3fc" }}>{d?.gece_adim ?? 0}</strong></div>
      <div>İvme Patlaması: <strong style={{ color: "#f472b6" }}>{d?.excited_count ?? 0}</strong></div>
      {/* 🚀 YENİ: Yatma Süresi Tooltip'e eklendi */}
      <div>Yatma Süresi: <strong style={{ color: "#818cf8" }}>{d?.yatma_suresi_dk ?? 0} dk</strong></div>
      
      {d?.kizginlik_alarm && (
        <div style={{ marginTop: 6, color: "#f87171", fontWeight: 700 }}>⚡ KIZGINLIK ALARMI</div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
//  ÖZEL TOOLTIP — Geçmiş Grafik
// ─────────────────────────────────────────────
const HistoryTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(10,10,20,0.95)",
      border: "1px solid rgba(167,139,250,0.3)",
      borderRadius: 8, padding: "8px 14px",
      fontSize: 12, color: "#e0e0e0",
    }}>
      <div style={{ color: "#a78bfa", fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{parseFloat(p.value).toFixed(3)}</strong>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────
//  ORTALAMA KARTI
// ─────────────────────────────────────────────
function AvgCard({ label, value, unit, borderColor }) {
  return (
    <div style={{
      padding: "10px 16px",
      border: `1px solid ${borderColor}`,
      borderRadius: 8,
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <span style={{ color: "#8899aa", fontSize: 13 }}>{label}</span>
      <span style={{ color: "#ffffff", fontWeight: 700, fontSize: 15 }}>
        {value} <span style={{ fontSize: 11, color: "#8899aa" }}>{unit}</span>
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
//  ANA COMPONENT
// ─────────────────────────────────────────────


const DeviceReport = () => {
  const { mac } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useAppContext();
  const goBack = () => navigate('/devices');
  const today = new Date().toISOString().slice(0, 16);

  // Geçmiş grafik state
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [startDate, setStartDate] = useState(today);
  const [endDate,   setEndDate]   = useState(today);

  // Ortalamalar state
  const [averages, setAverages] = useState(null);

  // Kızgınlık raporu state
  const [kizginlikData,    setKizginlikData]    = useState([]);
  const [kizginlikLoading, setKizginlikLoading] = useState(false);
  const [deviceData, setDeviceData] = useState(null);

  // ── Geçmiş Veri Çek (Yeni API: Günlük Agrega) ──
  const fetchHistory = useCallback(() => {
    setHistoryLoading(true);
    const url = `${API_BASE}/api/device-history-range/?mac=${mac}&start_date=${startDate}&end_date=${endDate}`;

    fetch(url, {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        setHistoryData(data.data || []);
        
        // Ortalamaları API'den al
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

  // ── Kızgınlık Raporu Çek ────────────────────
  const fetchKizginlik = useCallback(() => {
    if (!mac) return;
    setKizginlikLoading(true);
    fetch(`${API_BASE}/api/kizginlik-raporu/?mac=${mac}`, {
      credentials: 'include'
    })
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
      // Sadece cihaz bilgisini çek, bildirim (notification) atma!
      fetch(`${API_BASE}/api/cihazlar/`, {
        credentials: 'include'
      })
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

  // Kızgınlık alarm günleri ve özet hesaplamalar
  const alarmGunler = kizginlikData.filter(d => d.kizginlik_alarm).length;
  const maxSkor     = kizginlikData.length ? Math.max(...kizginlikData.map(d => d.kizginlik_skoru)) : 0;
  
  // 🚀 YENİ: Ortalama Yatma Süresi Hesaplama (Sadece yattığı günleri baz alarak)
  const yatmaVerileri = kizginlikData.filter(d => d.yatma_suresi_dk > 0);
  const ortYatma = yatmaVerileri.length 
    ? (yatmaVerileri.reduce((sum, d) => sum + d.yatma_suresi_dk, 0) / yatmaVerileri.length).toFixed(0)
    : 0;

  return (
    <div style={{ padding: "24px 36px", fontFamily: "'Courier New', monospace", color: "#c9d6e8" }}>

      {/* ── BAŞLIK ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 16, letterSpacing: 4, color: "#a78bfa", opacity: 0.7, marginBottom: 4 }}>
            CİHAZ RAPORU
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#fff" }}>
            📡 {deviceData?.name || mac}
            {deviceData?.animal && (
              <span style={{ fontSize: 14, opacity: 0.8, marginLeft: 8 }}>
                🐄 {deviceData.animal.ear_tag}
                {deviceData.animal.name && ` (${deviceData.animal.name})`}
              </span>
            )}
          </h2>
        </div>
        <button
          onClick={goBack}
          style={{
            background: "rgba(167,139,250,0.1)",
            border: "1px solid rgba(167,139,250,0.4)",
            color: "#a78bfa", padding: "8px 20px",
            borderRadius: 8, cursor: "pointer",
            fontSize: 16, fontFamily: "inherit",
            transition: "background 0.2s",
          }}
          onMouseOver={e => e.currentTarget.style.background = "rgba(167,139,250,0.2)"}
          onMouseOut={e => e.currentTarget.style.background = "rgba(167,139,250,0.1)"}
        >
          🔙 Geri Dön
        </button>
      </div>

      {/* ══════════════════════════════════════════
           BÖLÜM 1: KIZGINLIK RAPORU (14 Gün)
      ══════════════════════════════════════════ */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(248,113,113,0.15)",
        borderRadius: 12, padding: "24px",
        marginBottom: 24,
      }}>
        {/* Başlık + Özet kartlar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 20 }}>
          <div>
            <div style={{ fontSize: 14, letterSpacing: 3, color: "#f87171", opacity: 0.7, marginBottom: 4 }}>
              SON 14 GÜNLÜK ANALİZ
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f87171" }}>
              Kızgınlık (Östrus) Takip Grafiği
            </div>
            <div style={{ fontSize: 12, color: "#8899aa", marginTop: 4 }}>
              Skor ≥ 60 → Alarm &nbsp;|&nbsp; İnek döngüsü ~21 günde bir
            </div>
          </div>

          {/* Özet sayılar */}
          <div style={{ display: "flex", gap: 12}}>
            {[
              { label: "ALARM GÜNÜ", value: alarmGunler, color: "#f87171" },
              { label: "MAX SKOR",   value: maxSkor.toFixed(0), color: "#fbbf24" },
              { label: "ORT. YATMA", value: `${ortYatma} dk`, color: "#818cf8" }, // 🚀 YENİ KART
            ].map(k => (
              <div key={k.label} style={{
                background: `${k.color}11`,
                border: `1px solid ${k.color}33`,
                borderRadius: 10, padding: "12px 20px",
                textAlign: "center", minWidth: 80,
              }}>
                <div style={{ fontSize: 13, letterSpacing: 2, color: k.color, opacity: 0.7 }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: k.color, marginTop: 4 }}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Kızgınlık Grafiği */}
        {kizginlikLoading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#f87171" }}>
            Rapor yükleniyor...
          </div>
        ) : kizginlikData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={kizginlikData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="tarih" tick={{ fontSize: 10, fill: "#4a6070" }} tickLine={false} />
              
              {/* 🚀 YENİ: İkili Y Ekseni (Skor için Sol, Adım/Süre için Sağ) */}
              <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 10, fill: "#4a6070" }} tickLine={false} axisLine={false} width={32} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#4a6070" }} tickLine={false} axisLine={false} width={40} />
              
              <Tooltip content={<KizginlikTooltip />} />

              {/* Alarm eşiği (Sol eksene bağlı) */}
              <ReferenceLine
                yAxisId="left" y={60} stroke="#f87171" strokeDasharray="4 4" strokeOpacity={0.6}
                label={{ value: "ALARM EŞİĞİ (60)", position: "insideTopRight", fontSize: 12, fill: "#f87171" }}
              />
              {/* Şüphe eşiği (Sol eksene bağlı) */}
              <ReferenceLine
                yAxisId="left" y={40} stroke="#fbbf24" strokeDasharray="3 6" strokeOpacity={0.4}
                label={{ value: "ŞÜPHE (40)", position: "insideTopRight", fontSize: 12, fill: "#fbbf24" }}
              />

              {/* Kızgınlık skoru — alarm günleri kırmızı nokta (Sol Eksen) */}
              <Line
                yAxisId="left"
                type="monotone" dataKey="kizginlik_skoru"
                stroke="#f87171" strokeWidth={2.5}
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

              {/* Gece adım sayısı — Sağ Eksen */}
              <Line
                yAxisId="right"
                type="monotone" dataKey="gece_adim"
                stroke="#7dd3fc" strokeWidth={1.5}
                dot={false} isAnimationActive={false}
                name="Gece Adımı"
                strokeDasharray="3 3"
                strokeOpacity={0.6}
              />

              {/* 🚀 YENİ: Yatma Süresi Çizgisi — Sağ Eksen */}
              <Line
                yAxisId="right"
                type="monotone" dataKey="yatma_suresi_dk"
                stroke="#818cf8" strokeWidth={2}
                dot={false} isAnimationActive={false}
                name="Yatma Süresi"
                strokeOpacity={0.8}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#8899aa" }}>
            Henüz kızgınlık verisi yok. Veri biriktikçe grafik oluşacak.
          </div>
        )}

        {/* Skor açıklaması */}
        <div style={{
          display: "flex", gap: 24, marginTop: 16,
          fontSize: 12, color: "#8899aa", flexWrap: "wrap"
        }}>
          <span><span style={{color:"#f87171"}}>—</span> Skor (Sol Eksen)</span>
          <span><span style={{color:"#7dd3fc"}}>—</span> Gece Adımı (Sağ)</span>
          <span><span style={{color:"#818cf8"}}>—</span> Yatma Dk (Sağ)</span>
          <span style={{ marginLeft: "auto" }}>
            Skor = Adım Artışı (%50) + Gece Aktivitesi (%30) + İvme Patlaması (%20)
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════
           BÖLÜM 2: TARİHSEL İVME GRAFİĞİ
      ══════════════════════════════════════════ */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(167,139,250,0.15)",
        borderRadius: 12, padding: "24px",
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: "#a78bfa", opacity: 0.7, marginBottom: 16 }}>
          TARİHSEL İVME ANALİZİ
        </div>

        {/* Filtreleme çubuğu - Mobil uyumlu */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 20 }}>
          {[
            { label: "BAŞLANGIÇ", value: startDate, setter: setStartDate },
            { label: "BİTİŞ",     value: endDate,   setter: setEndDate   },
          ].map(f => (
            <div key={f.label} style={{ flex: "1 1 140px" }}>
              <div style={{ fontSize: 10, color: "#8899aa", letterSpacing: 2, marginBottom: 6 }}>
                {f.label}
              </div>
              <input
                type="date"
                value={f.value}
                onChange={e => f.setter(e.target.value)}
                style={{
                  width: "100%",
                  background: "#0f172a",
                  border: "1px solid #334155",
                  color: "#fff", padding: "8px 10px",
                  borderRadius: 6, fontSize: 13,
                  fontFamily: "inherit", outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))}
          <button
            onClick={fetchHistory}
            style={{
              background: "rgba(167,139,250,0.15)",
              border: "1px solid rgba(167,139,250,0.5)",
              color: "#a78bfa", padding: "8px 24px",
              borderRadius: 8, cursor: "pointer",
              fontSize: 13, fontFamily: "inherit",
              fontWeight: 700, letterSpacing: 1,
              transition: "background 0.2s",
              flex: "0 0 auto",
            }}
            onMouseOver={e => e.currentTarget.style.background = "rgba(167,139,250,0.25)"}
            onMouseOut={e => e.currentTarget.style.background = "rgba(167,139,250,0.15)"}
          >
            🔍 GETİR
          </button>

          {averages && (
            <div style={{ marginLeft: "auto", fontSize: 12, color: "#8899aa" }}>
              {averages.toplam_gun} gün
            </div>
          )}
        </div>

        {/* Grafikler - Mobil uyumlu */}
        {historyLoading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#a78bfa" }}>
            Veriler getiriliyor...
          </div>
        ) : historyData.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Günlük Adım Grafiği (BarChart) */}
            <div>
              <div style={{ fontSize: 12, color: "#00ffb4", marginBottom: 8, fontWeight: 600 }}>
                📊 Günlük Toplam Adım
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={historyData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="tarih" tick={{ fontSize: 10, fill: "#4a6070" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#4a6070" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(0,255,180,0.3)", borderRadius: 8, color: "#e0e0e0" }}
                    labelStyle={{ color: "#00ffb4", fontWeight: 700 }}
                  />
                  <Bar dataKey="toplam_adim" fill="#00ffb4" name="Toplam Adım" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Yatma Süresi ve Kızgınlık Skoru (LineChart) */}
            <div>
              <div style={{ fontSize: 12, color: "#818cf8", marginBottom: 8, fontWeight: 600 }}>
                📈 Yatma Süresi ve Kızgınlık Skoru
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={historyData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="tarih" tick={{ fontSize: 10, fill: "#4a6070" }} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#4a6070" }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#4a6070" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(129,140,248,0.3)", borderRadius: 8, color: "#e0e0e0" }}
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
          <div style={{ textAlign: "center", padding: "40px 0", color: "#8899aa" }}>
            Bu tarih aralığında günlük aktivite verisi bulunamadı.
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
           BÖLÜM 3: GERÇEK ORTALAMALAR
      ══════════════════════════════════════════ */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(167,139,250,0.15)",
        borderRadius: 12, padding: "24px",
      }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: "#a78bfa", opacity: 0.7, marginBottom: 16 }}>
          SEÇİLİ ARALIK ORTALAMALARI
        </div>

        {averages ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <AvgCard label="Ort. Günlük Adım"  value={averages.toplam_adim?.toFixed(0) || 0}   unit="adım" borderColor="rgba(0,255,180,0.4)" />
            <AvgCard label="Ort. Yatma Süresi"  value={averages.yatma_suresi?.toFixed(0) || 0}   unit="dk" borderColor="rgba(129,140,248,0.4)"  />
            <AvgCard label="Ort. Kızgınlık Skoru"  value={averages.kizginlik_skoru?.toFixed(1) || 0}   unit="puan" borderColor="rgba(248,113,113,0.4)"  />
            <div style={{ fontSize: 11, color: "#8899aa", marginTop: 4, gridColumn: "1 / -1" }}>
              {averages.toplam_gun} gün üzerinden hesaplandı
            </div>
          </div>
        ) : (
          <div style={{ color: "#8899aa", fontSize: 13 }}>
            Ortalama hesaplamak için yukarıdan tarih aralığı seçip GETİR'e bas.
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceReport;