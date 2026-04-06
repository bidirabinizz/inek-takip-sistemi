import React from 'react';

export default function KPICard({ label, value, description, icon, colorHex = "#10b981" }) {
  return (
    <div 
      className="relative overflow-hidden bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-sm"
    >
      <div className="absolute -top-2 -right-2 text-5xl opacity-10 select-none">{icon}</div>
      <div 
        className="text-[10px] tracking-widest opacity-70 mb-2 uppercase font-semibold" 
        style={{ color: colorHex }}
      >
        {label}
      </div>
      <div 
        className="text-4xl font-bold leading-none break-all text-slate-100" 
      >
        {value}
      </div>
      <div className="text-xs text-slate-400 mt-1">{description}</div>
    </div>
  );
}
