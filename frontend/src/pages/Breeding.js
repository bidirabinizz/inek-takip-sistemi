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
      case 'SUCCESS': return 'text-green-400 bg-green-400/10 border-green-500/20';
      case 'FAILED': return 'text-red-400 bg-red-400/10 border-red-500/20';
      case 'CANCELLED': return 'text-gray-400 bg-gray-400/10 border-gray-500/20';
      default: return 'text-yellow-400 bg-yellow-400/10 border-yellow-500/20';
    }
  };

  if (loading) return <div className="p-8 text-white text-center flex justify-center items-center h-full"><div className="w-12 h-12 border-t-2 border-cyber-green rounded-full animate-spin"></div></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="text-4xl text-cyber-green">🧬</span>
            Tohumlama & Gebelik Takip
          </h1>
          <p className="text-cyber-gray mt-2">İneklerin dölleme işlemleri ve gebelik 21/28 gün döngüsü</p>
        </div>
        {hasAccess && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-gradient-to-r from-cyber-green to-green-500 hover:to-green-400 text-black px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-cyber-green/20 transition-all hover:scale-105"
          >
            <PlusIcon className="w-5 h-5" />
            Yeni Kayıt Gir
          </button>
        )}
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-cyber-darkBlue border border-yellow-500/30 rounded-2xl p-5 flex items-center gap-4">
            <div className="bg-yellow-500/20 p-3 rounded-xl text-yellow-400"><CalendarDaysIcon className="w-8 h-8" /></div>
            <div><p className="text-cyber-gray text-sm">Sonuç Bekleyen</p><p className="text-2xl font-bold text-white">{summary.pending}</p></div>
          </div>
          <div className="bg-cyber-darkBlue border border-green-500/30 rounded-2xl p-5 flex items-center gap-4">
            <div className="bg-green-500/20 p-3 rounded-xl text-green-400"><ChartBarIcon className="w-8 h-8" /></div>
            <div><p className="text-cyber-gray text-sm">Bu Ay Gebe Kalan</p><p className="text-2xl font-bold text-white">{summary.success_this_month}</p></div>
          </div>
          <div className="bg-cyber-darkBlue border border-red-500/30 rounded-2xl p-5 flex items-center gap-4">
            <div className="bg-red-500/20 p-3 rounded-xl text-red-400"><ChartBarIcon className="w-8 h-8" /></div>
            <div><p className="text-cyber-gray text-sm">Bu Ay Tutmayan</p><p className="text-2xl font-bold text-white">{summary.failed_this_month}</p></div>
          </div>
          <div className="bg-cyber-darkBlue border border-cyan-500/30 rounded-2xl p-5 flex items-center gap-4">
            <div className="bg-cyan-500/20 p-3 rounded-xl text-cyan-400"><EyeIcon className="w-8 h-8" /></div>
            <div><p className="text-cyber-gray text-sm">Yaklaşan Kontrol</p><p className="text-2xl font-bold text-white">{summary.upcoming_checks}</p></div>
          </div>
        </div>
      )}

      {/* List Table */}
      <div className="bg-cyber-dark/80 backdrop-blur-sm border border-cyber-green/20 rounded-2xl overflow-hidden shadow-xl">
        {/* Desktop Table */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-sm text-cyber-lightGray">
            <thead className="bg-cyber-darkBlue/80 text-cyber-green uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Hayvan</th>
                <th className="px-6 py-4">İşlem Tarihi</th>
                <th className="px-6 py-4 text-center">Kaçıncı Gün</th>
                <th className="px-6 py-4 text-center">Durum</th>
                <th className="px-6 py-4 text-center">Tahmini Hedef</th>
                <th className="px-6 py-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-gray/10">
              {inseminations.map((ins) => (
                <tr key={ins.id} className="hover:bg-cyber-darkBlue/40 transition-colors">
                  <td className="px-6 py-4 font-medium text-white flex flex-col">
                    <span>{ins.animal.name || 'İsimsiz'}</span>
                    <span className="text-xs text-cyber-gray">{ins.animal.ear_tag}</span>
                  </td>
                  <td className="px-6 py-4">{new Date(ins.insemination_date).toLocaleDateString('tr-TR')}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-block px-3 py-1 bg-cyber-dark rounded-lg border border-cyber-gray/20 font-mono">{ins.days_since} GÜN</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1.5 rounded-lg border text-xs font-bold tracking-wide ${getStatusColor(ins.status)}`}>{ins.status_display}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {ins.status === 'SUCCESS' ? (
                      <div className="text-green-300">
                        <p className="text-xs text-cyber-gray">Tahmini Doğum</p>
                        {new Date(ins.expected_calving_date).toLocaleDateString('tr-TR')}
                      </div>
                    ) : ins.status === 'PENDING' ? (
                      <div className="text-cyan-300">
                        <p className="text-xs text-cyber-gray">Ultrason (28. Gün)</p>
                        {new Date(ins.pregnancy_check_date).toLocaleDateString('tr-TR')}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {(userRole === 'ADMIN' || canManageBreeding) && ins.status === 'PENDING' && (
                      <button onClick={() => setStatusModal({ isOpen: true, id: ins.id })} className="bg-cyber-dark border border-cyber-green text-cyber-green hover:bg-cyber-green hover:text-black px-4 py-1.5 rounded-lg text-xs font-bold transition-all">Sonuç Bildir</button>
                    )}
                  </td>
                </tr>
              ))}
              {inseminations.length === 0 && (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-cyber-gray">Henüz dölleme kaydı bulunmuyor.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Mobile Card View */}
        <div className="md:hidden p-4 space-y-4">
          {inseminations.map((ins) => (
            <div key={ins.id} className="bg-cyber-darkBlue/40 border border-cyber-gray/20 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-white font-semibold">{ins.animal.name || 'İsimsiz'}</p>
                  <p className="text-xs text-cyber-gray">{ins.animal.ear_tag}</p>
                </div>
                <span className={`px-3 py-1 rounded-lg border text-xs font-bold ${getStatusColor(ins.status)}`}>{ins.status_display}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-cyber-gray text-xs">İşlem Tarihi</p>
                  <p className="text-white">{new Date(ins.insemination_date).toLocaleDateString('tr-TR')}</p>
                </div>
                <div>
                  <p className="text-cyber-gray text-xs">Kaçıncı Gün</p>
                  <p className="text-white font-mono">{ins.days_since} GÜN</p>
                </div>
                <div>
                  <p className="text-cyber-gray text-xs">Tahmini Hedef</p>
                  <p className="text-white">{ins.status === 'SUCCESS' ? new Date(ins.expected_calving_date).toLocaleDateString('tr-TR') : ins.status === 'PENDING' ? new Date(ins.pregnancy_check_date).toLocaleDateString('tr-TR') : '-'}</p>
                </div>
              </div>
              {(userRole === 'ADMIN' || canManageBreeding) && ins.status === 'PENDING' && (
                <button onClick={() => setStatusModal({ isOpen: true, id: ins.id })} className="w-full bg-cyber-dark border border-cyber-green text-cyber-green hover:bg-cyber-green hover:text-black py-2 rounded-lg text-sm font-bold transition-all">Sonuç Bildir</button>
              )}
            </div>
          ))}
          {inseminations.length === 0 && (
            <div className="text-center text-cyber-gray py-8">Henüz dölleme kaydı bulunmuyor.</div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-cyber-dark border border-cyber-green/30 rounded-2xl p-4 md:p-8 w-[95%] max-w-lg shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 border-b border-cyber-gray/20 pb-3">Yeni Tohumlama Kaydı</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-cyber-lightGray mb-1">Hayvan Seçin *</label>
                <select required className="w-full bg-cyber-darkBlue border border-cyber-gray/30 rounded-lg p-3 text-white focus:border-cyber-green focus:outline-none" value={formData.animal_id} onChange={e => setFormData({ ...formData, animal_id: e.target.value })}>
                  <option value="">Seçiniz...</option>
                  {animals.map(a => <option key={a.id} value={a.id}>{a.ear_tag} - {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-cyber-lightGray mb-1">Tohumlama Tarihi *</label>
                <input required type="date" className="w-full bg-cyber-darkBlue border border-cyber-gray/30 rounded-lg p-3 text-white focus:border-cyber-green focus:outline-none" value={formData.insemination_date} onChange={e => setFormData({ ...formData, insemination_date: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-cyber-lightGray mb-1">Boğa / Semen Kodu</label>
                  <input type="text" className="w-full bg-cyber-darkBlue border border-cyber-gray/30 rounded-lg p-3 text-white focus:border-cyber-green focus:outline-none" value={formData.bull_info} onChange={e => setFormData({ ...formData, bull_info: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm text-cyber-lightGray mb-1">Suni Tohumlayıcı (Vet)</label>
                  <input type="text" className="w-full bg-cyber-darkBlue border border-cyber-gray/30 rounded-lg p-3 text-white focus:border-cyber-green focus:outline-none" value={formData.technician} onChange={e => setFormData({ ...formData, technician: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm text-cyber-lightGray mb-1">Özel Notlar</label>
                <textarea className="w-full bg-cyber-darkBlue border border-cyber-gray/30 rounded-lg p-3 text-white focus:border-cyber-green focus:outline-none" rows="2" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-cyber-gray hover:text-white">İptal</button>
                <button type="submit" className="bg-cyber-green hover:bg-green-500 text-black px-6 py-2 rounded-xl font-bold transition">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {statusModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-cyber-dark border border-cyber-green/30 rounded-2xl p-4 md:p-6 w-[95%] max-w-sm shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6 text-center">Gebelik Sonucu Bildir</h2>
            <p className="text-cyber-gray text-center text-sm mb-6">Ultrason kontrolü sonrası gebelik durumunu belirleyin.</p>
            <div className="flex flex-col gap-4">
              <button onClick={() => handleUpdateStatus('SUCCESS', 'Ultrason ile gebelik doğrulandı.')} className="w-full flex items-center justify-center gap-3 bg-green-500/20 hover:bg-green-500/40 text-green-400 border border-green-500/50 p-4 rounded-xl font-bold text-lg transition">✅ TUTTU (Gebe)</button>
              <button onClick={() => handleUpdateStatus('FAILED', 'Gebelik oluşmadı, tekrar kızgınlık takibinde.')} className="w-full flex items-center justify-center gap-3 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/50 p-4 rounded-xl font-bold text-lg transition">❌ TUTMADI (Boş)</button>
              <div className="border-t border-cyber-gray/20 mt-4 pt-4 flex justify-center">
                <button onClick={() => setStatusModal({ isOpen: false, id: null })} className="text-cyber-gray hover:text-white px-4 py-2">İptal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Breeding;
