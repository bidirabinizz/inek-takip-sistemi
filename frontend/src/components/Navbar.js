import React, { useState } from 'react';
import { 
  BellIcon, 
  Bars3Icon, 
  XMarkIcon, 
  ArrowRightOnRectangleIcon,
  HomeIcon,
  CpuChipIcon,
  HeartIcon,
  HomeModernIcon,
  BeakerIcon,
  Cog6ToothIcon,
  UsersIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { theme, notifications } = useAppContext();
  const { isAuthenticated, logout, userRole, permissions, user } = useAuth();
  const navigate = useNavigate(); 
  const location = useLocation();
   
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Tüm sekmeler ve icon mapping
  const allTabs = [
    { id: 'dashboard', path: '/', label: 'Canlı Takip', icon: ChartBarIcon, perm: 'view_dashboard' },
    { id: 'devices', path: '/devices', label: 'Cihazlar', icon: CpuChipIcon, perm: 'view_devices' },
    { id: 'animals', path: '/animals', label: 'Hayvanlar', icon: HeartIcon, perm: 'view_animals' },
    { id: 'paddocks', path: '/paddocks', label: 'Padoklar', icon: HomeModernIcon, perm: 'view_paddocks' },
    { id: 'breeding', path: '/breeding', label: 'Dölleme', icon: BeakerIcon, perm: 'view_breeding' },
    { id: 'settings', path: '/settings', label: 'Ayarlar', icon: Cog6ToothIcon, perm: 'manage_settings' },
    { id: 'users', path: '/users', label: 'Kullanıcılar', icon: UsersIcon, perm: 'manage_users' },
  ];
  
  // Yetki kontrolü
  const hasPermission = (perm) => userRole === 'ADMIN' || (permissions && permissions.includes(perm));
  const tabs = allTabs.filter(tab => hasPermission(tab.perm));

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleNavigation = (path) => {
    navigate(path);
    setSidebarOpen(false);
  };

  // Sidebar içeriği (desktop ve mobile için ortak)
  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full">
      {/* Logo Section */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigation('/')}>
          <div className="text-4xl">🐄</div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 tracking-tight">
              IoT KONTROL
            </h1>
            <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Merkezi v3.0</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-6 px-3 overflow-y-auto">
        <div className="space-y-1">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            const Icon = tab.icon;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleNavigation(tab.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative group ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                {/* Active indicator - left border */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full" />
                )}
                <Icon className={`h-5 w-5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span className="font-medium">{tab.label}</span>
                {isActive && (
                  <div className="ml-auto">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Bottom Section - User & Logout */}
      <div className="p-4 border-t border-slate-700">
        {/* Live indicator */}
        <div className="flex items-center gap-2 text-sm text-emerald-400 font-mono bg-slate-800/50 px-3 py-2 rounded-lg mb-3">
          <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
          SİSTEM AKTİF
        </div>
        
        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-2 mb-3">
          <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center">
            <span className="text-slate-300 font-bold">
              {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-100 truncate">
              {user?.username || 'Kullanıcı'}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {userRole === 'ADMIN' ? 'Yönetici' : 'Kullanıcı'}
            </p>
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 border border-rose-500/20 hover:border-rose-500/40"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
          <span className="font-medium">Çıkış Yap</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header - Always visible on mobile */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-md border-b border-slate-700 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="text-2xl">🐄</div>
          <div>
            <h1 className="text-sm font-bold text-slate-100">IoT Kontrol</h1>
            <p className="text-[10px] text-slate-400 font-mono">Merkezi</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-slate-700 rounded-xl transition-all relative">
            <BellIcon className="h-5 w-5 text-slate-400" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                {notifications.length}
              </span>
            )}
          </button>
          <button 
            onClick={toggleSidebar} 
            className="p-2 hover:bg-slate-700 rounded-xl transition-all"
          >
            {sidebarOpen ? (
              <XMarkIcon className="h-6 w-6 text-slate-100" />
            ) : (
              <Bars3Icon className="h-6 w-6 text-slate-100" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Sidebar panel - slides from left */}
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-slate-900/98 backdrop-blur-xl border-r border-slate-700 shadow-xl animate-slide-in">
            <SidebarContent isMobile={true} />
          </div>
        </div>
      )}

      {/* Desktop Sidebar - Fixed left */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-slate-900/95 backdrop-blur-xl border-r border-slate-700 shadow-xl z-30">
        <SidebarContent />
      </aside>
    </>
  );
};

export default Navbar;
