import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config';
import { useNavigate } from 'react-router-dom';
import { getCookie } from '../utils/cookieUtils';

const Animals = () => {
  const { isAuthenticated, userRole } = useAuth();
  const navigate = useNavigate();
  const [animals, setAnimals] = useState([]);
  const [paddocks, setPaddocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    ear_tag: '',
    name: '',
    birth_date: '',
    gender: 'Female',
    is_active: true,
    paddock_id: '',
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentAnimalId, setCurrentAnimalId] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    fetchAnimals();
    fetchPaddocks();
  }, [isAuthenticated, navigate]);

  const fetchPaddocks = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/paddocks/`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setPaddocks(data);
      }
    } catch (error) {
      console.error('Padoklar çekilemedi:', error);
    }
  };

  const fetchAnimals = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/animals/`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setAnimals(data.results || data);
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

    if (submitting) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    const payload = {
      ...formData,
      birth_date: formData.birth_date === '' ? null : formData.birth_date,
      paddock_id: formData.paddock_id === '' ? null : parseInt(formData.paddock_id),
    };

    try {
      if (isEditing && currentAnimalId) {
        const response = await fetch(`${API_BASE}/api/animals/${currentAnimalId}/`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (response.ok) {
          setMessage({ type: 'success', text: 'Hayvan başarıyla güncellendi' });
          setFormData({
            ear_tag: '',
            name: '',
            birth_date: '',
            gender: 'Female',
            is_active: true,
            paddock_id: '',
          });
          setIsEditing(false);
          setCurrentAnimalId(null);
          setShowModal(false);
          fetchAnimals();
        } else {
          setMessage({ type: 'error', text: data.error || 'Güncelleme başarısız' });
        }
      } else {
        const response = await fetch(`${API_BASE}/api/animals/create/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
          },
          credentials: 'include',
          body: JSON.stringify(payload),
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
            paddock_id: '',
          });
          setShowModal(false);
          fetchAnimals();
        } else {
          setMessage({ type: 'error', text: data.error || 'Ekleme başarısız' });
        }
      }
    } catch (error) {
      console.error('Hata detayı:', error);
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
          'X-CSRFToken': getCookie('csrftoken'),
        },
        credentials: 'include',
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

  const handleEdit = (animal) => {
    setFormData({
      ear_tag: animal.ear_tag,
      name: animal.name || '',
      birth_date: animal.birth_date || '',
      gender: animal.gender,
      is_active: animal.is_active,
      paddock_id: animal.paddock_id || '',
    });
    setCurrentAnimalId(animal.id);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleToggleActive = async (id, is_active) => {
    try {
      const response = await fetch(`${API_BASE}/api/animals/${id}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="text-white text-xl">Yükleniyor...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-4 md:p-8 border border-gray-700">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Hayvan Yönetimi</h1>
              <p className="text-gray-400 text-sm md:text-base">Küpe numaraları ve hayvan bilgileri</p>
            </div>
            {userRole !== 'WORKER' && (
              <button
                onClick={() => setShowModal(true)}
                className="w-full md:w-auto px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200"
              >
                + Yeni Hayvan Ekle
              </button>
            )}
          </div>

          {/* Message */}
          {message.text && (
            <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-900/50 border border-green-500 text-green-200' : 'bg-red-900/50 border border-red-500 text-red-200'}`}>
              {message.text}
            </div>
          )}

          {/* Table Container */}
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <div className="min-w-full">
              {/* Desktop Table */}
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="py-3 px-2 md:py-4 md:px-4 text-gray-300 font-semibold text-xs md:text-sm whitespace-nowrap">Küpe No</th>
                    <th className="py-3 px-2 md:py-4 md:px-4 text-gray-300 font-semibold text-xs md:text-sm whitespace-nowrap">İsim</th>
                    <th className="py-3 px-2 md:py-4 md:px-4 text-gray-300 font-semibold text-xs md:text-sm whitespace-nowrap">Doğum Tarihi</th>
                    <th className="py-3 px-2 md:py-4 md:px-4 text-gray-300 font-semibold text-xs md:text-sm whitespace-nowrap">Cinsiyet</th>
                    <th className="py-3 px-2 md:py-4 md:px-4 text-gray-300 font-semibold text-xs md:text-sm whitespace-nowrap">Padok</th>
                    <th className="py-3 px-2 md:py-4 md:px-4 text-gray-300 font-semibold text-xs md:text-sm whitespace-nowrap">Durum</th>
                    <th className="py-3 px-2 md:py-4 md:px-4 text-gray-300 font-semibold text-xs md:text-sm whitespace-nowrap">Atanmış Cihaz</th>
                    <th className="py-3 px-2 md:py-4 md:px-4 text-gray-300 font-semibold text-xs md:text-sm whitespace-nowrap">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {animals.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-gray-400">Henüz hayvan eklenmemiş</td>
                    </tr>
                  ) : (
                    animals.map((animal) => (
                      <tr key={animal.id} className="border-b border-gray-700 hover:bg-gray-700/30 transition-colors">
                        <td className="py-3 px-2 md:py-4 md:px-4 text-white font-mono text-xs md:text-sm whitespace-nowrap">{animal.ear_tag}</td>
                        <td className="py-3 px-2 md:py-4 md:px-4 text-gray-300 text-xs md:text-sm whitespace-nowrap">{animal.name || '-'}</td>
                        <td className="py-3 px-2 md:py-4 md:px-4 text-gray-300 text-xs md:text-sm whitespace-nowrap">{animal.birth_date || '-'}</td>
                        <td className="py-3 px-2 md:py-4 md:px-4 text-gray-300 text-xs md:text-sm whitespace-nowrap">{animal.gender}</td>
                        <td className="py-3 px-2 md:py-4 md:px-4 text-gray-300 text-xs md:text-sm whitespace-nowrap">{animal.paddock || '-'}</td>
                        <td className="py-3 px-2 md:py-4 md:px-4 whitespace-nowrap">
                          <span className={`px-2 py-1 md:px-3 md:py-1 rounded-full text-xs font-semibold ${animal.is_active ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                            {animal.is_active ? 'Aktif' : 'Pasif'}
                          </span>
                        </td>
                        <td className="py-3 px-2 md:py-4 md:px-4 text-gray-300 font-mono text-xs md:text-sm whitespace-nowrap">{animal.device || '-'}</td>
                        <td className="py-3 px-2 md:py-4 md:px-4 whitespace-nowrap">
                          {userRole !== 'WORKER' ? (
                            <div className="flex flex-col md:flex-row gap-1 md:gap-2">
                              <button
                                onClick={() => handleEdit(animal)}
                                className="px-2 py-1 md:px-3 md:py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                              >
                                Düzenle
                              </button>
                              <button
                                onClick={() => handleToggleActive(animal.id, animal.is_active)}
                                className="px-2 py-1 md:px-3 md:py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                              >
                                {animal.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                              </button>
                              <button
                                onClick={() => handleDelete(animal.id)}
                                className="px-2 py-1 md:px-3 md:py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                              >
                                Sil
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">-</span>
                          )}
                          {animal.device && (
                            <div className="mt-2">
                              <button
                                onClick={() => navigate(`/report/${animal.device}`)}
                                className="px-2 py-1 md:px-3 md:py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                              >
                                Detaylı Rapor
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden p-4 space-y-4">
            {animals.map((animal) => (
              <div key={animal.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-white font-semibold">{animal.ear_tag}</p>
                    <p className="text-sm text-gray-300">{animal.name || '-'}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${animal.is_active ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                    {animal.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-300 text-xs">Doğum Tarihi</p>
                    <p className="text-white">{animal.birth_date || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-300 text-xs">Cinsiyet</p>
                    <p className="text-white font-mono">{animal.gender}</p>
                  </div>
                  <div>
                    <p className="text-gray-300 text-xs">Padok</p>
                    <p className="text-white">{animal.paddock || '-'}</p>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-1 md:gap-2">
                  <button
                    onClick={() => handleEdit(animal)}
                    className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                  >
                    Düzenle
                  </button>
                  <button
                    onClick={() => handleToggleActive(animal.id, animal.is_active)}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                  >
                    {animal.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                  </button>
                  <button
                    onClick={() => handleDelete(animal.id)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                  >
                    Sil
                  </button>
                </div>
                {animal.device && (
                  <div className="mt-2">
                    <button
                      onClick={() => navigate(`/report/${animal.device}`)}
                      className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                    >
                      Detaylı Rapor
                    </button>
                  </div>
                )}
              </div>
            ))}
            {animals.length === 0 && (
              <div className="text-center text-gray-400 py-8">Henüz hayvan eklenmemiş</div>
            )}
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-700">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">{isEditing ? 'Hayvan Düzenle' : 'Yeni Hayvan Ekle'}</h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setIsEditing(false);
                    setCurrentAnimalId(null);
                  }}
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

                <div className="mb-4">
                  <label htmlFor="paddock_id" className="block text-sm font-medium text-gray-300 mb-2">
                    Padok
                  </label>
                  <select
                    id="paddock_id"
                    value={formData.paddock_id}
                    onChange={(e) => setFormData({ ...formData, paddock_id: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Atanmamış (Bağımsız)</option>
                    {paddocks.map((padok) => (
                      <option key={padok.id} value={padok.id}>
                        {padok.name} (Kapasite: {padok.capacity || 'Sınırsız'})
                      </option>
                    ))}
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
                    {submitting ? (isEditing ? 'Güncelleniyor...' : 'Ekleniyor...') : (isEditing ? 'Güncelle' : 'Ekle')}
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
    </div>
  );
};

export default Animals;
