import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';
import { usePermission } from '../hooks/usePermission';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const Paddocks = () => {
    const [paddocks, setPaddocks] = useState([]);
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
    }, []);

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
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">🏠 Padok Yönetimi</h1>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
