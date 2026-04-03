import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

// Ensure axios sends cookies with all requests
axios.defaults.withCredentials = true;
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';

// Global 401 interceptor - clear storage on 401, but DO NOT redirect
axios.interceptors.response.use(
    response => response,
    async error => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            // Clear auth state from storage
            localStorage.removeItem('userRole');
            
            // Try to logout on server to clear session
            try {
                await axios.post(`${API_BASE}/api/auth/logout/`);
            } catch (e) {
                // Ignore logout errors
            }
            
            // Do NOT use window.location or window.location.reload()
            // The AuthProvider will handle state changes via checkAuthStatus or component-level error handling
            // Simply reject the error - the component that made the request can handle it
            return Promise.reject(error);
        }
        
        return Promise.reject(error);
    }
);

const AuthContext = createContext({});

export const useAuth = () => {
    return useContext(AuthContext);
};



export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || null);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);

    const checkAuthStatus = useCallback(async () => {
        try {
            // Use a simple endpoint that just checks session authentication
            const response = await axios.get(`${API_BASE}/api/settings/`);
            if (response.status === 200) {
                setIsAuthenticated(true);
                // Kullanıcı rollerini ve izinlerini çek
                try {
                    const permsResponse = await axios.get(`${API_BASE}/api/permissions/`);
                    if (permsResponse.data) {
                        setPermissions(permsResponse.data.permissions || []);
                        const role = permsResponse.data.role;
                        if (userRole !== role) {
                            setUserRole(role);
                            localStorage.setItem('userRole', role);
                        }
                    }
                } catch (e) {
                    console.error("İzinler çekilemedi:", e);
                }
            }
        } catch (error) {
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                setIsAuthenticated(false);
                setUser(null);
                setUserRole(null);
                localStorage.removeItem('userRole');
            } else {
                // Network or other errors - assume not authenticated to be safe
                setIsAuthenticated(false);
                setUser(null);
                setUserRole(null);
                setPermissions([]);
                localStorage.removeItem('userRole');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    // Uygulama başladığında oturum durumunu kontrol et
    useEffect(() => {
        checkAuthStatus();
    }, [checkAuthStatus]);

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

                // İzinleri de hemen çek
                try {
                    const permsRes = await axios.get(`${API_BASE}/api/permissions/`);
                    setPermissions(permsRes.data.permissions || []);
                } catch (e) {
                    console.error("Login sırasında izinler çekilemedi:", e);
                }

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
            setPermissions([]);
            localStorage.removeItem('userRole');
        }
    };

    const value = {
        isAuthenticated,
        user,
        userRole,
        permissions,
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