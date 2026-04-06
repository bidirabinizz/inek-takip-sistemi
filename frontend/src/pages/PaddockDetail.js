import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../config';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const PaddockDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [paddock, setPaddock] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPaddockDetail();
    }, [id]);

    const fetchPaddockDetail = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await axios.get(`${API_BASE}/api/paddocks/${id}/`, {
                withCredentials: true
            });
            setPaddock(response.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Padok detayları yüklenirken hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const handleAnimalClick = (macAddress) => {
        if (macAddress) {
            navigate('/report/' + macAddress);
        } else {
            alert('Bu hayvana atanmış bir sensör bulunmuyor.');
        }
    };

    const getCapacityPercentage = () => {
        if (!paddock || paddock.capacity <= 0) return 0;
        return Math.min((paddock.animal_count / paddock.capacity) * 100, 100);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
                    <p className="text-slate-100 font-medium">Yükleniyor...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
                <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-xl p-6">
                    <div className="text-rose-400 mb-4 text-center">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-100 text-center mb-2">Hata Oluştu</h2>
                    <p className="text-slate-300 text-center mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/paddocks')}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        Padoklar Listesine Dön
                    </button>
                </div>
            </div>
        );
    }

    if (!paddock) {
        return null;
    }

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <div className="bg-slate-800 border-b border-slate-700 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/paddocks')}
                            className="flex items-center gap-2 text-slate-300 hover:text-slate-100 font-medium transition-colors px-3 py-2 rounded-lg hover:bg-slate-700"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                            <span>Geri Dön</span>
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-100">{paddock.name}</h1>
                            <p className="text-slate-400 text-sm mt-1">{paddock.description || 'Açıklama yok'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Kapasite Bilgisi</h3>
                        <div className="flex items-end justify-between mb-4">
                            <div>
                                <span className="text-3xl font-bold text-slate-100">{paddock.animal_count}</span>
                                <span className="text-slate-400 ml-2">/ {paddock.capacity || 'Sınırsız'}</span>
                            </div>
                            <span className="text-sm font-medium text-slate-400">
                                {paddock.capacity > 0 ? `${Math.round(getCapacityPercentage())}%` : 'Sınırsız'}
                            </span>
                        </div>
                        {paddock.capacity > 0 && (
                            <div className="w-full bg-slate-700 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all duration-500 ${paddock.animal_count > paddock.capacity ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${getCapacityPercentage()}%` }}
                                ></div>
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Hayvan Listesi</h3>
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <span className="text-4xl font-bold text-indigo-400 block mb-2">{paddock.animals?.length || 0}</span>
                                <span className="text-slate-400 font-medium">Aktif Hayvan</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Animals Grid */}
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-slate-100 mb-4">Padoktaki Hayvanlar</h2>
                    {(!paddock.animals || paddock.animals.length === 0) ? (
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
                            <p className="text-slate-400">Bu padokta hayvan bulunmuyor.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {paddock.animals.map((animal) => (
                                <div
                                    key={animal.id}
                                    onClick={() => handleAnimalClick(animal.device__mac_address)}
                                    className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:bg-slate-700/50 cursor-pointer transition-all duration-200"
                                >
                                    <div className="flex flex-col items-center text-center">
                                        <div className="text-5xl mb-3">🐄</div>
                                        <div className="w-full">
                                            <p className="text-sm text-slate-400 mb-1">Küpe No</p>
                                            <p className="font-bold text-slate-100 text-lg mb-2">{animal.ear_tag}</p>
                                            {animal.name && (
                                                <>
                                                    <p className="text-sm text-slate-400 mb-1">Ad</p>
                                                    <p className="text-slate-300 font-medium mb-3">{animal.name}</p>
                                                </>
                                            )}
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
                                            <div className={`w-2.5 h-2.5 rounded-full ${animal.device__mac_address ? 'bg-emerald-500' : 'bg-slate-500'}`}></div>
                                            <span className={`text-xs font-medium ${animal.device__mac_address ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                {animal.device__mac_address ? 'Sensör Aktif' : 'Sensör Yok'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaddockDetail;
