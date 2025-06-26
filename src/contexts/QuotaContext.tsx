import React, { createContext, useContext, useState, ReactNode } from 'react';

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
    setIsQuotaExceeded(exceeded);
    setRetryAfter(retryAfterSeconds);
  };

  const clearQuotaExceeded = () => {
    setIsQuotaExceeded(false);
    setRetryAfter(undefined);
  };

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