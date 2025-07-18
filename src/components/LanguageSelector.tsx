import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";

const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'fr-CA', name: 'Français (Québec)', flag: '🇨🇦' }
  ];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode).then(() => {
      // Force a re-render by updating localStorage
      localStorage.setItem('i18nextLng', languageCode);

      // Show a brief visual feedback
      const button = document.querySelector(`[data-lang="${languageCode}"]`) as HTMLElement;
      if (button) {
        button.style.transform = 'scale(1.1)';
        setTimeout(() => {
          button.style.transform = 'scale(1.05)';
        }, 200);
      }
    }).catch((error) => {
      console.error('Language change failed:', error);
    });
  };

  // Monitor language changes
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      // Language change handled by i18n
    };

    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '120px', // Align with tab list
    right: '20px',
    zIndex: 1000,
    display: 'flex',
    gap: '5px',
    padding: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '25px',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(10px)',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: 'transparent',
  };

  const activeButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#667eea',
    color: 'white',
    transform: 'scale(1.05)',
  };

  return (
    <div style={containerStyle}>
      {languages.map((language) => (
        <button
          key={language.code}
          data-lang={language.code}
          onClick={() => handleLanguageChange(language.code)}
          style={i18n.language === language.code ? activeButtonStyle : buttonStyle}
          title={`Switch to ${language.name}`}
        >
          <span>{language.flag}</span>
          <span>{language.code.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
};

export default LanguageSelector; 