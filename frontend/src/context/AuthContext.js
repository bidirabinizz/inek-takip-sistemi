import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

// Ensure axios sends cookies with all requests
axios.defaults.withCredentials = true;
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';

const AuthContext = createContext({});

export const useAuth = () => {
    return useContext(AuthContext);
};



export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || null);
    const [loading, setLoading] = useState(true);

    // Uygulama başladığında oturum durumunu kontrol et
    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            // Basit bir kontrol: backend'den kullanıcı bilgisi iste
            // Not: Django session tabanlı authentication kullanıyorsak,
            // bu endpoint'i backend'de eklemek gerekebilir
            const response = await axios.get(`${API_BASE}/api/aktivite-durum/`, {
                params: { mac: 'test' } // test MAC, sadece authentication kontrolü için
            });
            // Eğer istek başarılıysa, kullanıcı giriş yapmış kabul edilir
            // Bu mantığı backend'e göre düzenleyebilirsiniz
            setIsAuthenticated(true);
        } catch (error) {
            // 401 veya 403 hatası alınırsa giriş yapılmamış kabul et
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                setIsAuthenticated(false);
            } else {
                // Diğer hatalar (network, server error) için giriş yapılmamış varsay
                setIsAuthenticated(false);
            }
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        try {
            const response = await axios.post(`${API_BASE}/api/auth/login/`, {
                username,
                password
            });
            
            if (response.data.status === 'success') {
                setIsAuthenticated(true);
                setUser(response.data.user);
                const role = response.data.user.role;
                setUserRole(role);
                localStorage.setItem('userRole', role);
                return { success: true, message: response.data.message };
            }
        } catch (error) {
            if (error.response && error.response.data) {
                return {
                    success: false,
                    message: error.response.data.error || 'Giriş başarısız'
                };
            }
            return {
                success: false,
                message: 'Bağlantı hatası, lütfen tekrar deneyin'
            };
        }
    };

    const logout = async () => {
        try {
            await axios.post(`${API_BASE}/api/auth/logout/`);
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setIsAuthenticated(false);
            setUser(null);
            setUserRole(null);
            localStorage.removeItem('userRole');
        }
    };

    const value = {
        isAuthenticated,
        user,
        userRole,
        loading,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};