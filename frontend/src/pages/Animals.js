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
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-slate-100 text-xl">Yükleniyor...</div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100 mb-2">Hayvan Yönetimi</h1>
          <p className="text-slate-400 text-sm">Küpe numaraları ve hayvan bilgileri</p>
        </div>
        {userRole !== 'WORKER' && (
          <button
            onClick={() => setShowModal(true)}
            className="w-full md:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors"
          >
            + Yeni Hayvan Ekle
          </button>
        )}
      </div>

      {message.text && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-emerald-900/30 border border-emerald-500/50 text-emerald-200' : 'bg-rose-900/30 border border-rose-500/50 text-rose-200'}`}>
          {message.text}
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto bg-slate-800 rounded-xl border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-6 py-4 text-slate-200 font-semibold">Küpe No</th>
              <th className="px-6 py-4 text-slate-200 font-semibold">İsim</th>
              <th className="px-6 py-4 text-slate-200 font-semibold">Doğum Tarihi</th>
              <th className="px-6 py-4 text-slate-200 font-semibold">Cinsiyet</th>
              <th className="px-6 py-4 text-slate-200 font-semibold">Padok</th>
              <th className="px-6 py-4 text-slate-200 font-semibold">Durum</th>
              <th className="px-6 py-4 text-slate-200 font-semibold">Atanmış Cihaz</th>
              <th className="px-6 py-4 text-slate-200 font-semibold text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {animals.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-12 text-center text-slate-400">Henüz hayvan eklenmemiş</td>
              </tr>
            ) : (
              animals.map((animal) => (
                <tr key={animal.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4 text-slate-100 font-mono">{animal.ear_tag}</td>
                  <td className="px-6 py-4 text-slate-300">{animal.name || '-'}</td>
                  <td className="px-6 py-4 text-slate-300">{animal.birth_date || '-'}</td>
                  <td className="px-6 py-4 text-slate-300">{animal.gender}</td>
                  <td className="px-6 py-4 text-slate-300">{animal.paddock || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${animal.is_active ? 'bg-emerald-900/50 text-emerald-300' : 'bg-rose-900/50 text-rose-300'}`}>
                      {animal.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-300 font-mono">{animal.device || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    {userRole !== 'WORKER' ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleEdit(animal)}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded transition-colors"
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={() => handleToggleActive(animal.id, animal.is_active)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                        >
                          {animal.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                        </button>
                        <button
                          onClick={() => handleDelete(animal.id)}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs rounded transition-colors"
                        >
                          Sil
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-sm">-</span>
                    )}
                    {animal.device && (
                      <div className="mt-2">
                        <button
                          onClick={() => navigate(`/report/${animal.device}`)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded transition-colors"
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

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {animals.map((animal) => (
          <div key={animal.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-mono text-slate-100 font-semibold">{animal.ear_tag}</p>
                <p className="text-sm text-slate-300">{animal.name || '-'}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${animal.is_active ? 'bg-emerald-900/50 text-emerald-300' : 'bg-rose-900/50 text-rose-300'}`}>
                {animal.is_active ? 'Aktif' : 'Pasif'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-400 text-xs">Doğum Tarihi</p>
                <p className="text-slate-100">{animal.birth_date || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Cinsiyet</p>
                <p className="text-slate-100 font-mono">{animal.gender}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Padok</p>
                <p className="text-slate-100">{animal.paddock || '-'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {userRole !== 'WORKER' && (
                <>
                  <button
                    onClick={() => handleEdit(animal)}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded transition-colors"
                  >
                    Düzenle
                  </button>
                  <button
                    onClick={() => handleToggleActive(animal.id, animal.is_active)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                  >
                    {animal.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                  </button>
                  <button
                    onClick={() => handleDelete(animal.id)}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs rounded transition-colors"
                  >
                    Sil
                  </button>
                </>
              )}
              {animal.device && (
                <button
                  onClick={() => navigate(`/report/${animal.device}`)}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded transition-colors"
                >
                  Detaylı Rapor
                </button>
              )}
            </div>
          </div>
        ))}
        {animals.length === 0 && (
          <div className="text-center text-slate-400 py-8">Henüz hayvan eklenmemiş</div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg p-4 md:p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-100">{isEditing ? 'Hayvan Düzenle' : 'Yeni Hayvan Ekle'}</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setIsEditing(false);
                  setCurrentAnimalId(null);
                }}
                className="text-slate-400 hover:text-slate-100 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="ear_tag" className="block text-sm font-medium text-slate-300 mb-2">
                  Küpe Numarası *
                </label>
                <input
                  type="text"
                  id="ear_tag"
                  value={formData.ear_tag}
                  onChange={(e) => setFormData({ ...formData, ear_tag: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                  İsim
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="birth_date" className="block text-sm font-medium text-slate-300 mb-2">
                  Doğum Tarihi
                </label>
                <input
                  type="date"
                  id="birth_date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="gender" className="block text-sm font-medium text-slate-300 mb-2">
                  Cinsiyet
                </label>
                <select
                  id="gender"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="Female">Dişi</option>
                  <option value="Male">Erkek</option>
                </select>
              </div>

              <div className="mb-4">
                <label htmlFor="paddock_id" className="block text-sm font-medium text-slate-300 mb-2">
                  Padok
                </label>
                <select
                  id="paddock_id"
                  value={formData.paddock_id}
                  onChange={(e) => setFormData({ ...formData, paddock_id: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                    className="w-4 h-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-slate-300">Aktif</span>
                </label>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? (isEditing ? 'Güncelleniyor...' : 'Ekleniyor...') : (isEditing ? 'Güncelle' : 'Ekle')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg transition-all duration-200"
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
