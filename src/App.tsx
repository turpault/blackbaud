import React, { useEffect, useState, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import authService, { SessionInfo } from "./services/authService";

// Lazy load all page components
const Home = React.lazy(() => import("./components/Home"));
const Dashboard = React.lazy(() => import("./components/Dashboard"));
const Logout = React.lazy(() => import("./components/Logout"));

// Loading component for Suspense fallback
const LoadingFallback: React.FC<{ message?: string }> = ({ message = "Loading..." }) => {
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
      <p>{message}</p>
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

const App: React.FC = () => {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check authentication status on app load
    const checkAuth = async (): Promise<void> => {
      try {
        const session = await authService.checkAuthentication();
        setSessionInfo(session);
      } catch (error) {
        console.error('Failed to check authentication:', error);
        setSessionInfo({ authenticated: false });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

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
        <p>Checking authentication...</p>
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
    <div className="App">
      <Suspense fallback={<LoadingFallback message="Loading page..." />}>
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
            path="/logout" 
            element={<Logout />} 
          />
          {/* The OAuth callback is now handled by the proxy server */}
          {/* No need for a callback route in the React app */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
};

export default App;
