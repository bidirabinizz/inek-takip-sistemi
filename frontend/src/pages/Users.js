import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config';
import { useNavigate } from 'react-router-dom';

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

const Users = () => {
  const { isAuthenticated, userRole } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'WORKER',
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    if (userRole !== 'ADMIN') {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [isAuthenticated, userRole, navigate]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/users/`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        setMessage({ type: 'error', text: 'Kullanıcılar yüklenemedi' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bağlantı hatası' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (submitting) return;
    
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${API_BASE}/api/users/create/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Kullanıcı başarıyla oluşturuldu' });
        setFormData({
          username: '',
          email: '',
          password: '',
          role: 'WORKER',
        });
        setShowModal(false);
        fetchUsers();
      } else {
        setMessage({ type: 'error', text: data.error || 'Oluşturma başarısız' });
      }
    } catch (error) {
      console.error("Hata detayı:", error);
      setMessage({ type: 'error', text: 'Bağlantı hatası' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, username) => {
    if (!window.confirm(`"${username}" kullanıcısını silmek istediğinize emin misiniz?`)) return;

    try {
      const response = await fetch(`${API_BASE}/api/users/${id}/`, {
        method: 'DELETE',
        headers: {
          'X-CSRFToken': getCookie('csrftoken')
        },
        credentials: 'include'
      });
      if (response.ok) {
        setMessage({ type: 'success', text: 'Kullanıcı silindi' });
        fetchUsers();
      } else {
        setMessage({ type: 'error', text: 'Silme başarısız' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bağlantı hatası' });
    }
  };

  const handleRoleChange = async (id, newRole) => {
    try {
      const response = await fetch(`${API_BASE}/api/users/${id}/role/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Rol güncellendi' });
        fetchUsers();
      } else {
        setMessage({ type: 'error', text: 'Rol güncelleme başarısız' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bağlantı hatası' });
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-900/50 text-purple-300 border-purple-500';
      case 'VET':
        return 'bg-blue-900/50 text-blue-300 border-blue-500';
      case 'WORKER':
        return 'bg-gray-700 text-gray-300 border-gray-500';
      default:
        return 'bg-gray-700 text-gray-300 border-gray-500';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'Admin (Patron)';
      case 'VET':
        return 'Veteriner';
      case 'WORKER':
        return 'İşçi';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
        <div className="text-white text-xl">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Kullanıcı Yönetimi</h1>
              <p className="text-gray-400">Sistem kullanıcıları ve rolleri</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200"
            >
              + Yeni Kullanıcı Ekle
            </button>
          </div>

          {message.text && (
            <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-900/50 border border-green-500 text-green-200' : 'bg-red-900/50 border border-red-500 text-red-200'}`}>
              {message.text}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-4 px-4 text-gray-300 font-semibold">Kullanıcı Adı</th>
                  <th className="py-4 px-4 text-gray-300 font-semibold">E-posta</th>
                  <th className="py-4 px-4 text-gray-300 font-semibold">Rol</th>
                  <th className="py-4 px-4 text-gray-300 font-semibold">Katılım Tarihi</th>
                  <th className="py-4 px-4 text-gray-300 font-semibold">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-gray-400">
                      Henüz kullanıcı yok
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-700 hover:bg-gray-700/30 transition-colors">
                      <td className="py-4 px-4 text-white font-mono">{user.username}</td>
                      <td className="py-4 px-4 text-gray-300">{user.email || '-'}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRoleBadgeClass(user.role)}`}>
                            {getRoleLabel(user.role)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-300">
                        {new Date(user.date_joined).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            disabled={user.username === 'superadmin'} // Prevent role change for superadmin
                            className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="VET">Veteriner</option>
                            <option value="WORKER">İşçi</option>
                          </select>
                          <button
                            onClick={() => handleDelete(user.id, user.username)}
                            disabled={user.username === 'superadmin'} // Prevent deletion of superadmin
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={user.username === 'superadmin' ? 'Superadmin silinemez' : 'Kullanıcıyı Sil'}
                          >
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Yeni Kullanıcı Ekle</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                  Kullanıcı Adı *
                </label>
                <input
                  type="text"
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  E-posta
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Şifre *
                </label>
                <input
                  type="password"
                  id="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="mb-6">
                <label htmlFor="role" className="block text-sm font-medium text-gray-300 mb-2">
                  Rol *
                </label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="ADMIN">Admin (Patron)</option>
                  <option value="VET">Veteriner</option>
                  <option value="WORKER">İşçi</option>
                </select>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? 'Oluşturuluyor...' : 'Oluştur'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all duration-200"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
