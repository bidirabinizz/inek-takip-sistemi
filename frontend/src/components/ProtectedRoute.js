import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();
    
    if (loading) return <div className="p-10 text-center text-emerald-400">Yükleniyor...</div>;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    
    return children;
}
