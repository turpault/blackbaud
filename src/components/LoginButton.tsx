import React from "react";
import authService from "../services/authService";

const LoginButton: React.FC = () => {
  const handleLogin = (): void => {
    // With server-side OAuth2, we just redirect to the protected app
    // The proxy server will handle the OAuth2 flow automatically
    authService.initiateLogin();
  };

  const buttonStyle: React.CSSProperties = {
    background: "linear-gradient(45deg, #667eea, #764ba2)",
    border: "none",
    borderRadius: "25px",
    color: "white",
    padding: "15px 30px",
    fontSize: "18px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 15px 0 rgba(102, 126, 234, 0.3)",
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
  };

  const handleMouseOver = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const target = e.target as HTMLButtonElement;
    target.style.transform = "translateY(-2px)";
    target.style.boxShadow = "0 8px 25px 0 rgba(102, 126, 234, 0.4)";
  };

  const handleMouseOut = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const target = e.target as HTMLButtonElement;
    target.style.transform = "translateY(0)";
    target.style.boxShadow = "0 4px 15px 0 rgba(102, 126, 234, 0.3)";
  };

  return (
    <div style={{ textAlign: "center", margin: "20px 0" }}>
      <button
        onClick={handleLogin}
        style={buttonStyle}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        title="Login with Blackbaud OAuth2"
      >
        🔐 Login with Blackbaud
      </button>
      <p style={{ marginTop: "15px", color: "#666", fontSize: "14px" }}>
        Click to authenticate with your Blackbaud account
        <br />
        <small>Secure OAuth2 authentication via proxy server</small>
      </p>
    </div>
  );
};

export default LoginButton;
