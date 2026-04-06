import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppContext, AppProvider } from './context/AppContext';
import { useAuth, AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import DevicesView from './pages/Devices';
import DeviceReport from './pages/DeviceReport';
import LoginForm from './components/LoginForm';
import Settings from './pages/Settings';
import Animals from './pages/Animals';
import Users from './pages/Users';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Paddocks from './pages/Paddocks';
import Breeding from './pages/Breeding';

function AppContent() {
  const { theme } = useAppContext(); 
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
        <div className="text-white text-xl">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''} min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-mono`}>
      <div className="app-container">
        {isAuthenticated && <Navbar />}
        <main className="pt-2">
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute requiredPermission="view_dashboard">
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/devices"
              element={
                <ProtectedRoute requiredPermission="view_devices">
                  <DevicesView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/report/:mac"
              element={
                <ProtectedRoute requiredPermission="view_reports">
                  <DeviceReport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/animals"
              element={
                <ProtectedRoute requiredPermission="view_animals">
                  <Animals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/paddocks"
              element={
                <ProtectedRoute requiredPermission="view_paddocks">
                  <Paddocks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/breeding"
              element={
                <ProtectedRoute requiredPermission="view_breeding">
                  <Breeding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute requiredPermission="manage_settings">
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute requiredPermission="manage_users">
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="/login"
              element={isAuthenticated ? <Navigate to="/" replace /> : <LoginForm />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppProvider>
        <AuthProvider>
          <AppContent /> 
        </AuthProvider>
      </AppProvider>
    </Router>
  );
}