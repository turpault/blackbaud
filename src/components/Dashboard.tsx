import React, { useState, useEffect, Suspense } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import authService from "../services/authService";
import { SessionInfo } from "../types/auth";
import LanguageSelector from "./LanguageSelector";

// Lazy load the GiftList component since it's large
const GiftList = React.lazy(() => import("./GiftList"));
const CacheStatistics = React.lazy(() => import("./CacheStatistics"));
const Lists = React.lazy(() => import("./Lists"));
const Queries = React.lazy(() => import("./Queries"));

// Loading component for tab content
const TabLoadingFallback: React.FC = () => {
  const { t } = useTranslation();
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
      <p>{t('common.loadingContent')}</p>
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
  const { t } = useTranslation();
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>(tab || "lists");

  const tabs = [
    { id: "lists", label: t('dashboard.tabs.lists'), icon: "📝" },
    { id: "gifts", label: t('dashboard.tabs.gifts'), icon: "🎁" },
    { id: "queries", label: t('dashboard.tabs.queries'), icon: "🔍" },
    { id: "profile", label: t('dashboard.tabs.profile'), icon: "👤" },
    { id: "cache-stats", label: t('dashboard.tabs.cacheStats'), icon: "📊" },
  ];

  // Sync activeTab with URL parameter
  useEffect(() => {
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    } else if (!tab && activeTab !== "lists") {
      // If no tab in URL, default to lists
      navigate("/dashboard/lists", { replace: true });
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

  const handleMouseOver = (e: React.MouseEvent<HTMLElement>): void => {
    const target = e.target as HTMLElement;
    target.style.opacity = "0.8";
  };

  const handleMouseOut = (e: React.MouseEvent<HTMLElement>): void => {
    const target = e.target as HTMLElement;
    target.style.opacity = "1";
  };

  const containerStyle: React.CSSProperties = {
    margin: "0 auto",
    padding: "20px",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: "15px",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
    backdropFilter: "blur(10px)",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    color: "#333",
    paddingBottom: "15px",
    borderBottom: "1px solid #dee2e6",
  };

  const titleSectionStyle: React.CSSProperties = {
    flex: 1,
  };

  const buttonStyle: React.CSSProperties = {
    background: "linear-gradient(45deg, #ff6b6b, #ee5a24)",
    border: "none",
    borderRadius: "15px",
    color: "white",
    padding: "8px 16px",
    fontSize: "12px",
    cursor: "pointer",
    transition: "all 0.3s ease",
  };

  const logoutButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: "linear-gradient(45deg, #74b9ff, #0984e3)",
    marginRight: "8px",
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

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={titleSectionStyle}>
          <h1 style={{ margin: "0 0 4px 0", fontSize: "24px" }}>{t('dashboard.title')}</h1>
          <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>{t('dashboard.subtitle')}</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {/* Language Selector */}
          <div style={{
            display: 'flex',
            gap: '3px',
            padding: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '12px',
            border: '1px solid #dee2e6'
          }}>
            {[
              { code: 'en', name: 'English', flag: '🇺🇸' },
              { code: 'fr', name: 'Français', flag: '🇫🇷' },
              { code: 'fr-CA', name: 'Français (Québec)', flag: '🇨🇦' }
            ].map((language) => (
              <button
                key={language.code}
                onClick={() => {
                  const { i18n } = require('react-i18next');
                  i18n.changeLanguage(language.code);
                }}
                style={{
                  padding: '4px 8px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  backgroundColor: 'transparent',
                  color: '#666',
                  ...(language.code === 'en' ? { backgroundColor: '#667eea', color: 'white' } : {})
                }}
                title={`Switch to ${language.name}`}
              >
                {language.flag}
              </button>
            ))}
          </div>

          <Link
            to="/logout"
            style={logoutButtonStyle}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
          >
            {t('dashboard.logoutPage')}
          </Link>
          <button
            onClick={handleLogout}
            style={buttonStyle}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
            title={t('dashboard.quickLogoutTitle')}
          >
            {t('dashboard.quickLogout')}
          </button>
        </div>
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
              <h3>{t('dashboard.profile.title')}</h3>
              <p>{t('dashboard.profile.notAvailable')}</p>
            </div>
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default Dashboard;
