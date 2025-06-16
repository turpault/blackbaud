import React, { useState, useEffect, Suspense } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import authService, { SessionInfo } from "../services/authService";

// Lazy load the GiftList component since it's large
const GiftList = React.lazy(() => import("./GiftList"));
const CacheStatistics = React.lazy(() => import("./CacheStatistics"));
const Lists = React.lazy(() => import("./Lists"));
const Queries = React.lazy(() => import("./Queries"));

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

interface DashboardProps {
  sessionInfo: SessionInfo | null;
}

const Dashboard: React.FC<DashboardProps> = ({ sessionInfo }) => {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>(tab || "gifts");

  const tabs = [
    { id: "gifts", label: "Gifts", icon: "🎁" },
    { id: "cache-stats", label: "Cache Statistics", icon: "📊" },
    { id: "lists", label: "Lists", icon: "📝" },
    { id: "queries", label: "Queries", icon: "🔍" },
    { id: "profile", label: "Profile", icon: "👤" },
  ];

  // Sync activeTab with URL parameter
  useEffect(() => {
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    } else if (!tab && activeTab !== "gifts") {
      // If no tab in URL, default to gifts
      navigate("/dashboard/gifts", { replace: true });
    }
  }, [tab, activeTab, navigate]);

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

  const tabContainerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    marginBottom: "20px",
    borderBottom: "1px solid #dee2e6",
  };

  const tabStyle: React.CSSProperties = {
    padding: "12px 24px",
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "normal",
    color: "#666",
    borderBottom: "3px solid transparent",
    transition: "all 0.3s ease",
  };

  const activeTabStyle: React.CSSProperties = {
    borderBottom: "3px solid #0066cc",
  };

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
        <h1>🎯 Raiser's Edge NXT Dashboard</h1>
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
      <div style={tabContainerStyle}>
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => {
              setActiveTab(tabItem.id);
              navigate(`/dashboard/${tabItem.id}`, { replace: true });
            }}
            style={{
              ...tabStyle,
              ...(activeTab === tabItem.id ? activeTabStyle : {}),
            }}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
          >
            {tabItem.icon} {tabItem.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ marginTop: "20px" }}>
        <Suspense fallback={<TabLoadingFallback />}>
          {activeTab === "gifts" && <GiftList />}
          {activeTab === "cache-stats" && <CacheStatistics />}
          {activeTab === "lists" && <Lists />}
          {activeTab === "queries" && <Queries />}
          {activeTab === "profile" && (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <h3>👤 Profile Information</h3>
              <p>Profile information is not available.</p>
            </div>
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default Dashboard;
