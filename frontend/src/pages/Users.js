import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { API_BASE } from '../config';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Users = () => {
  const { isAuthenticated, userRole } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users'); // 'users' veya 'permissions'
  
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
    // Allow if user is ADMIN, otherwise check for specific permission
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
    if (roleKey === 'ADMIN') return; // Admin locked
    
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
      case 'ADMIN': return 'bg-purple-900/50 text-purple-300 border-purple-500';
      case 'VET': return 'bg-blue-900/50 text-blue-300 border-blue-500';
      default: return 'bg-gray-700 text-gray-300 border-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyber-dark">
         <div className="w-12 h-12 border-t-2 border-cyber-green rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6"> 
      
      {/* Header and Tabs */}
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">👥 Sistem Yönetimi</h1>
          <div className="flex gap-4 border-b border-cyber-gray/20 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab('users')}
              className={`pb-2 text-lg font-semibold transition-colors whitespace-nowrap ${activeTab === 'users' ? 'text-cyber-green border-b-2 border-cyber-green' : 'text-cyber-gray hover:text-white'}`}
            >
              Kullanıcılar
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`pb-2 text-lg font-semibold transition-colors whitespace-nowrap ${activeTab === 'permissions' ? 'text-cyber-green border-b-2 border-cyber-green' : 'text-cyber-gray hover:text-white'}`}
            >
              Roller & İzinler
            </button>
          </div>
        </div>
        
        {activeTab === 'users' && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-cyber-green text-black px-4 py-2 rounded-xl font-bold hover:bg-green-500 transition shadow-lg shadow-cyber-green/20"
          >
            + Yeni Kullanıcı
          </button>
        )}
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-green-900/40 border-green-500 text-green-300' : 'bg-red-900/40 border-red-500 text-red-300'}`}>
          {message.text}
        </div>
      )}

      {/* TABS CONTENT */}
      {activeTab === 'users' ? (
        <div className="bg-cyber-dark/80 border border-cyber-green/20 rounded-2xl overflow-hidden shadow-xl">
          {/* Desktop Table */}
          <table className="w-full text-left text-sm hidden md:table">
            <thead className="bg-cyber-darkBlue/80 text-cyber-green">
              <tr>
                <th className="px-6 py-4">Kullanıcı Adı</th>
                <th className="px-6 py-4">E-posta</th>
                <th className="px-6 py-4">Rol</th>
                <th className="px-6 py-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-gray/10 text-white">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-cyber-darkBlue/40">
                  <td className="px-6 py-4 font-mono">{user.username}</td>
                  <td className="px-6 py-4 text-cyber-gray">{user.email || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs border ${getRoleBadgeClass(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      disabled={user.username === 'superadmin' || user.username === 'bidirabinizz'}
                      className="bg-cyber-dark border border-cyber-gray/30 rounded px-2 py-1 focus:border-cyber-green outline-none disabled:opacity-50"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="VET">VETERİNER</option>
                      <option value="WORKER">İŞÇİ</option>
                    </select>
                    <button
                      onClick={() => handleDeleteUser(user.id, user.username)}
                      disabled={user.username === 'superadmin' || user.username === 'bidirabinizz'}
                      className="bg-red-900/50 hover:bg-red-600 text-white px-3 py-1 rounded disabled:opacity-50 transition"
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="md:hidden p-4 space-y-4">
            {users.map((user) => (
              <div key={user.id} className="bg-cyber-darkBlue/40 border border-cyber-gray/20 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-white font-semibold">{user.username}</p>
                    <p className="text-sm text-cyber-gray">{user.email || '-'}</p>
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
                    className="flex-1 bg-cyber-dark border border-cyber-gray/30 rounded px-2 py-1 text-sm focus:border-cyber-green outline-none disabled:opacity-50"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="VET">VETERİNER</option>
                    <option value="WORKER">İŞÇİ</option>
                  </select>
                  <button
                    onClick={() => handleDeleteUser(user.id, user.username)}
                    disabled={user.username === 'superadmin' || user.username === 'bidirabinizz'}
                    className="bg-red-900/50 hover:bg-red-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50 transition"
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
        <div className="space-y-8">
          <p className="text-cyber-gray text-sm">Alt kademedeki rollerin (Veteriner, İşçi) neyi görebileceğini ve yapabileceğini buradan ayarlayabilirsiniz. Admin rolünün tüm izinleri kalıcı olarak açıktır.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rolesData && Object.entries(rolesData).map(([roleKey, roleInfo]) => (
              <div key={roleKey} className={`bg-cyber-dark/60 border rounded-2xl p-6 ${roleKey==='ADMIN' ? 'border-purple-500/50 shadow-lg shadow-purple-500/10 opacity-70' : 'border-cyber-green/30 shadow-lg shadow-cyber-green/10'}`}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white">{roleInfo.label}</h3>
                  {roleKey !== 'ADMIN' && (
                    <button 
                      onClick={() => handleSavePermissions(roleKey)}
                      disabled={savingPerms}
                      className="bg-cyber-green/20 hover:bg-cyber-green/40 text-cyber-green border border-cyber-green/50 px-3 py-1 rounded text-sm transition"
                    >
                      {savingPerms ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  )}
                </div>
                
                <div className="space-y-3">
                  {Object.entries(roleInfo.permissions).map(([permKey, permVal]) => (
                    <label key={permKey} className="flex items-center justify-between p-2 hover:bg-cyber-darkBlue/40 rounded cursor-pointer transition">
                      <span className="text-sm text-cyber-lightGray">{permVal.label}</span>
                      <div className="relative inline-block w-10 mr-2 align-middle select-none">
                        <input 
                          type="checkbox" 
                          className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out"
                          checked={permVal.allowed}
                          onChange={() => togglePermission(roleKey, permKey)}
                          disabled={permVal.locked}
                          style={{
                                right: permVal.allowed ? '0' : '1.25rem',
                                borderColor: permVal.allowed ? (roleKey === 'ADMIN' ? '#A855F7' : '#00ff9d') : '#4B5563',
                          }}
                        />
                        <div className={`toggle-label block overflow-hidden h-5 rounded-full ${permVal.allowed ? (roleKey === 'ADMIN' ? 'bg-purple-500/30' : 'bg-cyber-green/30') : 'bg-gray-700'}`}></div>
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
          <div className="bg-cyber-dark border border-cyber-green/30 rounded-2xl shadow-2xl p-4 md:p-8 w-[95%] max-w-lg">
            <h2 className="text-2xl font-bold text-white mb-6">Yeni Kullanıcı</h2>
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-cyber-gray mb-1">Kullanıcı Adı *</label>
                <input required type="text" className="w-full bg-cyber-darkBlue border border-cyber-gray/30 rounded-lg p-2.5 text-white outline-none focus:border-cyber-green" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-cyber-gray mb-1">Şifre *</label>
                <input required type="password" className="w-full bg-cyber-darkBlue border border-cyber-gray/30 rounded-lg p-2.5 text-white outline-none focus:border-cyber-green" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-cyber-gray mb-1">Rol</label>
                <select className="w-full bg-cyber-darkBlue border border-cyber-gray/30 rounded-lg p-2.5 text-white outline-none focus:border-cyber-green" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                  <option value="ADMIN">ADMIN</option>
                  <option value="VET">VETERİNER</option>
                  <option value="WORKER">İŞÇİ</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4 border-t border-cyber-gray/20">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-cyber-gray hover:text-white flex-1">İptal</button>
                <button type="submit" className="bg-cyber-green hover:bg-green-500 text-black font-bold px-4 py-2 rounded-lg flex-1">Kaydet</button>
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
