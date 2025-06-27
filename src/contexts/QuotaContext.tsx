import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface QuotaContextType {
  isQuotaExceeded: boolean;
  retryAfter?: string;
  setQuotaExceeded: (exceeded: boolean, retryAfter?: string) => void;
  clearQuotaExceeded: () => void;
}

const QuotaContext = createContext<QuotaContextType | undefined>(undefined);

interface QuotaProviderProps {
  children: ReactNode;
}

export const QuotaProvider: React.FC<QuotaProviderProps> = ({ children }) => {
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(false);
  const [retryAfter, setRetryAfter] = useState<string | undefined>(undefined);

  const setQuotaExceeded = (exceeded: boolean, retryAfterSeconds?: string) => {
    console.log('🔔 QuotaContext: setQuotaExceeded called:', { exceeded, retryAfterSeconds });
    setIsQuotaExceeded(exceeded);
    setRetryAfter(retryAfterSeconds);
  };

  const clearQuotaExceeded = () => {
    console.log('🔔 QuotaContext: clearQuotaExceeded called');
    setIsQuotaExceeded(false);
    setRetryAfter(undefined);
  };

  // Debug logging for state changes
  useEffect(() => {
    console.log('🔔 QuotaContext: state changed:', { isQuotaExceeded, retryAfter });
  }, [isQuotaExceeded, retryAfter]);

  return (
    <QuotaContext.Provider value={{
      isQuotaExceeded,
      retryAfter,
      setQuotaExceeded,
      clearQuotaExceeded
    }}>
      {children}
    </QuotaContext.Provider>
  );
};

export const useQuota = (): QuotaContextType => {
  const context = useContext(QuotaContext);
  if (context === undefined) {
    throw new Error('useQuota must be used within a QuotaProvider');
  }
  return context;
}; 