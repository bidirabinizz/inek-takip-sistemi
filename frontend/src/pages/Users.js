import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { API_BASE } from '../config';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Users = () => {
  const { isAuthenticated, userRole } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  
  // Users state
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ username: '', email: '', password: '', role: 'WORKER' });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  // Permissions state
  const [rolesData, setRolesData] = useState(null);
  const [savingPerms, setSavingPerms] = useState(false);

  const canManageUsers = usePermission('manage_users');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (userRole !== 'ADMIN' && !canManageUsers) {
      navigate('/');
      return;
    }
    fetchData();
  }, [isAuthenticated, canManageUsers, userRole, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, permsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/users/`),
        axios.get(`${API_BASE}/api/permissions/all/`)
      ]);
      setUsers(usersRes.data);
      setRolesData(permsRes.data);
    } catch (error) {
      setMessage({ type: 'error', text: 'Veriler yüklenirken hata oluştu' });
    } finally {
      setLoading(false);
    }
  };

  // --- Users Handlers ---
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      await axios.post(`${API_BASE}/api/users/create/`, formData);
      setMessage({ type: 'success', text: 'Kullanıcı başarıyla oluşturuldu' });
      setFormData({ username: '', email: '', password: '', role: 'WORKER' });
      setShowModal(false);
      fetchData();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Oluşturma başarısız' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id, username) => {
    if (!window.confirm(`"${username}" kullanıcısını silmek istediğinize emin misiniz?`)) return;
    try {
      await axios.delete(`${API_BASE}/api/users/${id}/`);
      setMessage({ type: 'success', text: 'Kullanıcı silindi' });
      fetchData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Silme işlemi başarısız' });
    }
  };

  const handleRoleChange = async (id, newRole) => {
    try {
      await axios.put(`${API_BASE}/api/users/${id}/role/`, { role: newRole });
      setMessage({ type: 'success', text: 'Rol güncellendi' });
      fetchData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Rol güncelleme başarısız' });
    }
  };

  // --- Permissions Handlers ---
  const togglePermission = (roleKey, permKey) => {
    if (roleKey === 'ADMIN') return;
    
    setRolesData(prev => ({
      ...prev,
      [roleKey]: {
        ...prev[roleKey],
        permissions: {
          ...prev[roleKey].permissions,
          [permKey]: {
            ...prev[roleKey].permissions[permKey],
            allowed: !prev[roleKey].permissions[permKey].allowed
          }
        }
      }
    }));
  };

  const handleSavePermissions = async (roleKey) => {
    setSavingPerms(true);
    const permsToSave = {};
    Object.keys(rolesData[roleKey].permissions).forEach(k => {
      permsToSave[k] = rolesData[roleKey].permissions[k].allowed;
    });

    try {
      await axios.post(`${API_BASE}/api/permissions/update/`, {
        role: roleKey,
        permissions: permsToSave
      });
      setMessage({ type: 'success', text: `${rolesData[roleKey].label} izinleri başarıyla güncellendi!` });
    } catch (err) {
      setMessage({ type: 'error', text: 'İzinler güncellenemedi' });
    } finally {
      setSavingPerms(false);
      setTimeout(() => setMessage({type: '', text:''}), 3000);
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'ADMIN': return 'bg-purple-900/50 text-purple-300 border border-purple-500/40';
      case 'VET': return 'bg-blue-900/50 text-blue-300 border border-blue-500/40';
      default: return 'bg-slate-700 text-slate-300 border border-slate-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
         <div className="w-12 h-12 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6"> 
      
      {/* Header and Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100 mb-2">👥 Sistem Yönetimi</h1>
          <div className="flex gap-4 border-b border-slate-700 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab('users')}
              className={`pb-2 text-lg font-semibold transition-colors whitespace-nowrap ${activeTab === 'users' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-100'}`}
            >
              Kullanıcılar
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`pb-2 text-lg font-semibold transition-colors whitespace-nowrap ${activeTab === 'permissions' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-100'}`}
            >
              Roller & İzinler
            </button>
          </div>
        </div>
        
        {activeTab === 'users' && (
          <button
            onClick={() => setShowModal(true)}
            className="w-full md:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors"
          >
            + Yeni Kullanıcı
          </button>
        )}
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-emerald-900/30 border border-emerald-500/50 text-emerald-200' : 'bg-rose-900/30 border border-rose-500/50 text-rose-200'}`}>
          {message.text}
        </div>
      )}

      {/* TABS CONTENT */}
      {activeTab === 'users' ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-6 py-4 text-slate-200 font-semibold">Kullanıcı Adı</th>
                  <th className="px-6 py-4 text-slate-200 font-semibold">E-posta</th>
                  <th className="px-6 py-4 text-slate-200 font-semibold">Rol</th>
                  <th className="px-6 py-4 text-slate-200 font-semibold text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-100">{user.username}</td>
                    <td className="px-6 py-4 text-slate-300">{user.email || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs border ${getRoleBadgeClass(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex gap-2 justify-end">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={user.username === 'superadmin' || user.username === 'bidirabinizz'}
                        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="VET">VETERİNER</option>
                        <option value="WORKER">İŞÇİ</option>
                      </select>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        disabled={user.username === 'superadmin' || user.username === 'bidirabinizz'}
                        className="bg-rose-900/50 hover:bg-rose-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50 transition-colors"
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden p-4 space-y-4">
            {users.map((user) => (
              <div key={user.id} className="bg-slate-700/40 border border-slate-600/20 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-slate-100 font-semibold">{user.username}</p>
                    <p className="text-sm text-slate-300">{user.email || '-'}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs border ${getRoleBadgeClass(user.role)}`}>
                    {user.role}
                  </span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    disabled={user.username === 'superadmin' || user.username === 'bidirabinizz'}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="VET">VETERİNER</option>
                    <option value="WORKER">İŞÇİ</option>
                  </select>
                  <button
                    onClick={() => handleDeleteUser(user.id, user.username)}
                    disabled={user.username === 'superadmin' || user.username === 'bidirabinizz'}
                    className="bg-rose-900/50 hover:bg-rose-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50 transition-colors"
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* PERMISSIONS TAB */
        <div className="space-y-6">
          <p className="text-slate-400 text-sm">Alt kademedeki rollerin (Veteriner, İşçi) neyi görebileceğini ve yapabileceğini buradan ayarlayabilirsiniz. Admin rolünün tüm izinleri kalıcı olarak açıktır.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rolesData && Object.entries(rolesData).map(([roleKey, roleInfo]) => (
              <div key={roleKey} className={`bg-slate-800/60 border rounded-xl p-6 ${roleKey==='ADMIN' ? 'border-purple-500/40 opacity-70' : 'border-indigo-500/30'}`}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-100">{roleInfo.label}</h3>
                  {roleKey !== 'ADMIN' && (
                    <button 
                      onClick={() => handleSavePermissions(roleKey)}
                      disabled={savingPerms}
                      className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/50 px-3 py-1 rounded text-sm transition-colors"
                    >
                      {savingPerms ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  )}
                </div>
                
                <div className="space-y-3">
                  {Object.entries(roleInfo.permissions).map(([permKey, permVal]) => (
                    <label key={permKey} className="flex items-center justify-between p-2 hover:bg-slate-700/40 rounded cursor-pointer transition-colors">
                      <span className="text-sm text-slate-300">{permVal.label}</span>
                      <div className="relative inline-block w-10 mr-2 align-middle select-none">
                        <input 
                          type="checkbox" 
                          className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out"
                          checked={permVal.allowed}
                          onChange={() => togglePermission(roleKey, permKey)}
                          disabled={permVal.locked}
                          style={{
                                right: permVal.allowed ? '0' : '1.25rem',
                                borderColor: permVal.allowed ? (roleKey === 'ADMIN' ? '#a855f7' : '#10b981') : '#4b5563',
                          }}
                        />
                        <div className={`toggle-label block overflow-hidden h-5 rounded-full ${permVal.allowed ? (roleKey === 'ADMIN' ? 'bg-purple-500/30' : 'bg-emerald-500/30') : 'bg-slate-600'}`}></div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg p-4 md:p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-slate-100 mb-6">Yeni Kullanıcı</h2>
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Kullanıcı Adı *</label>
                <input required type="text" className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">E-posta</label>
                <input required type="email" className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Şifre *</label>
                <input required type="password" className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Rol</label>
                <select className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                  <option value="ADMIN">ADMIN</option>
                  <option value="VET">VETERİNER</option>
                  <option value="WORKER">İŞÇİ</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 text-slate-300 hover:text-slate-100">İptal</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Custom inline style for toggle switch transitions */}
      <style>{`
        .toggle-checkbox:checked { right: 0; }
        .toggle-checkbox { right: 1.25rem; transition: right 0.2s ease-in-out, border-color 0.2s ease-in-out; }
      `}</style>
    </div>
    
  );
};

export default Users;
