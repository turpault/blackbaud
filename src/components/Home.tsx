import React from "react";
import LoginButton from "./LoginButton";

const Home: React.FC = () => {
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
        <h1 style={titleStyle}>🚀 Blackbaud OAuth App</h1>
        <p style={subtitleStyle}>
          Connect securely with Blackbaud's API using OAuth 2.0 authentication.
          This application demonstrates a complete OAuth flow with modern React
          practices.
        </p>

        <LoginButton />

        <div style={featureStyle}>
          <div style={featureItemStyle}>
            <h3>🔒 Secure</h3>
            <p>OAuth 2.0 with PKCE and state verification</p>
          </div>
          <div style={featureItemStyle}>
            <h3>⚡ Fast</h3>
            <p>Modern React with efficient state management</p>
          </div>
          <div style={featureItemStyle}>
            <h3>🎨 Beautiful</h3>
            <p>Clean UI with smooth animations</p>
          </div>
        </div>

        <div style={{ marginTop: "30px", fontSize: "14px", color: "#888" }}>
          <p>
            <strong>Direct API Integration:</strong>
            <br />
            🔗 Direct Blackbaud API calls
            <br />
            🔐 Client-side OAuth 2.0 flow
            <br />
            💾 Secure token storage
            <br />
            🔄 Automatic token refresh
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
