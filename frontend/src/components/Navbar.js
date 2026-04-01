import React, { useState } from 'react';
import { BellIcon, Bars3Icon, XMarkIcon, MagnifyingGlassIcon, ArrowRightOnRectangleIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

// DİKKAT: activeTab ve setActiveTab kısımlarını sildik, artık onlara gerek yok!
const Navbar = () => {
  const { theme, toggleTheme, notifications, addNotification, searchQuery, setSearchQuery } = useAppContext();
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate(); 
  const location = useLocation();
  
  const [mobileOpen, setMobileOpen] = useState(false);

  // 🚀 URL yönlendirmeleri için "path" özelliğini ekledik
  const tabs = [
    { id: 'dashboard', path: '/', label: '📊 Canlı Takip', icon: '📊' },
    { id: 'devices', path: '/devices', label: '📡 Cihazlar', icon: '📡' },
    { id: 'settings', path: '/settings', label: '⚙️ Ayarlar', icon: '⚙️' },
  ];

  const toggleMobileMenu = () => setMobileOpen(!mobileOpen);

  const filteredTabs = tabs.filter(tab => 
    tab.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="bg-gradient-to-r from-cyber-dark to-cyber-darkBlue border-b border-cyber-green/20 shadow-2xl shadow-cyber-green/10 backdrop-blur-md sticky top-0 z-50">
      {/* Desktop Navbar */}
      <div className="hidden md:flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="text-3xl animate-pulse">🐄</div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-cyber-lightGray bg-clip-text text-transparent tracking-tight">
              IoT KONTROL MERKEZİ
            </h1>
            <p className="text-xs text-cyber-green font-mono tracking-widest uppercase">v3.0 AI Sistem</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-cyber-gray" />
            <input
              type="text"
              placeholder="Cihaz ara... (Ctrl+K)"
              className="w-full pl-11 pr-4 py-2 bg-cyber-dark/50 border border-cyber-green/30 rounded-xl text-cyber-lightGray placeholder-cyber-gray focus:outline-none focus:ring-2 focus:ring-cyber-green/50 focus:border-transparent transition-all duration-300"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNotification(`Ara: ${searchQuery}`, 'search')}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-cyber-dark/30 backdrop-blur-sm px-4 py-2 rounded-2xl border border-cyber-green/20">
          {filteredTabs.map((tab) => {
            // 🚀 Eğer mevcut URL, tab'ın path'i ile aynıysa aktiftir
            const isActive = location.pathname === tab.path;
            
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)} // 🚀 Yönlendirme işlemi
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 text-sm relative group ${
                  isActive
                    ? 'bg-gradient-to-r from-cyber-green to-cyber-green/70 text-black shadow-lg shadow-cyber-green/50 scale-105'
                    : 'text-cyber-gray hover:text-white hover:bg-cyber-green/20 hover:scale-105 hover:shadow-cyber-glow'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label.split(' ')[1]}</span>
                {isActive && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-2 h-2 bg-cyber-green rounded-full shadow-lg" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right Icons */}
        <div className="flex items-center gap-4 ml-4">
          <div className="flex items-center gap-1 text-sm text-cyber-green font-mono bg-cyber-dark/50 px-3 py-1 rounded-lg">
            <span className="animate-ping w-2 h-2 bg-green-400 rounded-full"></span>
            LIVE
          </div>
          <button className="p-2 hover:bg-cyber-green/20 rounded-xl transition-all hover:rotate-12 hover:scale-110 relative group">
            <BellIcon className="h-5 w-5 text-cyber-gray group-hover:text-cyber-green" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center animate-pulse">
                {notifications.length}
              </span>
            )}
          </button>
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 hover:border-red-500/50 text-red-300 hover:text-red-200 rounded-xl transition-all duration-200 text-sm font-medium"
              title="Çıkış Yap"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              <span className="hidden lg:inline">Çıkış Yap</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Navbar */}
      <div className="md:hidden">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="text-3xl">🐄</div>
            <div>
              <h1 className="text-lg font-bold text-white">IoT Kontrol</h1>
              <p className="text-xs text-cyber-green font-mono">Live</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <MagnifyingGlassIcon 
              className="h-6 w-6 text-cyber-gray hover:text-cyber-green cursor-pointer" 
              onClick={() => document.querySelector('input[type="search"]')?.focus()}
            />
            <button onClick={toggleMobileMenu} className="p-2 hover:bg-cyber-green/20 rounded-xl">
              {mobileOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden bg-cyber-dark border-t border-cyber-green/20 pb-4">
            <input
              type="search"
              placeholder="Cihaz ara..."
              className="w-full mx-6 mt-4 p-3 bg-cyber-dark/50 border border-cyber-green/30 rounded-xl text-cyber-lightGray focus:ring-2 focus:ring-cyber-green"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="px-6 mt-4 space-y-2">
              {filteredTabs.map((tab) => {
                const isActive = location.pathname === tab.path;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      navigate(tab.path); // 🚀 Yönlendirme işlemi
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                      isActive
                        ? 'bg-cyber-green/30 text-cyber-green border-2 border-cyber-green'
                        : 'text-cyber-gray hover:text-white hover:bg-cyber-green/20'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span className="font-semibold">{tab.label}</span>
                  </button>
                );
              })}
              {isAuthenticated && (
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl transition-all text-red-300 hover:text-red-200 hover:bg-red-900/20 border border-red-500/20"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                  <span className="font-semibold">Çıkış Yap</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;