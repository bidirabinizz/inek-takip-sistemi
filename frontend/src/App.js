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
import PaddockDetail from './pages/PaddockDetail';
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
    <div className={`${theme === 'dark' ? 'dark' : ''} min-h-screen bg-slate-900 text-slate-100 font-sans`}>
      <div className="flex">
        {isAuthenticated && <Navbar />}
        <main className="flex-1 md:ml-64 p-4 md:p-6 min-h-screen">
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
              path="/paddocks/:id"
              element={
                <ProtectedRoute requiredPermission="view_paddocks">
                  <PaddockDetail />
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