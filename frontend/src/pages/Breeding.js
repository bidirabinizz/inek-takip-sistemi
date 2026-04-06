import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';
import { usePermission } from '../hooks/usePermission';
import { useAuth } from '../context/AuthContext';
import { PlusIcon, EyeIcon, CalendarDaysIcon, ChartBarIcon } from '@heroicons/react/24/outline';

const Breeding = () => {
  const [inseminations, setInseminations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ animal_id: '', insemination_date: '', bull_info: '', technician: '', notes: '' });

  const [statusModal, setStatusModal] = useState({ isOpen: false, id: null });

  const { userRole } = useAuth();
  const canManageBreeding = usePermission('manage_breeding');
  const hasAccess = userRole === 'ADMIN' || canManageBreeding;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [insRes, animalsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/inseminations/`),
        axios.get(`${API_BASE}/api/animals/`)
      ]);
      setInseminations(insRes.data.results || []);
      setSummary(insRes.data.summary || null);
      const animalsList = animalsRes.data.results || animalsRes.data;
      setAnimals(animalsList.filter(a => a.is_active && a.gender === 'Female'));
    } catch (err) {
      console.error('Dölleme verileri çekilemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/inseminations/create/`, formData);
      setIsModalOpen(false);
      setFormData({ animal_id: '', insemination_date: '', bull_info: '', technician: '', notes: '' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Kayıt başarısız');
    }
  };

  const handleUpdateStatus = async (status, notes) => {
    try {
      await axios.put(`${API_BASE}/api/inseminations/${statusModal.id}/status/`, { status, notes });
      setStatusModal({ isOpen: false, id: null });
      fetchData();
    } catch (err) {
      alert('Durum güncellenemedi');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'SUCCESS': return 'bg-emerald-900/30 text-emerald-300 border border-emerald-500/40';
      case 'FAILED': return 'bg-rose-900/30 text-rose-300 border border-rose-500/40';
      case 'CANCELLED': return 'bg-slate-700 text-slate-300 border border-slate-600';
      default: return 'bg-amber-900/30 text-amber-300 border border-amber-500/40';
    }
  };

  if (loading) return <div className="p-8 flex justify-center items-center h-full"><div className="w-12 h-12 border-t-2 border-indigo-500 rounded-full animate-spin"></div></div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100 flex items-center gap-3">
            <span className="text-4xl">🧬</span>
            Tohumlama & Gebelik Takip
          </h1>
          <p className="text-slate-400 mt-2 text-sm">İneklerin dölleme işlemleri ve gebelik 21/28 gün döngüsü</p>
        </div>
        {hasAccess && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full md:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg flex items-center gap-2 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Yeni Kayıt Gir
          </button>
        )}
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 border border-amber-500/30 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-amber-500/20 p-3 rounded-xl text-amber-400"><CalendarDaysIcon className="w-6 h-6" /></div>
            <div><p className="text-slate-400 text-xs">Sonuç Bekleyen</p><p className="text-2xl font-bold text-slate-100">{summary.pending}</p></div>
          </div>
          <div className="bg-slate-800 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-emerald-500/20 p-3 rounded-xl text-emerald-400"><ChartBarIcon className="w-6 h-6" /></div>
            <div><p className="text-slate-400 text-xs">Bu Ay Gebe Kalan</p><p className="text-2xl font-bold text-slate-100">{summary.success_this_month}</p></div>
          </div>
          <div className="bg-slate-800 border border-rose-500/30 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-rose-500/20 p-3 rounded-xl text-rose-400"><ChartBarIcon className="w-6 h-6" /></div>
            <div><p className="text-slate-400 text-xs">Bu Ay Tutmayan</p><p className="text-2xl font-bold text-slate-100">{summary.failed_this_month}</p></div>
          </div>
          <div className="bg-slate-800 border border-sky-500/30 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-sky-500/20 p-3 rounded-xl text-sky-400"><EyeIcon className="w-6 h-6" /></div>
            <div><p className="text-slate-400 text-xs">Yaklaşan Kontrol</p><p className="text-2xl font-bold text-slate-100">{summary.upcoming_checks}</p></div>
          </div>
        </div>
      )}

      {/* List Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-6 py-4 text-slate-200 font-semibold">Hayvan</th>
                <th className="px-6 py-4 text-slate-200 font-semibold">İşlem Tarihi</th>
                <th className="px-6 py-4 text-center text-slate-200 font-semibold">Kaçıncı Gün</th>
                <th className="px-6 py-4 text-center text-slate-200 font-semibold">Durum</th>
                <th className="px-6 py-4 text-center text-slate-200 font-semibold">Tahmini Hedef</th>
                <th className="px-6 py-4 text-right text-slate-200 font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {inseminations.map((ins) => (
                <tr key={ins.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-100 flex flex-col">
                    <span>{ins.animal.name || 'İsimsiz'}</span>
                    <span className="text-xs text-slate-400">{ins.animal.ear_tag}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{new Date(ins.insemination_date).toLocaleDateString('tr-TR')}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-block px-3 py-1 bg-slate-700 rounded-lg border border-slate-600 font-mono">{ins.days_since} GÜN</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1.5 rounded-lg border text-xs font-bold tracking-wide ${getStatusColor(ins.status)}`}>{ins.status_display}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {ins.status === 'SUCCESS' ? (
                      <div className="text-emerald-300">
                        <p className="text-xs text-slate-400">Tahmini Doğum</p>
                        {new Date(ins.expected_calving_date).toLocaleDateString('tr-TR')}
                      </div>
                    ) : ins.status === 'PENDING' ? (
                      <div className="text-sky-300">
                        <p className="text-xs text-slate-400">Ultrason (28. Gün)</p>
                        {new Date(ins.pregnancy_check_date).toLocaleDateString('tr-TR')}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {(userRole === 'ADMIN' || canManageBreeding) && ins.status === 'PENDING' && (
                      <button onClick={() => setStatusModal({ isOpen: true, id: ins.id })} className="bg-slate-700 border border-indigo-500 text-indigo-400 hover:bg-indigo-600 hover:text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors">Sonuç Bildir</button>
                    )}
                  </td>
                </tr>
              ))}
              {inseminations.length === 0 && (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-400">Henüz dölleme kaydı bulunmuyor.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden p-4 space-y-4">
          {inseminations.map((ins) => (
            <div key={ins.id} className="bg-slate-700/40 border border-slate-600/20 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-slate-100 font-semibold">{ins.animal.name || 'İsimsiz'}</p>
                  <p className="text-xs text-slate-400">{ins.animal.ear_tag}</p>
                </div>
                <span className={`px-3 py-1 rounded-lg border text-xs font-bold ${getStatusColor(ins.status)}`}>{ins.status_display}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400 text-xs">İşlem Tarihi</p>
                  <p className="text-slate-100">{new Date(ins.insemination_date).toLocaleDateString('tr-TR')}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Kaçıncı Gün</p>
                  <p className="text-slate-100 font-mono">{ins.days_since} GÜN</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Tahmini Hedef</p>
                  <p className="text-slate-100">{ins.status === 'SUCCESS' ? new Date(ins.expected_calving_date).toLocaleDateString('tr-TR') : ins.status === 'PENDING' ? new Date(ins.pregnancy_check_date).toLocaleDateString('tr-TR') : '-'}</p>
                </div>
              </div>
              {(userRole === 'ADMIN' || canManageBreeding) && ins.status === 'PENDING' && (
                <button onClick={() => setStatusModal({ isOpen: true, id: ins.id })} className="w-full bg-slate-700 border border-indigo-500 text-indigo-400 hover:bg-indigo-600 hover:text-white py-2 rounded-lg text-sm font-bold transition-colors">Sonuç Bildir</button>
              )}
            </div>
          ))}
          {inseminations.length === 0 && (
            <div className="text-center text-slate-400 py-8">Henüz dölleme kaydı bulunmuyor.</div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg p-4 md:p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-slate-100 mb-6 border-b border-slate-700 pb-3">Yeni Tohumlama Kaydı</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Hayvan Seçin *</label>
                <select required className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.animal_id} onChange={e => setFormData({ ...formData, animal_id: e.target.value })}>
                  <option value="">Seçiniz...</option>
                  {animals.map(a => <option key={a.id} value={a.id}>{a.ear_tag} - {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Tohumlama Tarihi *</label>
                <input required type="date" className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.insemination_date} onChange={e => setFormData({ ...formData, insemination_date: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Boğa / Semen Kodu</label>
                  <input type="text" className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.bull_info} onChange={e => setFormData({ ...formData, bull_info: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Suni Tohumlayıcı (Vet)</label>
                  <input type="text" className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.technician} onChange={e => setFormData({ ...formData, technician: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Özel Notlar</label>
                <textarea className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" rows="2" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-300 hover:text-slate-100">İptal</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {statusModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg p-4 md:p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold text-slate-100 mb-6 text-center">Gebelik Sonucu Bildir</h2>
            <p className="text-slate-400 text-center text-sm mb-6">Ultrason kontrolü sonrası gebelik durumunu belirleyin.</p>
            <div className="flex flex-col gap-4">
              <button onClick={() => handleUpdateStatus('SUCCESS', 'Ultrason ile gebelik doğrulandı.')} className="w-full flex items-center justify-center gap-3 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 border border-emerald-500/50 p-4 rounded-xl font-bold text-lg transition-colors">✅ TUTTU (Gebe)</button>
              <button onClick={() => handleUpdateStatus('FAILED', 'Gebelik oluşmadı, tekrar kızgınlık takibinde.')} className="w-full flex items-center justify-center gap-3 bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 border border-rose-500/50 p-4 rounded-xl font-bold text-lg transition-colors">❌ TUTMADI (Boş)</button>
              <div className="border-t border-slate-700 mt-4 pt-4 flex justify-center">
                <button onClick={() => setStatusModal({ isOpen: false, id: null })} className="text-slate-400 hover:text-slate-100 px-4 py-2">İptal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Breeding;
