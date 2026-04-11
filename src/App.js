import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { PositionsProvider } from './context/PositionsContext';
import AuthPage from './pages/AuthPage';
import PositionsPage from './pages/PositionsPage';
import PositionDetail from './pages/PositionDetail';
import './App.css';

function AppRoutes() {
  const { user, loading } = useAuth();
  const [selectedPositionId, setSelectedPositionId] = useState(null);

  React.useEffect(() => {
    if (user?.user_metadata) {
      const company = user.user_metadata.company_name || 'VALVO';
      const logo = user.user_metadata.company_logo;
      document.title = `${company} | Trader Terminal`;
      
      const favicon = document.getElementById('favicon');
      if (favicon && logo) favicon.href = logo;
    }
  }, [user]);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner large" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <PositionsProvider>
      {selectedPositionId ? (
        <PositionDetail
          positionId={selectedPositionId}
          onBack={() => setSelectedPositionId(null)}
        />
      ) : (
        <PositionsPage onSelectPosition={setSelectedPositionId} />
      )}
    </PositionsProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
