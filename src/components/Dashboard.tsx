import React, { useState, useEffect, Suspense } from "react";
import { Link } from "react-router-dom";
import authService, { SessionInfo } from "../services/authService";

// Lazy load the GiftList component since it's large
const GiftList = React.lazy(() => import("./GiftList"));

// Loading component for tab content
const TabLoadingFallback: React.FC = () => {
  const loadingStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "40px",
    fontSize: "16px",
    color: "#666",
  };

  const spinnerStyle: React.CSSProperties = {
    width: "30px",
    height: "30px",
    border: "2px solid #f3f3f3",
    borderTop: "2px solid #0066cc",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: "15px",
  };

  return (
    <div style={loadingStyle}>
      <div style={spinnerStyle} />
      <p>Loading content...</p>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

interface UserInfo {
  [key: string]: any;
}

interface DashboardProps {
  sessionInfo: SessionInfo | null;
}

const Dashboard: React.FC<DashboardProps> = ({ sessionInfo }) => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("gifts");

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      // Try to get user profile - this might need adjustment based on available Blackbaud APIs
      const userData = await authService.getUserProfile();
      setUserInfo(userData);
    } catch (err: any) {
      setError("Failed to fetch user information: " + err.message);
      console.error("API Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Logout error:", error);
      // Force redirect even if logout request fails
      window.location.href = '/blackbaud/';
    }
  };

  const handleMouseOver = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const target = e.target as HTMLButtonElement;
    target.style.opacity = "0.8";
  };

  const handleMouseOut = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const target = e.target as HTMLButtonElement;
    target.style.opacity = "1";
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "20px",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: "15px",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
    backdropFilter: "blur(10px)",
  };

  const headerStyle: React.CSSProperties = {
    textAlign: "center",
    marginBottom: "30px",
    color: "#333",
  };

  const buttonStyle: React.CSSProperties = {
    background: "linear-gradient(45deg, #ff6b6b, #ee5a24)",
    border: "none",
    borderRadius: "20px",
    color: "white",
    padding: "10px 20px",
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    float: "right",
  };

  const tabStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    marginBottom: "20px",
    borderBottom: "1px solid #dee2e6",
  };

  const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: "12px 24px",
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: isActive ? "bold" : "normal",
    color: isActive ? "#0066cc" : "#666",
    borderBottom: isActive ? "3px solid #0066cc" : "3px solid transparent",
    transition: "all 0.3s ease",
  });

  const cardStyle: React.CSSProperties = {
    backgroundColor: "#f8f9fa",
    padding: "20px",
    borderRadius: "10px",
    marginTop: "20px",
    border: "1px solid #e9ecef",
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1>🎯 Welcome to Blackbaud Dashboard</h1>
        <p>You have successfully authenticated with Blackbaud!</p>
        <div style={{ float: "right", display: "flex", gap: "10px" }}>
          <Link
            to="/logout"
            style={{
              ...buttonStyle,
              textDecoration: "none",
              background: "linear-gradient(45deg, #74b9ff, #0984e3)",
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Logout Page
          </Link>
          <button
            onClick={handleLogout}
            style={buttonStyle}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
            title="Quick logout"
          >
            Quick Logout
          </button>
        </div>
        <div style={{ clear: "both" }}></div>
      </div>

      {/* Tab Navigation */}
      <div style={tabStyle}>
        <button
          style={tabButtonStyle(activeTab === "gifts")}
          onClick={() => setActiveTab("gifts")}
        >
          🎁 Gifts
        </button>
        <button
          style={tabButtonStyle(activeTab === "auth")}
          onClick={() => setActiveTab("auth")}
        >
          🔑 Authentication
        </button>
        <button
          style={tabButtonStyle(activeTab === "api")}
          onClick={() => setActiveTab("api")}
        >
          📊 API Data
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "gifts" && (
        <Suspense fallback={<TabLoadingFallback />}>
          <GiftList />
        </Suspense>
      )}

      {activeTab === "auth" && (
        <div style={cardStyle}>
          <h3>🔑 Authentication Status</h3>
          <p>
            <strong>Status:</strong>{" "}
            <span style={{ color: "green" }}>✅ Authenticated</span>
          </p>
          <p>
            <strong>Token Type:</strong>{" "}
            {sessionInfo?.tokenType || "Bearer"}
          </p>
          <p>
            <strong>Scope:</strong>{" "}
            {sessionInfo?.scope || "Not available"}
          </p>
          <p>
            <strong>Expires At:</strong>{" "}
            {sessionInfo?.expiresAt ? new Date(sessionInfo.expiresAt).toLocaleString() : "Not available"}
          </p>
          <div style={{ marginTop: "20px" }}>
            <h4>🔧 Available Actions</h4>
            <button
              onClick={fetchUserInfo}
              style={{
                ...buttonStyle,
                background: "linear-gradient(45deg, #4CAF50, #45a049)",
                float: "none",
                marginRight: "10px",
              }}
            >
              Refresh Data
            </button>
            <button
              onClick={() =>
                window.open("https://developer.blackbaud.com/skyapi/", "_blank")
              }
              style={{
                ...buttonStyle,
                background: "linear-gradient(45deg, #2196F3, #1976D2)",
                float: "none",
              }}
            >
              View API Docs
            </button>
          </div>
        </div>
      )}

      {activeTab === "api" && (
        <div style={cardStyle}>
          <h3>📊 API Data</h3>
          {loading && <p>Loading user information...</p>}
          {error && <p style={{ color: "red" }}>⚠️ {error}</p>}
          {userInfo && (
            <div>
              <p>
                <strong>API Response:</strong>
              </p>
              <pre
                style={{
                  backgroundColor: "#f1f3f4",
                  padding: "15px",
                  borderRadius: "5px",
                  overflow: "auto",
                  fontSize: "12px",
                }}
              >
                {JSON.stringify(userInfo, null, 2)}
              </pre>
            </div>
          )}
          {!loading && !error && !userInfo && (
            <p>
              No user information available. Check if the API endpoint is
              correct.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
