import React from 'react';

export default function AlarmTable({ alarmDevices }) {
  if (!alarmDevices || alarmDevices.length === 0) return null;

  return (
    <div className="mx-9 mb-6 bg-red-400/5 border border-red-400/30 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">🚨</span>
        <div>
          <div className="text-sm tracking-widest text-red-400 opacity-70 mb-0.5">ACİL DURUM</div>
          <div className="text-base font-bold text-red-400">Alarmlı İnekler</div>
        </div>
        <div className="ml-auto bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-1.5 text-xs text-red-400 font-semibold">
          {alarmDevices.length} cihaz
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-red-400/20">
              <th className="py-3 px-4 text-left text-red-400 font-semibold tracking-wide">CİHAZ</th>
              <th className="py-3 px-4 text-left text-red-400 font-semibold tracking-wide">HAYVAN</th>
              <th className="py-3 px-4 text-left text-red-400 font-semibold tracking-wide">KIZGINLIK SKORU</th>
              <th className="py-3 px-4 text-left text-red-400 font-semibold tracking-wide">DURUM</th>
            </tr>
          </thead>
          <tbody>
            {alarmDevices.map((device, idx) => (
              <tr 
                key={device.mac} 
                className={idx < alarmDevices.length - 1 ? "border-b border-red-400/10" : ""}
              >
                <td className="py-3 px-4 text-white font-mono">{device.name}</td>
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
                    <div className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_#f87171]" />
                    <span className="text-red-400 font-bold text-base">{device.kizginlik_skoru?.toFixed(0)}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="bg-red-400/15 border border-red-400/40 text-red-400 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide">
                    ALARM
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
