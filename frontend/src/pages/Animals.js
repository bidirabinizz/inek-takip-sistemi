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

const Animals = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    ear_tag: '',
    name: '',
    birth_date: '',
    gender: 'Female',
    is_active: true,
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    fetchAnimals();
  }, [isAuthenticated, navigate]);

  const fetchAnimals = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/animals/`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAnimals(data);
      } else {
        setMessage({ type: 'error', text: 'Hayvanlar yüklenemedi' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bağlantı hatası' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 🚀 KORUMA 1: Çift tıklamayı engelle (Zaten istek atılıyorsa ikincisini durdur)
    if (submitting) return; 
    
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    // 🚀 KORUMA 2: Boş tarihi "" yerine null yap ki Django'nun veritabanı çökmesin
    const payload = {
      ...formData,
      birth_date: formData.birth_date === '' ? null : formData.birth_date
    };

    try {
      const response = await fetch(`${API_BASE}/api/animals/create/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken') // Şifremiz yerinde duruyor
        },
        credentials: 'include',
        body: JSON.stringify(payload), // formData yerine temizlenmiş payload'u gönderiyoruz
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Hayvan başarıyla eklendi' });
        setFormData({
          ear_tag: '',
          name: '',
          birth_date: '',
          gender: 'Female',
          is_active: true,
        });
        setShowModal(false);
        fetchAnimals();
      } else {
        setMessage({ type: 'error', text: data.error || 'Ekleme başarısız' });
      }
    } catch (error) {
      console.error("Hata detayı:", error);
      setMessage({ type: 'error', text: 'Bağlantı hatası' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu hayvanı silmek istediğinize emin misiniz?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/animals/${id}/`, {
        method: 'DELETE',
        headers: {
          'X-CSRFToken': getCookie('csrftoken') // <--- BURAYI EKLEDİK
        },
        credentials: 'include'
      });
      if (response.ok) {
        setMessage({ type: 'success', text: 'Hayvan silindi' });
        fetchAnimals();
      } else {
        setMessage({ type: 'error', text: 'Silme başarısız' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bağlantı hatası' });
    }
  };

  const handleToggleActive = async (id, is_active) => {
    try {
      const response = await fetch(`${API_BASE}/api/animals/${id}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken') // <--- BURAYI EKLEDİK
        },
        credentials: 'include',
        body: JSON.stringify({ is_active: !is_active }),
      });
      if (response.ok) {
        fetchAnimals();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Güncelleme başarısız' });
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
              <h1 className="text-3xl font-bold text-white mb-2">Hayvan Yönetimi</h1>
              <p className="text-gray-400">Küpe numaraları ve hayvan bilgileri</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200"
            >
              + Yeni Hayvan Ekle
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
                  <th className="py-4 px-4 text-gray-300 font-semibold">Küpe No</th>
                  <th className="py-4 px-4 text-gray-300 font-semibold">İsim</th>
                  <th className="py-4 px-4 text-gray-300 font-semibold">Doğum Tarihi</th>
                  <th className="py-4 px-4 text-gray-300 font-semibold">Cinsiyet</th>
                  <th className="py-4 px-4 text-gray-300 font-semibold">Durum</th>
                  <th className="py-4 px-4 text-gray-300 font-semibold">Atanmış Cihaz</th>
                  <th className="py-4 px-4 text-gray-300 font-semibold">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {animals.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-gray-400">
                      Henüz hayvan eklenmemiş
                    </td>
                  </tr>
                ) : (
                  animals.map((animal) => (
                    <tr key={animal.id} className="border-b border-gray-700 hover:bg-gray-700/30 transition-colors">
                      <td className="py-4 px-4 text-white font-mono">{animal.ear_tag}</td>
                      <td className="py-4 px-4 text-gray-300">{animal.name || '-'}</td>
                      <td className="py-4 px-4 text-gray-300">{animal.birth_date || '-'}</td>
                      <td className="py-4 px-4 text-gray-300">{animal.gender}</td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${animal.is_active ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                          {animal.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-300 font-mono">{animal.device || '-'}</td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleActive(animal.id, animal.is_active)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                          >
                            {animal.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                          </button>
                          <button
                            onClick={() => handleDelete(animal.id)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
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
              <h2 className="text-2xl font-bold text-white">Yeni Hayvan Ekle</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="ear_tag" className="block text-sm font-medium text-gray-300 mb-2">
                  Küpe Numarası *
                </label>
                <input
                  type="text"
                  id="ear_tag"
                  value={formData.ear_tag}
                  onChange={(e) => setFormData({ ...formData, ear_tag: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  İsim
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="birth_date" className="block text-sm font-medium text-gray-300 mb-2">
                  Doğum Tarihi
                </label>
                <input
                  type="date"
                  id="birth_date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="gender" className="block text-sm font-medium text-gray-300 mb-2">
                  Cinsiyet
                </label>
                <select
                  id="gender"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="Female">Dişi</option>
                  <option value="Male">Erkek</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                  />
                  <span className="ml-2 text-sm text-gray-300">Aktif</span>
                </label>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? 'Ekleniyor...' : 'Ekle'}
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

export default Animals;
