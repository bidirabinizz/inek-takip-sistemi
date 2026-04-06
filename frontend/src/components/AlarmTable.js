import React from 'react';

export default function AlarmTable({ alarmDevices }) {
  if (!alarmDevices || alarmDevices.length === 0) return null;

  return (
    <div className="mx-4 md:mx-6 mb-6 bg-rose-900/10 border border-rose-500/30 rounded-xl p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <div className="text-xs tracking-widest text-rose-400 opacity-70 mb-0.5">ACİL DURUM</div>
            <div className="text-base font-bold text-rose-400">Alarmlı İnekler</div>
          </div>
        </div>
        <div className="ml-auto bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-1.5 text-xs text-rose-400 font-semibold">
          {alarmDevices.length} cihaz
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-rose-500/20">
              <th className="py-3 px-4 text-left text-rose-400 font-semibold tracking-wide">CİHAZ</th>
              <th className="py-3 px-4 text-left text-rose-400 font-semibold tracking-wide">HAYVAN</th>
              <th className="py-3 px-4 text-left text-rose-400 font-semibold tracking-wide">KIZGINLIK SKORU</th>
              <th className="py-3 px-4 text-left text-rose-400 font-semibold tracking-wide">DURUM</th>
            </tr>
          </thead>
          <tbody>
            {alarmDevices.map((device, idx) => (
              <tr 
                key={device.mac} 
                className={idx < alarmDevices.length - 1 ? "border-b border-rose-500/10" : ""}
              >
                <td className="py-3 px-4 text-slate-200 font-mono">{device.name}</td>
                <td className="py-3 px-4 text-slate-300">
                  {device.animal ? (
                    <div>
                      <div className="font-semibold">{device.animal.ear_tag}</div>
                      <div className="text-[11px] text-slate-400">{device.animal.name || '-'}</div>
                    </div>
                  ) : '-'}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-400" />
                    <span className="text-rose-400 font-bold text-base">{device.kizginlik_skoru?.toFixed(0)}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="bg-rose-500/15 border border-rose-500/40 text-rose-400 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide">
                    ALARM
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {alarmDevices.map((device, idx) => (
          <div key={device.mac} className={`bg-slate-800/50 border border-rose-500/20 rounded-lg p-4 ${idx < alarmDevices.length - 1 ? 'mb-3' : ''}`}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-mono text-slate-200 font-semibold text-sm">{device.name}</p>
                {device.animal && (
                  <p className="text-xs text-slate-400">{device.animal.ear_tag} {device.animal.name && `- ${device.animal.name}`}</p>
                )}
              </div>
              <span className="bg-rose-500/15 border border-rose-500/40 text-rose-400 px-2 py-1 rounded text-xs font-semibold">ALARM</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Kızgınlık Skoru:</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-rose-400 font-bold">{device.kizginlik_skoru?.toFixed(0)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
