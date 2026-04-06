import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginForm = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
        console.log("Giriş isteği gönderiliyor...");
        const result = await login(username, password);
        console.log("İstek sonucu:", result);

        if (result.success) {
            navigate('/', { replace: true });
        } else {
            setError(result.message);
        }
    } catch (err) {
        console.error("Login hatası:", err);
        setError("Sunucuya bağlanılamadı. Lütfen API URL'sini ve internetinizi kontrol edin.");
    } finally {
        setLoading(false); // Hata olsa da olmasa da yükleme durumunu kapat
    }
};

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
            <div className="bg-slate-800 rounded-xl shadow-lg p-6 md:p-8 w-full max-w-md border border-slate-700">
                <div className="text-center mb-6 md:mb-8">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-100 mb-2">Giriş Yap</h2>
                    <p className="text-slate-400 text-sm">Lütfen kullanıcı bilgilerinizi giriniz</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="bg-rose-900/30 border border-rose-500/50 text-rose-200 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                    
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
                            Kullanıcı Adı
                        </label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                            placeholder="Kullanıcı adınız"
                            required
                            disabled={loading}
                        />
                    </div>
                    
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                            Şifre
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                            placeholder="Şifreniz"
                            required
                            disabled={loading}
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Giriş yapılıyor...
                            </span>
                        ) : 'Giriş Yap'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginForm;
