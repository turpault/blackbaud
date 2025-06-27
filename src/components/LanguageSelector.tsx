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
    console.log('LanguageSelector: Changing language to:', languageCode);
    console.log('LanguageSelector: Current language before change:', i18n.language);

    // Force the language change
    i18n.changeLanguage(languageCode).then(() => {
      console.log('LanguageSelector: Language change completed successfully');
      console.log('LanguageSelector: New language:', i18n.language);

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
      console.error('LanguageSelector: Language change failed:', error);
    });
  };

  // Monitor language changes
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      console.log('LanguageSelector: Language changed to:', lng);
    };

    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  console.log('LanguageSelector: Current language:', i18n.language);
  console.log('LanguageSelector: Available languages:', i18n.languages);
  console.log('LanguageSelector: Is initialized:', i18n.isInitialized);

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: '20px',
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
      {/* Debug info */}
      <div style={{
        position: 'absolute',
        top: '50px',
        right: '0',
        backgroundColor: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '5px',
        fontSize: '10px',
        borderRadius: '4px',
        display: 'none' // Set to 'block' for debugging
      }}>
        Current: {i18n.language}<br />
        Initialized: {i18n.isInitialized ? 'Yes' : 'No'}<br />
        Available: {i18n.languages?.join(', ')}<br />
        Test: {i18n.t('common.loading')}
      </div>
    </div>
  );
};

export default LanguageSelector; 