import React, { useEffect, useState, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import authService from "./services/authService";
import { SessionInfo } from "./types/auth";
import LanguageSelector from "./components/LanguageSelector";
import { QuotaProvider, useQuota } from "./contexts/QuotaContext";
import QuotaNotification from "./components/QuotaNotification";

// Lazy load all page components
const Home = React.lazy(() => import("./components/Home"));
const Dashboard = React.lazy(() => import("./components/Dashboard"));
const Logout = React.lazy(() => import("./components/Logout"));

// Loading component for Suspense fallback
const LoadingFallback: React.FC<{ message?: string }> = ({ message }) => {
  const { t } = useTranslation();
  const loadingContainerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "200px",
    fontSize: "16px",
    color: "#666",
  };

  const spinnerStyle: React.CSSProperties = {
    width: "40px",
    height: "40px",
    border: "3px solid #f3f3f3",
    borderTop: "3px solid #2196F3",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: "15px",
  };

  return (
    <div style={loadingContainerStyle}>
      <div style={spinnerStyle} />
      <p>{message || t('common.loading')}</p>
      <style>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

// App content wrapper with quota notification
const AppContent: React.FC = () => {
  const { t } = useTranslation();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { isQuotaExceeded, retryAfter, clearQuotaExceeded, setQuotaExceeded } = useQuota();

  useEffect(() => {
    // Connect quota context to authService
    (window as any).__quotaContext = {
      setQuotaExceeded,
      clearQuotaExceeded
    };

    // Check authentication status on app load
    const checkAuth = async (): Promise<void> => {
      try {
        const session = await authService.checkAuthentication();
        setSessionInfo(session);

        // If user is authenticated, check for saved state to restore
        if (session.authenticated) {
          // Small delay to ensure app is fully loaded before restoring state
          setTimeout(() => {
            authService.restoreStateAfterAuth();
          }, 100);
        }
      } catch (error) {
        console.error('Failed to check authentication:', error);
        setSessionInfo({ authenticated: false });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Cleanup on unmount
    return () => {
      delete (window as any).__quotaContext;
    };
  }, [setQuotaExceeded, clearQuotaExceeded]);

  // Show loading spinner while checking authentication
  if (loading) {
    const loadingContainerStyle: React.CSSProperties = {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      fontSize: "18px",
    };

    const spinnerStyle: React.CSSProperties = {
      width: "50px",
      height: "50px",
      border: "3px solid #f3f3f3",
      borderTop: "3px solid #2196F3",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
      marginBottom: "20px",
    };

    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <p>{t('common.checkingAuth')}</p>
        <style>{`
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  const isAuthenticated = sessionInfo?.authenticated ?? false;

  return (
    <>
      <LanguageSelector />
      <Suspense fallback={<LoadingFallback message={t('common.loadingContent')} />}>
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Home />
            }
          />
          <Route
            path="/dashboard"
            element={
              isAuthenticated ? (
                <Dashboard sessionInfo={sessionInfo} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/dashboard/:tab"
            element={
              isAuthenticated ? (
                <Dashboard sessionInfo={sessionInfo} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/logout"
            element={<Logout />}
          />
          {/* OAuth callback is handled by the proxy server */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {/* Global Quota Notification */}
      <QuotaNotification
        isVisible={isQuotaExceeded}
        retryAfter={retryAfter}
        onDismiss={clearQuotaExceeded}
      />
    </>
  );
};

const App: React.FC = () => {
  return (
    <QuotaProvider>
      <div className="App">
        <AppContent />
      </div>
    </QuotaProvider>
  );
};

export default App;
