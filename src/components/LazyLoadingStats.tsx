import React, { useState, useEffect } from 'react';

interface LazyLoadingStatsProps {
  totalPdfs?: number;
  loadedPdfs?: number;
  pendingPdfs?: number;
  showDetails?: boolean;
}

const LazyLoadingStats: React.FC<LazyLoadingStatsProps> = ({
  totalPdfs = 0,
  loadedPdfs = 0,
  pendingPdfs = 0,
  showDetails = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [stats, setStats] = useState({
    totalPdfs,
    loadedPdfs,
    pendingPdfs,
    loadPercentage: totalPdfs > 0 ? Math.round((loadedPdfs / totalPdfs) * 100) : 0
  });

  useEffect(() => {
    setStats({
      totalPdfs,
      loadedPdfs,
      pendingPdfs,
      loadPercentage: totalPdfs > 0 ? Math.round((loadedPdfs / totalPdfs) * 100) : 0
    });
  }, [totalPdfs, loadedPdfs, pendingPdfs]);

  if (totalPdfs === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '12px',
      zIndex: 1000,
      cursor: 'pointer',
      transition: 'opacity 0.3s ease',
      opacity: isVisible ? 1 : 0.7
    }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ fontSize: '16px' }}>📊</div>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
            PDF Loading: {stats.loadPercentage}%
          </div>
          {showDetails && (
            <div style={{ fontSize: '10px', opacity: 0.8 }}>
              {stats.loadedPdfs} loaded / {stats.totalPdfs} total
              {stats.pendingPdfs > 0 && ` (${stats.pendingPdfs} pending)`}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: '4px',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '2px',
        marginTop: '8px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${stats.loadPercentage}%`,
          height: '100%',
          backgroundColor: stats.loadPercentage === 100 ? '#28a745' : '#007bff',
          transition: 'width 0.3s ease, background-color 0.3s ease'
        }} />
      </div>
    </div>
  );
};

export default LazyLoadingStats; 