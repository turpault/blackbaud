import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import authService from "../services/authService";

const Logout: React.FC = () => {
  const [logoutStatus, setLogoutStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    performLogout();
  }, []);

  const performLogout = async (): Promise<void> => {
    try {
      await authService.logout();
      setLogoutStatus("success");
      
      // Redirect to home after a short delay
      setTimeout(() => {
        window.location.href = '/blackbaud/';
      }, 2000);
    } catch (error: any) {
      console.error('Logout error:', error);
      setLogoutStatus("error");
      setErrorMessage(error.message || "Failed to logout properly");
      
      // Still redirect after error, but with longer delay
      setTimeout(() => {
        window.location.href = '/blackbaud/';
      }, 3000);
    }
  };

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    padding: "20px",
    backgroundColor: "#f5f5f5",
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: "white",
    padding: "40px",
    borderRadius: "15px",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.1)",
    textAlign: "center",
    maxWidth: "500px",
    width: "100%",
  };

  const spinnerStyle: React.CSSProperties = {
    width: "40px",
    height: "40px",
    border: "4px solid #f3f3f3",
    borderTop: "4px solid #667eea",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "20px auto",
  };

  const buttonStyle: React.CSSProperties = {
    background: "linear-gradient(45deg, #667eea, #764ba2)",
    border: "none",
    borderRadius: "25px",
    color: "white",
    padding: "12px 24px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "all 0.3s ease",
    textDecoration: "none",
    display: "inline-block",
    marginTop: "20px",
  };

  const renderContent = () => {
    switch (logoutStatus) {
      case "processing":
        return (
          <>
            <h2 style={{ color: "#333", marginBottom: "20px" }}>🔄 Logging Out</h2>
            <div style={spinnerStyle} />
            <p style={{ color: "#666" }}>Please wait while we log you out securely...</p>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </>
        );

      case "success":
        return (
          <>
            <h2 style={{ color: "#4CAF50", marginBottom: "20px" }}>✅ Logout Successful</h2>
            <p style={{ color: "#666", marginBottom: "20px" }}>
              You have been successfully logged out of your Blackbaud account.
            </p>
            <p style={{ color: "#999", fontSize: "14px" }}>
              Redirecting to home page in a moment...
            </p>
          </>
        );

      case "error":
        return (
          <>
            <h2 style={{ color: "#f44336", marginBottom: "20px" }}>⚠️ Logout Issue</h2>
            <p style={{ color: "#666", marginBottom: "10px" }}>
              There was an issue during logout, but you've been logged out locally.
            </p>
            {errorMessage && (
              <p style={{ color: "#f44336", fontSize: "14px", marginBottom: "20px" }}>
                {errorMessage}
              </p>
            )}
            <p style={{ color: "#999", fontSize: "14px" }}>
              Redirecting to home page...
            </p>
            <Link to="/" style={buttonStyle}>
              Go to Home Page
            </Link>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {renderContent()}
      </div>
    </div>
  );
};

export default Logout; 