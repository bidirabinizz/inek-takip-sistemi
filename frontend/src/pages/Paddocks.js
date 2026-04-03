import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';
import { usePermission } from '../hooks/usePermission';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const Paddocks = () => {
    const [paddocks, setPaddocks] = useState([]);
    const [analytics, setAnalytics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Form Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
    const [selectedPaddock, setSelectedPaddock] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '', capacity: 0 });

    const canManagePaddocks = usePermission('manage_paddocks');

    useEffect(() => {
        fetchPaddocks();
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            const response = await axios.get(`${API_BASE}/api/paddock-analytics/`, {
                withCredentials: true
            });
            setAnalytics(response.data);
        } catch (err) {
            console.error('Padok analitiği yüklenemedi:', err);
        }
    };

    const fetchPaddocks = async () => {
        try {
            const response = await axios.get(`${API_BASE}/api/paddocks/`);
            setPaddocks(response.data);
            setError('');
        } catch (err) {
            setError('Padoklar yüklenirken hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setModalMode('add');
        setFormData({ name: '', description: '', capacity: 0 });
        setSelectedPaddock(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (paddock) => {
        setModalMode('edit');
        setSelectedPaddock(paddock);
        setFormData({ name: paddock.name, description: paddock.description, capacity: paddock.capacity });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (modalMode === 'add') {
                await axios.post(`${API_BASE}/api/paddocks/create/`, formData);
            } else {
                await axios.put(`${API_BASE}/api/paddocks/${selectedPaddock.id}/`, formData);
            }
            setIsModalOpen(false);
            fetchPaddocks();
        } catch (err) {
            alert(err.response?.data?.error || 'Kayıt sırasında hata oluştu');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Bu padok pasife alınacaktır. Emin misiniz?')) {
            try {
                await axios.delete(`${API_BASE}/api/paddocks/${id}/`);
                fetchPaddocks();
            } catch (err) {
                alert('Silme işlemi başarısız.');
            }
        }
    };

    if (loading) return <div className="p-8 text-white text-center">Yükleniyor...</div>;

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-white">🏠 Padok Yönetimi</h1>
                {canManagePaddocks && (
                    <button 
                        onClick={handleOpenAddModal}
                        className="bg-cyber-green hover:bg-green-500 text-black px-4 py-2 rounded-xl flex items-center gap-2 transition"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Yeni Padok
                    </button>
                )}
            </div>

            {error && <div className="bg-red-500/20 text-red-300 p-4 rounded-xl mb-4 border border-red-500/50">{error}</div>}

            {/* Padok Analitik Özeti */}
            {analytics.length > 0 && (
                <div className="mb-6 md:mb-8">
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-4">📊 Günlük Padok Analitiği</h2>
                    
                    {/* Uyarı Rozetleri */}
                    {analytics.filter(a => a.warning).length > 0 && (
                        <div className="mb-4 p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-xl">
                            <div className="flex items-center gap-2 text-yellow-300">
                                <span className="text-xl">⚠️</span>
                                <span className="font-semibold">Düşük Aktivite Uyarısı:</span>
                                <span>
                                    {analytics.filter(a => a.warning).map(a => a.paddock_name).join(', ')} padoklarında adım sayısı düşük!
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Analitik Kartları - Mobil uyumlu */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {analytics.map(a => (
                            <div key={a.paddock_id} className={`p-4 rounded-xl border ${a.warning ? 'bg-yellow-900/10 border-yellow-500/30' : 'bg-cyber-dark/80 border-cyber-green/30'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="text-lg font-bold text-cyber-green">{a.paddock_name}</h3>
                                    {a.warning && (
                                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">⚠️ Düşük Aktivite</span>
                                    )}
                                    {a.alarm_sayisi > 0 && (
                                        <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded-full">🚨 {a.alarm_sayisi} Alarm</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <div className="text-cyber-gray text-xs">Hayvan Sayısı</div>
                                        <div className="text-white font-semibold">{a.hayvan_sayisi}</div>
                                    </div>
                                    <div>
                                        <div className="text-cyber-gray text-xs">Ort. Adım</div>
                                        <div className={`font-semibold ${a.ortalama_adim < 1000 ? 'text-yellow-400' : 'text-cyber-green'}`}>{a.ortalama_adim}</div>
                                    </div>
                                    <div>
                                        <div className="text-cyber-gray text-xs">Ort. Kızgınlık</div>
                                        <div className={`font-semibold ${a.ortalama_kizginlik_skoru >= 60 ? 'text-red-400' : 'text-white'}`}>{a.ortalama_kizginlik_skoru}</div>
                                    </div>
                                    <div>
                                        <div className="text-cyber-gray text-xs">Ort. Yatma</div>
                                        <div className="text-white font-semibold">{a.ortalama_yatma_suresi} dk</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Karşılaştırma Grafiği - Mobil uyumlu */}
                    <div className="bg-cyber-dark/80 border border-cyber-green/30 rounded-2xl p-4 md:p-6">
                        <h3 className="text-lg font-bold text-white mb-4">📊 Padok Karşılaştırması (Ortalama Adım)</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={analytics} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="paddock_name" tick={{ fontSize: 11, fill: "#4a6070" }} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: "#4a6070" }} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(0,255,180,0.3)", borderRadius: 8, color: "#e0e0e0" }}
                                    labelStyle={{ color: "#00ffb4", fontWeight: 700 }}
                                />
                                <Bar dataKey="ortalama_adim" name="Ortalama Adım" radius={[4, 4, 0, 0]}>
                                    {analytics.map((entry, index) => (
                                        <cell key={`cell-${index}`} fill={entry.warning ? '#fbbf24' : '#00ffb4'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {paddocks.map(paddock => (
                    <div key={paddock.id} className="bg-cyber-dark/80 border border-cyber-green/30 rounded-2xl p-6 hover:shadow-cyber-glow transition duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold text-cyber-green">{paddock.name}</h3>
                            {canManagePaddocks && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleOpenEditModal(paddock)} className="text-cyber-lightGray hover:text-white">
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => handleDelete(paddock.id)} className="text-red-400 hover:text-red-300">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        <p className="text-sm text-cyber-gray mb-4 min-h-[40px]">
                            {paddock.description || 'Açıklama yok'}
                        </p>
                        
                        <div className="flex justify-between items-center text-sm">
                            <div className="bg-cyber-darkBlue/50 px-3 py-1 rounded-lg">
                                Mevcut: <span className={paddock.animal_count > paddock.capacity && paddock.capacity > 0 ? "text-red-400 font-bold" : "text-white"}>{paddock.animal_count}</span>
                            </div>
                            <div className="bg-cyber-darkBlue/50 px-3 py-1 rounded-lg">
                                Kapasite: <span className="text-white">{paddock.capacity || 'Sınırsız'}</span>
                            </div>
                        </div>

                        {/* Capacity bar */}
                        {paddock.capacity > 0 && (
                            <div className="w-full bg-gray-700 rounded-full h-1.5 mt-4">
                                <div 
                                    className={`h-1.5 rounded-full ${paddock.animal_count > paddock.capacity ? 'bg-red-500' : 'bg-cyber-green'}`}
                                    style={{ width: `${Math.min((paddock.animal_count / paddock.capacity) * 100, 100)}%` }}
                                ></div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-cyber-dark border border-cyber-green/30 rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-cyber-green/20">
                        <h2 className="text-2xl font-bold text-white mb-4">
                            {modalMode === 'add' ? 'Yeni Padok Ekle' : 'Padok Düzenle'}
                        </h2>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-cyber-lightGray mb-1">Padok Adı *</label>
                                <input 
                                    required
                                    type="text" 
                                    className="w-full bg-cyber-darkBlue border border-cyber-gray/30 rounded-lg p-3 text-white focus:border-cyber-green focus:outline-none"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm text-cyber-lightGray mb-1">Açıklama</label>
                                <textarea 
                                    className="w-full bg-cyber-darkBlue border border-cyber-gray/30 rounded-lg p-3 text-white focus:border-cyber-green focus:outline-none"
                                    rows="3"
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                ></textarea>
                            </div>

                            <div>
                                <label className="block text-sm text-cyber-lightGray mb-1">Kapasite (0 = Sınırsız)</label>
                                <input 
                                    type="number" 
                                    min="0"
                                    className="w-full bg-cyber-darkBlue border border-cyber-gray/30 rounded-lg p-3 text-white focus:border-cyber-green focus:outline-none"
                                    value={formData.capacity}
                                    onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value) || 0})}
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-cyber-gray/20">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-cyber-gray hover:text-white">
                                    İptal
                                </button>
                                <button type="submit" className="bg-cyber-green hover:bg-green-500 text-black px-6 py-2 rounded-xl font-medium transition">
                                    Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Paddocks;
