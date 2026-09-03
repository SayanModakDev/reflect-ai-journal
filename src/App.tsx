import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';

function MainApp() {
  const { user, loading } = useAuth();
  // We can track router path: '/' or '/dashboard' or '/login'
  const [currentPath, setCurrentPath] = useState<string>('dashboard');

  useEffect(() => {
    // Unauthenticated visitors trying to access /dashboard are immediately redirected to /login
    if (!loading) {
      if (!user) {
        setCurrentPath('login');
      } else {
        setCurrentPath('dashboard');
      }
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center text-stone-600">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin mb-3" />
        <span className="text-xs font-mono tracking-wider text-stone-500">Initializing secure session...</span>
      </div>
    );
  }

  if (currentPath === 'login' || !user) {
    return <LoginView onSuccess={() => setCurrentPath('dashboard')} />;
  }

  return <DashboardView />;
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
