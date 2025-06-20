import React from "react";
import { useTranslation } from "react-i18next";
import LoginButton from "./LoginButton";

const Home: React.FC = () => {
  const { t } = useTranslation();
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    padding: "20px",
    textAlign: "center",
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: "50px",
    borderRadius: "20px",
    boxShadow: "0 15px 35px rgba(0, 0, 0, 0.2)",
    backdropFilter: "blur(10px)",
    maxWidth: "600px",
    width: "100%",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "3rem",
    fontWeight: "bold",
    marginBottom: "20px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: "1.2rem",
    color: "#666",
    marginBottom: "40px",
    lineHeight: "1.6",
  };

  const featureStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-around",
    marginTop: "40px",
    flexWrap: "wrap",
    gap: "20px",
  };

  const featureItemStyle: React.CSSProperties = {
    flex: "1",
    minWidth: "150px",
    padding: "20px",
    backgroundColor: "#f8f9fa",
    borderRadius: "10px",
    border: "1px solid #e9ecef",
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>{t('home.title')}</h1>
        <p style={subtitleStyle}>
          {t('home.subtitle')}
        </p>

        <LoginButton />

        <div style={featureStyle}>
          <div style={featureItemStyle}>
            <h3>{t('home.features.secure.title')}</h3>
            <p>{t('home.features.secure.description')}</p>
          </div>
          <div style={featureItemStyle}>
            <h3>{t('home.features.fast.title')}</h3>
            <p>{t('home.features.fast.description')}</p>
          </div>
          <div style={featureItemStyle}>
            <h3>{t('home.features.beautiful.title')}</h3>
            <p>{t('home.features.beautiful.description')}</p>
          </div>
        </div>

        <div style={{ marginTop: "30px", fontSize: "14px", color: "#888" }}>
          <p>
            <strong>{t('home.integration.title')}</strong>
            <br />
            {t('home.integration.directApi')}
            <br />
            {t('home.integration.clientOauth')}
            <br />
            {t('home.integration.secureStorage')}
            <br />
            {t('home.integration.autoRefresh')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
