import React from 'react';

export default function KPICard({ label, value, description, icon, colorHex = "#00ffb4" }) {
  return (
    <div 
      className="relative overflow-hidden bg-white/5 border rounded-xl p-5"
      style={{ borderColor: `${colorHex}22` }}
    >
      <div className="absolute -top-2 -right-2 text-5xl opacity-5 select-none">{icon}</div>
      <div 
        className="text-[10px] tracking-widest opacity-70 mb-2 uppercase" 
        style={{ color: colorHex }}
      >
        {label}
      </div>
      <div 
        className="text-4xl font-bold leading-none break-all" 
        style={{ color: colorHex, textShadow: `0 0 20px ${colorHex}55` }}
      >
        {value}
      </div>
      <div className="text-xs text-slate-400 mt-1">{description}</div>
    </div>
  );
}
