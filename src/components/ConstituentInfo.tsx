import React, { useEffect, useState } from 'react';
import authService from '../services/authService';
import type { ConstituentInfo as ConstituentInfoType } from '../services/authService';

interface ConstituentInfoProps {
  constituentId: string | undefined;
  onQueueConstituentLoad: (constituentId: string) => void;
}

const ConstituentInfo: React.FC<ConstituentInfoProps> = React.memo(({ constituentId, onQueueConstituentLoad }) => {
  const [constituent, setConstituent] = useState<ConstituentInfoType | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load constituent when component mounts
  useEffect(() => {
    if (!constituentId) return;

    const loadConstituent = async () => {
      if (constituent) return; // Already loaded

      setIsLoading(true);
      try {
        console.log(`🔍 Loading constituent ${constituentId}`);
        const result = await authService.getConstituent(constituentId);
        setConstituent(result);
        console.log(`✅ Loaded constituent ${constituentId}:`, result);
      } catch (error) {
        console.error(`❌ Failed to load constituent ${constituentId}:`, error);
        setConstituent(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadConstituent();
  }, [constituentId, constituent]);

  if (!constituentId) {
    return <span style={{ color: "#6c757d" }}>No constituent</span>;
  }

  if (isLoading) {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            width: "12px",
            height: "12px",
            border: "2px solid #f3f3f3",
            borderTop: "2px solid #2196F3",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}
        />
        <span className="loading-placeholder" style={{ width: "150px" }}></span>
      </span>
    );
  }

  if (!constituent) {
    return <span className="loading-placeholder" style={{ width: "120px" }}></span>;
  }

  const displayName = constituent.name ||
    constituent.preferred_name ||
    `${constituent.first || ''} ${constituent.last || ''}`.trim() ||
    "Unknown Constituent";

  return (
    <>
      {displayName}
      {constituent.lookup_id && (
        <span style={{
          fontSize: "12px",
          color: "#6c757d",
          marginLeft: "8px",
          fontWeight: "normal"
        }}>
          (ID: {constituent.lookup_id})
        </span>
      )}
    </>
  );
});

export default ConstituentInfo; 